import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image } from "react-native";
import { recognizeReceiptImage } from "../ocr";
import { parseReceiptLines } from "../receiptParser";
import { buildOcrFeedbackPayload, feedbackFingerprint, sendOcrFeedback } from "../services/ocrFeedbackApi";
import {
  filterExcludedProductNames,
  normalizeProductName,
  resolveProductClassifications,
  setProductExclusion,
  sendProductClassificationFeedback
} from "../services/productClassificationApi";
import { extractCommerceProductImages } from "../utils/commerceImageExtractor";
import { daysUntil, todayIso } from "../utils/date";
import { suggestedExpiryDate } from "../utils/expiryPresets";
import { chooseItemImage } from "../utils/itemImagePicker";
import { buildOcrCoordinateOptions, chooseBestOcrCoordinateOption, draftNameForOcrLine, frameForBox, getImageDisplaySize, isOcrLineInDrafts } from "../utils/receiptOverlay";
import { detectReceiptAiTextLineBoxes } from "../utils/receiptAiTextDetector";
import { normalizeReceiptImageForOcr } from "../utils/receiptImageNormalizer";
import { alignOcrLinesWithDetectedBoxes, detectReceiptTextLineBoxes, groupDetectedBoxesIntoRows } from "../utils/receiptTextLineDetector";
import { calibrateOcrLineBoxes } from "../utils/ocrBoxCalibrator";

export const DEFAULT_FEEDBACK_SETTINGS = { enabled: true };
const DEBUG_LOG = true;

function debugHighlightOcr(payload) {
  if (!DEBUG_LOG) return;
  console.log("[freshkeeper:highlight-ocr]", payload);
}

export function normalizeFeedbackSettings(value) {
  return { ...DEFAULT_FEEDBACK_SETTINGS, ...(value || {}) };
}

function guessGalleryImageKind(asset) {
  const fileName = String(asset?.fileName || asset?.uri || "").toLowerCase();
  const width = Number(asset?.width || 0);
  const height = Number(asset?.height || 0);
  const longer = Math.max(width, height);
  const shorter = Math.max(1, Math.min(width || longer, height || longer));
  const aspect = longer / shorter;

  if (/screenshot|screen_shot|스크린샷|캡처|capture/.test(fileName)) return "screen";
  if (aspect >= 2.05 && longer <= 3200) return "screen";
  if (longer >= 1800 && aspect < 1.95) return "paper";
  return "unknown";
}

function inferReceiptImageKind(imageAsset, sourceType, options, displaySize) {
  if (options?.physicalReceipt || options?.fromCamera) return "paper";
  if (sourceType === "coupang") return "screen";
  const guessedKind = guessGalleryImageKind({
    ...(typeof imageAsset === "object" ? imageAsset : {}),
    width: displaySize?.width,
    height: displaySize?.height
  });
  return guessedKind === "paper" ? "paper" : "screen";
}

