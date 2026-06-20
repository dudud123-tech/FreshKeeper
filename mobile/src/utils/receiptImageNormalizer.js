import { NativeModules, Platform } from "react-native";

const ReceiptImageNormalizer = NativeModules.ReceiptImageNormalizer;

export async function normalizeReceiptImageForOcr(imageUri, sourceType) {
  if (sourceType !== "receipt") {
    return { imageUri, normalized: false, reason: "not_receipt_source" };
  }
  if (Platform.OS !== "android" || !ReceiptImageNormalizer?.normalizeReceiptImage) {
    return { imageUri, normalized: false, reason: "normalizer_unavailable" };
  }

  try {
    const result = await ReceiptImageNormalizer.normalizeReceiptImage(imageUri);
    if (!result?.normalized || !result?.imageUri) {
      return { imageUri, normalized: false, reason: result?.reason || "not_normalized" };
    }
    return {
      imageUri: result.imageUri,
      normalized: true,
      reason: result.reason || "normalized",
      size: result.width && result.height ? { width: result.width, height: result.height } : null
    };
  } catch {
    return { imageUri, normalized: false, reason: "normalizer_failed" };
  }
}
