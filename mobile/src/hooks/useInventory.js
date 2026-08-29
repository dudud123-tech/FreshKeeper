import { useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { categories } from "../categories";
import { daysUntil, itemCreatedTime, todayIso } from "../utils/date";
import { suggestedExpiryDate, suggestedStorage } from "../utils/expiryPresets";
import {
  chooseItemImage,
  pickItemImageFromLibrary,
  takeItemImagePhoto
} from "../utils/itemImagePicker";
import { convertToPartnerLink, searchCoupangProducts } from "../services/coupangApi";
import { registerBarcodeProduct } from "../services/barcodeApi";
import { setCachedBarcodeImage } from "../services/barcodeImageCache";
import { sendProductClassificationFeedback } from "../services/productClassificationApi";
import { normalizeFeedbackSettings } from "./useReceiptFlow";
import { hasPlan, isRepeating } from "../utils/mealPlan";

// App.js가 설정을 저장하는 키와 반드시 같아야 한다(App.js의 SETTINGS_KEY). 보관함
// 수정 시 분류 피드백을 보낼지 말지 확인하는 용도로만 여기서 직접 읽는다 — 이 훅과
// useReceiptFlow 훅이 서로의 상태를 모르는 별도 인스턴스라 prop으로 못 받는다.
const SETTINGS_KEY = "fresh-keeper-mobile-settings-v1";

async function isClassificationFeedbackEnabled() {
  try {
    const stored = JSON.parse((await AsyncStorage.getItem(SETTINGS_KEY)) || "{}");
    return normalizeFeedbackSettings(stored.feedback).enabled;
  } catch {
    return true;
  }
}

// 등록 직후엔 없던 "실제 정답"이 보관함 수정에서 나온다 — 사용자가 카테고리/보관/
// 소비기한을 직접 고쳤다는 건 원래 분류(예측이든 등록 당시 값이든)가 틀렸다는
// 신호라 분류 정확도 개선에 특히 값지다(2026-08-16 피드백). 등록 당시 예측값이
// 남아있으면(useReceiptFlow.js의 classificationPrediction) 그걸 predicted로 쓰고,
// 직접등록/바코드 등록처럼 예측이 없었던 상품은 predicted 없이 final만 보낸다.
function classificationFeedbackItemForEdit(originalItem, editForm) {
  if (!originalItem) return null;
  const categoryChanged = editForm.category !== originalItem.category;
  const storageChanged = editForm.storage !== originalItem.storage;
  const expiryChanged = editForm.expiry !== originalItem.expiry;
  if (!categoryChanged && !storageChanged && !expiryChanged) return null;

  const prediction = originalItem.classificationPrediction || {};
  return {
    name: editForm.name || originalItem.name,
    predictedCategory: prediction.category || "",
    predictedStorage: prediction.storage || "",
    predictedExpiryDays: prediction.expiryDays,
    predictedSource: prediction.source || "default",
    finalCategory: editForm.category || "기타",
    finalStorage: editForm.storage || "냉장",
    finalExpiryDays: Math.max(0, daysUntil(editForm.expiry || todayIso(7)))
  };
}

const ITEM_STATUS_ACTIVE = "active";
const ITEM_STATUS_COMPLETED = "completed";

function completionCheerFor(item) {
  const days = daysUntil(item?.expiry);
  if (Number.isNaN(days)) {
    return {
      title: "냉장고 구출 완료",
      message: "완료 기록이 쌓이면 다음 장보기가 더 쉬워져요."
    };
  }
  if (days > 0) {
    return {
      title: `${days}일 먼저 구했어요`,
      message: "버리기 전에 잘 처리했어요. 오늘 냉장고 관리 점수 올라갑니다."
    };
  }
  if (days === 0) {
    return {
      title: "오늘 딱 맞게 구했어요",
      message: "소비기한 당일 처리 성공! 완료 탭에 기록해둘게요."
    };
  }
  return {
    title: "정리 완료",
    message: "늦었어도 기록해두면 다음에는 더 빨리 챙길 수 있어요."
  };
}

function normalizePurchaseUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

export function useInventory({
  defaultExpiryType,
  storageTypes,
  sortOptions,
  reminderDays,
  onManualSubmit,
  onStartEditScroll,
  pendingBarcode,
  onBarcodeRegistered
}) {
  const [items, setItems] = useState([]);
  // 등록 화면은 직접등록으로 열린다. 영수증 흐름은 useReceiptFlow가 실제로
  // 영수증 이미지를 받았을 때 setMode("receipt")로 알아서 전환한다.
  const [mode, setMode] = useState("manual");
  const [name, setName] = useState("");
  const [manualImageUri, setManualImageUri] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [category, setCategory] = useState(categories[0]);
  const [storage, setStorage] = useState(storageTypes[0]);
  const [expiry, setExpiry] = useState(() => suggestedExpiryDate("", categories[0], storageTypes[0]));
  // 직접등록에서 바로 잡는 "챙겨 먹기" 값. 예전에는 등록한 뒤 보관함 수정으로
  // 다시 들어가야 했다(2026-08-26 피드백). 비어 있으면 일정 없는 상품이다.
  const [manualPlan, setManualPlan] = useState({ plannedDate: "", plannedMeal: "", plannedTime: "", planRepeat: "" });
  const [editingId, setEditingId] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("전체");
  // 보관 위치 필터. 홈의 전체/냉장/냉동/실온 타일에서 넘어올 때도 이 값을 쓴다.
  const [storageFilter, setStorageFilter] = useState("전체");
  const [sortMode, setSortMode] = useState(sortOptions[0]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [inventoryScope, setInventoryScope] = useState(ITEM_STATUS_ACTIVE);
  const [favoriteFilter, setFavoriteFilter] = useState("all");
  const [focusItemId, setFocusItemId] = useState("");

  const normalizedItems = useMemo(() => {
    return items.map((item) => {
      const storagePreset = suggestedStorage(item.name, item.category, item.storage);
      const nextStorage = item.storage === "냉장" && storagePreset === "냉동" ? "냉동" : item.storage;
      return {
        createdAt: item.createdAt || `${item.expiry || todayIso()}T00:00:00.000`,
        ...item,
        status: item.status === ITEM_STATUS_COMPLETED ? ITEM_STATUS_COMPLETED : ITEM_STATUS_ACTIVE,
        completedAt: item.status === ITEM_STATUS_COMPLETED ? item.completedAt || "" : "",
        favorite: Boolean(item.favorite),
        storage: nextStorage
      };
    });
  }, [items]);

  const sortedItems = useMemo(() => {
    const filteredItems = [...normalizedItems]
      .filter((item) => {
        if (focusItemId) return true;
        return inventoryScope === ITEM_STATUS_COMPLETED
          ? item.status === ITEM_STATUS_COMPLETED
          : item.status !== ITEM_STATUS_COMPLETED;
      })
      .filter((item) => categoryFilter === "전체" || item.category === categoryFilter)
      .filter((item) => storageFilter === "전체" || item.storage === storageFilter)
      .filter((item) => favoriteFilter !== "favorite" || item.favorite)
      .filter((item) => {
        if (focusItemId) return item.id === focusItemId;
        if (inventoryScope === ITEM_STATUS_COMPLETED) return true;
        if (statusFilter === ITEM_STATUS_COMPLETED) return true;
        const days = daysUntil(item.expiry);
        if (statusFilter === "today") return days === 0;
        if (statusFilter === "expired") return days < 0;
        if (statusFilter === "urgent") return days >= 0 && days <= reminderDays;
        if (statusFilter === "week") return days >= 0 && days <= 7;
        return true;
      });

    const nextItems = filteredItems.sort((a, b) => {
        if (sortMode === "등록일순") {
          return itemCreatedTime(b) - itemCreatedTime(a);
        }
        return daysUntil(a.expiry) - daysUntil(b.expiry);
      });

    return nextItems;
  }, [normalizedItems, inventoryScope, categoryFilter, storageFilter, favoriteFilter, statusFilter, reminderDays, focusItemId, sortMode]);

  const summary = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000;
    return normalizedItems.reduce(
      (acc, item) => {
        if (item.status === ITEM_STATUS_COMPLETED) {
          acc.completed += 1;
          const completedTime = new Date(item.completedAt || 0).getTime();
          if (!Number.isNaN(completedTime) && completedTime >= weekAgo) acc.completedThisWeek += 1;
          return acc;
        }
        const days = daysUntil(item.expiry);
        acc.total += 1;
        if (days >= 0 && days <= reminderDays) acc.urgent += 1;
        if (days >= 0 && days <= 7) acc.week += 1;
        if (days === 0) acc.today += 1;
        if (days < 0) acc.expired += 1;
        return acc;
      },
      { total: 0, urgent: 0, week: 0, today: 0, expired: 0, completed: 0, completedThisWeek: 0 }
    );
  }, [normalizedItems, reminderDays]);

  function addItem(nextItem) {
    if (!nextItem.name.trim() || !nextItem.expiry.trim()) {
      Alert.alert("입력 필요", "상품명과 날짜를 입력해 주세요.");
      return false;
    }
    setItems((current) => [
      {
        id: nextItem.id || `${Date.now()}-${Math.random()}`,
        createdAt: nextItem.createdAt || new Date().toISOString(),
        ...nextItem,
        status: ITEM_STATUS_ACTIVE,
        completedAt: "",
        favorite: Boolean(nextItem.favorite),
        name: nextItem.name.trim()
      },
      ...current
    ]);
    return true;
  }

  async function submitManual() {
    if (manualSubmitting) return;
    if (!name.trim() || !expiry.trim()) {
      Alert.alert("입력 필요", "상품명과 날짜를 입력해 주세요.");
      return;
    }

    setManualSubmitting(true);
    let purchaseUrl = "";
    try {
      // 직접등록엔 구매 링크 입력칸이 없다(URL 타입 입력창에 삼성패스 자동완성이
      // 자꾸 떠서 상품명 입력을 방해해 뺐음, 2026-08-06). 저장 시점에 상품명으로
      // 쿠팡을 백그라운드에서 검색해서 채운다. 실패/결과 없음도 그냥 빈 링크로
      // 저장한다(등록 자체는 막지 않음). 링크를 고치고 싶으면 보관함 수정에서.
      const products = await searchCoupangProducts(name);
      purchaseUrl = products[0]?.productUrl || "";

      const added = addItem({
        name,
        category,
        storage,
        expiryType: defaultExpiryType,
        expiry,
        imageUri: manualImageUri,
        purchaseUrl,
        // 바코드로 등록한 상품이면 이 값을 남겨서, 나중에 보관함에서 사진을
        // 바꿔도 그 바코드의 로컬 사진 캐시를 같이 갱신할 수 있게 한다.
        barcode: pendingBarcode || "",
        // 일정을 안 잡았으면 네 필드 모두 빈 값이라 일정 없는 상품이 된다.
        ...manualPlan
      });
      if (!added) return;
      if (pendingBarcode) {
        // 처음 보는 바코드였던 경우: 방금 등록한 상품 정보를 서버에 남겨서
        // 다음에 이 바코드를 스캔하는 사람(나 자신 포함)은 소비기한만 입력하면 되게 한다.
        // await 없이 fire-and-forget으로 두면 내부에서 던진 예외가 조용히
        // 묻혀서 등록 자체가 안 될 수 있어(2026-08-08) 반드시 기다린다.
        await registerBarcodeProduct({
          barcode: pendingBarcode,
          name,
          category,
          storage,
          expiryDays: daysUntil(expiry)
        });
        // 사진은 서버엔 안 보내고(개인정보/용량) 이 기기에만 바코드와 묶어 남긴다 —
        // 같은 기기에서 같은 바코드를 다시 스캔하면 사진도 같이 채워지도록.
        if (manualImageUri) {
          await setCachedBarcodeImage(pendingBarcode, manualImageUri);
        }
        onBarcodeRegistered?.();
      }
      setName("");
      setManualImageUri("");
      setCategory(categories[0]);
      setStorage(storageTypes[0]);
      setExpiry(suggestedExpiryDate("", categories[0], storageTypes[0]));
      setManualPlan({ plannedDate: "", plannedMeal: "", plannedTime: "", planRepeat: "" });
      onManualSubmit?.();
    } finally {
      setManualSubmitting(false);
    }
  }

  async function pickManualImage() {
    await pickItemImageFromLibrary({ onSelected: setManualImageUri });
  }

  async function takeManualImagePhoto() {
    await takeItemImagePhoto({ onSelected: setManualImageUri });
  }

  function changeManualImage() {
    chooseItemImage({ onSelected: setManualImageUri });
  }

  function removeItem(id) {
    const item = normalizedItems.find((target) => target.id === id);
    Alert.alert("상품을 삭제할까요?", `${item?.name || "이 상품"}은 삭제 후 되돌릴 수 없습니다.`, [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: () => {
          setItems((current) => current.filter((target) => target.id !== id));
          if (editingId === id) cancelEdit();
        }
      }
    ]);
  }

  function completeItem(id) {
    const item = normalizedItems.find((target) => target.id === id);
    Alert.alert("소비 완료로 기록할까요?", `${item?.name || "이 상품"}을 완료 목록으로 옮깁니다.`, [
      { text: "취소", style: "cancel" },
      {
        text: "완료",
        onPress: () => {
          const cheer = completionCheerFor(item);
          setItems((current) =>
            current.map((target) =>
              target.id === id
                ? {
                    ...target,
                    status: ITEM_STATUS_COMPLETED,
                    completedAt: new Date().toISOString()
                  }
                : target
            )
          );
          if (editingId === id) cancelEdit();
          Alert.alert(cheer.title, cheer.message);
        }
      }
    ]);
  }

  function restoreItem(id) {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              status: ITEM_STATUS_ACTIVE,
              completedAt: ""
            }
          : item
      )
    );
    if (editingId === id) cancelEdit();
  }

  function toggleFavorite(id) {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              favorite: !item.favorite
            }
          : item
      )
    );
  }

  // 먹는 일정 지정/해제. plannedDate/plannedMeal은 기기 로컬 전용 필드라
  // 가족 공유로 올라가지 않는다(utils/mealPlan.js 주석 참고).
  function setItemPlan(id, { plannedDate, plannedMeal = "", plannedTime = "", planRepeat = "" }) {
    if (!plannedDate) return;
    setItems((current) =>
      current.map((item) =>
        // 일정을 새로 잡으면 "오늘 몫 끝냄" 기록은 지운다 — 예전 날짜의 기록이
        // 남아 있으면 새 일정이 그날 안 뜨는 일이 생긴다.
        item.id === id
          ? { ...item, plannedDate, plannedMeal, plannedTime, planRepeat, planDoneDate: "" }
          : item
      )
    );
  }

  // 홈·먹는 일정의 "오늘 먹었어요". 상품 상태는 건드리지 않는다 — 매일 마시는
  // 우유를 오늘 한 컵 마셨다고 보관함에서 없애면 안 된다. 오늘 몫만 끝났다고
  // 적어두면 planOccursOn이 오늘 목록과 오늘 알림에서 같이 빼준다.
  //
  // 상품 자체를 끝내는 "다 먹었어요"는 보관함 상세 카드의 completeItem이다.
  // done을 false로 주면 되돌린다. 이 동작은 확인 팝업이 없어서(완료와 달리
  // 상품 상태를 안 건드리므로 굳이 물을 일이 아니다) 되돌릴 길은 있어야 한다.
  function setPlanDoneToday(id, done = true) {
    const value = done ? todayIso() : "";
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, planDoneDate: value } : item))
    );
  }

  // 보관함을 떠날 때 목록 보기 상태를 처음으로 되돌린다. 홈 타일(만료/냉장 등)로
  // 들어오거나 등록 직후로 들어오면 필터와 focusItemId가 걸린 채로 남는데, 다른
  // 화면을 갔다가 돌아오면 왜 일부만 보이는지 알 길이 없었다(2026-08-27 피드백).
  //
  // 정렬(sortMode)은 건드리지 않는다 — 화면 안에서 사용자가 직접 고르는 취향이라
  // 진입 경로 때문에 걸리는 값이 아니다.
  function resetInventoryView() {
    setFocusItemId("");
    setStatusFilter("all");
    setInventoryScope(ITEM_STATUS_ACTIVE);
    setCategoryFilter("전체");
    setStorageFilter("전체");
    setFavoriteFilter("all");
  }

  // 날짜가 지난 일정은 앱을 켤 때(그리고 상품 목록이 바뀔 때) 조용히 비운다.
  //
  // 예전에는 "먹었어요" 체크를 눌러야만 없어져서, 안 누르면 홈과 일정 화면에
  // "지난 일정"으로 영원히 남았다. 그런데 지난 일정은 알림도 안 온다 —
  // schedulePlanReminders가 오늘부터 앞으로만 예약하기 때문이다. 화면만 채우고
  // 아무 일도 안 하는 셈이었다(2026-08-29 피드백).
  //
  // 상품을 완료 처리하지는 않는다. 안 먹었는데 먹었다고 기록하면 완료 목록과
  // 랭킹이 거짓이 된다. 일정 필드만 비우고 상품은 보관함에 그대로 둔다 —
  // 소비기한 알림은 계속 온다.
  //
  // 반복 상품은 대상이 아니다. planOccursOn이 원래 날짜와 반복 규칙으로 계산하므로
  // plannedDate를 옮길 필요 없이 알아서 다음 회차에 다시 뜬다.
  useEffect(() => {
    const today = todayIso();
    const stale = items.filter(
      (item) => hasPlan(item) && !isRepeating(item) && item.plannedDate < today
    );
    if (!stale.length) return;
    const staleIds = new Set(stale.map((item) => item.id));
    setItems((current) =>
      current.map((item) =>
        staleIds.has(item.id)
          ? { ...item, plannedDate: "", plannedTime: "", plannedMeal: "", planRepeat: "", planDoneDate: "" }
          : item
      )
    );
  }, [items, setItems]);

  function startEdit(item) {
    setEditingId(item.id);
    setEditForm({
      name: item.name,
      category: item.category,
      storage: item.storage,
      expiryType: item.expiryType || defaultExpiryType,
      expiry: item.expiry,
      purchaseUrl: item.purchaseUrl || "",
      plannedDate: item.plannedDate || "",
      plannedMeal: item.plannedMeal || "",
      plannedTime: item.plannedTime || "",
      planRepeat: item.planRepeat || "",
      memo: item.memo || ""
    });
    onStartEditScroll?.(item.id);
  }

  function cancelEdit() {
    setEditingId("");
    setEditForm(null);
  }

  async function saveEdit() {
    if (editSubmitting) return;
    if (!editForm?.name?.trim() || !editForm?.expiry?.trim()) {
      Alert.alert("입력 필요", "상품명과 날짜를 입력해 주세요.");
      return;
    }

    let purchaseUrl = normalizePurchaseUrl(editForm.purchaseUrl);
    const originalItem = items.find((item) => item.id === editingId);
    const hadPurchaseUrlBefore = Boolean(String(originalItem?.purchaseUrl || "").trim());
    setEditSubmitting(true);
    try {
      // 링크 칸이 비어있어도, 원래 링크가 있던 상품이면 사용자가 일부러 지운 것이니
      // 존중해서 빈 채로 저장한다. 애초에 링크가 없던 상품일 때만 상품명으로 쿠팡을
      // 검색해서 자동으로 채운다. 검색 실패/결과 없음도 그냥 빈 링크로 저장한다.
      if (!purchaseUrl && !hadPurchaseUrlBefore) {
        const products = await searchCoupangProducts(editForm.name);
        purchaseUrl = products[0]?.productUrl || "";
      } else if (purchaseUrl) {
        // 직접 붙여넣은(또는 예전부터 있던) 링크가 일반 쿠팡 링크일 수 있으니
        // 파트너스 링크로 변환한다. 이미 파트너스 링크면 그대로 돌아온다.
        purchaseUrl = await convertToPartnerLink(purchaseUrl);
      }
    } finally {
      setEditSubmitting(false);
    }

    setItems((current) =>
      current.map((item) =>
        item.id === editingId
          ? {
              ...item,
              ...editForm,
              name: editForm.name.trim(),
              purchaseUrl
            }
          : item
      )
    );

    // 분류 피드백 전송은 저장을 막으면 안 되니 fire-and-forget으로 보낸다.
    const feedbackItem = classificationFeedbackItemForEdit(originalItem, editForm);
    if (feedbackItem) {
      isClassificationFeedbackEnabled().then((enabled) => {
        if (enabled) void sendProductClassificationFeedback([feedbackItem]).catch(() => undefined);
      });
    }

    cancelEdit();
  }

  return {
    items,
    setItems,
    mode,
    setMode,
    name,
    setName,
    manualImageUri,
    setManualImageUri,
    manualSubmitting,
    category,
    setCategory,
    storage,
    setStorage,
    expiry,
    setExpiry,
    manualPlan,
    setManualPlan,
    editingId,
    editSubmitting,
    editForm,
    setEditForm,
    categoryFilter,
    setCategoryFilter,
    storageFilter,
    setStorageFilter,
    sortMode,
    setSortMode,
    statusFilter,
    setStatusFilter,
    inventoryScope,
    setInventoryScope,
    favoriteFilter,
    setFavoriteFilter,
    focusItemId,
    setFocusItemId,
    resetInventoryView,
    sortedItems,
    summary,
    addItem,
    submitManual,
    pickManualImage,
    takeManualImagePhoto,
    changeManualImage,
    removeItem,
    completeItem,
    restoreItem,
    toggleFavorite,
    setItemPlan,
    setPlanDoneToday,
    startEdit,
    cancelEdit,
    saveEdit
  };
}
