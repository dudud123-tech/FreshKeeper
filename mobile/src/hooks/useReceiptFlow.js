import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image } from "react-native";
import { recognizeReceiptImage } from "../ocr";
import { parseReceiptLines } from "../receiptParser";
import { buildOcrFeedbackPayload, feedbackFingerprint, sendOcrFeedback } from "../services/ocrFeedbackApi";
import { extractCommerceProductImages } from "../utils/commerceImageExtractor";
import { suggestedExpiryDate, suggestedStorage } from "../utils/expiryPresets";
import { buildOcrCoordinateOptions, chooseBestOcrCoordinateOption, draftNameForOcrLine, frameForBox, getImageDisplaySize, isOcrLineInDrafts } from "../utils/receiptOverlay";
import { detectReceiptAiTextLineBoxes } from "../utils/receiptAiTextDetector";
import { normalizeReceiptImageForOcr } from "../utils/receiptImageNormalizer";
import { alignOcrLinesWithDetectedBoxes, detectReceiptTextLineBoxes, groupDetectedBoxesIntoRows } from "../utils/receiptTextLineDetector";

export const DEFAULT_FEEDBACK_SETTINGS = { enabled: true };

export function normalizeFeedbackSettings(value) {
  return { ...DEFAULT_FEEDBACK_SETTINGS, ...(value || {}) };
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
  const [receiptImage, setReceiptImage] = useState("");
  const [receiptImageSize, setReceiptImageSize] = useState({ width: 0, height: 0 });
  const [ocrCoordinateSize, setOcrCoordinateSize] = useState(null);
  const [ocrCoordinateOptions, setOcrCoordinateOptions] = useState([]);
  const [ocrCoordinateModeIndex, setOcrCoordinateModeIndex] = useState(0);
  const [receiptImageLayout, setReceiptImageLayout] = useState({ width: 0, height: 0 });
  const [ocrLines, setOcrLines] = useState([]);
  const [commerceCropBoxes, setCommerceCropBoxes] = useState([]);
  const [selectedOcrLineIds, setSelectedOcrLineIds] = useState([]);
  const [receiptSelectorVisible, setReceiptSelectorVisible] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [initialDrafts, setInitialDrafts] = useState([]);
  const [excludedDrafts, setExcludedDrafts] = useState([]);
  const [draftForms, setDraftForms] = useState({});
  const [bulkDraftForm, setBulkDraftForm] = useState({ expiry: suggestedExpiryDate("", "기타", "냉장") });
  const [receiptStatus, setReceiptStatus] = useState("영수증을 촬영하거나 주문내역 캡처를 불러오면 상품 후보를 자동으로 만듭니다.");
  const [feedbackSettings, setFeedbackSettings] = useState(DEFAULT_FEEDBACK_SETTINGS);
  const [feedbackStatus, setFeedbackStatus] = useState("학습 개선 데이터 자동 전송 켜짐");
  const [feedbackUploadKey, setFeedbackUploadKey] = useState("");
  const feedbackUploadInFlightRef = useRef(false);

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
      const imageUri = normalizedImage.imageUri || originalImageUri;
      const normalizedSize = normalizedImage.size?.width && normalizedImage.size?.height ? normalizedImage.size : null;
      const displaySize = await getImageDisplaySize(imageUri, normalizedSize || assetSize);
      setReceiptSourceType(sourceType);
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

      if (sourceType === "receipt") {
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
        lines = alignOcrLinesWithDetectedBoxes(lines, detectedTextBoxes, aiTextBoxes.length ? "dbnet-text-line" : "opencv-text-line");
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
      setReceiptDrafts(nextDrafts, commerceImageResult.imageMap || {});
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

  async function pickReceiptImage() {
    setMode("receipt");
    goToPage(addPage);
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
      const asset = result.assets[0];
      Alert.alert("어떤 이미지인가요?", "영수증뿐 아니라 쿠팡 주문내역 캡처도 상품 후보로 만들 수 있습니다.", [
        {
          text: "취소",
          style: "cancel"
        },
        {
          text: "영수증",
          onPress: () => createReceiptCandidates(asset, { sourceType: "receipt" })
        },
        {
          text: "쿠팡 주문내역",
          onPress: () => createReceiptCandidates(asset, { sourceType: "coupang" })
        },
        {
          text: "자동 판단",
          onPress: () => createReceiptCandidates(asset, { sourceType: "auto" })
        }
      ], { cancelable: true });
    }
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
      await createReceiptCandidates(result.assets[0], { sourceType: "receipt" });
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
    const category = overrides.category || suggestCategory(draftName);
    const storage = overrides.storage || suggestedStorage(draftName, category, "냉장");
    return {
      category,
      storage,
      expiryType: defaultExpiryType,
      expiry: suggestedExpiryDate(draftName, category, storage),
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
  }

  function addAllDrafts() {
    if (!drafts.length) return;
    const finalDrafts = drafts.filter((draftName) => !excludedDrafts.includes(draftName) && isDraftAllowedByOcrSelection(draftName));
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
    setInitialDrafts([]);
  }

  function isDraftAllowedByOcrSelection(draftName) {
    const relatedLines = ocrLines.filter((line) => isOcrLineInDrafts(line, [draftName]));
    if (!relatedLines.length) return selectedOcrLineIds.length === 0;
    return relatedLines.some((line) => selectedOcrLineIds.includes(line.id));
  }

  function removeDraft(draftName) {
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
    setDraftForms((current) => ({
      ...current,
      [draftName]: {
        ...defaultDraftForm(draftName, current[draftName]),
        ...updates
      }
    }));
  }

  function toggleDraftExcluded(draftName) {
    setExcludedDrafts((current) => {
      if (current.includes(draftName)) {
        return current.filter((draft) => draft !== draftName);
      }
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
          ...updates
        };
      });
      return nextForms;
    });
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
    receiptSelectorVisible,
    setReceiptSelectorVisible,
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
    frameForOcrLine,
    frameForCommerceCropBox,
    toggleOcrLine,
    toggleCommerceCropBox,
    applyBulkDraftForm,
    addAllDrafts,
    removeDraft,
    toggleDraftExcluded,
    updateDraftForm,
    addDraft,
    uploadCurrentOcrFeedback
  };
}
