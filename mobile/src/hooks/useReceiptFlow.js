import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image } from "react-native";
import { recognizeReceiptImage } from "../ocr";
import { isProductNameCandidate, parseReceiptLines } from "../receiptParser";
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
import { buildOcrCoordinateOptions, chooseBestOcrCoordinateOption, draftNameForOcrLine, filterIsolatedRightEdgeLines, frameForBox, getImageDisplaySize, isOcrLineInDrafts } from "../utils/receiptOverlay";
import { normalizeReceiptImageForOcr } from "../utils/receiptImageNormalizer";
import { alignOcrLinesWithDetectedBoxes, detectReceiptTextLineBoxes } from "../utils/receiptTextLineDetector";
import { calibrateOcrLineBoxes } from "../utils/ocrBoxCalibrator";
import { searchCoupangProducts } from "../services/coupangApi";

export const DEFAULT_FEEDBACK_SETTINGS = { enabled: true };
// 실물 영수증에서 OCR 좌표 보정이 "충분히 맞았다"고 볼 수 있는 최소 비율.
// 캘리브레이션 네이티브 모듈이 all-or-nothing에 가깝게 동작해서(전량 성공 아니면 0),
// 0.5는 "대체로 맞음"과 "대체로 실패"를 가르기에 충분히 보수적인 값이다.
const COORDINATE_CONFIDENCE_THRESHOLD = 0.5;

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

