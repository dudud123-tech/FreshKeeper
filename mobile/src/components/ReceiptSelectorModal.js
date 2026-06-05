import { useEffect, useState } from "react";
import { Image, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { frameForBox } from "../utils/receiptOverlay";

export default function ReceiptSelectorModal({ visible, imageUri, imageSize, coordinateSize, coordinateLabel, canChangeCoordinate, lines, selectedIds, onToggleLine, onChangeCoordinate, onClose }) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const [isReceiptZoomed, setIsReceiptZoomed] = useState(false);
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
  const canvasHeight = Math.max(520, Math.round(canvasWidth * imageRatio));

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
    .enabled(isReceiptZoomed)
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

  const receiptGesture = Gesture.Race(pinchGesture, panGesture);
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
  }, [visible, imageUri, scaleValue, translateXValue, translateYValue]);

  function modalFrameForLine(line) {
    return frameForBox(line.box, coordinateSize, { width: canvasWidth, height: canvasHeight }, 32, 12, 0.5);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.gestureRoot}>
        <SafeAreaView style={styles.selectorScreen}>
          <Text style={styles.selectorHint}>줄을 터치해 상품 후보를 고르세요. 두 손가락으로 확대/축소하고, 확대 상태에서는 이미지를 끌어서 이동할 수 있습니다.</Text>
          {canChangeCoordinate ? (
            <Pressable style={styles.selectorCoordinateButton} onPress={onChangeCoordinate}>
              <Text style={styles.coordinateButtonText}>좌표 맞춤: {coordinateLabel}</Text>
            </Pressable>
          ) : null}
          <ScrollView style={styles.selectorScroll} contentContainerStyle={styles.selectorScrollContent} showsVerticalScrollIndicator={false} scrollEnabled={!isReceiptZoomed}>
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
                  {lines.map((line) => {
                    const frame = modalFrameForLine(line);
                    if (!frame) return null;
                    const selected = selectedIds.includes(line.id);
                    return (
                      <Pressable key={line.id} hitSlop={8} style={[styles.ocrBox, selected ? styles.ocrBoxSelected : styles.ocrBoxUnselected, frame]} onPress={() => onToggleLine(line)} />
                    );
                  })}
                </Animated.View>
              </View>
            </GestureDetector>
          </ScrollView>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1
  },
  selectorScreen: {
    flex: 1,
    backgroundColor: "#f5f2eb"
  },
  selectorHint: {
    color: "#68716b",
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 16,
    paddingTop: 34,
    paddingBottom: 10
  },
  selectorCoordinateButton: {
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#b9dfcf",
    backgroundColor: "#edf7f2",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  coordinateButtonText: {
    color: "#14583f",
    fontWeight: "900"
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
  ocrBox: {
    position: "absolute",
    borderRadius: 5,
    borderWidth: 1.5
  },
  ocrBoxUnselected: {
    borderColor: "rgba(79, 91, 84, 0.5)",
    backgroundColor: "rgba(240, 240, 236, 0.28)"
  },
  ocrBoxSelected: {
    borderColor: "#1f7a5a",
    backgroundColor: "rgba(31, 122, 90, 0.18)"
  }
});
