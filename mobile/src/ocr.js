import { sampleReceiptText } from "./sampleReceipt";

export async function recognizeReceiptImage(_imageUri) {
  await delay(450);
  return {
    mode: "sample",
    text: sampleReceiptText,
    message: "샘플 OCR 결과를 적용했습니다."
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
