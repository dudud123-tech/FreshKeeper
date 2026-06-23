import { useEffect, useRef, useState } from "react";
import { Image, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { frameForBox } from "../utils/receiptOverlay";

const DEBUG_LOG = true;
const HIGHLIGHT_TOOL_ICONS = {
  move: require("../../assets/actions/highlight-zoom.png"),
  paint: require("../../assets/actions/highlight-pen.png"),
  erase: require("../../assets/actions/highlight-eraser.png"),
  done: require("../../assets/actions/highlight-done.png")
};

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
      onClose?.();
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
          {isPaintMode ? (
            <View style={styles.highlightToolbar}>
              <Pressable
                style={[styles.highlightToolButton, highlightToolMode === "move" ? styles.highlightToolButtonActive : null]}
                onPress={() => setHighlightToolMode("move")}
              >
                <Image source={HIGHLIGHT_TOOL_ICONS.move} style={styles.highlightToolImage} />
              </Pressable>
              <Pressable
                style={[styles.highlightToolButton, highlightToolMode === "paint" ? styles.highlightToolButtonActive : null]}
                onPress={() => setHighlightToolMode("paint")}
              >
                <Image source={HIGHLIGHT_TOOL_ICONS.paint} style={styles.highlightToolImage} />
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
              </Pressable>
              <Pressable style={styles.highlightToolButton} onPress={confirmHighlight}>
                <Image source={HIGHLIGHT_TOOL_ICONS.done} style={styles.highlightToolImage} />
              </Pressable>
            </View>
          ) : null}
          <ScrollView style={styles.selectorScroll} contentContainerStyle={styles.selectorScrollContent} showsVerticalScrollIndicator={false} scrollEnabled={!isReceiptZoomed && !isPaintMode}>
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
  highlightToolbar: {
    minHeight: 84,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 5
  },
  highlightToolButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dfe5df",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center"
  },
  highlightToolButtonActive: {
    borderColor: "#1f7a5a",
    backgroundColor: "#ecf8f2"
  },
  highlightToolButtonDisabled: {
    opacity: 0.45
  },
  highlightToolImage: {
    width: 32,
    height: 32,
    resizeMode: "contain"
  },
  selectorScroll: {
    flex: 1
  },
  selectorScrollContent: {
    alignItems: "center",
    paddingBottom: 20
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
    backgroundColor: "rgba(255, 231, 64, 0.1)"
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
    borderColor: "#1f7a5a",
    backgroundColor: "rgba(31, 122, 90, 0.18)"
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
    borderColor: "#1f7a5a",
    backgroundColor: "rgba(31, 122, 90, 0.2)"
  }
});