// 네이티브(OpenCV)는 상품 썸네일 오른쪽 줄 중 x가 가장 작은 줄을 상품명으로 고르는데,
// 컬리처럼 상품명·옵션·가격이 같은 열에 세로로 쌓여 있으면 가격 줄이 몇 px 더 왼쪽이라는
// 이유만으로 가격을 상품명으로 집어버린다. 그래서 "썸네일이 어디 있는지"만 네이티브를
//믿고, "그 옆 어느 줄이 상품명인지"는 여기서 다시 고른다. 상품명은 항상 옵션/가격보다
// 위에 있으므로, 유효한 상품명 후보 중 가장 위쪽 줄을 고르면 된다.
function productLineForCropBox(cropBox, lines, coordinateSize) {
  const box = cropBox?.box;
  const coordinateWidth = coordinateSize?.width;
  if (!box || !coordinateWidth) return null;

  const boxRight = box.x + box.width;
  const yPadding = Math.max(10, box.height * 0.18);
  return lines
    .filter((line) => {
      const lineBox = line?.box;
      if (!lineBox) return false;
      const centerY = lineBox.y + lineBox.height / 2;
      return (
        centerY >= box.y - yPadding &&
        centerY <= box.y + box.height + yPadding &&
        lineBox.x >= boxRight - coordinateWidth * 0.01 &&
        lineBox.x < coordinateWidth * 0.88 &&
        isProductNameCandidate(line.text)
      );
    })
    .sort((a, b) => a.box.y - b.box.y)[0] || null;
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
  const [selectionRects, setSelectionRects] = useState([]);
  const [receiptSelectorVisible, setReceiptSelectorVisible] = useState(false);
  const [receiptImageTypeChooserVisible, setReceiptImageTypeChooserVisible] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [initialDrafts, setInitialDrafts] = useState([]);
  const [excludedDrafts, setExcludedDrafts] = useState([]);
  const [draftForms, setDraftForms] = useState({});
  const [bulkDraftForm, setBulkDraftForm] = useState({ expiry: suggestedExpiryDate("", "기타", "냉장") });
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [receiptStatus, setReceiptStatus] = useState("영수증을 촬영하거나 주문내역 캡처를 불러오면 상품 후보를 자동으로 만듭니다.");
  const [feedbackSettings, setFeedbackSettings] = useState(DEFAULT_FEEDBACK_SETTINGS);
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [feedbackUploadKey, setFeedbackUploadKey] = useState("");
  const feedbackUploadInFlightRef = useRef(false);
  const classificationRequestRef = useRef(0);
  // 박스 모드를 열 때(자동 인식 직후 또는 재진입)의 선택 상태 스냅샷. 뒤로가기로
  // 나갈 때 여기로 되돌린다 — cancelReceiptSelector 참고.
  const receiptSelectionSnapshotRef = useRef(null);

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

  // 자동 신뢰도 판단이 놓친 경우(예: 회전된 실물 영수증 — 개별 줄은 지역적으로
  // 그럴듯해 보여도 전체적으로 어긋나는 경우)를 위해, 박스 모드 화면에서 사용자가
  // 직접 "박스가 안 맞다"고 판단하면 언제든 드래그(색칠) 모드로 전환할 수 있게 한다.
  function switchToHighlightMode() {
    setSelectedOcrLineIds([]);
    setCommerceCropBoxes([]);
    setReceiptDrafts([]);
    setReceiptSelectorMode("highlight");
    setReceiptSelectorVisible(true);
    setReceiptStatus("상품명을 펜으로 표시한 뒤 체크를 눌러주세요. 표시한 영역만 상품 후보로 가져옵니다.");
  }

  async function createReceiptCandidates(imageAsset, options = {}) {
    try {
      const sourceType = options.sourceType || "receipt";
      const originalImageUri = typeof imageAsset === "string" ? imageAsset : imageAsset.uri;
      const assetSize = imageAsset?.width && imageAsset?.height ? { width: imageAsset.width, height: imageAsset.height } : { width: 0, height: 0 };
      const normalizedImage = await normalizeReceiptImageForOcr(originalImageUri, sourceType);
      
      let imageUri = normalizedImage.imageUri || originalImageUri;
      let normalizedSize = normalizedImage.size?.width && normalizedImage.size?.height ? normalizedImage.size : null;
      
      // OpenCV 테두리 보정(perspective warp)이 실패하여 원본 이미지를 사용하는 경우에만
      // expo-image-manipulator로 EXIF 회전을 물리적 픽셀 회전으로 보정한다. 화면 캡처(screenshot)는
      // sourceType이 "receipt"가 아니라서 normalizeReceiptImageForOcr가 항상 normalized:false를
      // 돌려주는데, 그렇다고 여기서 재인코딩을 걸면(특히 세로로 아주 긴 이미지) 불필요한 처리이자
      // 안드로이드 Canvas/Bitmap 크기 제한으로 이미지가 깨질 위험만 생긴다. 화면 캡처는 EXIF 회전
      // 문제가 없으므로 원본 이미지를 그대로 쓴다.
      if (sourceType === "receipt" && !normalizedImage.normalized) {
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
      setSelectionRects([]);
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
        const detectedTextBoxes = await detectReceiptTextLineBoxes(imageUri);
        lines = alignOcrLinesWithDetectedBoxes(lines, detectedTextBoxes, "opencv-text-line");
      }
      // 실물 영수증에 한해 "OCR 좌표를 얼마나 믿을 수 있는가"를 계산한다.
      // sourceType(카메라로 찍었는지 갤러리에서 골랐는지)이 아니라 imageKind(실제로
      // 실물 사진인지)로 판단해야 한다 — calibrateOcrLineBoxes는 sourceType과 무관하게
      // 항상 실행되므로, 갤러리에서 고른 실물 사진도 계산이 이미 되어 있다.
      let coordinateConfidence = 0;
      if (imageKind === "paper") {
        const linesWithBoxCount = lines.filter((line) => line?.box).length;
        const calibratedCount = ocrCalibration.appliedCount > 0
          ? ocrCalibration.appliedCount
          : lines.filter((line) => line.boxSource === "opencv-text-line").length;
        coordinateConfidence = linesWithBoxCount > 0 ? calibratedCount / linesWithBoxCount : 0;
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

      // 화면 캡처는 좌표가 항상 신뢰 가능해 그대로 박스 모드로 간다. 실물 영수증은
      // 좌표 신뢰도가 임계값 미만일 때만 드래그(색칠) 모드로 폴백한다 — 신뢰도가
      // 충분하면 실물 영수증도 원래 설계대로 빠른 박스 모드를 쓴다.
      if (imageKind === "paper" && coordinateConfidence < COORDINATE_CONFIDENCE_THRESHOLD) {
        switchToHighlightMode();
        return;
      }

      let selectedLineIds = lines.filter((line) => isOcrLineInDrafts(line, nextDrafts)).map((line) => line.id);
      setSelectedOcrLineIds(selectedLineIds);
      const commerceImageResult = await extractCommerceProductImages({
        imageUri,
        imageSize: displaySize,
        coordinateSize,
        lines,
        draftNames: nextDrafts
      });

      // 오른쪽 끝 부근 줄은 실제 상품명이 아니라 아이콘·뱃지 같은 UI 요소일 가능성이
      // 크다. "왼쪽에 텍스트가 있는지"로 판단하면 헤더 줄의 "coupang" 로고 글자 같은
      // 것 때문에 안 걸러지는 경우가 있었다(2026-08-15 재확인) — 그래서 텍스트가
      // 아니라 방금 감지된 상품 썸네일 위치를 기준으로 "왼쪽에 실제 상품 사진이
      // 있는지"를 본다. 진짜 상품 줄은 항상 왼쪽에 썸네일이 있고, 헤더의 검색·
      // 장바구니 아이콘은 왼쪽에 썸네일이 없다.
      const commerceImageBoxes = (commerceImageResult.cropBoxes || []).map((cropBox) => cropBox.box);
      lines = filterIsolatedRightEdgeLines(lines, coordinateSize.width, coordinateSize.height, commerceImageBoxes);
      setOcrLines(lines);
      selectedLineIds = selectedLineIds.filter((id) => lines.some((line) => line.id === id));
      setSelectedOcrLineIds(selectedLineIds);

      // 네이티브가 찾은 썸네일마다 어떤 줄이 상품명인지 JS에서 다시 정한다(위 주석 참고).
      // 상품이 아닌 썸네일(배송완료/반품완료 상태 아이콘 등)은 후보가 없어 자연히 걸러진다.
      const commerceCrops = (commerceImageResult.cropBoxes || [])
        .map((cropBox) => {
          const line = productLineForCropBox(cropBox, lines, coordinateSize);
          if (!line) return null;
          return { ...cropBox, lineId: line.id, draftName: draftNameForOcrLine(line) };
        })
        .filter(Boolean);

      // imageMap은 상품명을 키로 쓰므로, 위에서 상품명을 다시 정했으면 같이 다시 만들어야 한다.
      const commerceImageMap = {};
      commerceCrops.forEach((cropBox) => {
        if (cropBox.imageUri) commerceImageMap[cropBox.draftName] = cropBox.imageUri;
      });

      const commerceDraftNames = Array.from(new Set(commerceCrops.map((cropBox) => cropBox.draftName)));
      if (commerceDraftNames.length) {
        nextDrafts = commerceDraftNames;
      }
      if (commerceCrops.length) {
        // 상품 사진 인식(OpenCV)이 일부 상품에서 실패해도, 텍스트로 이미 선택된
        // 상품까지 함께 사라지면 안 되므로 교체가 아니라 합쳐야 한다.
        selectedLineIds = Array.from(
          new Set([...selectedLineIds, ...commerceCrops.map((cropBox) => cropBox.lineId)])
        );
        setSelectedOcrLineIds(selectedLineIds);
      }
      setCommerceCropBoxes(commerceCrops);
      const filteredDrafts = await filterExcludedProductNames(nextDrafts);
      const excludedDraftNames = nextDrafts.filter((name) => !filteredDrafts.includes(name));
      if (excludedDraftNames.length) {
        // 이미 확정된 선택(텍스트 매칭 + 상품 사진 매칭)을 통째로 다시 계산하면
        // 가격 등 다른 줄이 우연히 텍스트가 겹쳐 잘못 선택될 수 있다. 제외된
        // 상품에 해당하는 줄만 골라서 빼는 방식으로 안전하게 처리한다.
        selectedLineIds = selectedLineIds.filter((id) => {
          const line = lines.find((candidate) => candidate.id === id);
          return line ? !isOcrLineInDrafts(line, excludedDraftNames) : true;
        });
        setSelectedOcrLineIds(selectedLineIds);
      }
      nextDrafts = filteredDrafts;
      setReceiptDrafts(nextDrafts, commerceImageMap);
      // OCR 자동 인식 결과는 아직 "완료"로 확정된 적이 없는 상태다. 여기서 자동
      // 인식 결과 자체를 스냅샷으로 삼으면, 아무것도 안 건드리고 바로 뒤로가기를
      // 눌러도 스냅샷과 현재 상태가 똑같아 되돌린 게 티가 안 난다(2026-08-15 재확인
      // — 뒤로가기를 눌러도 자동 인식된 상품이 그대로 남아있었음). 확정된 적 없는
      // 첫 진입의 "취소 기준"은 빈 상태여야 한다.
      receiptSelectionSnapshotRef.current = { drafts: [], selectedOcrLineIds: [] };
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

  function openReceiptSelector(mode = "box") {
    if (mode === "box") {
      receiptSelectionSnapshotRef.current = { drafts, selectedOcrLineIds };
    }
    setReceiptSelectorMode(mode);
    setReceiptSelectorVisible(true);
  }

  // 박스 모드에서는 박스를 누를 때마다 즉시 drafts/selectedOcrLineIds가 바뀌므로,
  // "완료"와 "뒤로가기"가 똑같이 그냥 닫기만 하면 뒤로가기도 사실상 확정으로
  // 동작해버린다(2026-08-15 피드백 — 뒤로가기는 취소처럼 느껴지는데 선택이 그대로
  // 반영됐다). 위에서 모달을 열 때 떠둔 스냅샷으로, 뒤로가기로 나갈 때만 되돌린다.
  // 페인트(하이라이트) 모드는 "완료"를 눌러야만 drafts가 바뀌므로 되돌릴 게 없다.
  function cancelReceiptSelector() {
    const snapshot = receiptSelectionSnapshotRef.current;
    if (receiptSelectorMode === "box" && snapshot) {
      setReceiptDrafts(snapshot.drafts);
      setSelectedOcrLineIds(snapshot.selectedOcrLineIds);
    }
    setReceiptSelectorVisible(false);
  }

  function draftNamesFromHighlightedOcr(result) {
    const parsedDrafts = parseReceiptLines(result?.text || "");
    if (parsedDrafts.length) return parsedDrafts;
    const fallbackLines = Array.isArray(result?.lines) ? result.lines : [];
    return Array.from(
      new Set(
        fallbackLines
          .map((line) => draftNameForOcrLine(line))
          .filter(Boolean)
        )
    );
  }

  // OCR 박스 좌표는 원근왜곡/EXIF/스케일 문제로 실물이든 화면캡처든 완전히 믿기 어렵다.
  // 그래서 좌표 매칭은 아예 쓰지 않고, 박스로 표시한 영역만 잘라서 그 안만 다시 OCR하는
  // 좌표-독립적인 방식만 사용한다. 박스 하나당 한 번씩 크롭+OCR한다.
  // OCR이 이미 각 줄의 박스 높이를 알고 있으니, 그 중앙값을 캔버스 좌표로 환산해
  // "이 사진에서 글자 한 줄이 대략 몇 px인지" 추정한다. 위치(x,y)는 못 믿어도
  // 높이는 상대적으로 안정적이라 여유값의 기준으로 쓸 수 있다. 사진마다 글자 크기가
  // 다 달라서, 고정 픽셀값보다 이게 훨씬 사진에 맞게 여유를 잡아준다.
  function estimateCanvasLineHeight(canvasWidth, canvasHeight) {
    const canvasSize = { width: canvasWidth, height: canvasHeight };
    // heightRatio를 0으로 넘기면 frameForBox가 높이를 무조건 0으로 계산해버린다(과거
    // estimateHighlighterSize에도 있던 것과 같은 실수). 실제 박스 높이 그대로 받으려면
    // heightRatio=1이어야 한다.
    const heights = ocrLines
      .map((line) => frameForBox(line.box, activeOcrCoordinateSize, canvasSize, 0, 0, 1)?.height)
      .filter((height) => Number.isFinite(height) && height > 2 && height < canvasHeight * 0.1)
      .sort((a, b) => a - b);
    return heights.length ? heights[Math.floor(heights.length / 2)] : null;
  }

  async function draftNamesFromSelection(selection, trueSourceSize, canvasLineHeight) {
    // receiptImageSize(Image.getSize 결과)는 안드로이드 시스템 사진 선택기가 실제 파일이
    // 아니라 선택기 UI용 썸네일 크기를 돌려주는 경우가 있어 못 믿는다(실측 4배 축소된
    // 값이 나온 사례 있음). 실제로 크롭을 수행하는 ImageManipulator가 직접 디코딩해서
    // 알려주는 진짜 크기(trueSourceSize)를 우선 사용한다.
    const sourceWidth = trueSourceSize?.width || receiptImageSize.width || selection.canvasWidth;
    const sourceHeight = trueSourceSize?.height || receiptImageSize.height || selection.canvasHeight;
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
    // 여유는 실제 픽셀(rawCrop) 기준 비율이 아니라 화면(canvas) 기준 고정값으로 준다.
    // 사진마다 해상도가 다 달라서 실제 픽셀 비율로 여유를 주면 사진마다 잘리는 정도가
    // 들쭉날쭉해진다 — 캔버스 기준으로 고정하고 그때그때 실제 픽셀로 환산하면
    // 화면에 보이는 만큼은 항상 같은 여유를 유지할 수 있다.
    // ReceiptSelectorModal의 confirmHighlight()가 더 이상 자체 padding을 붙이지 않으므로
    // 이 값이 유일한 여유분이다. 가로는 사용자가 이미 원하는 폭만큼 드래그해서 그리므로
    // 여유를 거의 안 줘도 된다(오히려 옆 컬럼/가격까지 삼키는 위험만 커짐). 세로는
    // OCR이 글자 위아래 여백을 필요로 하는데, 사진마다 글자 크기가 달라서 고정값 대신
    // 실제 감지된 줄 높이(canvasLineHeight)에 비례해서 잡는다. 못 구하면 예전 고정값으로 폴백.
    // 가로는 최소 보장값(2canvas px)이 고해상도 사진에서 실제 픽셀로는 꽤 커져서
    // (예: scaleX 4배면 8px) 사용자가 그린 폭보다 눈에 띄게 넓게 잘리는 원인이 됐다.
    // 사용자가 이미 원하는 폭만큼 그리므로 가로는 여유를 아예 주지 않는다.
    const canvasMarginX = 0;
    const canvasMarginY = canvasLineHeight ? Math.max(2, Math.round(canvasLineHeight * 0.05)) : 8;
    const marginX = Math.round(canvasMarginX * scaleX);
    const marginY = Math.round(canvasMarginY * scaleY);
    const expandedWidth = Math.min(sourceWidth, rawCrop.width + marginX * 2);
    const expandedHeight = Math.min(sourceHeight, rawCrop.height + marginY * 2);
    const crop = {
      originX: Math.max(0, Math.round(centerX - expandedWidth / 2)),
      originY: Math.max(0, Math.round(centerY - expandedHeight / 2)),
      width: expandedWidth,
      height: expandedHeight
    };
    if (crop.originX + crop.width > sourceWidth) crop.width = Math.max(1, sourceWidth - crop.originX);
    if (crop.originY + crop.height > sourceHeight) crop.height = Math.max(1, sourceHeight - crop.originY);
    const resizeWidth = Math.min(1800, Math.max(1000, crop.width * 2));
    const cropped = await ImageManipulator.manipulateAsync(
      receiptImage,
      [{ crop }, { resize: { width: resizeWidth } }],
      { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG }
    );
    const cropSize = { width: cropped.width || crop.width, height: cropped.height || crop.height };
    const result = await recognizeReceiptImage(cropped.uri, cropSize);
    return { drafts: draftNamesFromHighlightedOcr(result), cropUri: cropped.uri, cropSize };
  }

  async function applyHighlightedReceiptSelection(selections) {
    const selectionList = (Array.isArray(selections) ? selections : [selections]).filter(
      (selection) => selection?.width && selection?.height
    );
    if (!receiptImage || !selectionList.length) return;
    try {
      setReceiptSelectorVisible(false);
      setReceiptStatus(
        selectionList.length > 1
          ? `표시한 ${selectionList.length}개 영역만 다시 읽는 중입니다.`
          : "표시한 영역만 다시 읽는 중입니다."
      );
      // 크롭 좌표 계산에 쓸 "진짜" 이미지 크기를 한 번만 확인해서 모든 박스에 재사용한다.
      let trueSourceSize = null;
      try {
        const probe = await ImageManipulator.manipulateAsync(receiptImage, [], { compress: 1 });
        if (probe?.width && probe?.height) trueSourceSize = { width: probe.width, height: probe.height };
      } catch {
        // 프로브 실패 시 draftNamesFromSelection이 receiptImageSize로 폴백한다.
      }
      const canvasLineHeight = estimateCanvasLineHeight(
        selectionList[0].canvasWidth,
        selectionList[0].canvasHeight
      );
      const resultsPerSelection = [];
      for (const selection of selectionList) {
        resultsPerSelection.push(await draftNamesFromSelection(selection, trueSourceSize, canvasLineHeight));
      }
      const highlightedDrafts = Array.from(new Set(resultsPerSelection.flatMap((item) => item.drafts)));
      setReceiptDrafts(highlightedDrafts);
      setSelectedOcrLineIds([]);
      setCommerceCropBoxes([]);
      setReceiptStatus(
        highlightedDrafts.length
          ? `표시한 영역에서 ${highlightedDrafts.length}개 상품 후보를 찾았습니다.`
          : "표시한 영역에서 상품 후보를 찾지 못했습니다. 상품명 부분을 조금 넓게 표시해 주세요."
      );
    } catch {
      setReceiptStatus("표시한 영역을 읽지 못했습니다. 다시 표시하거나 직접 등록해 주세요.");
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

  // 초기화/일괄 저장 후에도 "영수증 이미지 보기" 카드가 남아있던 버그(2026-08-08) —
  // 두 함수 다 초안(drafts)만 비우고 이미지 자체와 그 OCR 결과는 안 지웠던 게 원인.
  // 이미지 관련 상태를 한곳에 모아 같이 지운다.
  function resetReceiptImageState() {
    setReceiptImage("");
    setReceiptImageSize({ width: 0, height: 0 });
    setOcrCoordinateSize(null);
    setOcrCoordinateOptions([]);
    setOcrCoordinateModeIndex(0);
    setReceiptImageLayout({ width: 0, height: 0 });
    setOcrLines([]);
    setCommerceCropBoxes([]);
    setSelectedOcrLineIds([]);
    setSelectionRects([]);
    setReceiptSourceType("receipt");
    setReceiptSelectorMode("box");
  }

  function resetReceiptDrafts() {
    setDrafts([]);
    setInitialDrafts([]);
    setExcludedDrafts([]);
    setDraftForms({});
    resetReceiptImageState();
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

  async function addAllDrafts() {
    if (!drafts.length || bulkSubmitting) return;
    const finalDrafts = drafts.filter((draftName) => !excludedDrafts.includes(draftName));
    if (!finalDrafts.length) {
      setReceiptStatus("등록할 상품 후보가 없습니다. 필요한 상품을 다시 선택해 주세요.");
      return;
    }

    setBulkSubmitting(true);
    const purchaseUrlsByDraft = {};
    try {
      // 영수증/주문내역에는 구매 링크가 없으니, 상품명으로 쿠팡을 검색해서 채운다.
      // 실패하거나 못 찾은 건 그냥 빈 링크로 등록한다(등록 자체를 막지 않음).
      const results = await Promise.all(
        finalDrafts.map((draftName) => searchCoupangProducts(draftName))
      );
      finalDrafts.forEach((draftName, index) => {
        purchaseUrlsByDraft[draftName] = results[index]?.[0]?.productUrl || "";
      });
    } finally {
      setBulkSubmitting(false);
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
        imageUri: draftForm.imageUri || "",
        purchaseUrl: purchaseUrlsByDraft[draftName] || ""
      };
    });
    setItems((current) => [...nextItems, ...current]);
    setLatestRegisteredId(nextItems[0]?.id || "");
    setDrafts([]);
    setExcludedDrafts([]);
    setDraftForms({});
    resetReceiptImageState();
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
    selectionRects,
    setSelectionRects,
    receiptSelectorVisible,
    setReceiptSelectorVisible,
    receiptImageTypeChooserVisible,
    setReceiptImageTypeChooserVisible,
    openReceiptSelector,
    cancelReceiptSelector,
    applyHighlightedReceiptSelection,
    switchToHighlightMode,
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
    pickReceiptImage,
    selectReceiptImageForType,
    frameForOcrLine,
    frameForCommerceCropBox,
    toggleOcrLine,
    toggleCommerceCropBox,
    applyBulkDraftForm,
    addAllDrafts,
    bulkSubmitting,
    resetReceiptDrafts,
    removeDraft,
    toggleDraftExcluded,
    updateDraftForm,
    pickDraftImage,
    addDraft,
    uploadCurrentOcrFeedback
  };
}

