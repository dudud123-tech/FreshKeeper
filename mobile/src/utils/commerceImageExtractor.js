import { NativeModules, Platform } from "react-native";

const CoupangImageDetector = NativeModules.CoupangImageDetector;

function isCoupangOrderCapture(lines) {
  const text = lines.map((line) => line.text || "").join(" ");
  return ["주문내역", "배송완료", "로켓프레시", "바로구매"].some((keyword) => text.includes(keyword));
}

export async function extractCommerceProductImages({ imageUri, imageSize, coordinateSize, lines, draftNames }) {
  if (!isCoupangOrderCapture(lines || [])) return { imageMap: {}, cropBoxes: [] };

  const cropCoordinateSize = coordinateSize?.width && coordinateSize?.height ? coordinateSize : imageSize;
  const opencvResult = await extractWithOpenCv({
    imageUri,
    coordinateSize: cropCoordinateSize,
    lines,
    draftNames
  });
  return opencvResult || { imageMap: {}, cropBoxes: [] };
}

async function extractWithOpenCv({ imageUri, coordinateSize, lines, draftNames }) {
  if (Platform.OS !== "android" || !CoupangImageDetector?.detectProductImages) return null;
  try {
    const result = await CoupangImageDetector.detectProductImages(
      imageUri,
      lines || [],
      coordinateSize || {},
      draftNames || []
    );
    return {
      imageMap: result?.imageMap || {},
      cropBoxes: result?.cropBoxes || [],
      selectedLineIds: result?.selectedLineIds || [],
      draftNames: result?.draftNames || []
    };
  } catch {
    return null;
  }
}
