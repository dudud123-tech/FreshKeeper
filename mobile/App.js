import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  BackHandler,
  DeviceEventEmitter,
  NativeModules,
  ScrollView,
  useWindowDimensions,
  View
} from "react-native";
import { categories, suggestCategory } from "./src/categories";
import AddItemPage from "./src/components/AddItemPage";
import AppShell, { appShellStyles } from "./src/components/AppShell";
import CalendarModal from "./src/components/CalendarModal";
import HomePage from "./src/components/HomePage";
import InventoryList from "./src/components/InventoryList";
import LaunchScreen from "./src/components/LaunchScreen";
import ReceiptSelectorModal from "./src/components/ReceiptSelectorModal";
import SettingsPanel from "./src/components/SettingsPanel";
import { useAuth } from "./src/hooks/useAuth";
import { useExpiryNotifications } from "./src/hooks/useExpiryNotifications";
import { useFamilySync } from "./src/hooks/useFamilySync";
import { useInventory } from "./src/hooks/useInventory";
import { useReceiptFlow } from "./src/hooks/useReceiptFlow";
import {
  todayIso,
} from "./src/utils/date";
import { chooseItemImage } from "./src/utils/itemImagePicker";

const STORAGE_KEY = "fresh-keeper-mobile-items-v1";
const SETTINGS_KEY = "fresh-keeper-mobile-settings-v1";
const storageTypes = ["냉장", "냉동", "실온"];
const categoryFilters = ["전체", ...categories];
const sortOptions = ["소비기한순", "등록일순"];
const DEFAULT_EXPIRY_TYPE = "소비기한";
const APP_BUILD_LABEL = "dev 2026-06-07.1";
const PAGE_HOME = 0;
const PAGE_ADD = 1;
const PAGE_INVENTORY = 2;
const SharedImage = NativeModules.SharedImage;
let sessionPage = PAGE_HOME;
let launchScreenShown = false;

