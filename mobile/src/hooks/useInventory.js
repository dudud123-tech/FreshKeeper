import { useMemo, useState } from "react";
import { Alert } from "react-native";
import { categories } from "../categories";
import { daysUntil, itemCreatedTime, todayIso } from "../utils/date";
import { suggestedExpiryDate, suggestedStorage } from "../utils/expiryPresets";
import {
  chooseItemImage,
  pickItemImageFromLibrary,
  takeItemImagePhoto
} from "../utils/itemImagePicker";

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
  const [focusItemId, setFocusItemId] = useState("");

  const normalizedItems = useMemo(() => {
    return items.map((item) => {
      const storagePreset = suggestedStorage(item.name, item.category, item.storage);
      const nextStorage = item.storage === "냉장" && storagePreset === "냉동" ? "냉동" : item.storage;
      return {
        createdAt: item.createdAt || `${item.expiry || todayIso()}T00:00:00.000`,
        ...item,
        storage: nextStorage
      };
    });
  }, [items]);

  const sortedItems = useMemo(() => {
    const filteredItems = [...normalizedItems]
      .filter((item) => categoryFilter === "전체" || item.category === categoryFilter)
      .filter((item) => {
        if (focusItemId) return item.id === focusItemId;
        const days = daysUntil(item.expiry);
        if (statusFilter === "today") return days === 0;
        if (statusFilter === "expired") return days < 0;
        if (statusFilter === "urgent") return days >= 0 && days <= reminderDays;
        return true;
      });

    const nextItems = filteredItems.sort((a, b) => {
        if (sortMode === "등록일순") {
          return itemCreatedTime(b) - itemCreatedTime(a);
        }
        return daysUntil(a.expiry) - daysUntil(b.expiry);
      });

    return nextItems;
  }, [normalizedItems, categoryFilter, statusFilter, reminderDays, focusItemId, sortMode]);

  const summary = useMemo(() => {
    return normalizedItems.reduce(
      (acc, item) => {
        const days = daysUntil(item.expiry);
        acc.total += 1;
        if (days >= 0 && days <= reminderDays) acc.urgent += 1;
        if (days === 0) acc.today += 1;
        if (days < 0) acc.expired += 1;
        return acc;
      },
      { total: 0, urgent: 0, today: 0, expired: 0 }
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
      purchaseUrl: manualPurchaseUrl.trim()
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
    setItems((current) => current.filter((item) => item.id !== id));
    if (editingId === id) cancelEdit();
  }

  function startEdit(item) {
    setEditingId(item.id);
    setEditForm({
      name: item.name,
      category: item.category,
      storage: item.storage,
      expiryType: item.expiryType || defaultExpiryType,
      expiry: item.expiry,
      purchaseUrl: item.purchaseUrl || ""
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
              name: editForm.name.trim()
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
    startEdit,
    cancelEdit,
    saveEdit
  };
}
