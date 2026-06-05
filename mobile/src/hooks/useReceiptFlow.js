import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image } from "react-native";
import { recognizeReceiptImage } from "../ocr";
import { parseReceiptLines } from "../receiptParser";
import { buildOcrFeedbackPayload, feedbackFingerprint, sendOcrFeedback } from "../services/ocrFeedbackApi";
import { requestAiReceiptCandidates as requestAiReceiptCandidatesBase } from "../services/receiptAiApi";
import { todayIso } from "../utils/date";
import { buildOcrCoordinateOptions, draftNameForOcrLine, frameForBox, getImageDisplaySize, isOcrLineInDrafts } from "../utils/receiptOverlay";

export const DEFAULT_FEEDBACK_SETTINGS = { enabled: false };

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
  chargeAiUsage,
  refundAiUsage,
  showAiCreditRequired,
  setLatestRegisteredId,
  setTotalHighlighted
}) {
  const [receiptExtractionMode, setReceiptExtractionMode] = useState("fast");
  const [receiptImage, setReceiptImage] = useState("");
  const [receiptImageSize, setReceiptImageSize] = useState({ width: 0, height: 0 });
  const [ocrCoordinateSize, setOcrCoordinateSize] = useState(null);
  const [ocrCoordinateOptions, setOcrCoordinateOptions] = useState([]);
  const [ocrCoordinateModeIndex, setOcrCoordinateModeIndex] = useState(0);
  const [receiptImageLayout, setReceiptImageLayout] = useState({ width: 0, height: 0 });
  const [ocrLines, setOcrLines] = useState([]);
  const [selectedOcrLineIds, setSelectedOcrLineIds] = useState([]);
  const [receiptSelectorVisible, setReceiptSelectorVisible] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [aiReceiptLoading, setAiReceiptLoading] = useState(false);
  const [aiReceiptInfo, setAiReceiptInfo] = useState(null);
  const [draftForms, setDraftForms] = useState({});
  const [bulkDraftForm, setBulkDraftForm] = useState({ expiry: todayIso(7) });
  const [receiptStatus, setReceiptStatus] = useState("영수증을 촬영하거나 이미지를 불러오면 상품 후보를 자동으로 만듭니다.");
  const [feedbackSettings, setFeedbackSettings] = useState(DEFAULT_FEEDBACK_SETTINGS);
  const [feedbackStatus, setFeedbackStatus] = useState("학습 개선 데이터 전송 꺼짐");
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

  async function requestAiReceiptCandidates({ lines, localCandidates }) {
    return requestAiReceiptCandidatesBase({ lines, localCandidates, appVersion });
  }

  async function createReceiptCandidates(imageAsset) {
    try {
      const imageUri = typeof imageAsset === "string" ? imageAsset : imageAsset.uri;
      const assetSize = imageAsset?.width && imageAsset?.height ? { width: imageAsset.width, height: imageAsset.height } : { width: 0, height: 0 };
      const displaySize = await getImageDisplaySize(imageUri, assetSize);
      setMode("receipt");
      goToPage(0);
      setReceiptImage(imageUri);
      setReceiptImageSize(displaySize);
      setOcrCoordinateSize(null);
      setOcrCoordinateOptions([]);
      setOcrCoordinateModeIndex(0);
      setReceiptImageLayout({ width: 0, height: 0 });
      setOcrLines([]);
      setSelectedOcrLineIds([]);
      setAiReceiptLoading(receiptExtractionMode === "ai");
      setAiReceiptInfo(null);
      setFeedbackUploadKey("");
      feedbackUploadInFlightRef.current = false;
      setReceiptStatus("영수증을 읽고 상품 후보를 만드는 중입니다.");
      const result = await recognizeReceiptImage(imageUri);
      const ruleDrafts = parseReceiptLines(result.text);
      const lines = result.lines || [];
      let nextDrafts = ruleDrafts;
      let aiAssistUsed = false;
      let aiAssistFailed = false;

      if (receiptExtractionMode === "ai" && lines.length > 0) {
        const aiCharge = chargeAiUsage();
        if (!aiCharge.allowed) {
          aiAssistFailed = true;
          setAiReceiptInfo({
            ok: false,
            provider: "local-rules",
            model: "",
            fallbackFrom: "no_ai_credit",
            error: "AI usage credit required",
            candidates: [],
            localCandidateCount: ruleDrafts.length,
            ocrLineCount: lines.length
          });
          showAiCreditRequired();
          setAiReceiptLoading(false);
        } else {
          try {
            setReceiptStatus("OCR 결과를 AI가 한 번 더 정리하는 중입니다.");
            const aiResult = await requestAiReceiptCandidates({ lines, localCandidates: ruleDrafts });
            setAiReceiptInfo({
              ...aiResult.meta,
              candidates: aiResult.candidates,
              localCandidateCount: ruleDrafts.length,
              ocrLineCount: lines.length
            });
            if (aiResult.names.length > 0) {
              nextDrafts = aiResult.names;
              aiAssistUsed = true;
            }
          } catch {
            aiAssistFailed = true;
            refundAiUsage(aiCharge.source);
            setAiReceiptInfo({
              ok: false,
              provider: "local-rules",
              model: "",
              fallbackFrom: "request_failed",
              error: "AI 요청 실패",
              candidates: [],
              localCandidateCount: ruleDrafts.length,
              ocrLineCount: lines.length
            });
            nextDrafts = ruleDrafts;
          } finally {
            setAiReceiptLoading(false);
          }
        }
      } else {
        setAiReceiptLoading(false);
      }

      const coordinateOptions = buildOcrCoordinateOptions(result.coordinateSize, displaySize, assetSize);
      const coordinateSize = coordinateOptions[0]?.size || displaySize;
      setOcrLines(lines);
      setOcrCoordinateSize(coordinateSize);
      setOcrCoordinateOptions(coordinateOptions);
      setOcrCoordinateModeIndex(0);
      setSelectedOcrLineIds(lines.filter((line) => isOcrLineInDrafts(line, nextDrafts)).map((line) => line.id));
      setReceiptDrafts(nextDrafts);
      setReceiptStatus(
        nextDrafts.length > 0
          ? `${aiAssistUsed ? "AI가 상품 후보를 보강했습니다." : result.message || "상품 후보를 만들었습니다."}${aiAssistFailed ? " AI 보조를 잠시 사용할 수 없어 기본 방식으로 처리했습니다." : ""} 이미지에서 필요한 줄을 직접 터치해 후보를 추가할 수도 있습니다.`
          : "상품 후보를 찾지 못했습니다. 인식된 내용에서 직접 수정하거나 후보를 만들어 주세요."
      );
    } catch {
      setAiReceiptLoading(false);
      setReceiptStatus("영수증을 읽지 못했습니다. 이미지를 다시 선택하거나 직접 입력해 주세요.");
    }
  }

  async function pickReceiptImage() {
    setMode("receipt");
    goToPage(0);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("권한 필요", "영수증 이미지를 불러오려면 사진 접근 권한이 필요합니다.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      quality: 0.9
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      await createReceiptCandidates(result.assets[0]);
    }
  }

  async function takeReceiptPhoto() {
    setMode("receipt");
    goToPage(0);
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
      await createReceiptCandidates(result.assets[0]);
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

  function frameForOcrLine(line) {
    return frameForBox(line.box, activeOcrCoordinateSize, receiptImageLayout, 28, 12, 0.5);
  }

  function setReceiptDrafts(nextDrafts) {
    const uniqueDrafts = Array.from(new Set(nextDrafts));
    setDrafts(uniqueDrafts);
    setBulkDraftForm({ expiry: todayIso(7) });
    setDraftForms((current) => {
      const nextForms = {};
      uniqueDrafts.forEach((draft) => {
        nextForms[draft] =
          current[draft] || {
            category: suggestCategory(draft),
            storage: "냉장",
            expiryType: defaultExpiryType,
            expiry: todayIso(7)
          };
      });
      return nextForms;
    });
  }

  function addDraft(draftName) {
    const draftForm = draftForms[draftName] || {
      category: suggestCategory(draftName),
      storage: "냉장",
      expiryType: defaultExpiryType,
      expiry: todayIso(7)
    };
    const itemId = `${Date.now()}-${Math.random()}`;
    const added = addItem({
      id: itemId,
      name: draftName,
      ...draftForm
    });
    if (!added) return;
    setLatestRegisteredId(itemId);
    setDrafts((current) => current.filter((draft) => draft !== draftName));
    setDraftForms((current) => {
      const nextForms = { ...current };
      delete nextForms[draftName];
      return nextForms;
    });
    setTotalHighlighted(true);
    uploadCurrentOcrFeedback("auto");
  }

  function addAllDrafts() {
    if (!drafts.length) return;
    const nextItems = drafts.map((draftName) => ({
      id: `${Date.now()}-${draftName}-${Math.random()}`,
      createdAt: new Date().toISOString(),
      name: draftName,
      category: draftForms[draftName]?.category || suggestCategory(draftName),
      storage: draftForms[draftName]?.storage || "냉장",
      expiryType: defaultExpiryType,
      expiry: draftForms[draftName]?.expiry || bulkDraftForm.expiry
    }));
    setItems((current) => [...nextItems, ...current]);
    setLatestRegisteredId(nextItems[0]?.id || "");
    setDrafts([]);
    setDraftForms({});
    setTotalHighlighted(true);
    goToPage(1);
    uploadCurrentOcrFeedback("auto");
  }

  function removeDraft(draftName) {
    setDrafts((current) => current.filter((draft) => draft !== draftName));
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
        category: suggestCategory(draftName),
        storage: "냉장",
        expiryType: defaultExpiryType,
        expiry: todayIso(7),
        ...current[draftName],
        ...updates
      }
    }));
  }

  function applyBulkDraftForm(updates) {
    const nextBulk = { ...bulkDraftForm, ...updates };
    setBulkDraftForm(nextBulk);
    setDraftForms((current) => {
      const nextForms = { ...current };
      drafts.forEach((draftName) => {
        nextForms[draftName] = {
          category: suggestCategory(draftName),
          storage: "냉장",
          expiryType: defaultExpiryType,
          expiry: todayIso(7),
          ...nextForms[draftName],
          ...updates
        };
      });
      return nextForms;
    });
  }

  async function uploadCurrentOcrFeedback(source = "manual") {
    if (!ocrLines.length) return;
    if (!feedbackSettings.enabled && source !== "manual") return;
    if (feedbackUploadInFlightRef.current) {
      setFeedbackStatus("학습 데이터 전송 중입니다.");
      return;
    }

    const payload = buildOcrFeedbackPayload({ appVersion, lines: ocrLines, selectedIds: selectedOcrLineIds });
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
    receiptExtractionMode,
    setReceiptExtractionMode,
    receiptImage,
    receiptImageSize,
    activeOcrCoordinateSize,
    ocrCoordinateOptions,
    ocrCoordinateModeIndex,
    setOcrCoordinateModeIndex,
    setReceiptImageLayout,
    setReceiptImageSize,
    ocrLines,
    selectedOcrLineIds,
    receiptSelectorVisible,
    setReceiptSelectorVisible,
    drafts,
    aiReceiptLoading,
    aiReceiptInfo,
    draftForms,
    bulkDraftForm,
    receiptStatus,
    feedbackSettings,
    setFeedbackSettings,
    feedbackStatus,
    normalizeFeedbackSettings,
    takeReceiptPhoto,
    pickReceiptImage,
    frameForOcrLine,
    toggleOcrLine,
    applyBulkDraftForm,
    addAllDrafts,
    removeDraft,
    updateDraftForm,
    addDraft,
    uploadCurrentOcrFeedback
  };
}
