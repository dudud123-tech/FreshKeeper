import { useEffect, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { ChoiceGroup, DateButton, Field, PrimaryButton } from "./CommonControls";
import { daysUntil } from "../utils/date";
import { suggestedExpiryDate, suggestedStorage } from "../utils/expiryPresets";
import { getFoodImageSource } from "../utils/foodImages";

const cameraIcon = require("../../assets/actions/action-camera.png");
const galleryIcon = require("../../assets/actions/action-gallery.png");
const photoRegisterIcon = require("../../assets/actions/action-photo-register.png");
const directRegisterIcon = require("../../assets/actions/action-direct-register.png");
const inventoryEditIcon = require("../../assets/actions/inventory-edit.png");
const resetIcon = require("../../assets/actions/action-reset.png");
const storageTabIcon = require("../../assets/tabs/tab-box.png");
const defaultItemImage = require("../../assets/foods/category-etc.png");

export default function AddItemPage({
  width,
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
  takeReceiptPhoto,
  pickReceiptImage,
  selectReceiptImageForType,
  receiptImageTypeChooserVisible,
  setReceiptImageTypeChooserVisible,
  receiptSourceType,
  receiptInteractionMode,
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
  resetReceiptDrafts,
  draftForms,
  DEFAULT_EXPIRY_TYPE,
  removeDraft,
  toggleDraftExcluded,
  updateDraftForm,
  pickDraftImage,
  addDraft
}) {
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
              style={{ width }}
              contentContainerStyle={styles.page}
              keyboardShouldPersistTaps="handled"
              scrollEnabled={!isReceiptPreviewAdjusting}
            >
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.modeCards}>
                    <AddModeCard
                      active={mode === "receipt"}
                      icon={photoRegisterIcon}
                      title={"\uc0ac\uc9c4\ub4f1\ub85d"}
                      onPress={() => setMode("receipt")}
                    />
                    <AddModeCard
                      active={mode === "manual"}
                      icon={directRegisterIcon}
                      title={"\uc9c1\uc811\ub4f1\ub85d"}
                      onPress={() => setMode("manual")}
                    />
                  </View>
                </View>

                {mode === "manual" ? (
                  <View style={styles.form}>
                    <Field label={"\uc0c1\ud488\uba85"}>
                      <View style={styles.manualNameRow}>
                        <Pressable
                          style={styles.manualNameImageButton}
                          accessibilityLabel={"\uc0c1\ud488 \uc0ac\uc9c4 \ubcc0\uacbd"}
                          onLongPress={changeManualImage}
                          delayLongPress={300}
                        >
                          <Image
                            source={manualImageUri ? { uri: manualImageUri } : defaultItemImage}
                            resizeMode="cover"
                            style={styles.manualNameImage}
                          />
                        </Pressable>
                        <TextInput
                          value={name}
                          onChangeText={(value) => {
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
                    <Field label={"구매 링크"}>
                      <TextInput
                        value={manualPurchaseUrl}
                        onChangeText={setManualPurchaseUrl}
                        placeholder={"쿠팡 공유 링크를 붙여넣어 주세요"}
                        style={styles.input}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                        inputMode="url"
                      />
                    </Field>
                    <PrimaryButton label={"\ub4f1\ub85d\ud558\uae30"} onPress={submitManual} />
                  </View>
                ) : (
                  <View style={styles.form}>
                    <Pressable style={styles.receiptActionButton} onPress={takeReceiptPhoto}>
                      <View style={styles.receiptActionIconWrap}>
                        <Image source={cameraIcon} resizeMode="contain" style={styles.receiptHeroIcon} />
                      </View>
                      <View style={styles.galleryCopy}>
                        <Text style={styles.receiptHeroTitle}>{"구매내역 촬영"}</Text>
                        <Text style={styles.receiptHeroText}>{"영수증, 주문내역에서 상품을 찾습니다."}</Text>
                      </View>
                    </Pressable>

                    <Pressable style={styles.receiptActionButton} onPress={pickReceiptImage}>
                      <View style={styles.receiptActionIconWrap}>
                        <Image source={galleryIcon} resizeMode="contain" style={styles.receiptHeroIcon} />
                      </View>
                      <View style={styles.galleryCopy}>
                        <Text style={styles.receiptHeroTitle}>{"구매내역 스캔"}</Text>
                        <Text style={styles.receiptHeroText}>{"영수증, 쿠팡·컬리 주문내역도 가능합니다."}</Text>
                      </View>
                    </Pressable>

                    {receiptImage ? (
                      <View style={styles.receiptPreviewCard}>
                        <Pressable
                          style={styles.receiptPreviewHeader}
                          onPress={() => {
                            if (openReceiptSelector) openReceiptSelector(receiptInteractionMode === "paper" ? "highlight" : "box");
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
                      {drafts.length > 0 ? (
                        <>
                          <View style={styles.discoveredHeader}>
                            <Text style={styles.discoveredTitle}>{"\uc120\ud0dd\ub41c \uc0c1\ud488"}</Text>
                          </View>

                          <View style={styles.bulkBox}>
                            <View style={styles.bulkCountBox}>
                              <Text style={styles.bulkCount}>{selectedDraftCount + "\uac1c"}</Text>
                              <Text style={styles.bulkCountLabel}>{"선택됨"}</Text>
                            </View>
                            <Pressable
                              style={styles.bulkResetButton}
                              accessibilityLabel={"\uc120\ud0dd \uc0c1\ud488 \ub9ac\uc14b"}
                              onPress={resetReceiptDrafts}
                            >
                              <Image source={resetIcon} resizeMode="contain" style={styles.bulkResetIcon} />
                              <Text style={styles.bulkResetText}>{"초기화"}</Text>
                            </Pressable>
                            <Pressable style={styles.bulkSubmitButton} onPress={addAllDrafts}>
                              <Image source={storageTabIcon} resizeMode="contain" style={styles.bulkSubmitIcon} />
                              <Text style={styles.bulkSubmitText}>{"\ubcf4\uad00\ud568\uc5d0 \uc800\uc7a5\ud558\uae30"}</Text>
                              <Text style={styles.bulkSubmitChevron}>{"›"}</Text>
                            </Pressable>
                          </View>
                          <View style={styles.draftList}>
                            {drafts.map((draft) => {
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
                                    onLongPress={() => pickDraftImage?.(draft)}
                                    delayLongPress={300}
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
                                  <View style={styles.draftText}>
                                    <Text style={styles.itemName} numberOfLines={2}>{draft}</Text>
                                    <Text style={[styles.storageBadge, storageBadgeStyle(draftStorage)]}>{draftStorage}</Text>
                                  </View>
                                  <View style={styles.draftExpiryBox}>
                                    <Text style={[styles.ddayText, dday.tone === "expired" ? styles.ddayExpired : dday.tone === "safe" ? styles.ddaySafe : null]}>{dday.label}</Text>
                                    <Text style={styles.expiryDateText}>{formatDotDate(draftExpiry)}</Text>
                                  </View>
                                  <Pressable
                                    style={styles.dateMiniButton}
                                    accessibilityLabel={"\uc18c\ube44\uae30\ud55c \uc218\uc815"}
                                    onPress={() => setEditingDraft((current) => (current === draft ? "" : draft))}
                                  >
                                    <Image source={inventoryEditIcon} resizeMode="contain" style={styles.dateMiniIcon} />
                                  </Pressable>
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
              </View>
            </ScrollView>
            <Modal
              visible={Boolean(receiptImageTypeChooserVisible)}
              transparent
              animationType="fade"
              onRequestClose={() => setReceiptImageTypeChooserVisible?.(false)}
            >
              <View style={styles.imageTypeModalBackdrop}>
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
  const days = daysUntil(expiry);
  if (days < 0) return { label: `D+${Math.abs(days)}`, tone: "expired" };
  if (days === 0) return { label: "D-day", tone: "urgent" };
  if (days <= 3) return { label: `D-${days}`, tone: "urgent" };
  return { label: `D-${days}`, tone: "safe" };
}

function formatDotDate(value) {
  return typeof value === "string" ? value.replace(/-/g, ".") : "";
}

function storageBadgeStyle(storage) {
  if (storage === "\ub0c9\ub3d9") return styles.storageBadgeFrozen;
  if (storage === "\uc2e4\uc628") return styles.storageBadgeRoom;
  return styles.storageBadgeCold;
}

function ocrBoxStyleForLine(line, selected) {
  if (selected) return styles.ocrBoxSelected;
  if (line?.boxSource === "dbnet-text-line") return styles.ocrBoxDbNet;
  return line?.boxSource === "opencv-text-line" ? styles.ocrBoxOpenCv : styles.ocrBoxUnselected;
}

function AddModeCard({ active, icon, title, onPress }) {
  return (
    <Pressable style={[styles.addModeCard, active ? styles.addModeCardActive : null]} onPress={onPress}>
      <Image source={icon} resizeMode="contain" style={styles.addModeIcon} />
      <Text style={[styles.addModeTitle, active ? styles.addModeTitleActive : null]}>{title}</Text>
    </Pressable>
  );
}

function ImageTypeOption({ icon, label, onPress }) {
  return (
    <Pressable style={styles.imageTypeOption} onPress={onPress}>
      <View style={styles.imageTypeOptionIconWrap}>
        <Image source={icon} resizeMode="contain" style={styles.imageTypeOptionIcon} />
      </View>
      <Text style={styles.imageTypeOptionText}>{label}</Text>
      <Text style={styles.imageTypeChevron}>{"›"}</Text>
    </Pressable>
  );
}

function ReceiptStep({ number, title, description, children }) {
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
  page: {
    paddingHorizontal: 16,
    paddingBottom: 140
  },
  section: {
    backgroundColor: "transparent",
    padding: 0,
    marginTop: 0
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10
  },
  modeCards: {
    flexDirection: "row",
    flex: 1,
    gap: 12
  },
  addModeCard: {
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
    borderWidth: 2,
    borderColor: "#1f7a5a",
    backgroundColor: "#f7fcfa"
  },
  addModeIcon: {
    width: 38,
    height: 38
  },
  addModeTitle: {
    color: "#18201c",
    fontSize: 16,
    fontWeight: "900"
  },
  addModeTitleActive: {
    color: "#14583f"
  },
  form: {
    gap: 10
  },
  manualNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  manualNameImageButton: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: "#edf8f2",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center"
  },
  manualNameImage: {
    width: "100%",
    height: "100%"
  },
  manualNameInput: {
    flex: 1
  },
  manualImageBox: {
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
    width: 68,
    height: 68,
    borderRadius: 14,
    backgroundColor: "#f4f8f6",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center"
  },
  manualImage: {
    width: "100%",
    height: "100%"
  },
  manualImagePlaceholder: {
    width: 52,
    height: 52,
    opacity: 0.88
  },
  manualImageActions: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  manualImageButton: {
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
    width: 18,
    height: 18
  },
  manualImageButtonText: {
    color: "#14583f",
    fontSize: 12,
    fontWeight: "900"
  },
  manualImageClearButton: {
    minHeight: 38,
    borderRadius: 10,
    backgroundColor: "#fff1ee",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  manualImageClearText: {
    color: "#a83a2f",
    fontSize: 12,
    fontWeight: "900"
  },
  receiptActionButton: {
    minHeight: 86,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e6e4df",
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 12,
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  receiptActionIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#edf7f2",
    alignItems: "center",
    justifyContent: "center"
  },
  receiptHeroButton: {
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
  receiptHeroIcon: {
    width: 34,
    height: 34
  },
  receiptHeroTitle: {
    color: "#18201c",
    fontSize: 15,
    fontWeight: "900",
    flexShrink: 1
  },
  receiptHeroText: {
    color: "#8a938d",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
    flexShrink: 1,
    lineHeight: 17
  },
  galleryButton: {
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
    width: 28,
    height: 28
  },
  galleryText: {
    color: "#18201c",
    fontSize: 15,
    fontWeight: "900"
  },
  galleryCopy: {
    flex: 1,
    gap: 3
  },
  galleryHint: {
    color: "#8a938d",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17
  },
  imageTypeModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24
  },
  imageTypeModalCard: {
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
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#edf8f2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12
  },
  imageTypeHeroIcon: {
    width: 38,
    height: 38
  },
  imageTypeQuestionBadge: {
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
    color: "#fff",
    fontSize: 13,
    fontWeight: "900"
  },
  imageTypeTitle: {
    color: "#18201c",
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center"
  },
  imageTypeSubtitle: {
    color: "#8a938d",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 5,
    marginBottom: 16,
    textAlign: "center"
  },
  imageTypeOptions: {
    width: "100%",
    gap: 8
  },
  imageTypeOption: {
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
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#edf8f2",
    alignItems: "center",
    justifyContent: "center"
  },
  imageTypeOptionIcon: {
    width: 18,
    height: 18
  },
  imageTypeOptionText: {
    flex: 1,
    color: "#18201c",
    fontSize: 14,
    fontWeight: "800"
  },
  imageTypeChevron: {
    color: "#1f7a5a",
    fontSize: 22,
    fontWeight: "700",
    marginTop: -2
  },
  recognizedPanel: {
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e6e4df",
    backgroundColor: "#fff",
    padding: 14
  },
  receiptPreviewCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e6e4df",
    backgroundColor: "#fff",
    overflow: "hidden"
  },
  receiptPreviewHeader: {
    minHeight: 86,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14
  },
  receiptThumbWrap: {
    width: 58,
    height: 58,
    borderRadius: 10,
    backgroundColor: "#f4f5f2",
    overflow: "hidden"
  },
  receiptThumb: {
    width: "100%",
    height: "100%",
    resizeMode: "cover"
  },
  receiptPreviewCopy: {
    flex: 1,
    gap: 5
  },
  receiptPreviewTitle: {
    color: "#18201c",
    fontSize: 15,
    fontWeight: "900"
  },
  receiptPreviewMeta: {
    alignSelf: "flex-start",
    color: "#1f7a5a",
    fontSize: 12,
    fontWeight: "900",
    backgroundColor: "#edf7f2",
    borderRadius: 6,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  receiptPreviewToggle: {
    color: "#1f7a5a",
    fontSize: 14,
    fontWeight: "900"
  },
  receiptPreviewBody: {
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 12
  },
  recognizedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  panelTitle: {
    color: "#18201c",
    fontSize: 15,
    fontWeight: "900"
  },
  editText: {
    color: "#1f7a5a",
    fontSize: 13,
    fontWeight: "900"
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
    width: 18,
    height: 18,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "#1f7a5a",
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
    lineHeight: 18
  },
  recognizedName: {
    flex: 1,
    color: "#18201c",
    fontSize: 14,
    fontWeight: "800"
  },
  recognizedStorage: {
    color: "#68716b",
    fontSize: 12,
    fontWeight: "800"
  },
  registerPanel: {
    gap: 10
  },
  discoveredHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginTop: 6
  },
  discoveredTitle: {
    color: "#18201c",
    fontSize: 20,
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
  receiptStep: {
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
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#1f7a5a",
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 26,
    textAlign: "center"
  },
  receiptStepCopy: {
    flex: 1,
    gap: 3
  },
  receiptStepTitle: {
    color: "#18201c",
    fontSize: 16,
    fontWeight: "900"
  },
  receiptStepDescription: {
    color: "#68716b",
    fontSize: 12,
    lineHeight: 18
  },
  receiptActions: {
    gap: 10
  },
  status: {
    color: "#14583f",
    fontSize: 13,
    lineHeight: 19
  },
  receiptEmptyText: {
    color: "#68716b",
    fontSize: 13,
    lineHeight: 19,
    paddingVertical: 8
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
  receiptAdjustButton: {
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
    borderColor: "#1f7a5a",
    backgroundColor: "#1f7a5a"
  },
  receiptAdjustButtonText: {
    color: "#14583f",
    fontSize: 12,
    fontWeight: "900"
  },
  receiptAdjustButtonTextActive: {
    color: "#fff"
  },
  receiptImageCanvas: {
    width: "100%",
    height: "100%",
    position: "relative"
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
  ocrBoxSelected: {
    borderColor: "#1f7a5a",
    backgroundColor: "rgba(31, 122, 90, 0.045)"
  },
  ocrBoxUnselected: {
    borderColor: "#7d857f",
    backgroundColor: "rgba(104, 113, 107, 0.015)"
  },
  ocrBoxOpenCv: {
    borderColor: "#2f80ed",
    backgroundColor: "rgba(47, 128, 237, 0.055)"
  },
  ocrBoxDbNet: {
    borderColor: "#8b5cf6",
    backgroundColor: "rgba(139, 92, 246, 0.07)"
  },
  cropDebugBox: {
    position: "absolute",
    borderWidth: 2,
    borderRadius: 6
  },
  cropDebugBoxUnselected: {
    borderColor: "rgba(79, 91, 84, 0.5)",
    backgroundColor: "rgba(240, 240, 236, 0.18)"
  },
  cropDebugBoxSelected: {
    borderColor: "#1f7a5a",
    backgroundColor: "rgba(31, 122, 90, 0.16)"
  },
  receiptToolRow: {
    gap: 8
  },
  coordinateControlWrap: {
    gap: 8
  },
  coordinateToggleButton: {
    alignSelf: "flex-start",
    minHeight: 32,
    borderRadius: 999,
    backgroundColor: "#f4fbf8",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  coordinateToggleText: {
    color: "#14583f",
    fontSize: 12,
    fontWeight: "900"
  },
  coordinateChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  coordinateChip: {
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
    borderColor: "#1f7a5a",
    backgroundColor: "#edf7f2"
  },
  coordinateChipText: {
    color: "#68716b",
    fontSize: 12,
    fontWeight: "900"
  },
  coordinateChipTextActive: {
    color: "#14583f"
  },
  coordinateButton: {
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
    color: "#14583f",
    fontWeight: "900"
  },
  draftList: {
    gap: 10
  },
  draftItem: {
    minHeight: 84,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#eceff0",
    borderRadius: 16,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  draftItemExcluded: {
    opacity: 0.48
  },
  draftCheckButton: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: "#1f7a5a",
    alignItems: "center",
    justifyContent: "center"
  },
  draftCheckButtonOff: {
    borderWidth: 1.5,
    borderColor: "#cfd8d2",
    backgroundColor: "#fff"
  },
  draftCheckText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 14
  },
  draftImage: {
    width: 58,
    height: 58,
    borderRadius: 12,
    backgroundColor: "#edf7f2",
    overflow: "hidden"
  },
  draftText: {
    flex: 1,
    gap: 6
  },
  storageBadge: {
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "900",
    borderRadius: 6,
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 3
  },
  storageBadgeCold: {
    color: "#2779b8",
    backgroundColor: "#eaf4fb"
  },
  storageBadgeFrozen: {
    color: "#5b57c8",
    backgroundColor: "#eeedff"
  },
  storageBadgeRoom: {
    color: "#b56b16",
    backgroundColor: "#fff3dc"
  },
  draftExpiryBox: {
    alignItems: "center",
    minWidth: 64,
    gap: 4
  },
  dateMiniButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e6e4df",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 0
  },
  dateMiniIcon: {
    width: 20,
    height: 20
  },
  draftEditPanel: {
    flexBasis: "100%",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#eceff0",
    paddingTop: 12,
    marginTop: 2
  },
  editBanner: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#fff4eb",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  editBannerText: {
    color: "#ad5a18",
    fontSize: 12,
    fontWeight: "900"
  },
  editNameText: {
    color: "#18201c",
    fontSize: 15,
    fontWeight: "900"
  },
  draftEditActions: {
    flexDirection: "row",
    justifyContent: "flex-end"
  },
  draftEditDoneButton: {
    minHeight: 42,
    minWidth: 92,
    borderRadius: 10,
    backgroundColor: "#1f7a5a",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16
  },
  draftEditDoneText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900"
  },
  bulkBox: {
    minHeight: 72,
    marginTop: 4,
    marginBottom: 4,
    borderRadius: 18,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: 10,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3
  },
  bulkCountBox: {
    width: 64,
    minHeight: 56,
    borderRadius: 12,
    backgroundColor: "#edf8f2",
    alignItems: "center",
    justifyContent: "center"
  },
  bulkCount: {
    color: "#1f7a5a",
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 26
  },
  bulkCountLabel: {
    color: "#68716b",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2
  },
  bulkResetButton: {
    width: 58,
    minHeight: 56,
    borderRadius: 12,
    backgroundColor: "#f5faf7",
    alignItems: "center",
    justifyContent: "center"
  },
  bulkResetIcon: {
    width: 25,
    height: 25,
    tintColor: "#1f7a5a"
  },
  bulkResetText: {
    color: "#68716b",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2
  },
  bulkSubmitButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 13,
    backgroundColor: "#1f7a5a",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 14
  },
  bulkSubmitIcon: {
    width: 22,
    height: 22,
    tintColor: "#fff"
  },
  bulkSubmitText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900"
  },
  bulkSubmitChevron: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 26,
    marginLeft: 2
  },
  itemName: {
    color: "#18201c",
    fontSize: 14,
    fontWeight: "500",
    flexShrink: 1
  },
  ddayText: {
    color: "#f08a24",
    fontSize: 17,
    fontWeight: "900"
  },
  ddayExpired: {
    color: "#d94343"
  },
  ddaySafe: {
    color: "#4f9a37"
  },
  expiryDateText: {
    color: "#68716b",
    fontSize: 12,
    fontWeight: "800"
  },
  missingProductButton: {
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e6e4df",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center"
  },
  missingProductText: {
    color: "#1f7a5a",
    fontSize: 15,
    fontWeight: "900"
  },
  meta: {
    color: "#68716b",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4
  },
});
