import { useEffect, useRef, useState } from "react";
import { Alert, Image, Modal, Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { typography } from "../theme/typography";
import { frameForBox } from "../utils/receiptOverlay";

const DEBUG_LOG = true;
const HIGHLIGHT_TOOL_ICONS = {
  move: require("../../assets/actions/highlight-zoom.png"),
  paint: require("../../assets/actions/highlight-pen.png"),
  erase: require("../../assets/actions/highlight-eraser.png"),
  done: require("../../assets/actions/highlight-done.png")
};
const ANDROID_STATUS_BAR_HEIGHT = Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0;

function debugHighlightPaint(payload) {
  if (!DEBUG_LOG) return;
  console.log("[freshkeeper:highlight-paint]", payload);
}

export default function ReceiptSelectorModal({
  visible,
  imageUri,
  imageSize,
  coordinateSize,
  lines,
  cropBoxes = [],
  mode = "box",
  selectedIds,
  highlightMarks = [],
  setHighlightMarks,
  onToggleLine,
  onToggleCropBox,
  onConfirmHighlight,
  onClose
}) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const [isReceiptZoomed, setIsReceiptZoomed] = useState(false);
  const [highlightToolMode, setHighlightToolMode] = useState("paint");
  const lastHighlightMarkRef = useRef(null);
  const isPaintMode = mode === "highlight";
  const canMoveReceipt = !isPaintMode || highlightToolMode === "move";
  const scaleValue = useSharedValue(1);
  const translateXValue = useSharedValue(0);
  const translateYValue = useSharedValue(0);
  const startScaleValue = useSharedValue(1);
  const startTranslateXValue = useSharedValue(0);
  const startTranslateYValue = useSharedValue(0);
  const startFocalXValue = useSharedValue(0);
  const startFocalYValue = useSharedValue(0);
  const canvasWidthValue = useSharedValue(360);
  const canvasHeightValue = useSharedValue(620);
  const fallbackWidth = layout.width || 360;
  const imageRatio = imageSize.width && imageSize.height ? imageSize.height / imageSize.width : 1.6;
  const canvasWidth = fallbackWidth;
  const naturalCanvasHeight = Math.max(520, Math.round(canvasWidth * imageRatio));
  const canvasHeight = isPaintMode ? Math.min(naturalCanvasHeight, 760) : naturalCanvasHeight;
  const highlighterSize = estimateHighlighterSize(lines, coordinateSize, canvasWidth, canvasHeight);

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

  const paintAtPoint = (x, y) => {
    "worklet";
    const scale = Math.max(scaleValue.value, 1);
    const centerX = canvasWidthValue.value / 2;
    const centerY = canvasHeightValue.value / 2;
    const canvasX = (x - centerX - translateXValue.value) / scale + centerX;
    const canvasY = (y - centerY - translateYValue.value) / scale + centerY;
    runOnJS(addHighlightMark)(canvasX, canvasY);
  };

  const eraseAtPoint = (x, y) => {
    "worklet";
    const scale = Math.max(scaleValue.value, 1);
    const centerX = canvasWidthValue.value / 2;
    const centerY = canvasHeightValue.value / 2;
    const canvasX = (x - centerX - translateXValue.value) / scale + centerX;
    const canvasY = (y - centerY - translateYValue.value) / scale + centerY;
    runOnJS(removeHighlightMarkAt)(canvasX, canvasY);
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

  const paintGesture = Gesture.Pan()
    .enabled(isPaintMode && highlightToolMode === "paint")
    .minDistance(1)
    .onBegin((event) => {
      paintAtPoint(event.x, event.y);
    })
    .onUpdate((event) => {
      paintAtPoint(event.x, event.y);
    });

  const eraseGesture = Gesture.Pan()
    .enabled(isPaintMode && highlightToolMode === "erase")
    .minDistance(1)
    .onBegin((event) => {
      eraseAtPoint(event.x, event.y);
    })
    .onUpdate((event) => {
      eraseAtPoint(event.x, event.y);
    });

  const eraseTapGesture = Gesture.Tap()
    .enabled(isPaintMode && highlightToolMode === "erase")
    .onEnd((event) => {
      eraseAtPoint(event.x, event.y);
    });

  const receiptGesture = isPaintMode && highlightToolMode === "paint"
    ? paintGesture
    : isPaintMode && highlightToolMode === "erase"
      ? Gesture.Race(eraseTapGesture, eraseGesture)
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

  useEffect(() => {
    if (!visible) return;
    scaleValue.value = 1;
    translateXValue.value = 0;
    translateYValue.value = 0;
    setIsReceiptZoomed(false);
    setHighlightToolMode("paint");
    lastHighlightMarkRef.current = null;
  }, [visible, imageUri, mode, scaleValue, translateXValue, translateYValue]);

  function addHighlightMark(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const markHeight = highlighterSize.height;
    const markWidth = highlighterSize.width;
    const markX = Math.max(0, Math.min(x - markWidth / 2, canvasWidth - markWidth));
    const markY = Math.max(0, Math.min(y - markHeight / 2, canvasHeight - markHeight));
    const previous = lastHighlightMarkRef.current;
    const minDistance = Math.max(6, markHeight * 0.8);
    if (previous && Math.hypot(previous.x - markX, previous.y - markY) < minDistance) return;
    lastHighlightMarkRef.current = { x: markX, y: markY };
    setHighlightMarks?.((current) => [
      ...current,
      {
        id: `${Date.now()}-${current.length}`,
        x: markX,
        y: markY,
        width: markWidth,
        height: markHeight
      }
    ]);
  }

  function removeHighlightMarkAt(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    lastHighlightMarkRef.current = null;
    setHighlightMarks?.((current) => {
      if (!current.length) return current;
      const padding = Math.max(8, highlighterSize.height * 0.8);
      const hits = current
        .map((mark, index) => {
          const centerX = mark.x + mark.width / 2;
          const centerY = mark.y + mark.height / 2;
          const inside =
            x >= mark.x - padding &&
            x <= mark.x + mark.width + padding &&
            y >= mark.y - padding &&
            y <= mark.y + mark.height + padding;
          return inside ? { index, distance: Math.hypot(centerX - x, centerY - y) } : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.distance - b.distance);
      if (!hits.length) return current;
      const removeIndex = hits[0].index;
      return current.filter((_, index) => index !== removeIndex);
    });
  }

  function confirmHighlight() {
    if (!isPaintMode) {
      onClose?.();
      return;
    }
    if (!highlightMarks.length) {
      Alert.alert(
        "표시한 상품이 없습니다",
        "상품명을 펜으로 칠한 뒤 체크 버튼을 눌러주세요."
      );
      return;
    }
    const padding = 16;
    const minX = Math.max(0, Math.min(...highlightMarks.map((mark) => mark.x)) - padding);
    const minY = Math.max(0, Math.min(...highlightMarks.map((mark) => mark.y)) - padding);
    const maxX = Math.min(canvasWidth, Math.max(...highlightMarks.map((mark) => mark.x + mark.width)) + padding);
    const maxY = Math.min(canvasHeight, Math.max(...highlightMarks.map((mark) => mark.y + mark.height)) + padding);
    debugHighlightPaint({
      markCount: highlightMarks.length,
      highlighterSize,
      selection: {
        x: minX,
        y: minY,
        width: Math.max(1, maxX - minX),
        height: Math.max(1, maxY - minY),
        canvasWidth,
        canvasHeight
      }
    });
    onConfirmHighlight?.({
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
      canvasWidth,
      canvasHeight,
      marks: highlightMarks.map((mark) => ({
        x: mark.x,
        y: mark.y,
        width: mark.width,
        height: mark.height
      }))
    });
  }

  function modalFrameForLine(line) {
    return frameForBox(line.box, coordinateSize, { width: canvasWidth, height: canvasHeight }, 32, 12, 0.5);
  }

  function modalFrameForCropBox(cropBox) {
    return frameForBox(cropBox.box, coordinateSize, { width: canvasWidth, height: canvasHeight }, 32, 32, 1);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.gestureRoot}>
        <SafeAreaView style={styles.selectorScreen}>
          <View style={styles.highlightHeader}>
            <View style={styles.highlightTopBar}>
              <Pressable style={styles.highlightBackButton} onPress={onClose}>
                <Text style={styles.highlightBackText}>‹</Text>
              </Pressable>
              <Text style={styles.highlightScreenTitle}>상품 등록</Text>
              <View style={styles.highlightTopBarSpacer} />
            </View>
            {isPaintMode ? (
              <View style={styles.highlightInstructionFrame}>
                <Text style={styles.highlightSubtitle}>
                  영수증의 상품을 <Text style={styles.highlightSubtitleStrong}>색칠하면 등록</Text>할 수 있어요.
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
                  style={[styles.highlightToolButton, highlightToolMode === "move" ? styles.highlightToolButtonActive : null]}
                  onPress={() => setHighlightToolMode("move")}
                >
                  <Image source={HIGHLIGHT_TOOL_ICONS.move} style={styles.highlightToolImage} />
                  <Text style={[styles.highlightToolLabel, highlightToolMode === "move" ? styles.highlightToolLabelActive : null]}>확대/축소</Text>
                </Pressable>
                <Pressable
                  style={[styles.highlightToolButton, highlightToolMode === "paint" ? styles.highlightToolButtonActive : null]}
                  onPress={() => setHighlightToolMode("paint")}
                >
                  <Image source={HIGHLIGHT_TOOL_ICONS.paint} style={styles.highlightToolImage} />
                  <Text style={[styles.highlightToolLabel, highlightToolMode === "paint" ? styles.highlightToolLabelActive : null]}>색칠하기</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.highlightToolButton,
                    highlightToolMode === "erase" ? styles.highlightToolButtonActive : null,
                    !highlightMarks.length ? styles.highlightToolButtonDisabled : null
                  ]}
                  disabled={!highlightMarks.length}
                  onPress={() => setHighlightToolMode("erase")}
                >
                  <Image source={HIGHLIGHT_TOOL_ICONS.erase} style={styles.highlightToolImage} />
                  <Text style={[styles.highlightToolLabel, highlightToolMode === "erase" ? styles.highlightToolLabelActive : null]}>지우기</Text>
                </Pressable>
                <Pressable style={styles.highlightToolButton} onPress={confirmHighlight}>
                  <Image source={HIGHLIGHT_TOOL_ICONS.done} style={styles.highlightToolImage} />
                  <Text style={styles.highlightToolLabel}>완료</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.scanConfirmBar}>
                <Text style={styles.scanConfirmText}>박스를 터치하여 등록하거나 해제하세요.</Text>
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
                        {highlightMarks.map((mark) => (
                          <View
                            key={mark.id}
                            pointerEvents="none"
                            style={[styles.highlightMark, { left: mark.x, top: mark.y, width: mark.width, height: mark.height, borderRadius: mark.height / 2 }]}
                          />
                        ))}
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

function estimateHighlighterSize(lines, coordinateSize, canvasWidth, canvasHeight) {
  const heights = (Array.isArray(lines) ? lines : [])
    .map((line) => frameForBox(line.box, coordinateSize, { width: canvasWidth, height: canvasHeight }, 0, 0, 0)?.height || 0)
    .filter((height) => height >= 7 && height <= 34)
    .sort((a, b) => a - b);
  const medianHeight = heights.length ? heights[Math.floor(heights.length / 2)] : 14;
  const height = Math.max(8, Math.min(18, Math.round(medianHeight * 0.9)));
  return {
    height,
    width: Math.max(16, Math.min(36, Math.round(height * 2.0)))
  };
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
  highlightToolButtonDisabled: {
    opacity: 0.45
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
    paddingHorizontal: 8
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
  highlightMark: {
    position: "absolute",
    backgroundColor: "rgba(31, 141, 85, 0.28)"
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
