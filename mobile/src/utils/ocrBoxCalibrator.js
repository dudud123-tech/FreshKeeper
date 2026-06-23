import { NativeModules, Platform } from "react-native";

const ReceiptImageNormalizer = NativeModules.ReceiptImageNormalizer;

export async function calibrateOcrLineBoxes(imageUri, lines) {
  if (Platform.OS !== "android" || !ReceiptImageNormalizer?.calibrateOcrLineBoxes || !Array.isArray(lines) || !lines.length) {
    return { lines, appliedCount: 0, reason: "unavailable" };
  }

  const linesWithBoxes = lines.filter((line) => line?.box);
  if (linesWithBoxes.length < 4) {
    return { lines, appliedCount: 0, reason: "not_enough_ocr_boxes" };
  }

  try {
    const result = await ReceiptImageNormalizer.calibrateOcrLineBoxes(
      imageUri,
      linesWithBoxes.map((line) => ({
        id: line.id,
        box: line.box
      }))
    );
    const boxes = Array.isArray(result?.boxes) ? result.boxes : [];
    const boxById = new Map(
      boxes
        .map((entry) => [entry?.id, normalizeBox(entry?.box)])
        .filter(([id, box]) => id && box)
    );

    if (!boxById.size) {
      console.log("[freshkeeper:ocr-box-calibrate]", {
        appliedCount: 0,
        sampleCount: result?.sampleCount || 0,
        reason: result?.reason || "empty_result"
      });
      return { lines, appliedCount: 0, reason: result?.reason || "empty_result" };
    }

    const calibratedLines = lines.map((line) => {
      const calibratedBox = boxById.get(line.id);
      if (!calibratedBox) return line;
      return {
        ...line,
        originalBox: line.originalBox || line.box,
        box: calibratedBox,
        boxSource: "ocr-pixel-calibrated"
      };
    });

    console.log("[freshkeeper:ocr-box-calibrate]", {
      appliedCount: boxById.size,
      sampleCount: result?.sampleCount || 0,
      offsetX: result?.offsetX || 0,
      offsetY: result?.offsetY || 0,
      reason: result?.reason || "calibrated"
    });
    return { lines: calibratedLines, appliedCount: boxById.size, reason: result?.reason || "calibrated" };
  } catch (error) {
    console.log("[freshkeeper:ocr-box-calibrate]", {
      appliedCount: 0,
      reason: "native_error",
      message: error?.message || String(error)
    });
    return { lines, appliedCount: 0, reason: "native_error" };
  }
}

function normalizeBox(box) {
  const x = Number(box?.x);
  const y = Number(box?.y);
  const width = Number(box?.width);
  const height = Number(box?.height);
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}