export function useReceiptFlow({
  appVersion,
  defaultExpiryType,
  suggestCategory,
  addItem,
  setItems,
  setMode,
  goToPage,
  addPage = 0,
  inventoryPage = 1,
  setLatestRegisteredId,
  setTotalHighlighted
}) {
  const [receiptSourceType, setReceiptSourceType] = useState("receipt");
  const [receiptInteractionMode, setReceiptInteractionMode] = useState("box");
  const [receiptSelectorMode, setReceiptSelectorMode] = useState("box");
  const [receiptImage, setReceiptImage] = useState("");
  const [receiptImageSize, setReceiptImageSize] = useState({ width: 0, height: 0 });
  const [ocrCoordinateSize, setOcrCoordinateSize] = useState(null);
  const [ocrCoordinateOptions, setOcrCoordinateOptions] = useState([]);
  const [ocrCoordinateModeIndex, setOcrCoordinateModeIndex] = useState(0);
  const [receiptImageLayout, setReceiptImageLayout] = useState({ width: 0, height: 0 });
  const [ocrLines, setOcrLines] = useState([]);
  const [commerceCropBoxes, setCommerceCropBoxes] = useState([]);
  const [selectedOcrLineIds, setSelectedOcrLineIds] = useState([]);
  const [highlightMarks, setHighlightMarks] = useState([]);
  const [receiptSelectorVisible, setReceiptSelectorVisible] = useState(false);
  const [receiptImageTypeChooserVisible, setReceiptImageTypeChooserVisible] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [initialDrafts, setInitialDrafts] = useState([]);
  const [excludedDrafts, setExcludedDrafts] = useState([]);
  const [draftForms, setDraftForms] = useState({});
  const [bulkDraftForm, setBulkDraftForm] = useState({ expiry: suggestedExpiryDate("", "기타", "냉장") });
  const [receiptStatus, setReceiptStatus] = useState("영수증을 촬영하거나 주문내역 캡처를 불러오면 상품 후보를 자동으로 만듭니다.");
  const [feedbackSettings, setFeedbackSettings] = useState(DEFAULT_FEEDBACK_SETTINGS);
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [feedbackUploadKey, setFeedbackUploadKey] = useState("");
  const feedbackUploadInFlightRef = useRef(false);
  const classificationRequestRef = useRef(0);

  const activeOcrCoordinateSize = useMemo(() => {
    return ocrCoordinateOptions[ocrCoordinateModeIndex]?.size || ocrCoordinateSize || receiptImageSize;
  }, [ocrCoordinateOptions, ocrCoordinateModeIndex, ocrCoordinateSize, receiptImageSize]);

  useEffect(() => {
    if (!receiptImage) return;
    Image.getSize(
      receiptImage,
      (imageWidth, imageHeight) => setReceiptImageSize({ width: imageWidth, height: imageHeight }),
      () => undefined
    );
  }, [receiptImage]);

  async function createReceiptCandidates(imageAsset, options = {}) {
    try {
      const sourceType = options.sourceType || "receipt";
      const originalImageUri = typeof imageAsset === "string" ? imageAsset : imageAsset.uri;
      const assetSize = imageAsset?.width && imageAsset?.height ? { width: imageAsset.width, height: imageAsset.height } : { width: 0, height: 0 };
      const normalizedImage = await normalizeReceiptImageForOcr(originalImageUri, sourceType);
      
      let imageUri = normalizedImage.imageUri || originalImageUri;
      let normalizedSize = normalizedImage.size?.width && normalizedImage.size?.height ? normalizedImage.size : null;
      
      // OpenCV 테두리 보정(perspective warp)이 실패하여 원본 이미지를 사용하는 경우,
      // expo-image-manipulator를 사용해 이미지의 EXIF 회전을 물리적 픽셀 회전으로 보정합니다.
      if (!normalizedImage.normalized) {
        try {
          const manipulated = await ImageManipulator.manipulateAsync(
            originalImageUri,
            [], // 빈 액션은 EXIF Orientation 정보(예: 90도 회전)를 지닌 이미지를 물리적으로 회전된 정방향 이미지로 변환합니다.
            { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG }
          );
          imageUri = manipulated.uri;
          normalizedSize = { width: manipulated.width, height: manipulated.height };
        } catch (manipulateError) {
          console.log("[freshkeeper] Image manipulation failed, falling back to original:", manipulateError);
        }
      }

      const displaySize = await getImageDisplaySize(imageUri, normalizedSize || assetSize);
      const imageKind = inferReceiptImageKind(imageAsset, sourceType, options, displaySize);
      setReceiptSourceType(sourceType);
      setReceiptInteractionMode(imageKind === "paper" ? "paper" : "box");
      setReceiptSelectorMode(imageKind === "paper" ? "highlight" : "box");
      setMode("receipt");
      goToPage(addPage);
      setReceiptImage(imageUri);
      setReceiptImageSize(displaySize);
      setOcrCoordinateSize(null);
      setOcrCoordinateOptions([]);
      setOcrCoordinateModeIndex(0);
      setReceiptImageLayout({ width: 0, height: 0 });
      setOcrLines([]);
      setCommerceCropBoxes([]);
      setSelectedOcrLineIds([]);
      setHighlightMarks([]);
      setInitialDrafts([]);
      setExcludedDrafts([]);
      setFeedbackUploadKey("");
      feedbackUploadInFlightRef.current = false;
      setReceiptStatus(
        sourceType === "coupang"
          ? "쿠팡 주문내역 캡처에서 상품 후보를 찾는 중입니다."
          : normalizedImage.normalized
            ? "종이 영수증을 반듯하게 보정한 뒤 상품 후보를 찾는 중입니다."
            : "이미지를 읽고 상품 후보를 만드는 중입니다."
      );
      const result = await recognizeReceiptImage(imageUri, displaySize);
      const ruleDrafts = parseReceiptLines(result.text);
      let lines = result.lines || [];
      let nextDrafts = ruleDrafts;
      const ocrCalibration = await calibrateOcrLineBoxes(imageUri, lines);
      lines = ocrCalibration.lines || lines;

      if (sourceType === "receipt" && ocrCalibration.appliedCount === 0) {
        const aiTextBoxes = await detectReceiptAiTextLineBoxes(imageUri);
        const detectedTextBoxes = aiTextBoxes.length ? aiTextBoxes : await detectReceiptTextLineBoxes(imageUri);
        const detectedRowBoxes = aiTextBoxes.length ? groupDetectedBoxesIntoRows(aiTextBoxes) : detectedTextBoxes;
        console.log("[freshkeeper:ocr-box-source]", {
          sourceType,
          normalized: Boolean(normalizedImage.normalized),
          dbnetCount: aiTextBoxes.length,
          fallbackSource: aiTextBoxes.length ? "dbnet-text-line" : "opencv-text-line",
          detectedCount: detectedTextBoxes.length,
          detectedRowCount: detectedRowBoxes.length,
          ocrLineCount: lines.length
        });
        const requestedBoxSource = aiTextBoxes.length ? "dbnet-text-line" : "opencv-text-line";
        lines = alignOcrLinesWithDetectedBoxes(lines, detectedTextBoxes, requestedBoxSource);
        console.log("[freshkeeper:ocr-box-align]", {
          requestedBoxSource,
          appliedCount: lines.filter((line) => line.boxSource === requestedBoxSource).length,
          ocrLineCount: lines.length
        });
      } else if (sourceType === "receipt") {
        console.log("[freshkeeper:ocr-box-align]", {
          requestedBoxSource: "ocr-pixel-calibrated",
          appliedCount: ocrCalibration.appliedCount,
          ocrLineCount: lines.length
        });
      }

      const coordinateAssetSize = normalizedImage.normalized ? null : assetSize;
      const coordinateOptions = buildOcrCoordinateOptions(result.coordinateSize, displaySize, coordinateAssetSize);
      const bestCoordinate = chooseBestOcrCoordinateOption(coordinateOptions, lines, nextDrafts);
      const coordinateModeIndex = bestCoordinate.index || 0;
      const coordinateSize = coordinateOptions[coordinateModeIndex]?.size || coordinateOptions[0]?.size || displaySize;
      setOcrLines(lines);
      setOcrCoordinateSize(coordinateSize);
      setOcrCoordinateOptions(coordinateOptions);
      setOcrCoordinateModeIndex(coordinateModeIndex);

      if (imageKind === "paper") {
        setSelectedOcrLineIds([]);
        setCommerceCropBoxes([]);
        setReceiptDrafts([]);
        setReceiptSelectorMode("highlight");
        setReceiptSelectorVisible(true);
        setReceiptStatus("상품명을 펜으로 칠한 뒤 체크를 눌러주세요. 칠한 영역만 상품 후보로 가져옵니다.");
        return;
      }

      setSelectedOcrLineIds(lines.filter((line) => isOcrLineInDrafts(line, nextDrafts)).map((line) => line.id));
      const commerceImageResult = await extractCommerceProductImages({
        imageUri,
        imageSize: displaySize,
        coordinateSize,
        lines,
        draftNames: nextDrafts
      });
      if (commerceImageResult.draftNames?.length) {
        nextDrafts = commerceImageResult.draftNames;
      }
      if (commerceImageResult.selectedLineIds?.length) {
        setSelectedOcrLineIds(commerceImageResult.selectedLineIds);
      }
      setCommerceCropBoxes(commerceImageResult.cropBoxes || []);
      nextDrafts = await filterExcludedProductNames(nextDrafts);
      setSelectedOcrLineIds(
        lines.filter((line) => isOcrLineInDrafts(line, nextDrafts)).map((line) => line.id)
      );
      setReceiptDrafts(nextDrafts, commerceImageResult.imageMap || {});
      setReceiptSelectorMode("box");
      setReceiptSelectorVisible(true);
      const sourceLabel = sourceType === "coupang" ? "쿠팡 주문내역" : "이미지";
      const localResultMessage = sourceType === "coupang" ? `${sourceLabel}에서 상품 후보를 만들었습니다.` : result.message || `${sourceLabel}에서 상품 후보를 만들었습니다.`;
      setReceiptStatus(
        nextDrafts.length > 0
          ? `${localResultMessage} 결과가 어색하면 직접 줄을 고를 수 있습니다.`
          : "상품 후보를 찾지 못했습니다. 직접 줄을 고르거나 다시 선택해 주세요."
      );
    } catch {
      setReceiptStatus("이미지를 읽지 못했습니다. 이미지를 다시 선택하거나 직접 입력해 주세요.");
    }
  }

  async function selectReceiptImageForType(options) {
    setMode("receipt");
    goToPage(addPage);
    setReceiptImageTypeChooserVisible(false);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("권한 필요", "이미지나 캡처를 불러오려면 사진 접근 권한이 필요합니다.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      await createReceiptCandidates(result.assets[0], options);
    }
  }

  function pickReceiptImage() {
    setMode("receipt");
    goToPage(addPage);
    setReceiptImageTypeChooserVisible(true);
  }

  async function takeReceiptPhoto() {
    setMode("receipt");
    goToPage(addPage);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("권한 필요", "영수증을 촬영하려면 카메라 권한이 필요합니다.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.9
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      await createReceiptCandidates(result.assets[0], { sourceType: "receipt", physicalReceipt: true, fromCamera: true });
    }
  }

  function openReceiptSelector(mode = "box") {
    setReceiptSelectorMode(mode);
    setReceiptSelectorVisible(true);
  }

  function draftNamesFromHighlightedOcr(result) {
    const parsedDrafts = parseReceiptLines(result?.text || "");
    if (parsedDrafts.length) {
      debugHighlightOcr({
        stage: "parsed-drafts",
        text: String(result?.text || "").slice(0, 500),
        parsedDrafts
      });
      return parsedDrafts;
    }
    const fallbackLines = Array.isArray(result?.lines) ? result.lines : [];
    const fallbackDrafts = Array.from(
      new Set(
        fallbackLines
          .map((line) => draftNameForOcrLine(line))
          .filter(Boolean)
        )
    );
    debugHighlightOcr({
      stage: "fallback-drafts",
      text: String(result?.text || "").slice(0, 500),
      lineCount: fallbackLines.length,
      sampleLines: fallbackLines.slice(0, 8).map((line) => ({ text: line.text, box: line.box })),
      fallbackDrafts
    });
    return fallbackDrafts;
  }

  function isHighlightedProductCandidate(name) {
    const value = String(name || "").replace(/\s+/g, " ").trim();
    if (value.length < 2) return false;
    if (!/[가-힣A-Za-z]/.test(value)) return false;
    if (/^[\d\s,.\-+*xX%()T]+$/.test(value)) return false;
    if (/(CPN|MEMBER|WHOLESALE|회원|만료|판매|대표|전화|주소|승인|카드|합계|과세|부가|면세|포인트|POS|REG|사업자|영수증)/i.test(value)) return false;
    if (/^\d{4,}$/.test(value.replace(/\D/g, "")) && !/[가-힣A-Za-z]{2,}/.test(value)) return false;
    if (/\b\d+\s*[xX]\b/.test(value) || /\d{1,3}\s*,\s*\d{3}/.test(value)) {
      return /[가-힣A-Za-z]{3,}/.test(value) && !/[xX]\s*\d/.test(value);
    }
    return true;
  }

  function draftNamesFromHighlightedLines(selection) {
    if (!selection?.canvasWidth || !selection?.canvasHeight || !ocrLines.length) return [];
    const canvasSize = { width: selection.canvasWidth, height: selection.canvasHeight };
    const markCenters = Array.isArray(selection.marks)
      ? selection.marks.map((mark) => ({
          x: mark.x + mark.width / 2,
          y: mark.y + mark.height / 2,
          height: mark.height
        }))
      : [];
    const hitRect = {
      x: Math.max(0, selection.x - 12),
      y: Math.max(0, selection.y - 10),
      width: selection.width + 24,
      height: selection.height + 20
    };
    const hitCenterY = hitRect.y + hitRect.height / 2;
    const lineMetrics = ocrLines
      .map((line) => {
      const frame = frameForBox(line.box, activeOcrCoordinateSize, canvasSize, 0, 0, 0);
        if (!frame) return null;
      const centerY = frame.top + frame.height / 2;
      const overlapX = Math.min(frame.left + frame.width, hitRect.x + hitRect.width) - Math.max(frame.left, hitRect.x);
      const insideY = centerY >= hitRect.y && centerY <= hitRect.y + hitRect.height;
      const overlapRatio = overlapX > 0 ? overlapX / Math.max(1, Math.min(frame.width, hitRect.width)) : 0;
      const yDistance = Math.abs(centerY - hitCenterY);
      const draftName = draftNameForOcrLine(line).trim();
        const markDistances = markCenters
          .filter((mark) => mark.x >= frame.left - 18 && mark.x <= frame.left + frame.width + 18)
          .map((mark) => Math.abs(mark.y - centerY));
        const minMarkDistance = markDistances.length ? Math.min(...markDistances) : null;
        const markHitCount = markDistances.filter((distance) => distance <= 12).length;
        const accepted = insideY && overlapX > Math.min(frame.width, hitRect.width) * 0.15;
        return {
          line,
          text: line.text,
          draftName,
          accepted,
          productLike: isHighlightedProductCandidate(draftName),
          insideY,
          markHitCount,
          minMarkDistance: minMarkDistance === null ? null : Math.round(minMarkDistance * 10) / 10,
          overlapX: Math.round(overlapX * 10) / 10,
          overlapRatio: Math.round(overlapRatio * 100) / 100,
          yDistance: Math.round(yDistance * 10) / 10,
          frame: {
            left: Math.round(frame.left * 10) / 10,
            top: Math.round(frame.top * 10) / 10,
            width: Math.round(frame.width * 10) / 10,
            height: Math.round(frame.height * 10) / 10,
            centerY: Math.round(centerY * 10) / 10
          },
          boxSource: line.boxSource
        };
      })
      .filter(Boolean);
    const acceptedMetrics = lineMetrics.filter((metric) => metric.accepted);
    const productMetrics = acceptedMetrics.filter((metric) => metric.productLike);
    const rankedProductMetrics = productMetrics
      .map((metric) => ({
        ...metric,
        rankDistance: metric.minMarkDistance === null ? metric.yDistance : Math.min(metric.yDistance, metric.minMarkDistance)
      }))
      .sort((a, b) => a.rankDistance - b.rankDistance || b.overlapRatio - a.overlapRatio);
    const bestDistance = rankedProductMetrics[0]?.rankDistance ?? null;
    const selectedMetrics = bestDistance === null
      ? acceptedMetrics
      : rankedProductMetrics.filter((metric) => metric.rankDistance <= bestDistance + 8);
    const matchedLines = selectedMetrics.map((metric) => metric.line);
    const highlightedDrafts = Array.from(
      new Set(
        selectedMetrics
          .map((metric) => metric.draftName)
          .filter((name) => isHighlightedProductCandidate(name))
      )
    );
    debugHighlightOcr({
      stage: "existing-line-match",
      selection,
      hitRect,
      hitCenterY: Math.round(hitCenterY * 10) / 10,
      matchedCount: matchedLines.length,
      matchedLines: matchedLines.slice(0, 8).map((line) => ({ text: line.text, box: line.box, boxSource: line.boxSource })),
      bestDistance,
      selectedMetrics: selectedMetrics.slice(0, 8).map(({ line, ...metric }) => metric),
      nearbyMetrics: lineMetrics
        .filter((metric) => metric.accepted || metric.yDistance <= Math.max(80, hitRect.height * 1.4))
        .sort((a, b) => a.yDistance - b.yDistance)
        .slice(0, 30)
        .map(({ line, ...metric }) => metric),
      highlightedDrafts
    });
    return highlightedDrafts;
  }

  async function applyHighlightedReceiptSelection(selection) {
    if (!receiptImage || !selection?.width || !selection?.height) return;
    try {
      setReceiptSelectorVisible(false);
      setReceiptStatus("형광펜으로 칠한 영역만 다시 읽는 중입니다.");
      const lineMatchedDrafts = draftNamesFromHighlightedLines(selection);
      if (lineMatchedDrafts.length) {
        setReceiptDrafts(lineMatchedDrafts);
        setSelectedOcrLineIds([]);
        setCommerceCropBoxes([]);
        setReceiptStatus(`칠한 영역에서 ${lineMatchedDrafts.length}개 상품 후보를 찾았습니다.`);
        return;
      }
      const sourceWidth = receiptImageSize.width || selection.canvasWidth;
      const sourceHeight = receiptImageSize.height || selection.canvasHeight;
      const scaleX = sourceWidth / Math.max(1, selection.canvasWidth);
      const scaleY = sourceHeight / Math.max(1, selection.canvasHeight);
      const rawCrop = {
        originX: Math.max(0, Math.round(selection.x * scaleX)),
        originY: Math.max(0, Math.round(selection.y * scaleY)),
        width: Math.max(1, Math.min(sourceWidth, Math.round(selection.width * scaleX))),
        height: Math.max(1, Math.min(sourceHeight, Math.round(selection.height * scaleY)))
      };
      const centerX = rawCrop.originX + rawCrop.width / 2;
      const centerY = rawCrop.originY + rawCrop.height / 2;
      const expandedWidth = Math.min(sourceWidth, Math.max(rawCrop.width + 360, Math.round(sourceWidth * 0.65)));
      const expandedHeight = Math.min(sourceHeight, Math.max(rawCrop.height + 260, 420));
      const crop = {
        originX: Math.max(0, Math.round(centerX - expandedWidth / 2)),
        originY: Math.max(0, Math.round(centerY - expandedHeight / 2)),
        width: expandedWidth,
        height: expandedHeight
      };
      if (crop.originX + crop.width > sourceWidth) crop.width = Math.max(1, sourceWidth - crop.originX);
      if (crop.originY + crop.height > sourceHeight) crop.height = Math.max(1, sourceHeight - crop.originY);
      const resizeWidth = Math.min(1800, Math.max(1000, crop.width * 2));
      debugHighlightOcr({
        stage: "crop-request",
        selection,
        sourceWidth,
        sourceHeight,
        scaleX,
        scaleY,
        rawCrop,
        resizeWidth,
        crop
      });

      const cropped = await ImageManipulator.manipulateAsync(
        receiptImage,
        [{ crop }, { resize: { width: resizeWidth } }],
        { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG }
      );
      const cropSize = { width: cropped.width || crop.width, height: cropped.height || crop.height };
      const result = await recognizeReceiptImage(cropped.uri, cropSize);
      debugHighlightOcr({
        stage: "ocr-result",
        cropSize,
        text: String(result?.text || "").slice(0, 500),
        lineCount: Array.isArray(result?.lines) ? result.lines.length : 0,
        message: result?.message
      });
      const highlightedDrafts = draftNamesFromHighlightedOcr(result);
      debugHighlightOcr({
        stage: "final-drafts",
        count: highlightedDrafts.length,
        highlightedDrafts
      });
      setReceiptDrafts(highlightedDrafts);
      setSelectedOcrLineIds([]);
      setCommerceCropBoxes([]);
      setReceiptStatus(
        highlightedDrafts.length
          ? `칠한 영역에서 ${highlightedDrafts.length}개 상품 후보를 찾았습니다.`
          : "칠한 영역에서 상품 후보를 찾지 못했습니다. 상품명 부분을 조금 넓게 칠해 주세요."
      );
    } catch {
      setReceiptStatus("칠한 영역을 읽지 못했습니다. 다시 칠하거나 직접 등록해 주세요.");
    }
  }

  function toggleOcrLine(line) {
    const name = draftNameForOcrLine(line);
    if (!name) return;
    const isSelected = selectedOcrLineIds.includes(line.id);

    if (isSelected) {
      setSelectedOcrLineIds((current) => current.filter((id) => id !== line.id));
      removeDraft(name);
      return;
    }

    void setProductExclusion(name, false).catch(() => undefined);
    setSelectedOcrLineIds((current) => [...current, line.id]);
    setReceiptDrafts([...drafts, name]);
    setReceiptStatus("선택한 줄을 상품 후보에 추가했습니다.");
  }

  function toggleCommerceCropBox(cropBox) {
    const line = ocrLines.find((ocrLine) => ocrLine.id === cropBox.lineId);
    const draftName = cropBox.draftName || (line ? draftNameForOcrLine(line) : "");
    if (!draftName) return;
    const isSelected = cropBox.lineId ? selectedOcrLineIds.includes(cropBox.lineId) : drafts.includes(draftName);

    if (isSelected) {
      if (cropBox.lineId) setSelectedOcrLineIds((current) => current.filter((id) => id !== cropBox.lineId));
      removeDraft(draftName);
      return;
    }

    if (cropBox.lineId) {
      setSelectedOcrLineIds((current) => (current.includes(cropBox.lineId) ? current : [...current, cropBox.lineId]));
    }
    void setProductExclusion(draftName, false).catch(() => undefined);
    setReceiptDrafts([...drafts, draftName], cropBox.imageUri ? { [draftName]: cropBox.imageUri } : {});
    setReceiptStatus("사진과 상품명을 함께 후보에 추가했습니다.");
  }

  function frameForOcrLine(line) {
    return frameForBox(line.box, activeOcrCoordinateSize, receiptImageLayout, 28, 12, 0.5);
  }

  function frameForCommerceCropBox(cropBox) {
    return frameForBox(cropBox.box, activeOcrCoordinateSize, receiptImageLayout, 28, 28, 1);
  }

  function defaultDraftForm(draftName, overrides = {}) {
    return {
      category: "기타",
      storage: "냉장",
      expiryType: defaultExpiryType,
      expiry: todayIso(7),
      classificationPending: true,
      classificationPrediction: null,
      ...overrides
    };
  }

  function setReceiptDrafts(nextDrafts, imageMap = {}) {
    const uniqueDrafts = Array.from(new Set(nextDrafts));
    setDrafts(uniqueDrafts);
    setInitialDrafts(uniqueDrafts);
    setExcludedDrafts((current) => current.filter((draftName) => uniqueDrafts.includes(draftName)));
    setBulkDraftForm({
      expiry: uniqueDrafts[0] ? defaultDraftForm(uniqueDrafts[0]).expiry : suggestedExpiryDate("", "기타", "냉장")
    });
    setDraftForms((current) => {
      const nextForms = {};
      uniqueDrafts.forEach((draft) => {
        nextForms[draft] = current[draft] || defaultDraftForm(draft, imageMap[draft] ? { imageUri: imageMap[draft] } : {});
      });
      return nextForms;
    });
    void hydrateDraftClassifications(uniqueDrafts);
  }

  async function hydrateDraftClassifications(draftNames) {
    if (!draftNames.length) return;
    const requestId = classificationRequestRef.current + 1;
    classificationRequestRef.current = requestId;
    const resultMap = await resolveProductClassifications(draftNames);
    if (classificationRequestRef.current !== requestId) return;

    setDraftForms((current) => {
      const nextForms = { ...current };
      for (const draftName of draftNames) {
        const currentForm = nextForms[draftName];
        if (!currentForm || currentForm.classificationTouched) continue;
        const result = resultMap[normalizeProductName(draftName)];
        if (!result) {
          nextForms[draftName] = {
            ...currentForm,
            classificationPending: false
          };
          continue;
        }

        nextForms[draftName] = {
          ...currentForm,
          category: result.category,
          storage: result.storage,
          expiry: todayIso(result.expiryDays),
          classificationPending: false,
          classificationPrediction: {
            category: result.category,
            storage: result.storage,
            expiryDays: result.expiryDays,
            source: result.source
          }
        };
      }
      return nextForms;
    });
  }

  function resetReceiptDrafts() {
    setDrafts([]);
    setInitialDrafts([]);
    setExcludedDrafts([]);
    setDraftForms({});
    setSelectedOcrLineIds([]);
    setHighlightMarks([]);
    setCommerceCropBoxes([]);
    setBulkDraftForm({ expiry: suggestedExpiryDate("", "기타", "냉장") });
    setReceiptStatus("발견된 상품 후보를 비웠습니다. 다시 선택하거나 직접 추가해 주세요.");
  }

  function addDraft(draftName) {
    const draftForm = draftForms[draftName] || defaultDraftForm(draftName);
    const itemId = `${Date.now()}-${Math.random()}`;
    const added = addItem({
      id: itemId,
      name: draftName,
      ...draftForm
    });
    if (!added) return;
    setLatestRegisteredId(itemId);
    setDrafts((current) => current.filter((draft) => draft !== draftName));
    setExcludedDrafts((current) => current.filter((draft) => draft !== draftName));
    setDraftForms((current) => {
      const nextForms = { ...current };
      delete nextForms[draftName];
      return nextForms;
    });
    setTotalHighlighted(true);
    uploadCurrentOcrFeedback("auto", [draftName], [draftName]);
    uploadProductClassificationFeedback([classificationFeedbackItem(draftName, draftForm)]);
  }

  function addAllDrafts() {
    if (!drafts.length) return;
    const finalDrafts = drafts.filter((draftName) => !excludedDrafts.includes(draftName));
    if (!finalDrafts.length) {
      setReceiptStatus("등록할 상품 후보가 없습니다. 필요한 상품을 다시 선택해 주세요.");
      return;
    }
    const nextItems = finalDrafts.map((draftName) => {
      const draftForm = draftForms[draftName] || defaultDraftForm(draftName);
      return {
        id: `${Date.now()}-${draftName}-${Math.random()}`,
        createdAt: new Date().toISOString(),
        name: draftName,
        category: draftForm.category,
        storage: draftForm.storage,
        expiryType: defaultExpiryType,
        expiry: draftForm.expiry || bulkDraftForm.expiry,
        imageUri: draftForm.imageUri || ""
      };
    });
    setItems((current) => [...nextItems, ...current]);
    setLatestRegisteredId(nextItems[0]?.id || "");
    setDrafts([]);
    setExcludedDrafts([]);
    setDraftForms({});
    setTotalHighlighted(true);
    goToPage(inventoryPage);
    uploadCurrentOcrFeedback("auto", finalDrafts, initialDrafts.length ? initialDrafts : drafts);
    uploadProductClassificationFeedback(
      finalDrafts.map((draftName) =>
        classificationFeedbackItem(draftName, draftForms[draftName] || defaultDraftForm(draftName))
      )
    );
    setInitialDrafts([]);
  }

  function isDraftAllowedByOcrSelection(draftName) {
    const relatedLines = ocrLines.filter((line) => isOcrLineInDrafts(line, [draftName]));
    if (!relatedLines.length) return selectedOcrLineIds.length === 0;
    return relatedLines.some((line) => selectedOcrLineIds.includes(line.id));
  }

  function removeDraft(draftName) {
    void setProductExclusion(draftName, true).catch(() => undefined);
    setDrafts((current) => current.filter((draft) => draft !== draftName));
    setExcludedDrafts((current) => current.filter((draft) => draft !== draftName));
    setSelectedOcrLineIds((current) => {
      const relatedLineIds = ocrLines.filter((line) => draftNameForOcrLine(line) === draftName).map((line) => line.id);
      if (!relatedLineIds.length) return current;
      return current.filter((id) => !relatedLineIds.includes(id));
    });
    setDraftForms((current) => {
      const nextForms = { ...current };
      delete nextForms[draftName];
      return nextForms;
    });
  }

  function updateDraftForm(draftName, updates) {
    const classificationTouched = ["category", "storage", "expiry"].some((key) =>
      Object.prototype.hasOwnProperty.call(updates, key)
    );
    setDraftForms((current) => ({
      ...current,
      [draftName]: {
        ...defaultDraftForm(draftName, current[draftName]),
        ...updates,
        classificationTouched: current[draftName]?.classificationTouched || classificationTouched
      }
    }));
  }

  async function pickDraftImage(draftName) {
    chooseItemImage({
      onSelected: (imageUri) => {
        updateDraftForm(draftName, { imageUri });
        setReceiptStatus("상품 사진을 변경했습니다.");
      },
      libraryPermissionMessage: "상품 이미지를 바꾸려면 사진 접근 권한이 필요합니다.",
      cameraPermissionMessage: "상품 사진을 촬영하려면 카메라 권한이 필요합니다."
    });
  }

  function toggleDraftExcluded(draftName) {
    setExcludedDrafts((current) => {
      if (current.includes(draftName)) {
        void setProductExclusion(draftName, false).catch(() => undefined);
        return current.filter((draft) => draft !== draftName);
      }
      void setProductExclusion(draftName, true).catch(() => undefined);
      return [...current, draftName];
    });
  }

  function applyBulkDraftForm(updates) {
    const nextBulk = { ...bulkDraftForm, ...updates };
    setBulkDraftForm(nextBulk);
    setDraftForms((current) => {
      const nextForms = { ...current };
      drafts.forEach((draftName) => {
        nextForms[draftName] = {
          ...defaultDraftForm(draftName, nextForms[draftName]),
          ...updates,
          classificationTouched: true
        };
      });
      return nextForms;
    });
  }

  function classificationFeedbackItem(draftName, draftForm) {
    const prediction = draftForm.classificationPrediction || {};
    if (draftForm.classificationPending && !draftForm.classificationTouched) return null;
    if (!draftForm.classificationTouched && (!prediction.source || prediction.source === "default")) return null;
    return {
      name: draftName,
      predictedCategory: prediction.category || "",
      predictedStorage: prediction.storage || "",
      predictedExpiryDays: prediction.expiryDays,
      predictedSource: prediction.source || "default",
      finalCategory: draftForm.category || "기타",
      finalStorage: draftForm.storage || "냉장",
      finalExpiryDays: Math.max(0, daysUntil(draftForm.expiry || todayIso(7)))
    };
  }

  function uploadProductClassificationFeedback(items) {
    if (!feedbackSettings.enabled) return;
    void sendProductClassificationFeedback(items).catch(() => undefined);
  }

  async function uploadCurrentOcrFeedback(source = "manual", selectedNamesOverride = null, ruleCandidateNamesOverride = null) {
    if (!ocrLines.length) return;
    if (!feedbackSettings.enabled && source !== "manual") return;
    if (feedbackUploadInFlightRef.current) {
      setFeedbackStatus("학습 데이터 전송 중입니다.");
      return;
    }

    const payload = buildOcrFeedbackPayload({
      appVersion,
      lines: ocrLines,
      selectedIds: selectedOcrLineIds,
      selectedNames: Array.isArray(selectedNamesOverride) ? selectedNamesOverride : drafts,
      ruleCandidateNames: Array.isArray(ruleCandidateNamesOverride)
        ? ruleCandidateNamesOverride
        : (initialDrafts.length ? initialDrafts : drafts),
      aiRequestId: ""
    });
    const uploadKey = feedbackFingerprint(payload);
    if (uploadKey === feedbackUploadKey) {
      setFeedbackStatus("이미 전송한 선택 결과입니다.");
      return;
    }

    try {
      feedbackUploadInFlightRef.current = true;
      setFeedbackStatus("학습 데이터 전송 중입니다.");
      const result = await sendOcrFeedback(payload);
      setFeedbackUploadKey(uploadKey);
      setFeedbackStatus(`학습 데이터 전송 완료 (${result.selectedCount}/${result.lineCount})`);
    } catch {
      setFeedbackStatus("학습 데이터 전송 실패");
    } finally {
      feedbackUploadInFlightRef.current = false;
    }
  }

  return {
    receiptSourceType,
    receiptInteractionMode,
    receiptSelectorMode,
    receiptImage,
    receiptImageSize,
    activeOcrCoordinateSize,
    ocrCoordinateOptions,
    ocrCoordinateModeIndex,
    setOcrCoordinateModeIndex,
    setReceiptImageLayout,
    setReceiptImageSize,
    ocrLines,
    commerceCropBoxes,
    selectedOcrLineIds,
    highlightMarks,
    setHighlightMarks,
    receiptSelectorVisible,
    setReceiptSelectorVisible,
    receiptImageTypeChooserVisible,
    setReceiptImageTypeChooserVisible,
    openReceiptSelector,
    applyHighlightedReceiptSelection,
   drafts,
    excludedDrafts,
    draftForms,
    bulkDraftForm,
    receiptStatus,
    feedbackSettings,
    setFeedbackSettings,
    feedbackStatus,
    normalizeFeedbackSettings,
    createReceiptCandidates,
    takeReceiptPhoto,
    pickReceiptImage,
    selectReceiptImageForType,
    frameForOcrLine,
    frameForCommerceCropBox,
    toggleOcrLine,
    toggleCommerceCropBox,
    applyBulkDraftForm,
    addAllDrafts,
    resetReceiptDrafts,
    removeDraft,
    toggleDraftExcluded,
    updateDraftForm,
    pickDraftImage,
    addDraft,
    uploadCurrentOcrFeedback
  };
}

