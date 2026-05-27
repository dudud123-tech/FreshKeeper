import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";
import { categories, suggestCategory } from "./src/categories";
import { recognizeReceiptImage } from "./src/ocr";
import { parseReceiptLines } from "./src/receiptParser";

const STORAGE_KEY = "fresh-keeper-mobile-items-v1";
const SETTINGS_KEY = "fresh-keeper-mobile-settings-v1";
const storageTypes = ["냉장", "냉동", "실온"];
const categoryFilters = ["전체", ...categories];
const reminderOptions = [0, 1, 2, 3, 5, 7, 14];
const DEFAULT_EXPIRY_TYPE = "소비기한";
const APP_BUILD_LABEL = "dev 2026-05-26.8";

function todayIso(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return toIsoDate(date);
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function daysUntil(dateValue) {
  const today = parseIsoDate(todayIso());
  const target = parseIsoDate(dateValue);
  return Math.ceil((target - today) / 86400000);
}

function statusFor(item) {
  const days = daysUntil(item.expiry);
  if (days < 0) return { label: `${Math.abs(days)}일 지남`, tone: "expired" };
  if (days === 0) return { label: "오늘까지", tone: "warning" };
  if (days <= 3) return { label: `D-${days}`, tone: "warning" };
  return { label: `D-${days}`, tone: "normal" };
}

function timelineFor(item, reminderDays) {
  const days = daysUntil(item.expiry);
  if (days < 0) {
    return {
      label: "기한이 지났습니다",
      width: "100%",
      tone: "expired"
    };
  }
  if (days === 0) {
    return {
      label: "오늘까지",
      width: "100%",
      tone: "warning"
    };
  }
  if (days <= reminderDays) {
    const width = Math.max(24, Math.round(((reminderDays - days + 1) / Math.max(reminderDays + 1, 1)) * 100));
    return {
      label: `${days}일 남음 · 임박`,
      width: `${width}%`,
      tone: "warning"
    };
  }
  const safeWindow = Math.max(reminderDays + 7, 7);
  const width = Math.max(12, Math.round((1 - Math.min(days - reminderDays, safeWindow) / safeWindow) * 70));
  return {
    label: `${days}일 남음`,
    width: `${width}%`,
    tone: "normal"
  };
}

function formatDateLabel(value) {
  const date = parseIsoDate(value);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export default function App() {
  const { width } = useWindowDimensions();
  const viewportHeight = useWindowDimensions().height;
  const pagerRef = useRef(null);
  const inventoryScrollRef = useRef(null);
  const inventoryViewportHeightRef = useRef(0);
  const itemLayoutMapRef = useRef({});
  const calendarCallbackRef = useRef(null);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [mode, setMode] = useState("manual");
  const [name, setName] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [storage, setStorage] = useState(storageTypes[0]);
  const [expiry, setExpiry] = useState(todayIso());
  const [receiptImage, setReceiptImage] = useState("");
  const [receiptImageSize, setReceiptImageSize] = useState({ width: 0, height: 0 });
  const [ocrCoordinateSize, setOcrCoordinateSize] = useState(null);
  const [receiptImageLayout, setReceiptImageLayout] = useState({ width: 0, height: 0 });
  const [ocrLines, setOcrLines] = useState([]);
  const [selectedOcrLineIds, setSelectedOcrLineIds] = useState([]);
  const [receiptSelectorVisible, setReceiptSelectorVisible] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [draftForms, setDraftForms] = useState({});
  const [bulkDraftForm, setBulkDraftForm] = useState({ expiry: todayIso(7) });
  const [receiptStatus, setReceiptStatus] = useState("영수증을 촬영하거나 이미지를 불러오면 상품 후보를 자동으로 만듭니다.");
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("전체");
  const [statusFilter, setStatusFilter] = useState("all");
  const [focusItemId, setFocusItemId] = useState("");
  const [calendar, setCalendar] = useState({ visible: false, value: todayIso() });
  const [reminderDays, setReminderDays] = useState(3);
  const [totalHighlighted, setTotalHighlighted] = useState(false);
  const [latestRegisteredId, setLatestRegisteredId] = useState("");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (value) setItems(JSON.parse(value));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!receiptImage) return;
    Image.getSize(
      receiptImage,
      (imageWidth, imageHeight) => setReceiptImageSize({ width: imageWidth, height: imageHeight }),
      () => undefined
    );
  }, [receiptImage]);

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY)
      .then((value) => {
        if (!value) return;
        const settings = JSON.parse(value);
        if (typeof settings.reminderDays === "number") setReminderDays(settings.reminderDays);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(() => undefined);
  }, [items]);

  useEffect(() => {
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ reminderDays })).catch(() => undefined);
  }, [reminderDays]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (page === 1) {
        goToPage(0);
        return true;
      }

      Alert.alert("앱 종료", "앱을 종료하시겠습니까?", [
        { text: "취소", style: "cancel" },
        { text: "종료", style: "destructive", onPress: () => BackHandler.exitApp() }
      ]);
      return true;
    });

    return () => subscription.remove();
  }, [page, width]);

  const sortedItems = useMemo(() => {
    return [...items]
      .filter((item) => categoryFilter === "전체" || item.category === categoryFilter)
      .filter((item) => {
        if (focusItemId) return item.id === focusItemId;
        const days = daysUntil(item.expiry);
        if (statusFilter === "today") return days === 0;
        if (statusFilter === "expired") return days < 0;
        if (statusFilter === "urgent") return days >= 0 && days <= reminderDays;
        return true;
      })
      .sort((a, b) => daysUntil(a.expiry) - daysUntil(b.expiry));
  }, [items, categoryFilter, statusFilter, reminderDays, focusItemId]);

  const summary = useMemo(() => {
    return items.reduce(
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
  }, [items, reminderDays]);

  function goToPage(nextPage) {
    setPage(nextPage);
    pagerRef.current?.scrollTo({ x: width * nextPage, animated: true });
  }

  function goToInventory(nextStatusFilter = "all", options = {}) {
    setStatusFilter(nextStatusFilter);
    if (nextStatusFilter === "all") setCategoryFilter("전체");
    if (!options.scrollToLatest) setFocusItemId("");
    if (options.scrollToLatest && latestRegisteredId) setFocusItemId(latestRegisteredId);
    goToPage(1);
    setTimeout(() => scrollInventory(options.scrollToLatest), 120);
    if (options.scrollToLatest) setTimeout(() => scrollInventory(true), 420);
    if (options.clearHighlight) setTotalHighlighted(false);
  }

  function scrollInventory(scrollToLatest) {
    const layout = itemLayoutMapRef.current[latestRegisteredId];
    if (scrollToLatest && latestRegisteredId && layout) {
      inventoryScrollRef.current?.scrollTo({ y: Math.max(layout.y - 16, 0), animated: true });
      return;
    }
    inventoryScrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  function handleSummaryPress(type) {
    if (type === "total") {
      goToInventory("all", { clearHighlight: totalHighlighted, scrollToLatest: totalHighlighted });
      return;
    }
    setFocusItemId("");
    goToInventory(type);
  }

  function openCalendar(value, onSelect) {
    calendarCallbackRef.current = onSelect;
    setCalendar({ visible: true, value: value || todayIso() });
  }

  function selectCalendarDate(value) {
    calendarCallbackRef.current?.(value);
    calendarCallbackRef.current = null;
    setCalendar((current) => ({ ...current, visible: false }));
  }

  function addItem(nextItem) {
    if (!nextItem.name.trim() || !nextItem.expiry.trim()) {
      Alert.alert("입력 필요", "상품명과 날짜를 입력해 주세요.");
      return false;
    }
    setItems((current) => [
      {
        id: nextItem.id || `${Date.now()}-${Math.random()}`,
        createdAt: new Date().toISOString(),
        ...nextItem,
        name: nextItem.name.trim()
      },
      ...current
    ]);
    return true;
  }

  function submitManual() {
    const added = addItem({ name, category, storage, expiryType: DEFAULT_EXPIRY_TYPE, expiry });
    if (!added) return;
    setName("");
    setCategory(categories[0]);
    setStorage(storageTypes[0]);
    setExpiry(todayIso());
    goToPage(1);
  }

  async function createReceiptCandidates(imageAsset) {
    try {
      const imageUri = typeof imageAsset === "string" ? imageAsset : imageAsset.uri;
      setMode("receipt");
      goToPage(0);
      setReceiptImage(imageUri);
      setReceiptImageSize(imageAsset?.width && imageAsset?.height ? { width: imageAsset.width, height: imageAsset.height } : { width: 0, height: 0 });
      setOcrCoordinateSize(null);
      setReceiptImageLayout({ width: 0, height: 0 });
      setOcrLines([]);
      setSelectedOcrLineIds([]);
      setReceiptStatus("영수증을 읽고 상품 후보를 만드는 중입니다.");
      const result = await recognizeReceiptImage(imageUri);
      const drafts = parseReceiptLines(result.text);
      const lines = result.lines || [];
      const coordinateSize = resolveOcrCoordinateSize(result.coordinateSize, imageAsset);
      setOcrLines(lines);
      setOcrCoordinateSize(coordinateSize);
      console.log(
        "[freshkeeper:image-debug]",
        JSON.stringify({
          assetSize: imageAsset?.width && imageAsset?.height ? { width: imageAsset.width, height: imageAsset.height } : null,
          coordinateSize: result.coordinateSize,
          resolvedCoordinateSize: coordinateSize
        })
      );
      setSelectedOcrLineIds(lines.filter((line) => isOcrLineInDrafts(line, drafts)).map((line) => line.id));
      setReceiptDrafts(drafts);
      setReceiptStatus(
        drafts.length > 0
          ? `${result.message || "상품 후보를 만들었습니다."} 이미지에서 필요한 줄을 직접 터치해 후보를 추가할 수도 있습니다.`
          : "상품 후보를 찾지 못했습니다. 인식된 내용을 직접 수정한 뒤 후보를 만들어 주세요."
      );
    } catch (error) {
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
    return frameForBox(line.box, ocrCoordinateSize || receiptImageSize, receiptImageLayout, 28, 12, 0.5);
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
            expiryType: DEFAULT_EXPIRY_TYPE,
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
      expiryType: DEFAULT_EXPIRY_TYPE,
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
  }

  function addAllDrafts() {
    if (!drafts.length) return;
    const nextItems = drafts.map((draftName) => ({
      id: `${Date.now()}-${draftName}-${Math.random()}`,
      createdAt: new Date().toISOString(),
      name: draftName,
      category: draftForms[draftName]?.category || suggestCategory(draftName),
      storage: draftForms[draftName]?.storage || "냉장",
      expiryType: DEFAULT_EXPIRY_TYPE,
      expiry: draftForms[draftName]?.expiry || bulkDraftForm.expiry
    }));
    setItems((current) => [...nextItems, ...current]);
    setLatestRegisteredId(nextItems[0]?.id || "");
    setDrafts([]);
    setDraftForms({});
    setTotalHighlighted(true);
    goToPage(1);
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
        expiryType: DEFAULT_EXPIRY_TYPE,
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
          expiryType: DEFAULT_EXPIRY_TYPE,
          expiry: todayIso(7),
          ...nextForms[draftName],
          ...updates
        };
      });
      return nextForms;
    });
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
      expiryType: item.expiryType || DEFAULT_EXPIRY_TYPE,
      expiry: item.expiry
    });
    setTimeout(() => scrollItemToCenter(item.id), 120);
    setTimeout(() => scrollItemToCenter(item.id), 420);
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

  function scrollItemToCenter(itemId) {
    const layout = itemLayoutMapRef.current[itemId];
    if (!layout) return;
    const visibleHeight = inventoryViewportHeightRef.current || viewportHeight * 0.55;
    const targetOffset = Math.max(layout.y - (visibleHeight - layout.height) / 2, 0);
    inventoryScrollRef.current?.scrollTo({ y: targetOffset, animated: true });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboard}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>Fresh Keeper</Text>
              <View style={styles.titleRow}>
                <Text style={styles.title}>freshkeeper</Text>
                <Text style={styles.versionBadge}>{APP_BUILD_LABEL}</Text>
              </View>
            </View>
            <Text style={styles.pageHint}>{page === 0 ? "상품 등록" : "보관 목록"}</Text>
          </View>

          <View style={styles.summaryGrid}>
            <SummaryTile label="임박" value={summary.urgent} urgent active={statusFilter === "urgent"} onPress={() => handleSummaryPress("urgent")} />
            <SummaryTile label="전체" value={summary.total} active={totalHighlighted || statusFilter === "all"} highlighted={totalHighlighted} onPress={() => handleSummaryPress("total")} />
            <SummaryTile label="오늘" value={summary.today} active={statusFilter === "today"} onPress={() => handleSummaryPress("today")} />
            <SummaryTile label="만료" value={summary.expired} expired active={statusFilter === "expired"} onPress={() => handleSummaryPress("expired")} />
          </View>

          <ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onMomentumScrollEnd={(event) => {
              setPage(Math.round(event.nativeEvent.contentOffset.x / width));
            }}
            style={styles.pager}
          >
            <ScrollView
              ref={inventoryScrollRef}
              style={{ width }}
              contentContainerStyle={styles.page}
              keyboardShouldPersistTaps="handled"
              onLayout={(event) => {
                inventoryViewportHeightRef.current = event.nativeEvent.layout.height;
              }}
            >
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.eyebrow}>Add item</Text>
                    <Text style={styles.sectionTitle}>상품 등록</Text>
                  </View>
                  <View style={styles.tabs}>
                    <TabButton active={mode === "manual"} label="수동" onPress={() => setMode("manual")} />
                    <TabButton active={mode === "receipt"} label="영수증" onPress={() => setMode("receipt")} />
                  </View>
                </View>

                {mode === "manual" ? (
                  <View style={styles.form}>
                    <Field label="상품명">
                      <TextInput
                        value={name}
                        onChangeText={(value) => {
                          setName(value);
                          setCategory(suggestCategory(value));
                        }}
                        placeholder="예: 서울우유, 계란, 딸기"
                        style={styles.input}
                      />
                    </Field>
                    <ChoiceGroup label="카테고리" options={categories} value={category} onChange={setCategory} />
                    <View style={styles.manualInlineGroups}>
                      <View style={styles.inlineGroupWide}>
                        <ChoiceGroup label="보관" options={storageTypes} value={storage} onChange={setStorage} compact />
                      </View>
                    </View>
                    <Field label="날짜">
                      <DateButton value={expiry} onPress={() => openCalendar(expiry, setExpiry)} />
                    </Field>
                    <PrimaryButton label="등록하기" onPress={submitManual} />
                  </View>
                ) : (
                  <View style={styles.form}>
                    <View style={styles.receiptActions}>
                      <PrimaryButton label="영수증 촬영" onPress={takeReceiptPhoto} />
                      <SecondaryButton label="이미지 불러오기" onPress={pickReceiptImage} />
                    </View>
                    {receiptImage ? (
                      <View
                        style={styles.receiptImageWrap}
                        onLayout={(event) => {
                          setReceiptImageLayout({
                            width: event.nativeEvent.layout.width,
                            height: event.nativeEvent.layout.height
                          });
                        }}
                      >
                        <Image
                          source={{ uri: receiptImage }}
                          style={styles.receiptImage}
                          onLoad={(event) => {
                            const source = event.nativeEvent.source;
                            if (source?.width && source?.height) {
                              setReceiptImageSize((current) => (current.width && current.height ? current : { width: source.width, height: source.height }));
                            }
                          }}
                        />
                        {ocrLines.map((line) => {
                          const frame = frameForOcrLine(line);
                          if (!frame) return null;
                          const selected = selectedOcrLineIds.includes(line.id);
                          return (
                            <Pressable
                              key={line.id}
                              accessibilityLabel={`${line.text} 선택`}
                              hitSlop={8}
                              style={[styles.ocrBox, selected ? styles.ocrBoxSelected : styles.ocrBoxUnselected, frame]}
                              onPress={() => toggleOcrLine(line)}
                            />
                          );
                        })}
                      </View>
                    ) : null}
                    {receiptImage && ocrLines.length > 0 ? <SecondaryButton label="영수증 크게 선택하기" onPress={() => setReceiptSelectorVisible(true)} /> : null}
                    <Text style={styles.status}>{receiptStatus}</Text>
                    {drafts.length > 0 ? (
                      <View style={styles.bulkBox}>
                        <Text style={styles.label}>후보 전체 설정</Text>
                        <Field label="날짜">
                          <DateButton value={bulkDraftForm.expiry} compact onPress={() => openCalendar(bulkDraftForm.expiry, (value) => applyBulkDraftForm({ expiry: value }))} />
                        </Field>
                        <PrimaryButton label="모두 등록" onPress={addAllDrafts} />
                      </View>
                    ) : null}
                    <View style={styles.draftList}>
                      {drafts.map((draft) => (
                        <View key={draft} style={styles.draftItem}>
                          <View style={styles.draftText}>
                            <Text style={styles.itemName}>{draft}</Text>
                            <Text style={styles.meta}>
                              {draftForms[draft]?.category || suggestCategory(draft)} · {DEFAULT_EXPIRY_TYPE} {draftForms[draft]?.expiry || bulkDraftForm.expiry}
                            </Text>
                            <View style={styles.draftControls}>
                              <Pressable style={styles.removeDraftButton} accessibilityLabel="후보 삭제" onPress={() => removeDraft(draft)}>
                                <Text style={styles.removeDraftText}>삭제</Text>
                              </Pressable>
                              <View style={styles.draftActionRow}>
                                <Pressable
                                  style={styles.dateMiniButton}
                                  accessibilityLabel="날짜 선택"
                                  onPress={() => openCalendar(draftForms[draft]?.expiry || todayIso(7), (value) => updateDraftForm(draft, { expiry: value }))}
                                >
                                  <Text style={styles.dateMiniIcon}>▦</Text>
                                </Pressable>
                                <Pressable style={styles.smallButton} accessibilityLabel="상품 등록" onPress={() => addDraft(draft)}>
                                  <Text style={styles.smallButtonText}>등록</Text>
                                </Pressable>
                              </View>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>

            <ScrollView style={{ width }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
              <View style={styles.section}>
                <Text style={styles.eyebrow}>Inventory</Text>
                <Text style={styles.sectionTitle}>보관 목록</Text>
                <View style={styles.settingsBox}>
                  <Text style={styles.label}>임박 알림 기준</Text>
                  <Text style={styles.settingDescription}>
                    {reminderDays === 0 ? "당일 상품만 임박으로 표시합니다." : `만료 ${reminderDays}일 전부터 임박으로 표시합니다.`}
                  </Text>
                  <ChoiceGroup label="알림 시작" options={reminderOptions} value={reminderDays} onChange={setReminderDays} formatLabel={(value) => (value === 0 ? "당일" : `${value}일 전`)} />
                </View>
                <ChoiceGroup label="카테고리 필터" options={categoryFilters} value={categoryFilter} onChange={setCategoryFilter} />
                {focusItemId ? (
                  <View style={styles.focusNotice}>
                    <Text style={styles.focusNoticeText}>방금 등록한 상품을 보고 있습니다.</Text>
                    <Pressable style={styles.focusNoticeButton} onPress={() => setFocusItemId("")}>
                      <Text style={styles.focusNoticeButtonText}>전체 목록</Text>
                    </Pressable>
                  </View>
                ) : null}
                <View style={styles.itemList}>
                  {sortedItems.length === 0 ? (
                    <Text style={styles.empty}>조건에 맞는 상품이 없습니다.</Text>
                  ) : (
                    sortedItems.map((item) => {
                      const status = statusFor(item);
                      const timeline = timelineFor(item, reminderDays);
                      const isEditing = editingId === item.id && editForm;
                      return (
                        <View
                          key={item.id}
                          style={[styles.itemCard, isEditing && styles.itemCardEditing]}
                          onLayout={(event) => {
                            itemLayoutMapRef.current[item.id] = {
                              y: event.nativeEvent.layout.y,
                              height: event.nativeEvent.layout.height
                            };
                            if (isEditing) {
                              setTimeout(() => scrollItemToCenter(item.id), 80);
                            }
                          }}
                        >
                          {isEditing ? (
                            <View style={styles.editPanel}>
                              <View style={styles.editBanner}>
                                <Text style={styles.editBannerText}>수정 중</Text>
                              </View>
                              <Field label="상품명">
                                <TextInput
                                  value={editForm.name}
                                  onChangeText={(value) =>
                                    setEditForm((current) => ({
                                      ...current,
                                      name: value,
                                      category: suggestCategory(value)
                                    }))
                                  }
                                  style={styles.input}
                                />
                              </Field>
                              <ChoiceGroup
                                label="카테고리"
                                options={categories}
                                value={editForm.category}
                                onChange={(value) => setEditForm((current) => ({ ...current, category: value }))}
                              />
                              <ChoiceGroup
                                label="보관"
                                options={storageTypes}
                                value={editForm.storage}
                                onChange={(value) => setEditForm((current) => ({ ...current, storage: value }))}
                              />
                              <Field label="날짜">
                                <DateButton
                                  value={editForm.expiry}
                                  onPress={() => openCalendar(editForm.expiry, (value) => setEditForm((current) => ({ ...current, expiry: value })))}
                                />
                              </Field>
                              <View style={styles.cardActions}>
                                <Pressable style={styles.secondaryAction} onPress={cancelEdit}>
                                  <Text style={styles.secondaryActionText}>취소</Text>
                                </Pressable>
                                <Pressable style={styles.editSaveAction} onPress={saveEdit}>
                                  <Text style={styles.saveActionText}>저장</Text>
                                </Pressable>
                              </View>
                            </View>
                          ) : (
                            <>
                              <View style={styles.itemHeader}>
                                <Text style={styles.itemName}>{item.name}</Text>
                                <Text style={[styles.badge, styles[status.tone]]}>{status.label}</Text>
                              </View>
                              <Text style={styles.meta}>
                                {item.category} · {item.storage} · {DEFAULT_EXPIRY_TYPE} {item.expiry}
                              </Text>
                              <ExpiryTimeline timeline={timeline} />
                              <View style={styles.cardActions}>
                                <Pressable style={styles.secondaryAction} onPress={() => startEdit(item)}>
                                  <Text style={styles.secondaryActionText}>수정</Text>
                                </Pressable>
                                <Pressable style={styles.deleteAction} onPress={() => removeItem(item.id)}>
                                  <Text style={styles.deleteText}>삭제</Text>
                                </Pressable>
                              </View>
                            </>
                          )}
                        </View>
                      );
                    })
                  )}
                </View>
              </View>
            </ScrollView>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      <CalendarModal
        visible={calendar.visible}
        value={calendar.value}
        onClose={() => setCalendar((current) => ({ ...current, visible: false }))}
        onSelect={selectCalendarDate}
      />
      <ReceiptSelectorModal
        visible={receiptSelectorVisible}
        imageUri={receiptImage}
        imageSize={receiptImageSize}
        coordinateSize={ocrCoordinateSize || receiptImageSize}
        lines={ocrLines}
        selectedIds={selectedOcrLineIds}
        onToggleLine={toggleOcrLine}
        onClose={() => setReceiptSelectorVisible(false)}
      />
    </SafeAreaView>
  );
}

function ReceiptSelectorModal({ visible, imageUri, imageSize, coordinateSize, lines, selectedIds, onToggleLine, onClose }) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const [viewTransform, setViewTransform] = useState({ scale: 1, translateX: 0, translateY: 0 });
  const gestureStartRef = useRef({
    distance: 0,
    scale: 1,
    translateX: 0,
    translateY: 0,
    x: 0,
    y: 0
  });
  const fallbackWidth = layout.width || 360;
  const imageRatio = imageSize.width && imageSize.height ? imageSize.height / imageSize.width : 1.6;
  const canvasWidth = fallbackWidth;
  const canvasHeight = Math.max(520, Math.round(canvasWidth * imageRatio));
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => viewTransform.scale > 1,
      onMoveShouldSetPanResponder: (event, gestureState) => event.nativeEvent.touches.length >= 2 || Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5,
      onPanResponderGrant: (event, gestureState) => {
        const touches = event.nativeEvent.touches;
        gestureStartRef.current = {
          distance: distanceBetweenTouches(touches),
          scale: viewTransform.scale,
          translateX: viewTransform.translateX,
          translateY: viewTransform.translateY,
          x: gestureState.x0,
          y: gestureState.y0
        };
      },
      onPanResponderMove: (event, gestureState) => {
        const touches = event.nativeEvent.touches;
        const start = gestureStartRef.current;

        if (touches.length >= 2 && start.distance > 0) {
          const nextScale = clamp(start.scale * (distanceBetweenTouches(touches) / start.distance), 1, 4);
          setViewTransform({
            scale: nextScale,
            translateX: start.translateX,
            translateY: start.translateY
          });
          return;
        }

        if (start.scale > 1) {
          setViewTransform({
            scale: start.scale,
            translateX: start.translateX + gestureState.dx,
            translateY: start.translateY + gestureState.dy
          });
        }
      },
      onPanResponderRelease: () => {
        setViewTransform((current) => {
          if (current.scale <= 1.02) return { scale: 1, translateX: 0, translateY: 0 };
          return current;
        });
      }
    })
  ).current;

  useEffect(() => {
    if (visible) setViewTransform({ scale: 1, translateX: 0, translateY: 0 });
  }, [visible, imageUri]);

  function modalFrameForLine(line) {
    return frameForBox(line.box, coordinateSize, { width: canvasWidth, height: canvasHeight }, 32, 12, 0.5);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.selectorScreen}>
        <View style={styles.selectorHeader}>
          <View>
            <Text style={styles.eyebrow}>Receipt picker</Text>
            <Text style={styles.selectorTitle}>영수증에서 줄 선택</Text>
          </View>
          <Pressable style={styles.selectorCloseButton} onPress={onClose}>
            <Text style={styles.selectorCloseText}>닫기</Text>
          </Pressable>
        </View>
        <Text style={styles.selectorHint}>확대 버튼으로 글씨를 키우고, 확대 상태에서는 이미지를 끌어서 이동하세요. 초록색은 후보, 회색은 미선택입니다.</Text>
        <View style={styles.zoomControls}>
          <Pressable style={styles.zoomButton} onPress={() => setViewTransform((current) => ({ ...current, scale: clamp(current.scale - 0.4, 1, 4) }))}>
            <Text style={styles.zoomButtonText}>-</Text>
          </Pressable>
          <Pressable style={styles.zoomResetButton} onPress={() => setViewTransform({ scale: 1, translateX: 0, translateY: 0 })}>
            <Text style={styles.zoomResetText}>{Math.round(viewTransform.scale * 100)}%</Text>
          </Pressable>
          <Pressable style={styles.zoomButton} onPress={() => setViewTransform((current) => ({ ...current, scale: clamp(current.scale + 0.4, 1, 4) }))}>
            <Text style={styles.zoomButtonText}>+</Text>
          </Pressable>
        </View>
        <ScrollView style={styles.selectorScroll} contentContainerStyle={styles.selectorScrollContent} showsVerticalScrollIndicator={false}>
          <View
            style={styles.selectorViewport}
            onLayout={(event) => setLayout({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
            {...panResponder.panHandlers}
          >
            <View
              style={[
                styles.selectorCanvas,
                {
                  width: canvasWidth,
                  height: canvasHeight,
                  transform: [
                    { translateX: viewTransform.translateX },
                    { translateY: viewTransform.translateY },
                    { scale: viewTransform.scale }
                  ]
                }
              ]}
            >
              {imageUri ? <Image source={{ uri: imageUri }} style={styles.selectorImage} /> : null}
              {lines.map((line) => {
                const frame = modalFrameForLine(line);
                if (!frame) return null;
                const selected = selectedIds.includes(line.id);
                return (
                  <Pressable key={line.id} hitSlop={8} style={[styles.ocrBox, selected ? styles.ocrBoxSelected : styles.ocrBoxUnselected, frame]} onPress={() => onToggleLine(line)} />
                );
              })}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function frameForBox(box, imageSize, layout, minWidth, minHeight, heightRatio = 1) {
  if (!box || !imageSize.width || !imageSize.height || !layout.width || !layout.height) return null;
  const scale = Math.min(layout.width / imageSize.width, layout.height / imageSize.height);
  const renderedWidth = imageSize.width * scale;
  const renderedHeight = imageSize.height * scale;
  const offsetX = (layout.width - renderedWidth) / 2;
  const offsetY = (layout.height - renderedHeight) / 2;
  const fullHeight = Math.max(box.height * scale, minHeight);
  const visualHeight = Math.max(fullHeight * heightRatio, minHeight);

  return {
    left: offsetX + box.x * scale,
    top: offsetY + box.y * scale + (fullHeight - visualHeight) / 2,
    width: Math.max(box.width * scale, minWidth),
    height: visualHeight
  };
}

function resolveOcrCoordinateSize(coordinateSize, imageAsset) {
  if (!coordinateSize?.width || !imageAsset?.width || !imageAsset?.height) return coordinateSize || null;
  const widthRatio = coordinateSize.width / imageAsset.width;
  const heightRatio = coordinateSize.height / imageAsset.height;

  if (widthRatio > 0.75 && widthRatio < 1.25 && heightRatio > 0.55 && heightRatio < 1.25) {
    return { width: imageAsset.width, height: imageAsset.height };
  }

  return {
    width: coordinateSize.width,
    height: Math.round(imageAsset.height * (coordinateSize.width / imageAsset.width))
  };
}

function draftNameForOcrLine(line) {
  return parseReceiptLines(line.text)[0] || line.text.trim();
}

function isOcrLineInDrafts(line, drafts) {
  const draftName = draftNameForOcrLine(line).replace(/\s/g, "");
  const lineText = line.text.replace(/\s/g, "");
  return drafts.some((draft) => {
    const normalizedDraft = draft.replace(/\s/g, "");
    return normalizedDraft === draftName || lineText.includes(normalizedDraft) || draftName.includes(normalizedDraft);
  });
}

function distanceBetweenTouches(touches) {
  if (!touches || touches.length < 2) return 0;
  const [first, second] = touches;
  const dx = first.pageX - second.pageX;
  const dy = first.pageY - second.pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function CalendarModal({ visible, value, onClose, onSelect }) {
  const [month, setMonth] = useState(() => startOfMonth(parseIsoDate(value)));

  useEffect(() => {
    if (visible) setMonth(startOfMonth(parseIsoDate(value)));
  }, [visible, value]);

  const days = useMemo(() => buildCalendarDays(month), [month]);
  const selected = value;
  const today = todayIso();

  function moveMonth(offset) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <Pressable style={styles.calendarNav} onPress={() => moveMonth(-1)}>
              <Text style={styles.calendarNavText}>‹</Text>
            </Pressable>
            <Text style={styles.calendarTitle}>
              {month.getFullYear()}년 {month.getMonth() + 1}월
            </Text>
            <Pressable style={styles.calendarNav} onPress={() => moveMonth(1)}>
              <Text style={styles.calendarNavText}>›</Text>
            </Pressable>
          </View>
          <View style={styles.weekRow}>
            {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
              <Text key={day} style={styles.weekText}>
                {day}
              </Text>
            ))}
          </View>
          <View style={styles.calendarGrid}>
            {days.map((day, index) => {
              if (!day) return <View key={`empty-${index}`} style={styles.dayCell} />;
              const iso = toIsoDate(day);
              const isSelected = iso === selected;
              const isToday = iso === today;
              return (
                <Pressable key={iso} style={[styles.dayCell, isSelected && styles.daySelected, isToday && !isSelected && styles.dayToday]} onPress={() => onSelect(iso)}>
                  <Text style={[styles.dayText, isSelected && styles.daySelectedText]}>{day.getDate()}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.calendarActions}>
            <Pressable style={styles.secondaryAction} onPress={onClose}>
              <Text style={styles.secondaryActionText}>닫기</Text>
            </Pressable>
            <Pressable style={styles.saveAction} onPress={() => onSelect(today)}>
              <Text style={styles.saveActionText}>오늘</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function buildCalendarDays(month) {
  const firstDay = month.getDay();
  const lastDate = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: firstDay }, () => null);
  for (let day = 1; day <= lastDate; day += 1) {
    days.push(new Date(month.getFullYear(), month.getMonth(), day));
  }
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function SummaryTile({ label, value, urgent, expired, active, highlighted, onPress }) {
  return (
    <Pressable style={[styles.summaryTile, urgent && styles.summaryUrgent, expired && styles.summaryExpired, active && styles.summaryActive, highlighted && styles.summaryHighlighted]} onPress={onPress}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, urgent && styles.summaryUrgentText, expired && styles.summaryExpiredText]}>{value}</Text>
    </Pressable>
  );
}

function ExpiryTimeline({ timeline }) {
  return (
    <View style={styles.timelineWrap}>
      <View style={styles.timelineTrack}>
        <View style={[styles.timelineFill, styles[`${timeline.tone}Fill`], { width: timeline.width }]} />
      </View>
      <Text style={[styles.timelineLabel, styles[`${timeline.tone}TimelineText`]]}>{timeline.label}</Text>
    </View>
  );
}

function TabButton({ active, label, onPress }) {
  return (
    <Pressable style={[styles.tab, active && styles.tabActive]} onPress={onPress}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Field({ label, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function DateButton({ value, onPress, compact = false }) {
  return (
    <Pressable style={[styles.dateButton, compact && styles.dateButtonCompact]} onPress={onPress}>
      <Text style={[styles.dateText, compact && styles.dateTextCompact]}>{formatDateLabel(value)}</Text>
      {!compact ? <Text style={styles.dateSubText}>{value}</Text> : null}
    </Pressable>
  );
}

function ChoiceGroup({ label, options, value, onChange, formatLabel = (option) => option, compact = false, hideLabel = false }) {
  return (
    <View style={[styles.field, compact && styles.fieldCompact]}>
      {!hideLabel ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.choices}>
        {options.map((option) => (
          <Pressable key={String(option)} style={[styles.choice, compact && styles.choiceCompact, value === option && styles.choiceActive]} onPress={() => onChange(option)}>
            <Text style={[styles.choiceText, compact && styles.choiceTextCompact, value === option && styles.choiceTextActive]}>{formatLabel(option)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function PrimaryButton({ label, onPress }) {
  return (
    <Pressable style={styles.primaryButton} onPress={onPress}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }) {
  return (
    <Pressable style={styles.secondaryButton} onPress={onPress}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5f2eb"
  },
  keyboard: {
    flex: 1
  },
  container: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? 44 : 16
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 10
  },
  eyebrow: {
    color: "#14583f",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 4
  },
  title: {
    color: "#18201c",
    fontSize: 26,
    fontWeight: "900"
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8
  },
  versionBadge: {
    color: "#14583f",
    backgroundColor: "#edf7f2",
    borderWidth: 1,
    borderColor: "#b9dfcf",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 11,
    fontWeight: "900"
  },
  pageHint: {
    marginTop: 4,
    color: "#68716b",
    fontSize: 13,
    fontWeight: "900"
  },
  summaryGrid: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 8
  },
  summaryTile: {
    flex: 1,
    minHeight: 64,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2ddd3",
    backgroundColor: "#fff",
    padding: 10
  },
  summaryUrgent: {
    backgroundColor: "#fff6ee",
    borderColor: "#f0c6ad"
  },
  summaryExpired: {
    backgroundColor: "#fff1ef",
    borderColor: "#e6aaa2"
  },
  summaryActive: {
    borderWidth: 2,
    borderColor: "#1f7a5a"
  },
  summaryHighlighted: {
    backgroundColor: "#edf7f2",
    borderColor: "#1f7a5a"
  },
  summaryLabel: {
    color: "#68716b",
    fontSize: 12,
    fontWeight: "800"
  },
  summaryValue: {
    color: "#18201c",
    fontSize: 23,
    fontWeight: "900",
    marginTop: 5
  },
  summaryUrgentText: {
    color: "#d95f3d"
  },
  summaryExpiredText: {
    color: "#a73727"
  },
  pager: {
    flex: 1
  },
  page: {
    paddingHorizontal: 16,
    paddingBottom: 18
  },
  section: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2ddd3",
    backgroundColor: "#fff",
    padding: 14,
    marginTop: 8
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  sectionTitle: {
    color: "#18201c",
    fontSize: 20,
    fontWeight: "900"
  },
  tabs: {
    flexDirection: "row",
    borderRadius: 8,
    backgroundColor: "#f3f0e8",
    padding: 3
  },
  tab: {
    minHeight: 38,
    minWidth: 78,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center"
  },
  tabActive: {
    backgroundColor: "#1f7a5a"
  },
  tabText: {
    color: "#68716b",
    fontWeight: "900"
  },
  tabTextActive: {
    color: "#fff"
  },
  form: {
    gap: 8,
    marginTop: 10
  },
  field: {
    gap: 7,
    marginTop: 8
  },
  fieldCompact: {
    gap: 5,
    marginTop: 6
  },
  settingsBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2ddd3",
    backgroundColor: "#faf7f0"
  },
  settingDescription: {
    color: "#68716b",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2
  },
  focusNotice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: "#edf7f2",
    borderWidth: 1,
    borderColor: "#b9dfcf",
    padding: 10
  },
  focusNoticeText: {
    flex: 1,
    color: "#14583f",
    fontSize: 13,
    fontWeight: "900"
  },
  focusNoticeButton: {
    minHeight: 34,
    borderRadius: 8,
    backgroundColor: "#1f7a5a",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  focusNoticeButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900"
  },
  label: {
    color: "#68716b",
    fontSize: 13,
    fontWeight: "800"
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#e2ddd3",
    borderRadius: 8,
    backgroundColor: "#fff",
    color: "#18201c",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  dateButton: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: "#e2ddd3",
    borderRadius: 8,
    backgroundColor: "#fff",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  dateButtonCompact: {
    minHeight: 42,
    paddingVertical: 7
  },
  dateText: {
    color: "#18201c",
    fontSize: 15,
    fontWeight: "900"
  },
  dateTextCompact: {
    fontSize: 14
  },
  dateSubText: {
    color: "#68716b",
    fontSize: 12,
    marginTop: 2
  },
  choices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7
  },
  choice: {
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2ddd3",
    backgroundColor: "#f4f1eb",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  choiceCompact: {
    height: 34,
    paddingHorizontal: 9
  },
  choiceActive: {
    backgroundColor: "#1f7a5a",
    borderColor: "#1f7a5a"
  },
  choiceText: {
    color: "#18201c",
    fontWeight: "800"
  },
  choiceTextCompact: {
    fontSize: 13
  },
  choiceTextActive: {
    color: "#fff"
  },
  primaryButton: {
    height: 44,
    borderRadius: 8,
    backgroundColor: "#1f7a5a",
    alignItems: "center",
    justifyContent: "center"
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "900"
  },
  secondaryButton: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2ddd3",
    backgroundColor: "#f4f1eb",
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryButtonText: {
    color: "#18201c",
    fontWeight: "900"
  },
  receiptActions: {
    gap: 10
  },
  hint: {
    color: "#68716b",
    textAlign: "center",
    paddingVertical: 18
  },
  status: {
    color: "#14583f",
    fontSize: 13,
    lineHeight: 19
  },
  manualInlineGroups: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start"
  },
  inlineGroupWide: {
    flex: 1.05
  },
  receiptImageWrap: {
    width: "100%",
    height: 280,
    borderRadius: 8,
    backgroundColor: "#faf7f0",
    overflow: "hidden"
  },
  receiptImage: {
    width: "100%",
    height: "100%",
    resizeMode: "contain"
  },
  ocrBox: {
    position: "absolute",
    borderWidth: 1,
    borderRadius: 4
  },
  ocrBoxUnselected: {
    borderColor: "#7d857f",
    backgroundColor: "rgba(104, 113, 107, 0.015)"
  },
  ocrBoxSelected: {
    borderColor: "#1f7a5a",
    backgroundColor: "rgba(31, 122, 90, 0.045)"
  },
  ocrPicker: {
    gap: 8,
    marginTop: 4
  },
  ocrLineList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7
  },
  ocrLineChip: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d9cfc0",
    backgroundColor: "#fff",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  ocrLineChipSelected: {
    borderColor: "#1f7a5a",
    backgroundColor: "#edf7f2"
  },
  ocrLineText: {
    color: "#18201c",
    fontSize: 13,
    fontWeight: "800"
  },
  ocrLineTextSelected: {
    color: "#14583f"
  },
  selectorScreen: {
    flex: 1,
    backgroundColor: "#f5f2eb"
  },
  selectorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 24 : 10,
    paddingBottom: 10
  },
  selectorTitle: {
    color: "#18201c",
    fontSize: 22,
    fontWeight: "900"
  },
  selectorCloseButton: {
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: "#1f7a5a",
    justifyContent: "center",
    paddingHorizontal: 14
  },
  selectorCloseText: {
    color: "#fff",
    fontWeight: "900"
  },
  selectorHint: {
    color: "#68716b",
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 16,
    paddingBottom: 10
  },
  zoomControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 10
  },
  zoomButton: {
    width: 44,
    height: 38,
    borderRadius: 8,
    backgroundColor: "#1f7a5a",
    alignItems: "center",
    justifyContent: "center"
  },
  zoomButtonText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 26
  },
  zoomResetButton: {
    minWidth: 72,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#b9dfcf",
    backgroundColor: "#edf7f2",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  zoomResetText: {
    color: "#14583f",
    fontWeight: "900"
  },
  selectorScroll: {
    flex: 1
  },
  selectorScrollContent: {
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 14
  },
  selectorViewport: {
    width: "100%",
    minHeight: 620,
    alignItems: "center",
    justifyContent: "flex-start",
    overflow: "hidden"
  },
  selectorCanvas: {
    backgroundColor: "#faf7f0",
    borderRadius: 8,
    overflow: "hidden"
  },
  selectorImage: {
    width: "100%",
    height: "100%",
    resizeMode: "contain"
  },
  selectorLinePanel: {
    borderTopWidth: 1,
    borderColor: "#e2ddd3",
    backgroundColor: "#fff",
    padding: 12,
    gap: 8
  },
  selectorLineList: {
    gap: 7,
    paddingRight: 12
  },
  draftList: {
    gap: 10
  },
  bulkBox: {
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d9cfc0",
    backgroundColor: "#faf7f0",
    padding: 10
  },
  draftItem: {
    gap: 6,
    borderWidth: 1,
    borderColor: "#e2ddd3",
    borderRadius: 8,
    padding: 9
  },
  draftText: {
    gap: 3
  },
  draftControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 5
  },
  draftActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  removeDraftButton: {
    minHeight: 32,
    justifyContent: "center",
    paddingHorizontal: 2
  },
  removeDraftText: {
    color: "#9f3929",
    fontSize: 13,
    fontWeight: "900"
  },
  dateMiniButton: {
    width: 36,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d9cfc0",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 0
  },
  dateMiniIcon: {
    color: "#18201c",
    fontSize: 18,
    fontWeight: "900"
  },
  smallButton: {
    minWidth: 50,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#edf7f2",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 0
  },
  smallButtonText: {
    color: "#14583f",
    fontSize: 13,
    fontWeight: "900"
  },
  itemList: {
    gap: 10,
    marginTop: 14
  },
  empty: {
    color: "#68716b",
    textAlign: "center",
    paddingVertical: 18
  },
  itemCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2ddd3",
    padding: 12
  },
  itemCardEditing: {
    borderWidth: 2,
    borderColor: "#d95f3d",
    backgroundColor: "#fff8f1"
  },
  editPanel: {
    gap: 4
  },
  editBanner: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#d95f3d",
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 4
  },
  editBannerText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900"
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8
  },
  itemName: {
    color: "#18201c",
    fontSize: 16,
    fontWeight: "900",
    flexShrink: 1
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    color: "#14583f",
    backgroundColor: "#edf7f2",
    fontSize: 12,
    fontWeight: "900"
  },
  normal: {
    color: "#14583f",
    backgroundColor: "#edf7f2"
  },
  warning: {
    color: "#b84b24",
    backgroundColor: "#fff0df"
  },
  expired: {
    color: "#a73727",
    backgroundColor: "#f8e4e0"
  },
  meta: {
    color: "#68716b",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4
  },
  timelineWrap: {
    marginTop: 10,
    gap: 5
  },
  timelineTrack: {
    height: 9,
    borderRadius: 999,
    backgroundColor: "#ece8df",
    overflow: "hidden"
  },
  timelineFill: {
    height: "100%",
    borderRadius: 999
  },
  normalFill: {
    backgroundColor: "#1f7a5a"
  },
  warningFill: {
    backgroundColor: "#d95f3d"
  },
  expiredFill: {
    backgroundColor: "#a73727"
  },
  timelineLabel: {
    fontSize: 12,
    fontWeight: "900"
  },
  normalTimelineText: {
    color: "#14583f"
  },
  warningTimelineText: {
    color: "#b84b24"
  },
  expiredTimelineText: {
    color: "#a73727"
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 10,
    flexWrap: "wrap"
  },
  secondaryAction: {
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: "#f4f1eb",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  secondaryActionText: {
    color: "#18201c",
    fontWeight: "900"
  },
  saveAction: {
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: "#1f7a5a",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  saveActionText: {
    color: "#fff",
    fontWeight: "900"
  },
  editSaveAction: {
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: "#d95f3d",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 9
  },
  deleteAction: {
    minHeight: 38,
    borderRadius: 8,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  deleteText: {
    color: "#9f3929",
    fontWeight: "900"
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(24, 32, 28, 0.36)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18
  },
  calendarCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 8,
    backgroundColor: "#fff",
    padding: 16
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12
  },
  calendarTitle: {
    color: "#18201c",
    fontSize: 18,
    fontWeight: "900"
  },
  calendarNav: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f4f1eb"
  },
  calendarNavText: {
    color: "#18201c",
    fontSize: 30,
    fontWeight: "700"
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: 6
  },
  weekText: {
    flex: 1,
    color: "#68716b",
    textAlign: "center",
    fontWeight: "900"
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8
  },
  dayToday: {
    borderWidth: 1,
    borderColor: "#1f7a5a"
  },
  daySelected: {
    backgroundColor: "#1f7a5a"
  },
  dayText: {
    color: "#18201c",
    fontWeight: "800"
  },
  daySelectedText: {
    color: "#fff"
  },
  calendarActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 12
  }
});
