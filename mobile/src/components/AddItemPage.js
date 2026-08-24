import { useEffect, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { typography } from "../theme/typography";
import { ChoiceGroup, DateButton, Field, PrimaryButton } from "./CommonControls";
import { openCoupangOrderHistory } from "../utils/coupangLinks";
import { daysUntil } from "../utils/date";
import { suggestedExpiryDate, suggestedStorage } from "../utils/expiryPresets";
import { getFoodImageSource } from "../utils/foodImages";

const cameraIcon = require("../../assets/actions/action-camera.png");
const barcodeIcon = require("../../assets/actions/action-barcode.png");
const galleryIcon = require("../../assets/actions/action-gallery.png");
const photoRegisterIcon = require("../../assets/actions/action-photo-register.png");
const directRegisterIcon = require("../../assets/actions/action-direct-register.png");
const inventoryEditIcon = require("../../assets/actions/edit_note_80dp.png");
const resetIcon = require("../../assets/actions/action-reset.png");
const storageTabIcon = require("../../assets/tabs/kitchen.png");
const coupangLogoIcon = require("../../assets/actions/coupang2.png");

export default function AddItemPage({
  mode,
  setMode,
  name,
  setName,
  manualImageUri,
  setManualImageUri,
  manualSubmitting,
  category,
  setCategory,
  categories,
  suggestCategory,
  storage,
  setStorage,
  storageTypes,
  expiry,
  setExpiry,
  openCalendar,
  submitManual,
  changeManualImage,
  onScanBarcode,
  barcodeLookupPending,
  pickReceiptImage,
  selectReceiptImageForType,
  receiptImageTypeChooserVisible,
  setReceiptImageTypeChooserVisible,
  receiptSourceType,
  receiptSelectorMode,
  drafts,
  excludedDrafts,
  receiptImage,
  ocrLines,
  commerceCropBoxes,
  setReceiptSelectorVisible,
  openReceiptSelector,
  setReceiptImageLayout,
  setReceiptImageSize,
  frameForOcrLine,
  selectedOcrLineIds,
  toggleOcrLine,
  toggleCommerceCropBox,
  frameForCommerceCropBox,
  receiptStatus,
  bulkDraftForm,
  applyBulkDraftForm,
  addAllDrafts,
  bulkSubmitting,
  resetReceiptDrafts,
  draftForms,
  DEFAULT_EXPIRY_TYPE,
  removeDraft,
  toggleDraftExcluded,
  updateDraftForm,
  pickDraftImage,
  addDraft
}) {
  // 화면 너비와 글자 크기에 맞춰 카드/레이아웃이 깨지지 않도록 조정한다.
  const { fontScale, width } = useWindowDimensions();
  const compactModeCards = fontScale >= 1.4 && width < 430;
  const [isReceiptPreviewAdjusting, setReceiptPreviewAdjusting] = useState(false);
  const [editingDraft, setEditingDraft] = useState("");
  const selectedDraftCount = drafts.filter((draft) => !excludedDrafts?.includes(draft)).length;

  useEffect(() => {
    setReceiptPreviewAdjusting(false);
    setEditingDraft("");
  }, [receiptImage]);

  return (
    <>
            <ScrollView
              style={styles.screen}
              contentContainerStyle={styles.page}
              keyboardShouldPersistTaps="handled"
              scrollEnabled={!isReceiptPreviewAdjusting}
            >
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  {/* 상단 모드는 영수증 등록 / 직접 등록을 바꾸는 버튼이다. */}
                  <View style={styles.modeCards}>
                    <AddModeCard
                      active={mode === "receipt"}
                      compact={compactModeCards}
                      icon={photoRegisterIcon}
                      title={"\uc0ac\uc9c4\ub4f1\ub85d"}
                      // 예전엔 사진등록 모드로 바꾼 뒤 "구매내역 촬영/스캔" 버튼을
                      // 따로 눌러야 했다. 촬영(즉석 카메라)은 갤러리에서 방금 찍은
                      // 사진을 골라도 되니 없앴고, 스캔 흐름을 이 버튼 자체에
                      // 합쳐서 한 번에 유형 선택+갤러리로 바로 넘어가게 했다
                      // (2026-08-08, "상품등록-사진등록-구매내역스캔" 3단계가
                      // 복잡하다는 피드백).
                      onPress={() => pickReceiptImage()}
                    />
                    <AddModeCard
                      active={mode === "manual"}
                      compact={compactModeCards}
                      icon={directRegisterIcon}
                      title={"\uc9c1\uc811\ub4f1\ub85d"}
                      onPress={() => setMode("manual")}
                    />
                  </View>
                </View>

                {mode === "manual" ? (
                  <View style={styles.form}>
                    {/* 바코드를 스캔하면 등록된 상품은 소비기한만, 처음 보는 상품은
                        상품명부터 자동으로 채워 준다. */}
                    <Pressable
                      style={styles.barcodeScanButton}
                      onPress={onScanBarcode}
                      disabled={barcodeLookupPending}
                    >
                      <Image source={barcodeIcon} resizeMode="contain" style={styles.barcodeScanIcon} />
                      <Text style={styles.barcodeScanText}>
                        {barcodeLookupPending ? "\ubc14\ucf54\ub4dc \ud655\uc778 \uc911..." : "\ubc14\ucf54\ub4dc\ub85c \uc2a4\uce94\ud558\uae30"}
                      </Text>
                    </Pressable>
                    {/* 직접 등록에서는 상품명 왼쪽에 대표 이미지를 붙여 둔다. */}
                    <Field label={"\uc0c1\ud488\uba85"}>
                      <View style={styles.manualNameRow}>
                        <Pressable
                          style={styles.manualNameImageButton}
                          accessibilityLabel={"\uc0c1\ud488 \uc0ac\uc9c4 \ubcc0\uacbd"}
                          onPress={changeManualImage}
                        >
                          <Image
                            source={manualImageUri ? { uri: manualImageUri } : galleryIcon}
                            resizeMode={manualImageUri ? "cover" : "contain"}
                            style={[
                              styles.manualNameImage,
                              !manualImageUri && styles.manualNamePlaceholderImage
                            ]}
                          />
                        </Pressable>
                        <TextInput
                          value={name}
                          onChangeText={(value) => {
                            // 상품명이 바뀌면 카테고리/보관/소비기한 추천도 같이 갱신한다.
                            const nextCategory = suggestCategory(value);
                            const nextStorage = suggestedStorage(value, nextCategory, storage);
                            setName(value);
                            setCategory(nextCategory);
                            setStorage(nextStorage);
                            setExpiry(suggestedExpiryDate(value, nextCategory, nextStorage));
                          }}
                          placeholder={"\uc608: \uc11c\uc6b8\uc6b0\uc720, \uacc4\ub780, \ub538\uae30"}
                          style={[styles.input, styles.manualNameInput]}
                        />
                      </View>
                    </Field>
                    {/* 카테고리와 보관 방식은 따로 수정할 수 있게 분리해 둔다. */}
                    <ChoiceGroup
                      label={"\uce74\ud14c\uace0\ub9ac"}
                      options={categories}
                      value={category}
                      onChange={(value) => {
                        const nextStorage = suggestedStorage(name, value, storage);
                        setCategory(value);
                        setStorage(nextStorage);
                        setExpiry(suggestedExpiryDate(name, value, nextStorage));
                      }}
                    />
                    <View style={styles.manualInlineGroups}>
                      <View style={styles.inlineGroupWide}>
                        <ChoiceGroup
                          label={"\ubcf4\uad00"}
                          options={storageTypes}
                          value={storage}
                          onChange={(value) => {
                            setStorage(value);
                            setExpiry(suggestedExpiryDate(name, category, value));
                          }}
                          compact
                        />
                      </View>
                    </View>
                    <Field label={"\uc18c\ube44\uae30\ud55c"}>
                      <DateButton value={expiry} onPress={() => openCalendar(expiry, setExpiry)} />
                    </Field>
                    <PrimaryButton
                      label={manualSubmitting ? "\ub4f1\ub85d \uc911..." : "\ub4f1\ub85d\ud558\uae30"}
                      onPress={submitManual}
                      disabled={manualSubmitting}
                    />
                  </View>
                ) : (
                  <View style={styles.form}>
                    {/* 이미지 선택 진입점은 위쪽 "사진등록" 모드 카드 자체다(2026-08-08) —
                        따로 있던 "구매내역 촬영/스캔" 두 버튼을 없애고 합쳤다. 이미지를
                        다시 고르고 싶으면 위 모드 카드를 다시 누르면 된다("이미지 다시
                        선택하기" 버튼은 모드 카드와 기능이 겹쳐서 뺐음, 2026-08-08). */}
                    {/* 초기화 버튼(왼쪽 위) + "N개 보관함 저장" 버튼(전체 폭),
                        영수증 이미지 카드보다 위에 둔다(2026-08-08 피드백). */}
                    {drafts.length > 0 ? (
                      <View style={styles.bulkSection}>
                        <Pressable
                          style={styles.bulkResetButton}
                          accessibilityLabel={"\uc120\ud0dd \uc0c1\ud488 \ub9ac\uc14b"}
                          onPress={resetReceiptDrafts}
                        >
                          <Image source={resetIcon} resizeMode="contain" style={styles.bulkResetIcon} />
                          <Text style={styles.bulkResetText}>{"\ucd08\uae30\ud654"}</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.bulkSubmitButton, bulkSubmitting && styles.bulkSubmitButtonDisabled]}
                          onPress={bulkSubmitting ? undefined : addAllDrafts}
                        >
                          <Image source={storageTabIcon} resizeMode="contain" style={styles.bulkSubmitIcon} />
                          <Text style={styles.bulkSubmitText}>
                            {bulkSubmitting ? "\ub4f1\ub85d \uc911..." : selectedDraftCount + "\uac1c \ubcf4\uad00\ud568 \uc800\uc7a5"}
                          </Text>
                          <Text style={styles.bulkSubmitChevron}>{"›"}</Text>
                        </Pressable>
                      </View>
                    ) : null}

                    {/* 영수증 이미지가 있으면 미리보기를 보여 주고 다시 고를 수 있게 한다. */}
                    {receiptImage ? (
                      <View style={styles.receiptPreviewCard}>
                        <Pressable
                          style={styles.receiptPreviewHeader}
                          onPress={() => {
                            if (openReceiptSelector) openReceiptSelector(receiptSelectorMode === "highlight" ? "highlight" : "box");
                            else setReceiptSelectorVisible(true);
                          }}
                        >
                          <View style={styles.receiptThumbWrap}>
                            <Image source={{ uri: receiptImage }} style={styles.receiptThumb} />
                          </View>
                          <View style={styles.receiptPreviewCopy}>
                            <Text style={styles.receiptPreviewTitle}>{"\uc601\uc218\uc99d \uc774\ubbf8\uc9c0"}</Text>
                            <Text style={styles.receiptPreviewMeta}>
                              {receiptSourceType === "coupang"
                                  ? "\ucfe0\ud321 \uc8fc\ubb38\ub0b4\uc5ed"
                                  : "\ucd2c\uc601/\ucea1\ucc98 \uc774\ubbf8\uc9c0"}
                            </Text>
                          </View>
                          <Text style={styles.receiptPreviewToggle}>{"\ubcf4\uae30 \u203a"}</Text>
                        </Pressable>
                      </View>
                    ) : null}

                    <View style={styles.registerPanel}>
                      {/* OCR 결과와 자동 인식된 초안 상품들이 모이는 영역이다. */}
                      {drafts.length > 0 ? (
                        <>
                          <View style={styles.draftList}>
                            {drafts.map((draft) => {
                              // 각 초안 상품은 여기서 바로 개별 수정할 수 있다.
                              const isDraftExcluded = excludedDrafts?.includes(draft);
                              const draftCategory = draftForms[draft]?.category || suggestCategory(draft);
                              const draftStorage = draftForms[draft]?.storage || suggestedStorage(draft, draftCategory, "\ub0c9\uc7a5");
                              const draftExpiry = draftForms[draft]?.expiry || bulkDraftForm.expiry;
                              const dday = ddayLabel(draftExpiry);
                              return (
                                <View key={draft} style={[styles.draftItem, isDraftExcluded ? styles.draftItemExcluded : null]}>
                                  <Pressable
                                    style={[styles.draftCheckButton, isDraftExcluded ? styles.draftCheckButtonOff : null]}
                                    accessibilityLabel={isDraftExcluded ? "\uc0c1\ud488 \uc120\ud0dd" : "\uc0c1\ud488 \uc120\ud0dd \ud574\uc81c"}
                                    onPress={() => toggleDraftExcluded(draft)}
                                  >
                                    {isDraftExcluded ? null : <Text style={styles.draftCheckText}>{"\u2713"}</Text>}
                                  </Pressable>
                                  <Pressable
                                    accessibilityLabel={"\uc0c1\ud488 \uc0ac\uc9c4 \ubcc0\uacbd"}
                                    onPress={() => pickDraftImage?.(draft)}
                                  >
                                    <Image
                                      source={getFoodImageSource({
                                        name: draft,
                                        category: draftCategory,
                                        imageUri: draftForms[draft]?.imageUri
                                      })}
                                      resizeMode="cover"
                                      style={styles.draftImage}
                                    />
                                  </Pressable>
                                  <View style={styles.draftContent}>
                                    <Text style={styles.itemName} numberOfLines={1}>{draft}</Text>
                                    <Text style={styles.expiryDateText}>{"\uc18c\ube44\uae30\ud55c " + formatDotDate(draftExpiry)}</Text>
                                    <View style={styles.draftTimelineTrack}>
                                      <View
                                        style={[
                                          styles.draftTimelineFill,
                                          dday.tone === "expired"
                                            ? styles.draftTimelineFillExpired
                                            : dday.tone === "safe"
                                              ? styles.draftTimelineFillSafe
                                              : styles.draftTimelineFillWarning
                                        ]}
                                      />
                                    </View>
                                  </View>
                                  <View style={styles.draftRightColumn}>
                                    <View style={styles.draftBadgeRow}>
                                      <Text style={[styles.storageBadge, storageBadgeStyle(draftStorage)]}>{draftStorage}</Text>
                                      <Text style={[styles.ddayText, dday.tone === "expired" ? styles.ddayExpired : dday.tone === "safe" ? styles.ddaySafe : null]}>{dday.label}</Text>
                                    </View>
                                    <Pressable
                                      style={styles.dateMiniButton}
                                      accessibilityLabel={"\uc18c\ube44\uae30\ud55c \uc218\uc815"}
                                      onPress={() => setEditingDraft((current) => (current === draft ? "" : draft))}
                                    >
                                      <Image source={inventoryEditIcon} resizeMode="contain" style={styles.dateMiniIcon} />
                                    </Pressable>
                                  </View>
                                  {editingDraft === draft ? (
                                    <View style={styles.draftEditPanel}>
                                      <View style={styles.editBanner}>
                                        <Text style={styles.editBannerText}>{"\uc218\uc815 \uc911"}</Text>
                                      </View>
                                      <Text style={styles.editNameText}>{draft}</Text>
                                      <ChoiceGroup
                                        label={"\uce74\ud14c\uace0\ub9ac"}
                                        options={categories}
                                        value={draftCategory}
                                        onChange={(value) => updateDraftForm(draft, { category: value })}
                                      />
                                      <ChoiceGroup
                                        label={"\ubcf4\uad00"}
                                        options={storageTypes}
                                        value={draftStorage}
                                        onChange={(value) => updateDraftForm(draft, { storage: value })}
                                      />
                                      <Field label={DEFAULT_EXPIRY_TYPE}>
                                        <DateButton
                                          value={draftExpiry}
                                          onPress={() =>
                                            openCalendar(
                                              draftExpiry || suggestedExpiryDate(draft, draftCategory, draftStorage),
                                              (value) => updateDraftForm(draft, { expiry: value })
                                            )
                                          }
                                        />
                                      </Field>
                                      <View style={styles.draftEditActions}>
                                        <Pressable style={styles.draftEditDoneButton} onPress={() => setEditingDraft("")}>
                                          <Text style={styles.draftEditDoneText}>{"\uc644\ub8cc"}</Text>
                                        </Pressable>
                                      </View>
                                    </View>
                                  ) : null}
                                </View>
                              );
                            })}
                          </View>

                          <Pressable style={styles.missingProductButton} onPress={() => setMode("manual")}>
                            <Text style={styles.missingProductText}>{"\uff0b \ub204\ub77d\ub41c \uc0c1\ud488 \uc9c1\uc811 \ucd94\uac00\ud558\uae30"}</Text>
                          </Pressable>

                        </>
                      ) : (
                        <Text style={styles.receiptEmptyText}>
                          {"\uc0c1\ud488 \ud6c4\ubcf4\uac00 \uc544\uc9c1 \uc5c6\uc2b5\ub2c8\ub2e4. \uc774\ubbf8\uc9c0\ub97c \uc120\ud0dd\ud558\uac70\ub098 \uc9c1\uc811 \uc785\ub825\ud574 \uc8fc\uc138\uc694."}
                        </Text>
                      )}
                    </View>
                  </View>
                )}

                {/* 앱 전체에서 쿠팡 주문내역으로 가는 유일한 진입점이라 모드 밖에 둔다.
                    예전엔 "사진등록" 브랜치 안에 있어서 직접등록을 마지막으로 쓴
                    사용자는(mode가 세션 내내 유지된다) 다시는 못 보는 상태였다.
                    홈에도 같은 카드가 있었지만 문을 두 개 두는 셈이라 없앴다.
                    영수증을 이미 고른 뒤에는 할 일이 끝났으므로 감춘다.
                    캡처 후 돌아오는 길(공유하기 → 오늘까지야)은 이미 구현돼 있는데
                    안내가 없어서(SharedImageModule.kt, App.js) 여기서 같이
                    알려준다(2026-08-13 피드백 대응, 2026-08-24 모드 밖으로 이동). */}
                {!receiptImage ? (
                  <Pressable style={styles.orderHistoryShortcut} onPress={openCoupangOrderHistory}>
                    <View style={styles.orderHistoryShortcutRow}>
                      <Image source={coupangLogoIcon} resizeMode="contain" style={styles.orderHistoryShortcutIcon} />
                      <Text style={styles.orderHistoryShortcutTitle}>{"주문내역 바로가기"}</Text>
                      <Text style={styles.orderHistoryShortcutChevron}>{"›"}</Text>
                    </View>
                    <Text style={styles.orderHistoryShortcutHint}>
                      {"캡처해서 공유하면 자동 등록돼요."}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </ScrollView>
            <Modal
              visible={Boolean(receiptImageTypeChooserVisible)}
              transparent
              animationType="fade"
              onRequestClose={() => setReceiptImageTypeChooserVisible?.(false)}
            >
              <View style={styles.imageTypeModalBackdrop}>
                {/* 들어온 이미지가 실물 사진인지, 영수증 캡처인지 구분하는 팝업이다. */}
                <View style={styles.imageTypeModalCard}>
                  <View style={styles.imageTypeIconHalo}>
                    <Image source={galleryIcon} resizeMode="contain" style={styles.imageTypeHeroIcon} />
                    <View style={styles.imageTypeQuestionBadge}>
                      <Text style={styles.imageTypeQuestionText}>{"?"}</Text>
                    </View>
                  </View>
                  <Text style={styles.imageTypeTitle}>{"어떤 이미지인가요?"}</Text>
                  <Text style={styles.imageTypeSubtitle}>{"이미지 유형을 선택해 주세요."}</Text>
                  <View style={styles.imageTypeOptions}>
                    <ImageTypeOption
                      icon={cameraIcon}
                      label={"실물 영수증 사진"}
                      onPress={() => selectReceiptImageForType?.({ sourceType: "receipt", physicalReceipt: true })}
                    />
                    <ImageTypeOption
                      icon={galleryIcon}
                      label={"모바일/주문내역 캡쳐"}
                      onPress={() => selectReceiptImageForType?.({ sourceType: "auto" })}
                    />
                  </View>
                </View>
              </View>
            </Modal>
    </>
  );
}

function ReceiptPreview({
  imageUri,
  ocrLines,
  cropBoxes,
  selectedOcrLineIds,
  onLayoutSize,
  onImageSize,
  frameForOcrLine,
  frameForCommerceCropBox,
  toggleOcrLine,
  toggleCommerceCropBox,
  isAdjusting,
  setIsAdjusting
}) {
  // 영수증 이미지 위에 OCR 박스와 확대/이동 조작을 얹는 미리보기 컴포넌트다.
  const [isZoomed, setIsZoomed] = useState(false);
  const scaleValue = useSharedValue(1);
  const translateXValue = useSharedValue(0);
  const translateYValue = useSharedValue(0);
  const startScaleValue = useSharedValue(1);
  const startTranslateXValue = useSharedValue(0);
  const startTranslateYValue = useSharedValue(0);
  const startFocalXValue = useSharedValue(0);
  const startFocalYValue = useSharedValue(0);

  const applyTransform = (nextScale, nextTranslateX, nextTranslateY) => {
    "worklet";
    const clampedScale = Math.min(Math.max(nextScale, 1), 4);
    if (clampedScale <= 1.02) {
      scaleValue.value = 1;
      translateXValue.value = 0;
      translateYValue.value = 0;
      return;
    }
    scaleValue.value = clampedScale;
    translateXValue.value = Math.min(Math.max(nextTranslateX, -180), 180);
    translateYValue.value = Math.min(Math.max(nextTranslateY, -260), 260);
  };

  const pinchGesture = Gesture.Pinch()
    .enabled(isAdjusting)
    .onBegin(() => {
      startScaleValue.value = scaleValue.value;
      startTranslateXValue.value = translateXValue.value;
      startTranslateYValue.value = translateYValue.value;
      startFocalXValue.value = 0;
      startFocalYValue.value = 0;
    })
    .onStart((event) => {
      startFocalXValue.value = event.focalX || 0;
      startFocalYValue.value = event.focalY || 0;
    })
    .onUpdate((event) => {
      applyTransform(
        startScaleValue.value * event.scale,
        startTranslateXValue.value + (event.focalX || startFocalXValue.value) - startFocalXValue.value,
        startTranslateYValue.value + (event.focalY || startFocalYValue.value) - startFocalYValue.value
      );
    })
    .onEnd(() => {
      applyTransform(scaleValue.value, translateXValue.value, translateYValue.value);
      runOnJS(setIsZoomed)(scaleValue.value > 1.02);
    });

  const panGesture = Gesture.Pan()
    .enabled(isAdjusting && isZoomed)
    .maxPointers(1)
    .onBegin(() => {
      startScaleValue.value = scaleValue.value;
      startTranslateXValue.value = translateXValue.value;
      startTranslateYValue.value = translateYValue.value;
    })
    .onUpdate((event) => {
      applyTransform(
        startScaleValue.value,
        startTranslateXValue.value + event.translationX,
        startTranslateYValue.value + event.translationY
      );
    })
    .onEnd(() => {
      applyTransform(scaleValue.value, translateXValue.value, translateYValue.value);
      runOnJS(setIsZoomed)(scaleValue.value > 1.02);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateXValue.value },
      { translateY: translateYValue.value },
      { scale: scaleValue.value }
    ]
  }));

  useEffect(() => {
    scaleValue.value = 1;
    translateXValue.value = 0;
    translateYValue.value = 0;
    setIsZoomed(false);
    setIsAdjusting(false);
  }, [imageUri, scaleValue, translateXValue, translateYValue]);

  useEffect(() => {
    if (isAdjusting) return;
    if (scaleValue.value <= 1.02) {
      translateXValue.value = 0;
      translateYValue.value = 0;
      setIsZoomed(false);
    }
  }, [isAdjusting, scaleValue, translateXValue, translateYValue]);

  function toggleAdjusting() {
    if (isAdjusting) {
      scaleValue.value = 1;
      translateXValue.value = 0;
      translateYValue.value = 0;
      setIsZoomed(false);
      setIsAdjusting(false);
      return;
    }
    setIsAdjusting(true);
  }

  return (
    <View
      style={styles.receiptImageWrap}
      onLayout={(event) => {
        onLayoutSize({
          width: event.nativeEvent.layout.width,
          height: event.nativeEvent.layout.height
        });
      }}
    >
      <Pressable
        style={[styles.receiptAdjustButton, isAdjusting ? styles.receiptAdjustButtonActive : null]}
        onPress={toggleAdjusting}
      >
        <Text style={[styles.receiptAdjustButtonText, isAdjusting ? styles.receiptAdjustButtonTextActive : null]}>
          {isAdjusting ? "\uc870\uc815 \uc911 \u00b7 \uc644\ub8cc" : "\uc774\ubbf8\uc9c0 \uc870\uc815"}
        </Text>
      </Pressable>
      <GestureDetector gesture={Gesture.Race(pinchGesture, panGesture)}>
        <Animated.View style={[styles.receiptImageCanvas, animatedStyle]}>
          <Image
            source={{ uri: imageUri }}
            style={styles.receiptImage}
            onLoad={(event) => {
              const source = event.nativeEvent.source;
              if (source?.width && source?.height) {
                onImageSize({ width: source.width, height: source.height });
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
                accessibilityLabel={`${line.text} ?좏깮`}
                hitSlop={8}
                style={[styles.ocrBox, ocrBoxStyleForLine(line, selected), frame]}
                onPress={() => toggleOcrLine(line)}
              />
            );
          })}
          {cropBoxes.map((cropBox) => {
            const frame = frameForCommerceCropBox(cropBox);
            if (!frame) return null;
            const selected = cropBox.lineId ? selectedOcrLineIds.includes(cropBox.lineId) : false;
            return (
              <Pressable
                key={cropBox.id}
                hitSlop={8}
                style={[styles.cropDebugBox, selected ? styles.cropDebugBoxSelected : styles.cropDebugBoxUnselected, frame]}
                onPress={() => toggleCommerceCropBox?.(cropBox)}
              />
            );
          })}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function ddayLabel(expiry) {
  // 소비기한을 D-day 형태로 화면에 표시한다.
  const days = daysUntil(expiry);
  if (days < 0) return { label: `D+${Math.abs(days)}`, tone: "expired" };
  if (days === 0) return { label: "D-day", tone: "urgent" };
  if (days <= 3) return { label: `D-${days}`, tone: "urgent" };
  return { label: `D-${days}`, tone: "safe" };
}

