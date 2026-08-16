import { useEffect, useState } from "react";
import { Alert, Image, Modal, Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { typography } from "../theme/typography";
import { frameForBox } from "../utils/receiptOverlay";

const HIGHLIGHT_TOOL_ICONS = {
  move: require("../../assets/actions/highlight-zoom.png"),
  paint: require("../../assets/actions/highlight-pen.png"),
  done: require("../../assets/actions/highlight-done.png")
};
const ANDROID_STATUS_BAR_HEIGHT = Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0;
const MIN_SELECTION_SIZE = 10;

export default function ReceiptSelectorModal({
  visible,
  imageUri,
  imageSize,
  coordinateSize,
  lines,
  cropBoxes = [],
  mode = "box",
  selectedIds,
  selectionRects = [],
  setSelectionRects,
  onToggleLine,
  onToggleCropBox,
  onConfirmHighlight,
  onSwitchToHighlight,
  onCancel,
  onConfirm
}) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const [isReceiptZoomed, setIsReceiptZoomed] = useState(false);
  const [isMoveMode, setIsMoveMode] = useState(false);
  const [draftRect, setDraftRect] = useState(null);
  const isPaintMode = mode === "highlight";
  const canMoveReceipt = !isPaintMode || isMoveMode;
  const scaleValue = useSharedValue(1);
  const translateXValue = useSharedValue(0);
  const translateYValue = useSharedValue(0);
  const startScaleValue = useSharedValue(1);
  const startTranslateXValue = useSharedValue(0);
  const startTranslateYValue = useSharedValue(0);
  const startFocalXValue = useSharedValue(0);
  const startFocalYValue = useSharedValue(0);
  const dragStartXValue = useSharedValue(0);
  const dragStartYValue = useSharedValue(0);
  const canvasWidthValue = useSharedValue(360);
  const canvasHeightValue = useSharedValue(620);
  const fallbackWidth = layout.width || 360;
  const imageRatio = imageSize.width && imageSize.height ? imageSize.height / imageSize.width : 1.6;
  const canvasWidth = fallbackWidth;
  const naturalCanvasHeight = Math.max(520, Math.round(canvasWidth * imageRatio));
  // 예전엔 색칠 모드에서 캔버스 높이를 760px로 강제로 잘랐는데, 세로로 긴 영수증은
  // 실제 이미지보다 캔버스가 작아져서 Image의 기본 resizeMode("cover")로 인해
  // 가운데만 잘려 보이고, 그 상태로 좌표 계산은 "캔버스 전체 = 이미지 전체"라고
  // 가정해버려 칠한 위치와 실제 매칭 위치가 어긋났다. 박스 모드처럼 캔버스를
  // 이미지 실제 비율 그대로 두고 ScrollView로 스크롤하게 한다.
  const canvasHeight = naturalCanvasHeight;

  const applyTransform = (nextScale, nextTranslateX, nextTranslateY) => {
    "worklet";
    const clampedScale = Math.min(Math.max(nextScale, 1), 4);
    if (clampedScale <= 1.02) {
      scaleValue.value = 1;
      translateXValue.value = 0;
      translateYValue.value = 0;
      return;
    }
    const maxTranslateX = (canvasWidthValue.value * (clampedScale - 1)) / 2;
    const maxTranslateY = (canvasHeightValue.value * (clampedScale - 1)) / 2;
    scaleValue.value = clampedScale;
    translateXValue.value = Math.min(Math.max(nextTranslateX, -maxTranslateX), maxTranslateX);
    translateYValue.value = Math.min(Math.max(nextTranslateY, -maxTranslateY), maxTranslateY);
  };

  const pinchGesture = Gesture.Pinch()
    .enabled(canMoveReceipt)
    .onBegin((event) => {
      startScaleValue.value = scaleValue.value;
      startTranslateXValue.value = translateXValue.value;
      startTranslateYValue.value = translateYValue.value;
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
      runOnJS(setIsReceiptZoomed)(scaleValue.value > 1.02);
    });

  const panGesture = Gesture.Pan()
    .enabled(canMoveReceipt && isReceiptZoomed)
    .maxPointers(1)
    .minDistance(4)
    .onBegin(() => {
      startScaleValue.value = scaleValue.value;
      startTranslateXValue.value = translateXValue.value;
      startTranslateYValue.value = translateYValue.value;
    })
    .onUpdate((event) => {
      if (startScaleValue.value <= 1.02) return;
      applyTransform(
        startScaleValue.value,
        startTranslateXValue.value + event.translationX,
        startTranslateYValue.value + event.translationY
      );
    })
    .onEnd(() => {
      applyTransform(scaleValue.value, translateXValue.value, translateYValue.value);
      runOnJS(setIsReceiptZoomed)(scaleValue.value > 1.02);
    });

  // 손가락으로 텍스트를 정밀 추적해서 칠하게 하면 줄에서 위/아래로 삐뚤어지거나
  // 글자를 덜 덮는 문제가 반복됐다. 그 대신 모서리를 대충 드래그해 사각형을
  // 그리게 하면, 사용자는 정밀하게 따라 그릴 필요 없이 상품명 주변을 넉넉히
  // 감싸기만 하면 된다. 여러 상품을 고르도록 드래그할 때마다 박스가 하나씩
  // 쌓이고(추가), 잘못 그린 박스는 각자의 삭제 버튼으로 지운다.
  const boxGesture = Gesture.Pan()
    .enabled(isPaintMode && !isMoveMode)
    .minDistance(1)
    .onBegin((event) => {
      const scale = Math.max(scaleValue.value, 1);
      const centerX = canvasWidthValue.value / 2;
      const centerY = canvasHeightValue.value / 2;
      const canvasX = (event.x - centerX - translateXValue.value) / scale + centerX;
      const canvasY = (event.y - centerY - translateYValue.value) / scale + centerY;
      dragStartXValue.value = canvasX;
      dragStartYValue.value = canvasY;
      runOnJS(setDraftRect)({ x: canvasX, y: canvasY, width: 0, height: 0 });
    })
    .onUpdate((event) => {
      const scale = Math.max(scaleValue.value, 1);
      const centerX = canvasWidthValue.value / 2;
      const centerY = canvasHeightValue.value / 2;
      const canvasX = (event.x - centerX - translateXValue.value) / scale + centerX;
      const canvasY = (event.y - centerY - translateYValue.value) / scale + centerY;
      const x = Math.min(dragStartXValue.value, canvasX);
      const y = Math.min(dragStartYValue.value, canvasY);
      const width = Math.abs(canvasX - dragStartXValue.value);
      const height = Math.abs(canvasY - dragStartYValue.value);
      runOnJS(setDraftRect)({ x, y, width, height });
    })
    .onEnd(() => {
      runOnJS(commitDraftRect)();
    });

  const receiptGesture = isPaintMode && !isMoveMode
    ? boxGesture
    : Gesture.Race(pinchGesture, panGesture);
  const animatedCanvasStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateXValue.value },
      { translateY: translateYValue.value },
      { scale: scaleValue.value }
    ]
  }));

  useEffect(() => {
    canvasWidthValue.value = canvasWidth;
    canvasHeightValue.value = canvasHeight;
  }, [canvasWidth, canvasHeight, canvasWidthValue, canvasHeightValue]);

  // 확대/이동 상태와 그리다 만 박스(draftRect)는 다시 열 때마다 초기화하지만,
  // 이미 그려둔 박스(selectionRects)는 여기서 건드리지 않는다 — "보기"로 재진입해도
  // 이전에 표시해둔 박스가 남아있어야 한다. 새 이미지를 고른 경우의 초기화는
  // useReceiptFlow.js의 createReceiptCandidates/resetReceiptDrafts가 책임진다.
  useEffect(() => {
    if (!visible) return;
    scaleValue.value = 1;
    translateXValue.value = 0;
    translateYValue.value = 0;
    setIsReceiptZoomed(false);
    setIsMoveMode(false);
    setDraftRect(null);
  }, [visible, imageUri, mode, scaleValue, translateXValue, translateYValue]);

  function commitDraftRect() {
    // setDraftRect의 업데이트 콜백 안에서 다른 컴포넌트(App) 소유 상태인
    // setSelectionRects를 호출하면 "다른 컴포넌트를 렌더링 중 업데이트" 경고가 뜬다.
    // 두 상태 업데이트를 중첩하지 않고 각자 독립적으로 호출한다.
    if (!draftRect || draftRect.width < MIN_SELECTION_SIZE || draftRect.height < MIN_SELECTION_SIZE) {
      setDraftRect(null);
      return;
    }
    const committedRect = { ...draftRect, id: `${Date.now()}-${selectionRects.length}` };
    setSelectionRects?.((rects) => [...rects, committedRect]);
    setDraftRect(null);
  }

  function removeSelectionRect(id) {
    setSelectionRects?.((rects) => rects.filter((rect) => rect.id !== id));
  }

  function confirmHighlight() {
    if (!isPaintMode) {
      // 박스 모드는 박스를 누를 때마다 이미 drafts에 바로 반영돼 있으므로, 완료는
      // 그 상태를 그대로 인정하고 닫기만 하면 된다(되돌릴 스냅샷은 onCancel 쪽 몫).
      onConfirm?.();
      return;
    }
    if (!selectionRects.length) {
      Alert.alert(
        "표시한 상품이 없습니다",
        "상품명 주변을 드래그해서 박스로 감싼 뒤 완료 버튼을 눌러주세요."
      );
      return;
    }
    // 여백은 여기서 붙이지 않는다 — useReceiptFlow.js의 draftNamesFromSelection이
    // 이미 캔버스 기준 고정 여백을 붙이므로, 여기서 또 붙이면 두 배로 넓어져
    // 위아래 다른 줄까지 크롭에 딸려온다.
    const selections = selectionRects.map((rect) => {
      const minX = Math.max(0, rect.x);
      const minY = Math.max(0, rect.y);
      const maxX = Math.min(canvasWidth, rect.x + rect.width);
      const maxY = Math.min(canvasHeight, rect.y + rect.height);
      return {
        x: minX,
        y: minY,
        width: Math.max(1, maxX - minX),
        height: Math.max(1, maxY - minY),
        canvasWidth,
        canvasHeight
      };
    });
    onConfirmHighlight?.(selections);
  }

  function modalFrameForLine(line) {
    return frameForBox(line.box, coordinateSize, { width: canvasWidth, height: canvasHeight }, 32, 12, 0.5);
  }

  function modalFrameForCropBox(cropBox) {
    return frameForBox(cropBox.box, coordinateSize, { width: canvasWidth, height: canvasHeight }, 32, 32, 1);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <GestureHandlerRootView style={styles.gestureRoot}>
        <SafeAreaView style={styles.selectorScreen}>
          <View style={styles.highlightHeader}>
            <View style={styles.highlightTopBar}>
              <Pressable style={styles.highlightBackButton} onPress={onCancel}>
                <Text style={styles.highlightBackText}>‹</Text>
              </Pressable>
              <Text style={styles.highlightScreenTitle}>상품 등록</Text>
              <View style={styles.highlightTopBarSpacer} />
            </View>
            {isPaintMode ? (
              <View style={styles.highlightInstructionFrame}>
                <Text style={styles.highlightSubtitle}>
                  상품명 주변을 <Text style={styles.highlightSubtitleStrong}>박스로 드래그</Text>하면 등록할 수 있어요.
                </Text>
              </View>
            ) : (
              <View style={styles.highlightInstructionFrame}>
                <View style={styles.scanInstructionLine}>
                  <Text style={styles.highlightSubtitle}>인식된 상품을 확인한 뒤</Text>
                  <Pressable style={styles.inlineDoneButton} onPress={confirmHighlight}>
                    <Text style={styles.inlineDoneButtonText}>완료</Text>
                  </Pressable>
                  <Text style={styles.highlightSubtitle}>를 눌러주세요.</Text>
                </View>
              </View>
            )}
            {isPaintMode ? (
              <View style={styles.highlightToolbar}>
                <Pressable
                  style={[styles.highlightToolButton, isMoveMode ? styles.highlightToolButtonActive : null]}
                  onPress={() => setIsMoveMode(true)}
                >
                  <Image source={HIGHLIGHT_TOOL_ICONS.move} style={styles.highlightToolImage} />
                  <Text style={[styles.highlightToolLabel, isMoveMode ? styles.highlightToolLabelActive : null]}>확대/축소</Text>
                </Pressable>
                <Pressable
                  style={[styles.highlightToolButton, !isMoveMode ? styles.highlightToolButtonActive : null]}
                  onPress={() => setIsMoveMode(false)}
                >
                  <Image source={HIGHLIGHT_TOOL_ICONS.paint} style={styles.highlightToolImage} />
                  <Text style={[styles.highlightToolLabel, !isMoveMode ? styles.highlightToolLabelActive : null]}>영역 선택</Text>
                </Pressable>
                <Pressable style={styles.highlightToolButton} onPress={confirmHighlight}>
                  <Image source={HIGHLIGHT_TOOL_ICONS.done} style={styles.highlightToolImage} />
                  <Text style={styles.highlightToolLabel}>완료</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.scanConfirmBar}>
                <Text style={styles.scanConfirmText}>박스를 터치하여 등록하거나 해제하세요.</Text>
                {onSwitchToHighlight ? (
                  <Pressable style={styles.switchToHighlightButton} onPress={onSwitchToHighlight}>
                    <Text style={styles.switchToHighlightButtonText}>박스가 안 맞나요? 직접 표시하기</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </View>
          <ScrollView
            style={styles.selectorScroll}
            contentContainerStyle={[styles.selectorScrollContent, isPaintMode ? styles.highlightScrollContent : null]}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!isReceiptZoomed}
          >
            <View style={isPaintMode ? styles.receiptStageCard : styles.selectorStagePlain}>
              <GestureDetector gesture={receiptGesture}>
                <View
                  collapsable={false}
                  style={styles.selectorViewport}
                  onLayout={(event) => setLayout({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
                >
                  <Animated.View
                    style={[
                      styles.selectorCanvas,
                      {
                        width: canvasWidth,
                        height: canvasHeight
                      },
                      animatedCanvasStyle
                    ]}
                  >
                    {imageUri ? <Image source={{ uri: imageUri }} style={styles.selectorImage} /> : null}
                    {isPaintMode ? (
                      <>
                        {selectionRects.map((rect) => (
                          <View key={rect.id} pointerEvents="box-none" style={[styles.selectionBox, { left: rect.x, top: rect.y, width: rect.width, height: rect.height }]}>
                            <Pressable
                              hitSlop={10}
                              style={styles.selectionDeleteButton}
                              onPress={() => removeSelectionRect(rect.id)}
                            >
                              <Text style={styles.selectionDeleteButtonText}>×</Text>
                            </Pressable>
                          </View>
                        ))}
                        {draftRect ? (
                          <View
                            pointerEvents="none"
                            style={[styles.selectionBox, { left: draftRect.x, top: draftRect.y, width: draftRect.width, height: draftRect.height }]}
                          />
                        ) : null}
                      </>
                    ) : (
                      <>
                        {lines.map((line) => {
                          const frame = modalFrameForLine(line);
                          if (!frame) return null;
                          const selected = selectedIds.includes(line.id);
                          return (
                            <Pressable key={line.id} hitSlop={8} style={[styles.ocrBox, ocrBoxStyleForLine(line, selected), frame]} onPress={() => onToggleLine(line)} />
                          );
                        })}
                        {cropBoxes.map((cropBox) => {
                          const frame = modalFrameForCropBox(cropBox);
                          if (!frame) return null;
                          const selected = cropBox.lineId ? selectedIds.includes(cropBox.lineId) : false;
                          return (
                            <Pressable
                              key={cropBox.id}
                              hitSlop={8}
                              style={[styles.cropDebugBox, selected ? styles.cropDebugBoxSelected : styles.cropDebugBoxUnselected, frame]}
                              onPress={() => onToggleCropBox?.(cropBox)}
                            />
                          );
                        })}
                      </>
                    )}
                  </Animated.View>
                </View>
              </GestureDetector>
            </View>
          </ScrollView>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

function ocrBoxStyleForLine(line, selected) {
  if (selected) return styles.ocrBoxSelected;
  if (line?.boxSource === "dbnet-text-line") return styles.ocrBoxDbNet;
  return line?.boxSource === "opencv-text-line" ? styles.ocrBoxOpenCv : styles.ocrBoxUnselected;
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1
  },
  selectorScreen: {
    flex: 1,
    backgroundColor: "#fbfcfb"
  },
  highlightHeader: {
    paddingHorizontal: 16,
    paddingTop: ANDROID_STATUS_BAR_HEIGHT,
    paddingBottom: 8,
    gap: 8
  },
  highlightTopBar: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  highlightBackButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center"
  },
  highlightBackText: {
    color: "#18201c",
    fontSize: 32,
    fontWeight: "500",
    lineHeight: 34
  },
  highlightScreenTitle: {
    ...typography.screenTitle,
    color: "#18201c",
  },
  highlightTopBarSpacer: {
    width: 38,
    height: 38
  },
  highlightInstructionFrame: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 0,
    paddingBottom: 2
  },
  scanInstructionLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 4
  },
  highlightSubtitle: {
    textAlign: "center",
    color: "#5d6661",
    fontSize: 16,
    fontWeight: "400"
  },
  highlightSubtitleStrong: {
    color: "#1f8d55",
    fontWeight: "800"
  },
  inlineDoneButton: {
    minHeight: 26,
    borderRadius: 13,
    backgroundColor: "#1f8d55",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  inlineDoneButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "400"
  },
  highlightToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#edf0ed",
    shadowColor: "#0f241a",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    overflow: "hidden"
  },
  highlightToolButton: {
    flex: 1,
    minHeight: 62,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "transparent",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  },
  highlightToolButtonActive: {
    borderColor: "#d5eddf",
    backgroundColor: "#eef9f1",
    shadowColor: "#1f7a5a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 2
  },
  highlightToolImage: {
    width: 28,
    height: 28,
    resizeMode: "contain"
  },
  highlightToolLabel: {
    color: "#3f4844",
    fontSize: 11,
    fontWeight: "800"
  },
  highlightToolLabelActive: {
    color: "#1f8d55"
  },
  scanConfirmBar: {
    minHeight: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    gap: 8
  },
  switchToHighlightButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e0503c"
  },
  switchToHighlightButtonText: {
    color: "#e0503c",
    fontSize: 13,
    fontWeight: "800"
  },
  scanConfirmText: {
    color: "#5d6661",
    fontSize: 16,
    fontWeight: "600"
  },
  scanConfirmButton: {
    minHeight: 36,
    borderRadius: 18,
    backgroundColor: "#1f8d55",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    gap: 5
  },
  scanConfirmIcon: {
    width: 18,
    height: 18,
    resizeMode: "contain",
    tintColor: "#fff"
  },
  scanConfirmButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900"
  },
  highlightNoticeCard: {
    minHeight: 82,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#f0dfaa",
    backgroundColor: "#fff9df",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14
  },
  highlightNoticeCopy: {
    flex: 1,
    paddingRight: 12
  },
  highlightNoticeTitle: {
    color: "#5b3616",
    fontSize: 18,
    fontWeight: "900"
  },
  highlightNoticeText: {
    marginTop: 7,
    color: "#7a5c31",
    fontSize: 15,
    fontWeight: "700"
  },
  highlightSelectionPill: {
    height: 46,
    minWidth: 104,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: "#f2a13a",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14
  },
  highlightSelectionText: {
    color: "#f07818",
    fontSize: 16,
    fontWeight: "900"
  },
  selectorScroll: {
    flex: 1
  },
  selectorScrollContent: {
    alignItems: "center",
    paddingBottom: 20
  },
  highlightScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 14
  },
  selectorStagePlain: {
    width: "100%",
    alignItems: "center"
  },
  receiptStageCard: {
    width: "100%",
    minHeight: 430,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e4e9e5",
    backgroundColor: "#fff",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center"
  },
  selectorViewport: {
    width: "100%",
    overflow: "hidden",
    alignItems: "center"
  },
  selectorCanvas: {
    position: "relative",
    backgroundColor: "#fff"
  },
  selectorImage: {
    width: "100%",
    height: "100%"
  },
  selectionBox: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "#1f8d55",
    borderRadius: 8,
    backgroundColor: "rgba(31, 141, 85, 0.16)"
  },
  selectionDeleteButton: {
    position: "absolute",
    right: -12,
    top: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#e0503c",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0f241a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3
  },
  selectionDeleteButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 18
  },
  highlightZoomControl: {
    position: "absolute",
    left: 18,
    bottom: 20,
    width: 58,
    height: 154,
    borderRadius: 29,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    alignItems: "center",
    justifyContent: "space-around",
    shadowColor: "#0f241a",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3
  },
  highlightZoomButtonText: {
    color: "#3f4844",
    fontSize: 24,
    fontWeight: "500"
  },
  highlightZoomPercent: {
    color: "#3f4844",
    fontSize: 14,
    fontWeight: "900"
  },
  originalViewPill: {
    position: "absolute",
    right: 18,
    bottom: 20,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(78, 81, 79, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  originalViewText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900"
  },
  highlightHowToCard: {
    width: "100%",
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#7bc397",
    backgroundColor: "#fbfff8",
    paddingHorizontal: 16,
    paddingVertical: 16
  },
  highlightHowToTitle: {
    color: "#1f8d55",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 14
  },
  highlightHowToSteps: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  highlightHowToStep: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  highlightStepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    overflow: "hidden",
    textAlign: "center",
    textAlignVertical: "center",
    color: "#fff",
    backgroundColor: "#66a958",
    fontSize: 13,
    fontWeight: "900"
  },
  highlightStepText: {
    color: "#3f4844",
    fontSize: 13,
    fontWeight: "800"
  },
  highlightStepArrow: {
    color: "#1f8d55",
    fontSize: 28,
    fontWeight: "600"
  },
  highlightBottomBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: "#fbfcfb"
  },
  highlightSubmitButton: {
    height: 64,
    borderRadius: 18,
    backgroundColor: "#159447",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    shadowColor: "#0f241a",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 4
  },
  highlightSubmitText: {
    flex: 1,
    textAlign: "center",
    color: "#fff",
    fontSize: 20,
    fontWeight: "900"
  },
  highlightSubmitCountPill: {
    minWidth: 62,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  highlightSubmitCountText: {
    color: "#159447",
    fontSize: 18,
    fontWeight: "900"
  },
  ocrBox: {
    position: "absolute",
    borderRadius: 5,
    borderWidth: 1.5
  },
  ocrBoxUnselected: {
    borderColor: "rgba(79, 91, 84, 0.5)",
    backgroundColor: "rgba(240, 240, 236, 0.28)"
  },
  ocrBoxOpenCv: {
    borderColor: "#2f80ed",
    backgroundColor: "rgba(47, 128, 237, 0.12)"
  },
  ocrBoxDbNet: {
    borderColor: "#8b5cf6",
    backgroundColor: "rgba(139, 92, 246, 0.16)"
  },
  ocrBoxSelected: {
    borderColor: "#2563eb",
    backgroundColor: "rgba(37, 99, 235, 0.22)"
  },
  cropDebugBox: {
    position: "absolute",
    borderRadius: 8,
    borderWidth: 2
  },
  cropDebugBoxUnselected: {
    borderColor: "rgba(79, 91, 84, 0.5)",
    backgroundColor: "rgba(240, 240, 236, 0.18)"
  },
  cropDebugBoxSelected: {
    borderColor: "#2563eb",
    backgroundColor: "rgba(37, 99, 235, 0.24)"
  }
});
