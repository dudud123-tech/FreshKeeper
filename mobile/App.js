import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  BackHandler,
  DeviceEventEmitter,
  NativeModules,
  Platform,
  ScrollView,
  useWindowDimensions,
  View
} from "react-native";
import mobileAds from "react-native-google-mobile-ads";
import { categories, suggestCategory } from "./src/categories";
import AddItemPage from "./src/components/AddItemPage";
import AppShell, { appShellStyles } from "./src/components/AppShell";
import BarcodeScannerModal from "./src/components/BarcodeScannerModal";
import CalendarModal from "./src/components/CalendarModal";
import ForceUpdateScreen from "./src/components/ForceUpdateScreen";
import HomePage from "./src/components/HomePage";
import InventoryList from "./src/components/InventoryList";
import LaunchScreen from "./src/components/LaunchScreen";
import OnboardingScreen from "./src/components/OnboardingScreen";
import ReceiptSelectorModal from "./src/components/ReceiptSelectorModal";
import SchedulePage from "./src/components/SchedulePage";
import SettingsPanel from "./src/components/SettingsPanel";
import SoftUpdatePrompt from "./src/components/SoftUpdatePrompt";
import WhatsNewModal from "./src/components/WhatsNewModal";
import { useAuth } from "./src/hooks/useAuth";
import { useAppNotifications } from "./src/hooks/useAppNotifications";
import { useFamilySync } from "./src/hooks/useFamilySync";
import { useGrowthSync } from "./src/hooks/useGrowthSync";
import { useInventory } from "./src/hooks/useInventory";
import { useReceiptFlow } from "./src/hooks/useReceiptFlow";
import { fetchAndroidVersionRequirement } from "./src/services/appVersionApi";
import { lookupBarcodeProduct } from "./src/services/barcodeApi";
import { getCachedBarcodeImage, setCachedBarcodeImage } from "./src/services/barcodeImageCache";
import { normalizeProductName } from "./src/services/productClassificationApi";
import {
  todayIso,
} from "./src/utils/date";
import { suggestedExpiryDate, suggestedStorage } from "./src/utils/expiryPresets";
import { toPlanTime } from "./src/utils/mealPlan";
import { chooseItemImage } from "./src/utils/itemImagePicker";