function formatDotDate(value) {
  // 날짜를 2026.07.04 형식으로 보여주기 위한 변환 함수다.
  return typeof value === "string" ? value.replace(/-/g, ".") : "";
}

function storageBadgeStyle(storage) {
  // 보관 방식에 따라 색상을 다르게 쓰는 헬퍼다.
  if (storage === "\ub0c9\ub3d9") return styles.storageBadgeFrozen;
  if (storage === "\uc2e4\uc628") return styles.storageBadgeRoom;
  return styles.storageBadgeCold;
}

function ocrBoxStyleForLine(line, selected) {
  // OCR 박스의 출처와 선택 상태에 따라 테두리 색을 바꾼다.
  if (selected) return styles.ocrBoxSelected;
  if (line?.boxSource === "dbnet-text-line") return styles.ocrBoxDbNet;
  return line?.boxSource === "opencv-text-line" ? styles.ocrBoxOpenCv : styles.ocrBoxUnselected;
}

function AddModeCard({ active, compact, icon, title, onPress }) {
  // 상단 모드 전환 카드 컴포넌트다.
  return (
    <Pressable
      style={[styles.addModeCard, compact ? styles.addModeCardCompact : null, active ? styles.addModeCardActive : null]}
      onPress={onPress}
    >
      {/* 위의 모드 상태와 아이콘/라벨이 맞도록 관리한다. */}
      <Image
        source={icon}
        resizeMode="contain"
        style={[styles.addModeIcon, compact ? styles.addModeIconCompact : null]}
      />
      <Text
        maxFontSizeMultiplier={1.35}
        numberOfLines={1}
        style={[styles.addModeTitle, active ? styles.addModeTitleActive : null]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

function ImageTypeOption({ icon, label, onPress }) {
  // 이미지 종류 선택 팝업 안의 한 줄 선택지다.
  return (
    <Pressable style={styles.imageTypeOption} onPress={onPress}>
      {/* 아이콘 박스 크기는 여기서 조정한다. 테두리 크기와 이미지 크기를 같이 본다. */}
      <View style={styles.imageTypeOptionIconWrap}>
        <Image source={icon} resizeMode="contain" style={styles.imageTypeOptionIcon} />
      </View>
      <Text style={styles.imageTypeOptionText}>{label}</Text>
      <Text style={styles.imageTypeChevron}>{"›"}</Text>
    </Pressable>
  );
}

function ReceiptStep({ number, title, description, children }) {
  // 영수증 조정/안내 단계가 있을 때 쓰는 공통 섹션이다.
  return (
    <View style={styles.receiptStep}>
      <View style={styles.receiptStepHeader}>
        <Text style={styles.receiptStepBadge}>{number}</Text>
        <View style={styles.receiptStepCopy}>
          <Text style={styles.receiptStepTitle}>{title}</Text>
          {description ? <Text style={styles.receiptStepDescription}>{description}</Text> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // 화면 최상단 스크롤 영역 전체.
  screen: {
    flex: 1,
    alignSelf: "stretch"
  },
  page: {
    // 스크롤 안쪽 좌우/하단 여백.
    paddingHorizontal: 16,
    paddingBottom: 140
  },
  section: {
    // 상단 모드 카드와 본문을 담는 기본 컨테이너.
    backgroundColor: "transparent",
    padding: 0,
    marginTop: 0
  },
  sectionHeader: {
    // 상단 모드 카드 줄의 배치.
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10
  },
  modeCards: {
    // 상단 모드 카드 두 개를 나란히 배치한다.
    flexDirection: "row",
    flex: 1,
    gap: 12
  },
  addModeCard: {
    // "사진등록", "직접등록" 카드 공통 스타일.
    flex: 1,
    minHeight: 64,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e6e4df",
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1
  },
  addModeCardActive: {
    // 현재 선택된 모드 카드의 강조 상태.
    borderWidth: 2,
    borderColor: "#1f7a5a",
    backgroundColor: "#f7fcfa"
  },
  addModeCardCompact: {
    // 글자가 큰 환경에서 카드 간격을 줄이는 보정값.
    gap: 4,
    paddingHorizontal: 6
  },
  addModeIcon: {
    // 모드 카드 안 아이콘 기본 크기.
    width: 38,
    height: 38
  },
  addModeIconCompact: {
    // 모드 카드 아이콘의 작은 버전.
    width: 26,
    height: 26
  },
  addModeTitle: {
    // 모드 카드 제목 텍스트.
    ...typography.cardTitle,
    color: "#18201c",
  },
  addModeTitleActive: {
    // 선택된 모드 제목 색상.
    color: "#14583f"
  },
  form: {
    // 각 등록 모드의 본문 입력 묶음.
    gap: 10
  },
  manualNameRow: {
    // 직접 등록에서 이미지와 상품명을 같은 줄에 배치한다.
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  manualNameImageButton: {
    // 상품명 왼쪽의 대표 이미지 버튼.
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: "#edf8f2",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center"
  },
  manualNameImage: {
    // 대표 이미지가 버튼 크기를 꽉 채우도록 한다.
    width: "100%",
    height: "100%"
  },
  manualNamePlaceholderImage: {
    // 기본 갤러리 아이콘은 버튼 가장자리에 붙지 않도록 여백을 둔다.
    width: "78%",
    height: "78%"
  },
  manualNameInput: {
    // 상품명 입력칸은 나머지 공간을 모두 차지한다.
    flex: 1
  },
  manualImageBox: {
    // 직접 등록에서 큰 이미지 미리보기/편집용 박스.
    minHeight: 92,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e6e4df",
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12
  },
  manualImagePreview: {
    // 이미지 미리보기 썸네일 영역.
    width: 68,
    height: 68,
    borderRadius: 14,
    backgroundColor: "#f4f8f6",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center"
  },
  manualImage: {
    // 썸네일 이미지 채움.
    width: "100%",
    height: "100%"
  },
  manualImagePlaceholder: {
    // 이미지가 없을 때 보이는 기본 아이콘.
    width: 52,
    height: 52,
    opacity: 0.88
  },
  manualImageActions: {
    // 이미지 선택/삭제 버튼들이 들어가는 영역.
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  manualImageButton: {
    // 이미지 선택 버튼 공통 스타일.
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d8e8df",
    backgroundColor: "#f8fcfa",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10
  },
  manualImageButtonIcon: {
    // 이미지 선택 버튼 안의 작은 아이콘.
    width: 18,
    height: 18
  },
  manualImageButtonText: {
    // 이미지 선택 버튼 텍스트.
    ...typography.captionStrong,
    color: "#14583f",
  },
  manualImageClearButton: {
    // 현재 이미지를 지우는 버튼.
    minHeight: 38,
    borderRadius: 10,
    backgroundColor: "#fff1ee",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  manualImageClearText: {
    // 이미지 삭제 버튼 텍스트.
    ...typography.captionStrong,
    color: "#a83a2f",
  },
  barcodeScanButton: {
    // 직접 등록 상단의 바코드 스캔 진입. 등록된 바코드면 소비기한만,
    // 처음 보는 바코드면 상품명부터 자동으로 채워 주는 지름길이라 눈에 띄게 둔다.
    // 버튼 카드 느낌보단 아이콘을 누르는 느낌으로, 아이콘-텍스트를 세로로 둔다.
    // 상품명 입력칸까지 여백이 넓으면 등록하기 버튼이 화면 밖으로 밀려나서
    // (2026-08-08) 위아래 여백을 최소로 줄였다.
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    paddingVertical: 0,
    marginBottom: 0
  },
  barcodeScanIcon: {
    // 아이콘 자체가 버튼 역할을 하도록 큼직하게 둔다. 이미지가 3:1 가로형이라
    // 폭을 기존(44) 대비 3배로 키우고 높이는 비율에 맞춰 그대로 둔다.
    width: 132,
    height: 44,
    tintColor: "#1f7a5a"
  },
  barcodeScanText: {
    ...typography.captionStrong,
    color: "#1f7a5a"
  },
  receiptHeroButton: {
    // 큰 영수증 안내 버튼이 있던 경우의 공통 스타일.
    minHeight: 198,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#d7d9d4",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 24
  },
  galleryButton: {
    // 갤러리 진입 버튼이 필요할 때 쓰는 공통 스타일.
    minHeight: 66,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e6e4df",
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 10
  },
  galleryIcon: {
    // 갤러리 버튼 안의 아이콘.
    width: 28,
    height: 28
  },
  galleryText: {
    // 갤러리 버튼 제목 텍스트.
    ...typography.cardTitle,
    color: "#18201c",
  },
  galleryHint: {
    // 갤러리 버튼 보조 설명 텍스트.
    ...typography.caption,
    color: "#8a938d",
  },
  imageTypeModalBackdrop: {
    // 이미지 종류 선택 팝업의 반투명 배경.
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24
  },
  imageTypeModalCard: {
    // 이미지 종류 선택 팝업 본체.
    width: "100%",
    maxWidth: 360,
    borderRadius: 18,
    backgroundColor: "#fff",
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 18,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8
  },
  imageTypeIconHalo: {
    // 팝업 상단의 큰 아이콘 원형 배경.
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#edf8f2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12
  },
  imageTypeHeroIcon: {
    // 팝업 상단 대표 아이콘.
    width: 55,
    height: 55
  },
  imageTypeQuestionBadge: {
    // 우측 상단 물음표 뱃지.
    position: "absolute",
    right: 8,
    top: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#1f7a5a",
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center"
  },
  imageTypeQuestionText: {
    // 물음표 뱃지 글자.
    ...typography.captionStrong,
    color: "#fff",
  },
  imageTypeTitle: {
    // 팝업 제목.
    ...typography.sectionTitle,
    color: "#18201c",
    textAlign: "center"
  },
  imageTypeSubtitle: {
    // 팝업 설명문.
    ...typography.caption,
    color: "#8a938d",
    marginTop: 5,
    marginBottom: 16,
    textAlign: "center"
  },
  imageTypeOptions: {
    // 팝업 선택지 목록.
    width: "100%",
    gap: 8
  },
  imageTypeOption: {
    // 팝업 안의 한 줄 선택지.
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e8ebe6",
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 10
  },
  imageTypeOptionIconWrap: {
    // 선택지 왼쪽 아이콘 배경 상자.
    width: 35,
    height: 35,
    borderRadius: 12,
    backgroundColor: "#edf8f2",
    alignItems: "center",
    justifyContent: "center"
  },
  imageTypeOptionIcon: {
    // 선택지 왼쪽 실제 아이콘 크기.
    width: 28,
    height: 28
  },
  imageTypeOptionText: {
    // 선택지 가운데 문구.
    ...typography.label,
    flex: 1,
    color: "#18201c",
  },
  imageTypeChevron: {
    // 선택지 오른쪽 화살표.
    color: "#1f7a5a",
    fontSize: 22,
    fontWeight: "700",
    marginTop: -2
  },
  recognizedPanel: {
    // 인식된 상품 패널 전체.
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e6e4df",
    backgroundColor: "#fff",
    padding: 14
  },
  orderHistoryShortcut: {
    // 쿠팡 주문내역 바로가기 카드. "사진등록" 모드에서 아직 이미지를 고르기 전에만 보인다.
    // 로고 줄 / 설명 줄 2단이라 세로 배치다(HomePage.js의 같은 이름 스타일과 맞춰 둔다).
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e6e4df",
    backgroundColor: "#fff",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  orderHistoryShortcutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  orderHistoryShortcutIcon: {
    // 바로가기 카드 왼쪽 쿠팡 로고. coupang2.png는 정사각형이 아니라 가로로 긴
    // 워드마크(565×131, 약 4.3:1)라 정사각형 박스에 담으면 세로로 눌린 채 작게
    // 뜬다 — 실제 비율에 맞춰 가로로 넓게 잡는다. 로고 자체가 색을 가진 브랜드
    // 이미지라 tintColor는 주지 않는다(다른 단색 액션 아이콘들과 다름).
    width: 58,
    height: 14
  },
  orderHistoryShortcutTitle: {
    // 제목이 남는 가로 공간을 먹어야 화살표가 오른쪽 끝으로 밀린다.
    ...typography.cardTitle,
    color: "#18201c",
    flex: 1
  },
  orderHistoryShortcutHint: {
    ...typography.caption,
    color: "#68716b",
  },
  orderHistoryShortcutChevron: {
    // 바로가기 카드 오른쪽 화살표.
    color: "#1f7a5a",
    fontSize: 22,
    fontWeight: "700",
    marginTop: -2
  },
  receiptPreviewCard: {
    // 영수증 미리보기 카드.
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e6e4df",
    backgroundColor: "#fff",
    overflow: "hidden"
  },
  receiptPreviewHeader: {
    // 미리보기 카드 상단 헤더.
    minHeight: 86,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14
  },
  receiptThumbWrap: {
    // 영수증 썸네일 배경 상자.
    width: 58,
    height: 58,
    borderRadius: 10,
    backgroundColor: "#f4f5f2",
    overflow: "hidden"
  },
  receiptThumb: {
    // 썸네일 이미지 채움.
    width: "100%",
    height: "100%",
    resizeMode: "cover"
  },
  receiptPreviewCopy: {
    // 영수증 썸네일 옆의 제목/상세 텍스트 묶음이다.
    flex: 1,
    gap: 5
  },
  receiptPreviewTitle: {
    // "영수증 이미지"처럼 상단 제목에 쓰는 스타일이다.
    ...typography.cardTitle,
    color: "#18201c",
  },
  receiptPreviewMeta: {
    // "쿠팡 주문내역" / "촬영/캡처 이미지" 같은 보조 배지 스타일이다.
    ...typography.captionStrong,
    alignSelf: "flex-start",
    color: "#1f7a5a",
    backgroundColor: "#edf7f2",
    borderRadius: 6,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  receiptPreviewToggle: {
    // 오른쪽의 "보기 >" 텍스트다. 미리보기 열기 힌트 역할을 한다.
    ...typography.label,
    color: "#1f7a5a",
  },
  receiptPreviewBody: {
    // 영수증 미리보기 안쪽 본문 영역이다. OCR 박스와 안내가 들어간다.
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 12
  },
  recognizedHeader: {
    // 인식된 상품 목록의 상단 제목과 편집 버튼을 가로로 배치한다.
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  panelTitle: {
    // 카드나 섹션의 공통 제목 스타일이다.
    ...typography.cardTitle,
    color: "#18201c",
  },
  editText: {
    // "수정" 같은 보조 액션 텍스트에 쓰는 스타일이다.
    ...typography.captionStrong,
    color: "#1f7a5a",
  },
  recognizedList: {
    gap: 10
  },
  recognizedRow: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  checkBadge: {
    ...typography.captionStrong,
    width: 18,
    minHeight: 18,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "#1f7a5a",
    color: "#fff",
    textAlign: "center",
  },
  recognizedName: {
    ...typography.bodyStrong,
    flex: 1,
    color: "#18201c",
  },
  recognizedStorage: {
    ...typography.captionStrong,
    color: "#68716b",
  },
  registerPanel: {
    // OCR 결과, 초안 목록, 누락 상품 안내를 담는 하단 영역.
    gap: 10
  },
  label: {
    ...typography.label,
    color: "#68716b",
  },
  input: {
    // 공통 텍스트 입력창 기본 스타일.
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#e2ddd3",
    borderRadius: 8,
    backgroundColor: "#fff",
    color: "#18201c",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  receiptStep: {
    // 영수증 관련 보조 단계가 있으면 묶는 카드 구역.
    gap: 10,
    paddingTop: 14,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#ece6dc"
  },
  receiptStepHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10
  },
  receiptStepBadge: {
    ...typography.captionStrong,
    width: 26,
    minHeight: 26,
    borderRadius: 13,
    backgroundColor: "#1f7a5a",
    color: "#fff",
    textAlign: "center"
  },
  receiptStepCopy: {
    flex: 1,
    gap: 3
  },
  receiptStepTitle: {
    ...typography.cardTitle,
    color: "#18201c",
  },
  receiptStepDescription: {
    ...typography.caption,
    color: "#68716b",
  },
  receiptActions: {
    // 영수증 작업 버튼들을 세로로 쌓는 영역.
    gap: 10
  },
  status: {
    // 인식/처리 상태 문구 스타일.
    ...typography.caption,
    color: "#14583f",
  },
  receiptEmptyText: {
    // 영수증을 아직 고르지 않았을 때 보여 주는 안내 문구.
    ...typography.caption,
    color: "#68716b",
    paddingVertical: 8
  },
  manualInlineGroups: {
    // 직접 등록에서 보관 방식 같은 짧은 그룹을 한 줄로 배치한다.
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start"
  },
  inlineGroupWide: {
    // 오른쪽 칸보다 조금 넓게 가져가는 그룹 폭.
    flex: 1.05
  },
  receiptImageWrap: {
    // 영수증 이미지 미리보기 영역의 바깥 프레임.
    width: "100%",
    height: 280,
    borderRadius: 8,
    backgroundColor: "#faf7f0",
    overflow: "hidden"
  },
  receiptAdjustButton: {
    // 미리보기 우측 상단의 이미지 조정 버튼.
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 20,
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(31, 122, 90, 0.22)",
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  receiptAdjustButtonActive: {
    // 이미지 조정 모드가 켜졌을 때의 버튼 상태.
    borderColor: "#1f7a5a",
    backgroundColor: "#1f7a5a"
  },
  receiptAdjustButtonText: {
    // 이미지 조정 버튼 안의 글자.
    ...typography.captionStrong,
    color: "#14583f",
  },
  receiptAdjustButtonTextActive: {
    // 이미지 조정 중일 때 글자색 반전.
    color: "#fff"
  },
  receiptImageCanvas: {
    // 실제 이미지와 OCR 박스를 함께 올려두는 캔버스.
    width: "100%",
    height: "100%",
    position: "relative"
  },
  receiptImage: {
    // 영수증 원본 이미지 자체.
    width: "100%",
    height: "100%",
    resizeMode: "contain"
  },
  ocrBox: {
    // OCR 인식 영역 공통 테두리.
    position: "absolute",
    borderWidth: 1,
    borderRadius: 4
  },
  ocrBoxSelected: {
    // 사용자가 선택한 OCR 영역.
    borderColor: "#1f7a5a",
    backgroundColor: "rgba(31, 122, 90, 0.045)"
  },
  ocrBoxUnselected: {
    // 기본 OCR 영역.
    borderColor: "#7d857f",
    backgroundColor: "rgba(104, 113, 107, 0.015)"
  },
  ocrBoxOpenCv: {
    // OpenCV 계열 OCR 결과 영역.
    borderColor: "#2f80ed",
    backgroundColor: "rgba(47, 128, 237, 0.055)"
  },
  ocrBoxDbNet: {
    // DBNet 계열 OCR 결과 영역.
    borderColor: "#8b5cf6",
    backgroundColor: "rgba(139, 92, 246, 0.07)"
  },
  cropDebugBox: {
    // 자동 인식된 상품 후보 박스의 공통 테두리.
    position: "absolute",
    borderWidth: 2,
    borderRadius: 6
  },
  cropDebugBoxUnselected: {
    // 선택되지 않은 후보 박스.
    borderColor: "rgba(79, 91, 84, 0.5)",
    backgroundColor: "rgba(240, 240, 236, 0.18)"
  },
  cropDebugBoxSelected: {
    // 선택된 후보 박스.
    borderColor: "#1f7a5a",
    backgroundColor: "rgba(31, 122, 90, 0.16)"
  },
  receiptToolRow: {
    // 조정 도구 줄 전체.
    gap: 8
  },
  coordinateControlWrap: {
    // 좌표/조정 관련 컨트롤 묶음.
    gap: 8
  },
  coordinateToggleButton: {
    // 좌표 조절 모드를 켜고 끄는 버튼.
    alignSelf: "flex-start",
    minHeight: 32,
    borderRadius: 999,
    backgroundColor: "#f4fbf8",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  coordinateToggleText: {
    // 좌표 조절 버튼의 글자.
    ...typography.captionStrong,
    color: "#14583f",
  },
  coordinateChipRow: {
    // 좌표 선택 칩들을 한 줄에 펼친다.
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  coordinateChip: {
    // 좌표 선택용 작은 버튼.
    minHeight: 36,
    flexGrow: 1,
    flexBasis: "22%",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d8e8df",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8
  },
  coordinateChipActive: {
    // 선택된 좌표 칩.
    borderColor: "#1f7a5a",
    backgroundColor: "#edf7f2"
  },
  coordinateChipText: {
    // 좌표 칩 안의 기본 글자.
    ...typography.captionStrong,
    color: "#68716b",
  },
  coordinateChipTextActive: {
    // 선택된 좌표 칩의 글자색.
    color: "#14583f"
  },
  coordinateButton: {
    // 좌표 조정 확인/실행 버튼.
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#b9dfcf",
    backgroundColor: "#edf7f2",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  coordinateButtonText: {
    // 좌표 버튼 글자.
    ...typography.label,
    color: "#14583f",
  },
  draftList: {
    // OCR 초안 상품 목록 전체.
    gap: 8
  },
  draftItem: {
    // 초안 상품 한 줄 카드.
    minHeight: 80,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderColor: "#ecebea",
    borderRadius: 14,
    backgroundColor: "#fff",
    padding: 8
  },
  draftItemExcluded: {
    // 선택 해제된 초안 상품의 흐린 상태.
    opacity: 0.48
  },
  draftCheckButton: {
    // 초안 상품 선택 체크박스.
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: "#1f7a5a",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22
  },
  draftCheckButtonOff: {
    // 체크가 꺼진 상태의 체크박스.
    borderWidth: 1.5,
    borderColor: "#cfd8d2",
    backgroundColor: "#fff"
  },
  draftCheckText: {
    // 체크박스 안의 체크 표시.
    ...typography.badge,
    color: "#fff",
  },
  draftImage: {
    // 초안 상품 썸네일 이미지.
    width: 62,
    height: 62,
    borderRadius: 14,
    backgroundColor: "#f3f6f4",
    overflow: "hidden"
  },
  draftContent: {
    // 초안 상품명, 소비기한, D-day 막대 묶음.
    flex: 1,
    minWidth: 0,
    gap: 3,
    paddingTop: 2
  },
  draftRightColumn: {
    // 우측 상단 보관 배지/D-day와 수정 버튼 묶음.
    alignItems: "flex-end",
    gap: 8,
    minWidth: 82,
    paddingTop: 2
  },
  draftBadgeRow: {
    // 보관 배지와 D-day를 같은 줄에 배치.
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  storageBadge: {
    // 냉장/냉동/실온 배지 공통 스타일.
    ...typography.captionStrong,
    alignSelf: "flex-start",
    borderRadius: 6,
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 3
  },
  storageBadgeCold: {
    // 냉장 배지 색상.
    color: "#2779b8",
    backgroundColor: "#eaf4fb"
  },
  storageBadgeFrozen: {
    // 냉동 배지 색상.
    color: "#5b57c8",
    backgroundColor: "#eeedff"
  },
  storageBadgeRoom: {
    // 실온 배지 색상.
    color: "#b56b16",
    backgroundColor: "#fff3dc"
  },
  draftTimelineTrack: {
    // 보관함 카드와 맞춘 D-day 진행 막대.
    width: "100%",
    height: 5,
    borderRadius: 999,
    backgroundColor: "#e8ece9",
    overflow: "hidden",
    marginTop: 4
  },
  draftTimelineFill: {
    // D-day 진행 막대의 채워진 부분.
    height: "100%",
    borderRadius: 999,
    width: "62%",
    backgroundColor: "#1f7a5a"
  },
  draftTimelineFillExpired: {
    // 만료 상품 진행 막대 색상.
    width: "100%",
    backgroundColor: "#d9534f"
  },
  draftTimelineFillWarning: {
    // 임박 상품 진행 막대 색상.
    width: "40%",
    backgroundColor: "#f08a24"
  },
  draftTimelineFillSafe: {
    // 여유 상품 진행 막대 색상.
    width: "62%",
    backgroundColor: "#1f7a5a"
  },
  dateMiniButton: {
    // 초안 상품 옆의 둥근 수정 버튼.
    width: 34,
    minHeight: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#dfe9e3",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 0
  },
  dateMiniIcon: {
    // 작은 수정 버튼 아이콘 크기.
    width: 20,
    height: 20,
    tintColor: "#1f7a5a"
  },
  draftEditPanel: {
    // 초안 상품별 상세 수정 패널.
    flexBasis: "100%",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#eceff0",
    paddingTop: 12,
    marginTop: 2
  },
  editBanner: {
    // "수정 중" 상태를 알려 주는 배지.
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#fff4eb",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  editBannerText: {
    // 수정 중 배지의 텍스트.
    ...typography.captionStrong,
    color: "#ad5a18",
  },
  editNameText: {
    // 수정 중인 상품명 표시.
    ...typography.cardTitle,
    color: "#18201c",
  },
  draftEditActions: {
    // 수정 패널의 완료 버튼 정렬.
    flexDirection: "row",
    justifyContent: "flex-end"
  },
  draftEditDoneButton: {
    // 수정 완료 버튼.
    minHeight: 42,
    minWidth: 92,
    borderRadius: 10,
    backgroundColor: "#1f7a5a",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16
  },
  draftEditDoneText: {
    // 수정 완료 버튼 글자.
    ...typography.label,
    color: "#fff",
  },
  bulkSection: {
    // 카드(테두리/배경)로 감싸면 답답해 보인다는 피드백(2026-08-08)으로 감싸는
    // 박스를 없앴다 — 초기화 버튼(왼쪽, 자기 크기만큼만)과 "N개 보관함 저장"
    // 버튼(오른쪽, 남은 폭 전체)을 한 줄에 나란히 둔다(2026-08-08 재조정).
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 2,
    marginBottom: 8
  },
  bulkResetButton: {
    // 예전엔 선택 개수 텍스트 옆에 붙는 작은 인라인 버튼이었는데, 그 텍스트를
    // 저장 버튼 라벨("N개 보관함 저장")로 옮기면서 이 버튼만 남아 크기를
    // 키웠다(2026-08-08).
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d7dbd8",
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 16
  },
  bulkResetIcon: {
    // 초기화 버튼 아이콘.
    width: 20,
    height: 20,
    tintColor: "#68716b"
  },
  bulkResetText: {
    ...typography.bodyStrong,
    color: "#68716b",
  },
  bulkSubmitButton: {
    // 선택된 초안들을 보관함에 넣는 메인 버튼. 초기화 버튼과 한 줄에 나란히
    // 두면서 남은 폭을 다 채우도록 flex:1을 줬다(2026-08-08).
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: "#1f7a5a",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 12
  },
  bulkSubmitButtonDisabled: {
    opacity: 0.6
  },
  bulkSubmitIcon: {
    // 보관함 저장 버튼 아이콘.
    width: 20,
    height: 20,
    tintColor: "#fff"
  },
  bulkSubmitText: {
    // 보관함 저장 버튼 텍스트.
    ...typography.label,
    fontSize: 17,
    color: "#fff",
  },
  bulkSubmitChevron: {
    // 보관함 저장 버튼 오른쪽 화살표.
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 24,
    marginLeft: 1
  },
  itemName: {
    // 초안/목록의 상품명 텍스트.
    ...typography.cardTitle,
    color: "#18201c",
    flexShrink: 1
  },
  ddayText: {
    // D-day 표시 텍스트 공통 스타일.
    ...typography.cardTitle,
    color: "#f08a24",
  },
  ddayExpired: {
    // 이미 지난 소비기한 색상.
    color: "#d94343"
  },
  ddaySafe: {
    // 여유가 있는 소비기한 색상.
    color: "#4f9a37"
  },
  expiryDateText: {
    // 실제 소비기한 날짜 텍스트.
    ...typography.captionStrong,
    color: "#68716b",
  },
  missingProductButton: {
    // 초안 목록이 있어도 누락 상품을 직접 추가하는 버튼.
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e6e4df",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center"
  },
  missingProductText: {
    // 누락 상품 직접 추가 버튼 텍스트.
    ...typography.cardTitle,
    color: "#1f7a5a",
  },
  meta: {
    // 카드 아래에 붙는 부가 설명 텍스트 공통 스타일.
    ...typography.caption,
    color: "#68716b",
    marginTop: 4
  },
});
