import { useMemo, useState } from "react";
import { Alert } from "react-native";
import { categories } from "../categories";
import { DEFAULT_PURCHASE_URL } from "../constants/purchase";
import { daysUntil, itemCreatedTime, todayIso } from "../utils/date";
import { suggestedExpiryDate, suggestedStorage } from "../utils/expiryPresets";
import {
  chooseItemImage,
  pickItemImageFromLibrary,
  takeItemImagePhoto
} from "../utils/itemImagePicker";

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
  onStartEditScroll
}) {
  const [items, setItems] = useState([]);
  const [mode, setMode] = useState("receipt");
  const [name, setName] = useState("");
  const [manualImageUri, setManualImageUri] = useState("");
  const [manualPurchaseUrl, setManualPurchaseUrl] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [storage, setStorage] = useState(storageTypes[0]);
  const [expiry, setExpiry] = useState(() => suggestedExpiryDate("", categories[0], storageTypes[0]));
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("전체");
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
  }, [normalizedItems, inventoryScope, categoryFilter, favoriteFilter, statusFilter, reminderDays, focusItemId, sortMode]);

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

  function submitManual() {
    const added = addItem({
      name,
      category,
      storage,
      expiryType: defaultExpiryType,
      expiry,
      imageUri: manualImageUri,
      purchaseUrl: normalizePurchaseUrl(manualPurchaseUrl)
    });
    if (!added) return;
    setName("");
    setManualImageUri("");
    setManualPurchaseUrl("");
    setCategory(categories[0]);
    setStorage(storageTypes[0]);
    setExpiry(suggestedExpiryDate("", categories[0], storageTypes[0]));
    onManualSubmit?.();
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

  function startEdit(item) {
    setEditingId(item.id);
    setEditForm({
      name: item.name,
      category: item.category,
      storage: item.storage,
      expiryType: item.expiryType || defaultExpiryType,
      expiry: item.expiry,
      purchaseUrl: item.purchaseUrl || DEFAULT_PURCHASE_URL
    });
    onStartEditScroll?.(item.id);
  }

  function cancelEdit() {
    setEditingId("");
    setEditForm(null);
  }

  function saveEdit() {
    if (!editForm?.name?.trim() || !editForm?.expiry?.trim()) {
      Alert.alert("입력 필요", "상품명과 날짜를 입력해 주세요.");
      return;
    }
    setItems((current) =>
      current.map((item) =>
        item.id === editingId
          ? {
              ...item,
              ...editForm,
              name: editForm.name.trim(),
              purchaseUrl: normalizePurchaseUrl(editForm.purchaseUrl)
            }
          : item
      )
    );
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
    manualPurchaseUrl,
    setManualPurchaseUrl,
    category,
    setCategory,
    storage,
    setStorage,
    expiry,
    setExpiry,
    editingId,
    editForm,
    setEditForm,
    categoryFilter,
    setCategoryFilter,
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
    startEdit,
    cancelEdit,
    saveEdit
  };
}