const STORAGE_KEY = "fresh-keeper-mobile-items-v1";
const SETTINGS_KEY = "fresh-keeper-mobile-settings-v1";
const ONBOARDING_KEY = "fresh-keeper-onboarding-seen-v1";
const LAST_SEEN_VERSION_KEY = "fresh-keeper-last-seen-version-code-v1";
const storageTypes = ["냉장", "냉동", "실온"];
const categoryFilters = ["전체", ...categories];
const sortOptions = ["소비기한순", "등록일순"];
const DEFAULT_EXPIRY_TYPE = "소비기한";
const APP_BUILD_LABEL = "dev 2026-06-07.1";
const PAGE_HOME = 0;
const PAGE_ADD = 1;
const PAGE_INVENTORY = 2;
const PAGE_SCHEDULE = 3;
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
  const [barcodeScannerVisible, setBarcodeScannerVisible] = useState(false);
  const [barcodeLookupPending, setBarcodeLookupPending] = useState(false);
  // 처음 보는 바코드를 스캔했을 때만 채워진다 — 이 값이 있으면 직접등록 저장
  // 성공 시 방금 입력한 상품 정보를 이 바코드로 서버에 등록한다.
  const [pendingBarcode, setPendingBarcode] = useState("");
  const {
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
    editingId,
    editSubmitting,
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
    setItemPlan,
    clearItemPlan,
    completePlanOccurrence,
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
    },
    pendingBarcode,
    onBarcodeRegistered: () => setPendingBarcode("")
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
    receiptSelectorMode,
    receiptImage,
    receiptImageSize,
    activeOcrCoordinateSize,
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
    planNotificationSettings,
    setPlanNotificationSettings,
    normalizeNotificationSettings,
    normalizePlanNotificationSettings
  } = useAppNotifications({ items, reminderDays, settingsReady });
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
  const { growthProfile, growthDashboardReport } = useGrowthSync({
    items,
    reminderDays,
    authUser
  });
  const [launchVisible, setLaunchVisible] = useState(!launchScreenShown);
  const [onboardingVisible, setOnboardingVisible] = useState(false);
  const [updateRequired, setUpdateRequired] = useState(false);
  const [updatePlayStoreUrl, setUpdatePlayStoreUrl] = useState("");
  const [whatsNewVisible, setWhatsNewVisible] = useState(false);
  const [whatsNewContent, setWhatsNewContent] = useState(null);
  const [softUpdateVisible, setSoftUpdateVisible] = useState(false);
  const [softUpdatePlayStoreUrl, setSoftUpdatePlayStoreUrl] = useState("");
  const sharedImageInFlightRef = useRef(false);
  const createReceiptCandidatesRef = useRef(createReceiptCandidates);

  useEffect(() => {
    mobileAds().initialize().catch(() => undefined);
  }, []);

  useEffect(() => {
    // 스캔한 바코드를 등록 안 하고 화면을 벗어나면(직접등록 탭 이탈, 다른 페이지
    // 이동 등) pendingBarcode를 비운다 — 나중에 전혀 다른 상품을 저장할 때
    // 엉뚱하게 이 바코드로 등록돼 버리는 걸 막기 위해서다.
    if (mode !== "manual" || page !== PAGE_ADD) {
      setPendingBarcode("");
    }
  }, [mode, page]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    // 서버가 정한 최소 버전보다 낮으면 업데이트 화면으로 막는다. 서버 응답이
    // 없거나(오프라인 등) 버전 정보를 못 읽으면 그냥 통과시킨다(fail open).
    fetchAndroidVersionRequirement().then(async (requirement) => {
      if (!requirement) return;
      const currentVersionCode = Number(Constants.expoConfig?.android?.versionCode);
      const minVersionCode = Number(requirement.minSupportedVersionCode);
      if (!Number.isFinite(currentVersionCode) || !Number.isFinite(minVersionCode)) return;
      if (currentVersionCode < minVersionCode) {
        setUpdatePlayStoreUrl(requirement.playStoreUrl || "");
        setUpdateRequired(true);
        return; // 업데이트부터 해야 하니, 새소식은 실제로 새 버전을 켰을 때 보여준다.
      }

      // 강제 차단 대상은 아니지만 스토어 최신 버전보다 낮으면, 업데이트할지 그냥
      // 쓸지 사용자가 고를 수 있게 물어본다(2026-08-08). Play 스토어 자동 업데이트가
      // 항상 되는 건 아니라서 앱에서도 권유하는 것 — "나중에"를 눌러도 앱은 그대로
      // 쓸 수 있고, 지속적으로 재확인하도록 매 실행마다 다시 물어본다(별도 저장 안 함).
      const latestVersionCode = Number(requirement.latestVersionCode);
      if (Number.isFinite(latestVersionCode) && currentVersionCode < latestVersionCode) {
        setSoftUpdatePlayStoreUrl(requirement.playStoreUrl || "");
        setSoftUpdateVisible(true);
      }

      // 방금 업데이트해서 이전에 기록해둔 버전보다 지금 버전이 높으면 새소식을 한 번
      // 보여준다. 처음 설치한 사용자는 비교할 이전 기록이 없으니 그냥 지금 버전만
      // 조용히 기록하고 넘어간다(온보딩 화면이 그 역할을 대신함).
      const storedRaw = await AsyncStorage.getItem(LAST_SEEN_VERSION_KEY);
      const storedVersionCode = storedRaw ? Number(storedRaw) : null;
      if (storedVersionCode !== null && currentVersionCode > storedVersionCode) {
        const whatsNew = requirement.whatsNew;
        if (whatsNew && Number(whatsNew.versionCode) === currentVersionCode) {
          setWhatsNewContent(whatsNew);
          setWhatsNewVisible(true);
        }
      }
      await AsyncStorage.setItem(LAST_SEEN_VERSION_KEY, String(currentVersionCode));
    });
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (value) setItems(JSON.parse(value));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((value) => {
        if (!value) setOnboardingVisible(true);
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
        if (settings.planNotifications) setPlanNotificationSettings(normalizePlanNotificationSettings(settings.planNotifications));
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
      JSON.stringify({
        reminderDays,
        notifications: notificationSettings,
        planNotifications: planNotificationSettings,
        feedback: feedbackSettings,
        family: familySettings
      })
    ).catch(() => undefined);
  }, [reminderDays, notificationSettings, planNotificationSettings, feedbackSettings, familySettings, settingsReady]);

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

  function finishOnboarding() {
    setOnboardingVisible(false);
    AsyncStorage.setItem(ONBOARDING_KEY, "1").catch(() => undefined);
  }

  function replayOnboarding() {
    setOnboardingVisible(true);
  }

  function goToInventory(nextStatusFilter = "all", options = {}) {
    setStatusFilter(nextStatusFilter);
    setInventoryScope(nextStatusFilter === "completed" ? "completed" : "active");
    if (nextStatusFilter === "all") setCategoryFilter("전체");
    if (!options.scrollToLatest) setFocusItemId("");
    if (options.scrollToLatest && latestRegisteredId) setFocusItemId(latestRegisteredId);
    goToPage(PAGE_INVENTORY);
    setTimeout(() => scrollInventory(options.scrollToLatest), 120);
    if (options.scrollToLatest) setTimeout(() => scrollInventory(true), 420);
    if (options.clearHighlight) setTotalHighlighted(false);
  }

  function applyItemImage(itemId, imageUri) {
    // 바코드로 등록된 상품이면, 나중에 사진을 바꿀 때도 그 바코드의 로컬 사진
    // 캐시를 같이 갱신한다 — 처음 등록할 때만 사진을 넣어야 저장되는 게 아니라
    // 언제든 바꾸면 다음 스캔부터 반영되게(2026-08-08, "이후 추가"도 되게 해달라는 피드백).
    const targetItem = items.find((item) => item.id === itemId);
    if (targetItem?.barcode) {
      setCachedBarcodeImage(targetItem.barcode, imageUri);
    }
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

  function openBarcodeScanner() {
    setBarcodeScannerVisible(true);
  }

  function closeBarcodeScanner() {
    setBarcodeScannerVisible(false);
  }

  // 스캔한 바코드에 쓸 사진을 찾는다. 서버(barcode_products)엔 사진이 없으니
  // 이 기기 안에서만 찾는다. 로컬 캐시만 보면 캐시 기능이 생기기 전에 등록해 둔
  // 상품은 영영 사진이 안 붙어서(2026-08-08 버그), 실제 보관함 상품에서도 찾는다.
  async function resolveBarcodeImageUri(barcode, productName) {
    const cached = await getCachedBarcodeImage(barcode);
    if (cached) return cached;

    // 1) 같은 바코드로 등록해 둔 상품
    const byBarcode = items.find((item) => item.barcode === barcode && item.imageUri);
    if (byBarcode) return byBarcode.imageUri;

    // 2) 같은 상품명으로 등록해 둔 상품(표기 차이는 normalizeProductName으로 흡수)
    const targetName = normalizeProductName(productName);
    if (!targetName) return "";
    const byName = items.find(
      (item) => item.imageUri && normalizeProductName(item.name) === targetName
    );
    return byName?.imageUri || "";
  }

  async function handleBarcodeScanned(barcode) {
    setBarcodeScannerVisible(false);
    setBarcodeLookupPending(true);
    try {
      const { ok, product } = await lookupBarcodeProduct(barcode);

      if (!ok) {
        // 조회 자체가 실패 — 등록된 바코드인지 아닌지 알 수 없다. 여기서 "처음 보는
        // 바코드"라고 안내해 버리면 이미 등록해 둔 상품을 다시 등록하게 만든다.
        Alert.alert(
          "바코드를 확인하지 못했어요",
          "네트워크 상태를 확인하고 다시 스캔해 주세요."
        );
        return;
      }

      if (product) {
        // 이미 등록된 바코드 — 이름/카테고리/보관방식은 그대로 채우고
        // 소비기한만 사용자가 확인/조정하면 된다.
        const nextCategory = product.category || suggestCategory(product.name);
        const nextStorage = product.storage || suggestedStorage(product.name, nextCategory, storage);
        setName(product.name);
        setCategory(nextCategory);
        setStorage(nextStorage);
        setExpiry(
          Number.isFinite(product.expiryDays)
            ? todayIso(product.expiryDays)
            : suggestedExpiryDate(product.name, nextCategory, nextStorage)
        );
        setManualImageUri(await resolveBarcodeImageUri(barcode, product.name));
        setPendingBarcode("");
        setMode("manual");
        Alert.alert("상품 정보를 불러왔어요", `"${product.name}" 등록 정보를 채웠어요. 소비기한만 확인해 주세요.`);
      } else {
        // 처음 보는 바코드 — 상품명부터 사용자가 입력하게 비워 두고,
        // 저장에 성공하면 이 바코드로 등록되도록 기억해 둔다.
        setName("");
        setManualImageUri("");
        setCategory(categories[0]);
        setStorage(storageTypes[0]);
        setExpiry(suggestedExpiryDate("", categories[0], storageTypes[0]));
        setPendingBarcode(barcode);
        setMode("manual");
        Alert.alert(
          "처음 보는 바코드예요",
          "상품명과 정보를 입력해서 등록해 주세요. 한 번 등록하면 다음부터는 자동으로 채워져요."
        );
      }
    } finally {
      setBarcodeLookupPending(false);
    }
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
      hideBottomNav={launchVisible || onboardingVisible}
      onReplayTutorial={replayOnboarding}
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
            selectionRects={selectionRects}
            setSelectionRects={setSelectionRects}
            onToggleLine={toggleOcrLine}
            onToggleCropBox={toggleCommerceCropBox}
            onConfirmHighlight={applyHighlightedReceiptSelection}
            onSwitchToHighlight={switchToHighlightMode}
            onCancel={cancelReceiptSelector}
            onConfirm={() => setReceiptSelectorVisible(false)}
          />
          <BarcodeScannerModal
            visible={barcodeScannerVisible}
            onScanned={handleBarcodeScanned}
            onClose={closeBarcodeScanner}
          />
          {launchVisible ? <LaunchScreen onDone={finishLaunch} /> : null}
          {!launchVisible && onboardingVisible ? <OnboardingScreen onDone={finishOnboarding} /> : null}
          {updateRequired ? <ForceUpdateScreen playStoreUrl={updatePlayStoreUrl} /> : null}
          <WhatsNewModal
            visible={!launchVisible && !updateRequired && whatsNewVisible}
            content={whatsNewContent}
            onClose={() => setWhatsNewVisible(false)}
          />
          <SoftUpdatePrompt
            visible={!launchVisible && !updateRequired && softUpdateVisible}
            playStoreUrl={softUpdatePlayStoreUrl}
            onLater={() => setSoftUpdateVisible(false)}
          />
        </>
      }
    >
            <HomePage
              items={items}
              summary={summary}
              reminderDays={reminderDays}
              growthProfile={growthProfile}
              growthDashboardReport={growthDashboardReport}
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
              manualSubmitting={manualSubmitting}
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
              onScanBarcode={openBarcodeScanner}
              barcodeLookupPending={barcodeLookupPending}
              pickManualImage={pickManualImage}
              takeManualImagePhoto={takeManualImagePhoto}
              changeManualImage={changeManualImage}
              pickReceiptImage={pickReceiptImage}
              selectReceiptImageForType={selectReceiptImageForType}
              receiptImageTypeChooserVisible={receiptImageTypeChooserVisible}
              setReceiptImageTypeChooserVisible={setReceiptImageTypeChooserVisible}
              receiptSourceType={receiptSourceType}
              receiptSelectorMode={receiptSelectorMode}
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
              bulkSubmitting={bulkSubmitting}
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
              inventoryScope={inventoryScope}
              setInventoryScope={setInventoryScope}
              sortOptions={sortOptions}
              sortMode={sortMode}
              setSortMode={setSortMode}
              categoryFilters={categoryFilters}
              categoryFilter={categoryFilter}
              setCategoryFilter={setCategoryFilter}
              favoriteFilter={favoriteFilter}
              setFavoriteFilter={setFavoriteFilter}
              focusItemId={focusItemId}
              clearFocusItem={() => setFocusItemId("")}
              editingId={editingId}
              editSubmitting={editSubmitting}
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
              completeItem={completeItem}
              restoreItem={restoreItem}
              toggleFavorite={toggleFavorite}
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

            <SchedulePage
              items={items}
              setItemPlan={setItemPlan}
              clearItemPlan={clearItemPlan}
              completeItem={completePlanOccurrence}
              openCalendar={openCalendar}
              planNotificationTime={toPlanTime(planNotificationSettings.hour, planNotificationSettings.minute)}
            />

            <ScrollView style={appShellStyles.screen} contentContainerStyle={appShellStyles.page} keyboardShouldPersistTaps="handled">
              <SettingsPanel
                settingsTab={settingsTab}
                setSettingsTab={setSettingsTab}
                reminderDays={reminderDays}
                setReminderDays={setReminderDays}
                notificationSettings={notificationSettings}
                setNotificationSettings={setNotificationSettings}
                planNotificationSettings={planNotificationSettings}
                setPlanNotificationSettings={setPlanNotificationSettings}
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
                onReplayTutorial={replayOnboarding}
              />
            </ScrollView>
    </AppShell>
  );
}