export default function App() {
  const {
    fontScale,
    height: viewportHeight,
    scale: displayScale,
    width: viewportWidth
  } = useWindowDimensions();
  const displayLayoutKey = `${viewportWidth}-${viewportHeight}-${displayScale}-${fontScale}`;
  const inventoryScrollRef = useRef(null);
  const inventoryViewportHeightRef = useRef(0);
  const itemLayoutMapRef = useRef({});
  const calendarCallbackRef = useRef(null);
  const [page, setPage] = useState(sessionPage);
  const [calendar, setCalendar] = useState({ visible: false, value: todayIso() });
  const [reminderDays, setReminderDays] = useState(3);
  const {
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
  } = useInventory({
    defaultExpiryType: DEFAULT_EXPIRY_TYPE,
    storageTypes,
    sortOptions,
    reminderDays,
    onManualSubmit: () => goToPage(PAGE_INVENTORY),
    onStartEditScroll: (itemId) => {
      setTimeout(() => scrollItemToCenter(itemId), 120);
      setTimeout(() => scrollItemToCenter(itemId), 420);
    }
  });
  const [settingsTab, setSettingsTab] = useState("alert");
  const [settingsReady, setSettingsReady] = useState(false);
  const {
    user: authUser,
    authReady,
    authBusy,
    authProviderBusy,
    authStatus,
    googleLoginConfigured,
    kakaoLoginConfigured,
    naverLoginConfigured,
    loginWithGoogle,
    loginWithKakao,
    loginWithNaver,
    logout,
    removeAccount
  } = useAuth();
  const [, setTotalHighlighted] = useState(false);
  const [latestRegisteredId, setLatestRegisteredId] = useState("");
  const {
    receiptSourceType,
    receiptInteractionMode,
    receiptSelectorMode,
    receiptImage,
    receiptImageSize,
    activeOcrCoordinateSize,
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
  } = useReceiptFlow({
    appVersion: APP_BUILD_LABEL,
    defaultExpiryType: DEFAULT_EXPIRY_TYPE,
    suggestCategory,
    addItem,
    setItems,
    setMode,
    goToPage,
    addPage: PAGE_ADD,
    inventoryPage: PAGE_INVENTORY,
    setLatestRegisteredId,
    setTotalHighlighted
  });
  const {
    notificationSettings,
    setNotificationSettings,
    normalizeNotificationSettings
  } = useExpiryNotifications({ items, reminderDays, settingsReady });
  const {
    familySettings,
    setFamilySettings,
    familyCodeInput,
    setFamilyCodeInput,
    familyStatus,
    familyItemCount,
    familyMembers,
    familyJoinRequests,
    normalizeFamilyCode,
    normalizeFamilySettings,
    shareFamilyDigest,
    shareFamilyCode,
    createFamilyShareCode,
    connectFamilyShareCode,
    pullFamilyItems,
    disconnectFamilyShare,
    removeMember,
    checkFamilyJoinRequest,
    decideJoinRequest
  } = useFamilySync({
    items,
    setItems,
    settingsReady,
    reminderDays,
    defaultExpiryType: DEFAULT_EXPIRY_TYPE,
    authUser
  });
  const [launchVisible, setLaunchVisible] = useState(!launchScreenShown);
  const sharedImageInFlightRef = useRef(false);
  const createReceiptCandidatesRef = useRef(createReceiptCandidates);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (value) setItems(JSON.parse(value));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    createReceiptCandidatesRef.current = createReceiptCandidates;
  }, [createReceiptCandidates]);

  useEffect(() => {
    consumeSharedImage();
    const sharedImageSubscription = DeviceEventEmitter.addListener("FreshKeeperSharedImageIntent", consumeSharedImage);
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") consumeSharedImage();
    });
    return () => {
      sharedImageSubscription.remove();
      subscription.remove();
    };
  }, []);

  async function consumeSharedImage() {
    if (!SharedImage?.consumeInitialImage || sharedImageInFlightRef.current) return;
    try {
      sharedImageInFlightRef.current = true;
      const sharedImage = await SharedImage.consumeInitialImage();
      if (sharedImage) {
        await createReceiptCandidatesRef.current(sharedImage, { sourceType: "auto" });
      }
    } catch {
      Alert.alert("이미지 공유 실패", "공유된 이미지를 불러오지 못했습니다. 갤러리에서 다시 선택해 주세요.");
    } finally {
      sharedImageInFlightRef.current = false;
    }
  }

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY)
      .then((value) => {
        if (!value) return;
        const settings = JSON.parse(value);
        if (typeof settings.reminderDays === "number") setReminderDays(settings.reminderDays);
        if (settings.notifications) setNotificationSettings(normalizeNotificationSettings(settings.notifications));
        if (settings.feedback) setFeedbackSettings(normalizeFeedbackSettings(settings.feedback));
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
      JSON.stringify({ reminderDays, notifications: notificationSettings, feedback: feedbackSettings, family: familySettings })
    ).catch(() => undefined);
  }, [reminderDays, notificationSettings, feedbackSettings, familySettings, settingsReady]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (page !== PAGE_HOME) {
        goToPage(PAGE_HOME);
        return true;
      }

      Alert.alert("앱 종료", "앱을 종료하시겠습니까?", [
        { text: "취소", style: "cancel" },
        { text: "종료", style: "destructive", onPress: () => BackHandler.exitApp() }
      ]);
      return true;
    });

    return () => subscription.remove();
  }, [page]);

  function goToPage(nextPage) {
    sessionPage = nextPage;
    setPage(nextPage);
  }

  function finishLaunch() {
    launchScreenShown = true;
    setLaunchVisible(false);
  }

  function goToInventory(nextStatusFilter = "all", options = {}) {
    setStatusFilter(nextStatusFilter);
    if (nextStatusFilter === "all") setCategoryFilter("전체");
    if (!options.scrollToLatest) setFocusItemId("");
    if (options.scrollToLatest && latestRegisteredId) setFocusItemId(latestRegisteredId);
    goToPage(PAGE_INVENTORY);
    setTimeout(() => scrollInventory(options.scrollToLatest), 120);
    if (options.scrollToLatest) setTimeout(() => scrollInventory(true), 420);
    if (options.clearHighlight) setTotalHighlighted(false);
  }

  function applyItemImage(itemId, imageUri) {
    setItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              imageUri
            }
          : item
      )
    );
  }

  async function changeItemImage(itemId) {
    chooseItemImage({
      onSelected: (imageUri) => applyItemImage(itemId, imageUri),
      libraryPermissionMessage: "상품 이미지를 바꾸려면 사진 접근 권한이 필요합니다.",
      cameraPermissionMessage: "상품 사진을 촬영하려면 카메라 권한이 필요합니다."
    });
  }

  function scrollInventory(scrollToLatest) {
    const layout = itemLayoutMapRef.current[latestRegisteredId];
    if (scrollToLatest && latestRegisteredId && layout) {
      inventoryScrollRef.current?.scrollTo({ y: Math.max(layout.y - 16, 0), animated: true });
      return;
    }
    inventoryScrollRef.current?.scrollTo({ y: 0, animated: true });
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

  function scrollItemToCenter(itemId) {
    const layout = itemLayoutMapRef.current[itemId];
    if (!layout) return;
    const visibleHeight = inventoryViewportHeightRef.current || viewportHeight * 0.55;
    const targetOffset = Math.max(layout.y - (visibleHeight - layout.height) / 2, 0);
    inventoryScrollRef.current?.scrollTo({ y: targetOffset, animated: true });
  }


  return (
    <AppShell
      key={displayLayoutKey}
      page={page}
      onPageChange={goToPage}
      hideBottomNav={launchVisible}
      overlays={
        <>
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
            lines={ocrLines}
            cropBoxes={commerceCropBoxes}
            mode={receiptSelectorMode}
            selectedIds={selectedOcrLineIds}
            highlightMarks={highlightMarks}
            setHighlightMarks={setHighlightMarks}
            onToggleLine={toggleOcrLine}
            onToggleCropBox={toggleCommerceCropBox}
            onConfirmHighlight={applyHighlightedReceiptSelection}
            onClose={() => setReceiptSelectorVisible(false)}
          />
          {launchVisible ? <LaunchScreen onDone={finishLaunch} /> : null}
        </>
      }
    >
            <HomePage
              items={items}
              summary={summary}
              reminderDays={reminderDays}
              onOpenInventory={goToInventory}
              onOpenAdd={() => goToPage(PAGE_ADD)}
              onChangeItemImage={changeItemImage}
            />

            <AddItemPage
              mode={mode}
              setMode={setMode}
              name={name}
              setName={setName}
              manualImageUri={manualImageUri}
              setManualImageUri={setManualImageUri}
              manualPurchaseUrl={manualPurchaseUrl}
              setManualPurchaseUrl={setManualPurchaseUrl}
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
              pickManualImage={pickManualImage}
              takeManualImagePhoto={takeManualImagePhoto}
              changeManualImage={changeManualImage}
              takeReceiptPhoto={takeReceiptPhoto}
              pickReceiptImage={pickReceiptImage}
              selectReceiptImageForType={selectReceiptImageForType}
              receiptImageTypeChooserVisible={receiptImageTypeChooserVisible}
              setReceiptImageTypeChooserVisible={setReceiptImageTypeChooserVisible}
              receiptSourceType={receiptSourceType}
              receiptInteractionMode={receiptInteractionMode}
              drafts={drafts}
              excludedDrafts={excludedDrafts}
              receiptImage={receiptImage}
              ocrLines={ocrLines}
              commerceCropBoxes={commerceCropBoxes}
              setReceiptSelectorVisible={setReceiptSelectorVisible}
              openReceiptSelector={openReceiptSelector}
              setReceiptImageLayout={setReceiptImageLayout}
              setReceiptImageSize={setReceiptImageSize}
              frameForOcrLine={frameForOcrLine}
              selectedOcrLineIds={selectedOcrLineIds}
              toggleOcrLine={toggleOcrLine}
              toggleCommerceCropBox={toggleCommerceCropBox}
              receiptStatus={receiptStatus}
              frameForCommerceCropBox={frameForCommerceCropBox}
              bulkDraftForm={bulkDraftForm}
              applyBulkDraftForm={applyBulkDraftForm}
              addAllDrafts={addAllDrafts}
              resetReceiptDrafts={resetReceiptDrafts}
              draftForms={draftForms}
              DEFAULT_EXPIRY_TYPE={DEFAULT_EXPIRY_TYPE}
              removeDraft={removeDraft}
              toggleDraftExcluded={toggleDraftExcluded}
              updateDraftForm={updateDraftForm}
              pickDraftImage={pickDraftImage}
              addDraft={addDraft}
            />

            <InventoryList
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
              onChangeItemImage={changeItemImage}
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

            <ScrollView style={appShellStyles.screen} contentContainerStyle={appShellStyles.page} keyboardShouldPersistTaps="handled">
              <SettingsPanel
                settingsTab={settingsTab}
                setSettingsTab={setSettingsTab}
                reminderDays={reminderDays}
                setReminderDays={setReminderDays}
                notificationSettings={notificationSettings}
                setNotificationSettings={setNotificationSettings}
                shareFamilyDigest={shareFamilyDigest}
                shareFamilyCode={shareFamilyCode}
                familyCodeInput={familyCodeInput}
                setFamilyCodeInput={setFamilyCodeInput}
                normalizeFamilyCode={normalizeFamilyCode}
                createFamilyShareCode={createFamilyShareCode}
                connectFamilyShareCode={connectFamilyShareCode}
                familySettings={familySettings}
                setFamilySettings={setFamilySettings}
                pullFamilyItems={pullFamilyItems}
                disconnectFamilyShare={disconnectFamilyShare}
                familyStatus={familyStatus}
                familyItemCount={familyItemCount}
                familyMembers={familyMembers}
                familyJoinRequests={familyJoinRequests}
                removeFamilyMember={removeMember}
                checkFamilyJoinRequest={checkFamilyJoinRequest}
                decideFamilyJoinRequest={decideJoinRequest}
                feedbackSettings={feedbackSettings}
                setFeedbackSettings={setFeedbackSettings}
                feedbackStatus={feedbackStatus}
                authUser={authUser}
                authReady={authReady}
                authBusy={authBusy}
                authProviderBusy={authProviderBusy}
                authStatus={authStatus}
                googleLoginConfigured={googleLoginConfigured}
                kakaoLoginConfigured={kakaoLoginConfigured}
                naverLoginConfigured={naverLoginConfigured}
                loginWithGoogle={loginWithGoogle}
                loginWithKakao={loginWithKakao}
                loginWithNaver={loginWithNaver}
                logout={logout}
                removeAccount={removeAccount}
              />
            </ScrollView>
    </AppShell>
  );
}

