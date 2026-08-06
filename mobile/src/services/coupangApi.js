const WORKER_API_BASE = "https://freshkeeper-ocr-feedback.dndud123.workers.dev/api";
const COUPANG_ENDPOINT = `${WORKER_API_BASE}/coupang`;
const REQUEST_TIMEOUT_MS = 6000;
const DEFAULT_FOOD_CATEGORY_ID = 1012; // 쿠팡 카테고리: 식품

// 상품명으로 쿠팡을 검색해 파트너스 링크가 이미 붙은 상품 목록을 받아온다.
// 구매 링크 자동 채움은 부가 기능이라 실패해도 예외를 던지지 않고 빈 배열을
// 돌려준다 — 상품 저장 자체를 막으면 안 된다.
export async function searchCoupangProducts(keyword) {
  const trimmed = String(keyword || "").trim();
  if (!trimmed) return [];

  try {
    const response = await fetchWithTimeout(
      `${COUPANG_ENDPOINT}/search?keyword=${encodeURIComponent(trimmed)}&limit=5`
    );
    if (!response.ok) return [];
    const body = await response.json();
    return Array.isArray(body?.products) ? body.products : [];
  } catch {
    return [];
  }
}

// 카테고리 인기상품. 기본은 식품(1012) — 이 앱의 그로서리 카테고리들이 전부 여기 속한다.
export async function fetchBestCategoryProducts(categoryId = DEFAULT_FOOD_CATEGORY_ID, limit = 10) {
  try {
    const response = await fetchWithTimeout(
      `${COUPANG_ENDPOINT}/bestcategories?categoryId=${encodeURIComponent(categoryId)}&limit=${limit}`
    );
    if (!response.ok) return [];
    const body = await response.json();
    return Array.isArray(body?.products) ? body.products : [];
  } catch {
    return [];
  }
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
