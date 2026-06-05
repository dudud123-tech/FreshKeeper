import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { categories, suggestCategory } from "./src/categories";
import AddItemPage from "./src/components/AddItemPage";
import CalendarModal from "./src/components/CalendarModal";
import { PageNavButton, SummaryTile } from "./src/components/CommonControls";
import InventoryList from "./src/components/InventoryList";
import LaunchScreen from "./src/components/LaunchScreen";
import ReceiptSelectorModal from "./src/components/ReceiptSelectorModal";
import SettingsPanel from "./src/components/SettingsPanel";
import { useAiUsage } from "./src/hooks/useAiUsage";
import { useExpiryNotifications } from "./src/hooks/useExpiryNotifications";
import { useFamilySync } from "./src/hooks/useFamilySync";
import { useReceiptFlow } from "./src/hooks/useReceiptFlow";
import {
  clamp,
  daysUntil,
  todayIso,
} from "./src/utils/date";

const STORAGE_KEY = "fresh-keeper-mobile-items-v1";
const SETTINGS_KEY = "fresh-keeper-mobile-settings-v1";
const storageTypes = ["냉장", "냉동", "실온"];
const categoryFilters = ["전체", ...categories];
const sortOptions = ["소비기한순", "등록일순"];
const DEFAULT_EXPIRY_TYPE = "소비기한";
const APP_BUILD_LABEL = "dev 2026-06-04.1";
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
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("전체");
  const [sortMode, setSortMode] = useState(sortOptions[0]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [focusItemId, setFocusItemId] = useState("");
  const [calendar, setCalendar] = useState({ visible: false, value: todayIso() });
  const [reminderDays, setReminderDays] = useState(3);
  const {
    aiUsageSettings,
    setAiUsageSettings,
    aiUsageStatus,
    normalizedAiUsage,
    aiFreeRemaining,
    aiTotalRemaining,
    aiAdRemainingToday,
    aiFreeMonthlyLimit,
    aiAdCreditLimit,
    aiDailyAdLimit,
    normalizeAiUsageSettings,
    chargeAiUsage,
    refundAiUsage,
    showAiCreditRequired,
    simulateRewardedAd
  } = useAiUsage();
  const [settingsTab, setSettingsTab] = useState("plan");
  const [settingsReady, setSettingsReady] = useState(false);
  const [totalHighlighted, setTotalHighlighted] = useState(false);
  const [latestRegisteredId, setLatestRegisteredId] = useState("");
  const {
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
  } = useReceiptFlow({
    appVersion: APP_BUILD_LABEL,
    defaultExpiryType: DEFAULT_EXPIRY_TYPE,
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
  });
  const {
    notificationSettings,
    setNotificationSettings,
    notificationStatus,
    normalizeNotificationSettings
  } = useExpiryNotifications({ items, reminderDays, settingsReady });
  const {
    familySettings,
    setFamilySettings,
    familyCodeInput,
    setFamilyCodeInput,
    familyStatus,
    normalizeFamilyCode,
    normalizeFamilySettings,
    shareFamilyDigest,
    createFamilyShareCode,
    connectFamilyShareCode,
    pullFamilyItems,
    disconnectFamilyShare
  } = useFamilySync({
    items,
    setItems,
    settingsReady,
    reminderDays,
    defaultExpiryType: DEFAULT_EXPIRY_TYPE
  });
  const [launchVisible, setLaunchVisible] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (value) setItems(JSON.parse(value));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY)
      .then((value) => {
        if (!value) return;
        const settings = JSON.parse(value);
        if (typeof settings.reminderDays === "number") setReminderDays(settings.reminderDays);
        if (settings.notifications) setNotificationSettings(normalizeNotificationSettings(settings.notifications));
        if (settings.feedback) setFeedbackSettings(normalizeFeedbackSettings(settings.feedback));
        if (settings.aiUsage) setAiUsageSettings(normalizeAiUsageSettings(settings.aiUsage));
        if (settings.family) {
          const nextFamily = normalizeFamilySettings(settings.family);
          setFamilySettings(nextFamily);
          setFamilyCodeInput(nextFamily.code || "");
        }
      })
      .catch(() => undefined)
      .finally(() => setSettingsReady(true));
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(() => undefined);
  }, [items]);

  useEffect(() => {
    if (!settingsReady) return;
    AsyncStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ reminderDays, notifications: notificationSettings, feedback: feedbackSettings, family: familySettings, aiUsage: normalizeAiUsageSettings(aiUsageSettings) })
    ).catch(() => undefined);
  }, [reminderDays, notificationSettings, feedbackSettings, familySettings, aiUsageSettings, settingsReady]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (page !== 0) {
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

  const normalizedItems = useMemo(() => {
    return items.map((item) => ({
      createdAt: item.createdAt || `${item.expiry || todayIso()}T00:00:00.000`,
      ...item
    }));
  }, [items]);

  const sortedItems = useMemo(() => {
    return [...normalizedItems]
      .filter((item) => categoryFilter === "전체" || item.category === categoryFilter)
      .filter((item) => {
        if (focusItemId) return item.id === focusItemId;
        const days = daysUntil(item.expiry);
        if (statusFilter === "today") return days === 0;
        if (statusFilter === "expired") return days < 0;
        if (statusFilter === "urgent") return days >= 0 && days <= reminderDays;
        return true;
      })
      .sort((a, b) => {
        if (sortMode === "등록일순") {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return daysUntil(a.expiry) - daysUntil(b.expiry);
      });
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
        createdAt: nextItem.createdAt || new Date().toISOString(),
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
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboard}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <Text style={styles.title}>오늘까지야</Text>
              <Text style={styles.eyebrow}>소비기한 알림 보관함</Text>
            </View>
          </View>

          <View style={styles.summaryGrid}>
            <SummaryTile label="임박" value={summary.urgent} urgent active={statusFilter === "urgent"} onPress={() => handleSummaryPress("urgent")} />
            <SummaryTile label="전체" value={summary.total} active={totalHighlighted || statusFilter === "all"} highlighted={totalHighlighted} onPress={() => handleSummaryPress("total")} />
            <SummaryTile label="오늘" value={summary.today} active={statusFilter === "today"} onPress={() => handleSummaryPress("today")} />
            <SummaryTile label="만료" value={summary.expired} expired active={statusFilter === "expired"} onPress={() => handleSummaryPress("expired")} />
          </View>

          <View style={styles.pageNav}>
            <PageNavButton active={page === 0} label="상품추가" onPress={() => goToPage(0)} />
            <PageNavButton active={page === 1} label="보관함" onPress={() => goToPage(1)} />
            <PageNavButton active={page === 2} label="설정" onPress={() => goToPage(2)} />
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
            <AddItemPage
              width={width}
              mode={mode}
              setMode={setMode}
              name={name}
              setName={setName}
              category={category}
              setCategory={setCategory}
              categories={categories}
              suggestCategory={suggestCategory}
              storage={storage}
              setStorage={setStorage}
              storageTypes={storageTypes}
              expiry={expiry}
              setExpiry={setExpiry}
              openCalendar={openCalendar}
              submitManual={submitManual}
              takeReceiptPhoto={takeReceiptPhoto}
              pickReceiptImage={pickReceiptImage}
              receiptExtractionMode={receiptExtractionMode}
              setReceiptExtractionMode={setReceiptExtractionMode}
              drafts={drafts}
              aiReceiptLoading={aiReceiptLoading}
              aiReceiptInfo={aiReceiptInfo}
              receiptImage={receiptImage}
              ocrLines={ocrLines}
              setReceiptSelectorVisible={setReceiptSelectorVisible}
              setReceiptImageLayout={setReceiptImageLayout}
              setReceiptImageSize={setReceiptImageSize}
              frameForOcrLine={frameForOcrLine}
              selectedOcrLineIds={selectedOcrLineIds}
              toggleOcrLine={toggleOcrLine}
              ocrCoordinateOptions={ocrCoordinateOptions}
              ocrCoordinateModeIndex={ocrCoordinateModeIndex}
              setOcrCoordinateModeIndex={setOcrCoordinateModeIndex}
              receiptStatus={receiptStatus}
              bulkDraftForm={bulkDraftForm}
              applyBulkDraftForm={applyBulkDraftForm}
              addAllDrafts={addAllDrafts}
              draftForms={draftForms}
              DEFAULT_EXPIRY_TYPE={DEFAULT_EXPIRY_TYPE}
              removeDraft={removeDraft}
              updateDraftForm={updateDraftForm}
              addDraft={addDraft}
            />

            <InventoryList
              width={width}
              scrollRef={inventoryScrollRef}
              onLayout={(event) => {
                inventoryViewportHeightRef.current = event.nativeEvent.layout.height;
              }}
              sortedItems={sortedItems}
              sortOptions={sortOptions}
              sortMode={sortMode}
              setSortMode={setSortMode}
              categoryFilters={categoryFilters}
              categoryFilter={categoryFilter}
              setCategoryFilter={setCategoryFilter}
              focusItemId={focusItemId}
              clearFocusItem={() => setFocusItemId("")}
              editingId={editingId}
              editForm={editForm}
              setEditForm={setEditForm}
              categories={categories}
              storageTypes={storageTypes}
              suggestCategory={suggestCategory}
              openCalendar={openCalendar}
              cancelEdit={cancelEdit}
              saveEdit={saveEdit}
              startEdit={startEdit}
              removeItem={removeItem}
              onItemLayout={(itemId, event, isEditing) => {
                itemLayoutMapRef.current[itemId] = {
                  y: event.nativeEvent.layout.y,
                  height: event.nativeEvent.layout.height
                };
                if (isEditing) {
                  setTimeout(() => scrollItemToCenter(itemId), 80);
                }
              }}
              reminderDays={reminderDays}
              expiryType={DEFAULT_EXPIRY_TYPE}
            />

            <ScrollView style={{ width }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
              <View style={styles.section}>
                <SettingsPanel
                  settingsTab={settingsTab}
                  setSettingsTab={setSettingsTab}
                  aiTotalRemaining={aiTotalRemaining}
                  aiFreeMonthlyLimit={aiFreeMonthlyLimit}
                  reminderDays={reminderDays}
                  setReminderDays={setReminderDays}
                  notificationSettings={notificationSettings}
                  setNotificationSettings={setNotificationSettings}
                  notificationStatus={notificationStatus}
                  shareFamilyDigest={shareFamilyDigest}
                  familyCodeInput={familyCodeInput}
                  setFamilyCodeInput={setFamilyCodeInput}
                  normalizeFamilyCode={normalizeFamilyCode}
                  createFamilyShareCode={createFamilyShareCode}
                  connectFamilyShareCode={connectFamilyShareCode}
                  familySettings={familySettings}
                  pullFamilyItems={pullFamilyItems}
                  disconnectFamilyShare={disconnectFamilyShare}
                  familyStatus={familyStatus}
                  aiAdCreditLimit={aiAdCreditLimit}
                  aiDailyAdLimit={aiDailyAdLimit}
                  aiFreeRemaining={aiFreeRemaining}
                  normalizedAiUsage={normalizedAiUsage}
                  aiAdRemainingToday={aiAdRemainingToday}
                  simulateRewardedAd={simulateRewardedAd}
                  aiUsageStatus={aiUsageStatus}
                  feedbackSettings={feedbackSettings}
                  setFeedbackSettings={setFeedbackSettings}
                  feedbackStatus={feedbackStatus}
                  appVersion={APP_BUILD_LABEL}
                />
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
          coordinateSize={activeOcrCoordinateSize}
          coordinateLabel={ocrCoordinateOptions[ocrCoordinateModeIndex]?.label || "기본"}
          canChangeCoordinate={ocrCoordinateOptions.length > 1}
          lines={ocrLines}
          selectedIds={selectedOcrLineIds}
          onToggleLine={toggleOcrLine}
          onChangeCoordinate={() => setOcrCoordinateModeIndex((current) => (current + 1) % ocrCoordinateOptions.length)}
          onClose={() => setReceiptSelectorVisible(false)}
        />
        {launchVisible ? <LaunchScreen onDone={() => setLaunchVisible(false)} /> : null}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1
  },
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
  brandRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    flexWrap: "wrap",
    gap: 8
  },
  eyebrow: {
    color: "#14583f",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 3
  },
  title: {
    color: "#18201c",
    fontSize: 26,
    fontWeight: "900"
  },
  summaryGrid: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 8
  },
  pageNav: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 8
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
  },});

