import AsyncStorage from "@react-native-async-storage/async-storage";

// 상품 사진은 서버 barcode_products 테이블에 안 넣기로 했다(개인정보/용량 문제,
// 2026-08-08 설계). 대신 "개인 기기에만" 남기기로 한 부분을 실제로 구현한다 —
// 바코드별 사진 URI를 이 기기 AsyncStorage에만 저장해서, 같은 기기에서 같은
// 바코드를 다시 스캔하면 사진도 같이 채워지게 한다.
const CACHE_KEY = "fresh-keeper-barcode-images-v1";

async function readCache() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function getCachedBarcodeImage(barcode) {
  const key = String(barcode || "").trim();
  if (!key) return "";
  const cache = await readCache();
  return cache[key] || "";
}

export async function setCachedBarcodeImage(barcode, imageUri) {
  const key = String(barcode || "").trim();
  const uri = String(imageUri || "").trim();
  if (!key || !uri) return;
  const cache = await readCache();
  cache[key] = uri;
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // 저장 실패해도 등록 자체는 이미 끝난 뒤라 치명적이지 않다 — 다음에 이
    // 바코드를 스캔하면 사진 없이 이름/카테고리만 채워지는 정도로 그친다.
  }
}
