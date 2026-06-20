import { NativeModules, Platform } from "react-native";

const ReceiptTextDetector = NativeModules.ReceiptTextDetector;

export async function detectReceiptAiTextLineBoxes(imageUri) {
  if (Platform.OS !== "android" || !ReceiptTextDetector?.detectTextBoxes) {
    console.log("[freshkeeper:dbnet]", {
      stage: "native-module-unavailable",
      platform: Platform.OS,
      hasModule: Boolean(ReceiptTextDetector)
    });
    return [];
  }

  try {
    const boxes = await ReceiptTextDetector.detectTextBoxes(imageUri);
    const normalizedBoxes = Array.isArray(boxes) ? boxes.map(normalizeDetectedBox).filter(Boolean) : [];
    console.log("[freshkeeper:dbnet]", {
      stage: "native-result",
      rawCount: Array.isArray(boxes) ? boxes.length : 0,
      normalizedCount: normalizedBoxes.length
    });
    return normalizedBoxes;
  } catch (error) {
    console.log("[freshkeeper:dbnet]", {
      stage: "native-error",
      message: error?.message || String(error)
    });
    return [];
  }
}

function normalizeDetectedBox(box) {
  const x = Number(box?.x);
  const y = Number(box?.y);
  const width = Number(box?.width);
  const height = Number(box?.height);
  const score = Number(box?.score);
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  return {
    x,
    y,
    width,
    height,
    score: Number.isFinite(score) ? score : 0
  };
}
