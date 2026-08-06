const WORKER_API_BASE = "https://freshkeeper-ocr-feedback.dndud123.workers.dev/api";
const COUPANG_ENDPOINT = `${WORKER_API_BASE}/coupang`;
const REQUEST_TIMEOUT_MS = 6000;
const DEFAULT_FOOD_CATEGORY_ID = 1012; // 쿠팡 카테고리: 식품

// 검색어와 후보 상품명의 유사도(0~1). 쿠팡 검색 결과는 텍스트 관련성이 아니라
// 스폰서/프로모션 노출 순서로 1등이 정해질 때가 있어서(예: "홍루이젠호밀빵햄치즈
// 샌드위치"를 검색해도 무관한 "치아바타"가 1위로 나옴, 2026-08-06 실제 확인),
// 쿠팡이 매긴 순위를 그대로 믿지 않고 문자 2-gram 겹침으로 직접 재정렬한다.
// 한글은 형태소 분석 없이도 2-gram 겹침만으로 꽤 잘 구분된다.
function productNameMatchScore(query, candidateName) {
  const normalize = (value) => String(value || "").replace(/[\s,./·()[\]]+/g, "").toLowerCase();
  const q = normalize(query);
  const c = normalize(candidateName);
  if (q.length < 2 || c.length < 2) return 0;

  const bigrams = (value) => {
    const set = new Set();
    for (let i = 0; i < value.length - 1; i++) set.add(value.slice(i, i + 2));
    return set;
  };
  const queryGrams = bigrams(q);
  const candidateGrams = bigrams(c);
  let overlap = 0;
  for (const gram of queryGrams) {
    if (candidateGrams.has(gram)) overlap += 1;
  }
  return overlap / queryGrams.size;
}

// 검색어와 겹치는 정도가 이 밑이면 "그럴듯한 후보가 없다"고 보고 자동완성을
// 포기한다 — 엉뚱한 상품 링크를 자신 있게 붙이는 것보다 안 붙이는 게 낫다.
const MIN_PRODUCT_MATCH_SCORE = 0.3;

// 상품명으로 쿠팡을 검색해 파트너스 링크가 이미 붙은 상품 목록을 받아온다.
// 쿠팡 자체 순위(스폰서 노출 등) 대신 검색어와 가장 비슷한 상품명 순으로
// 재정렬해서 돌려준다. 구매 링크 자동 채움은 부가 기능이라 실패해도 예외를
// 던지지 않고 빈 배열을 돌려준다 — 상품 저장 자체를 막으면 안 된다.
export async function searchCoupangProducts(keyword) {
  const trimmed = String(keyword || "").trim();
  if (!trimmed) return [];

  try {
    const response = await fetchWithTimeout(
      `${COUPANG_ENDPOINT}/search?keyword=${encodeURIComponent(trimmed)}&limit=10`
    );
    if (!response.ok) return [];
    const body = await response.json();
    const products = Array.isArray(body?.products) ? body.products : [];

    return products
      .map((product) => ({ product, score: productNameMatchScore(trimmed, product.productName) }))
      .filter((entry) => entry.score >= MIN_PRODUCT_MATCH_SCORE)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.product);
  } catch {
    return [];
  }
}

// 우리 파트너스 계정의 트래킹 태그. 링크에 이게 이미 들어있으면 우리 쪽에서 만든
// 링크(검색 결과, 또는 이 함수로 이미 한 번 변환된 링크)라는 뜻이라 다시 변환할
// 필요가 없다. ⚠️ link.coupang.com 도메인이라고 해서 우리 링크인 건 아니다 —
// 쿠팡 앱 자체의 "공유하기" 버튼도 같은 도메인의 단축 링크(예: /a/xxxxx)를 쓰는데
// 거기엔 이 태그가 없다(대신 쿠팡 자체 공유 트래킹 태그가 들어있음). 도메인만 보고
// 건너뛰면 사용자가 공유로 붙여넣은 링크가 영원히 변환 안 되는 버그가 생긴다.
const OWN_AFFILIATE_TAG = "lptag=AF7292320";
const CONVERTIBLE_COUPANG_HOSTS = new Set(["www.coupang.com", "coupang.com", "m.coupang.com", "link.coupang.com"]);

// 사용자가 직접 붙여넣은 쿠팡 링크(공유 링크 포함)를 파트너스 링크로 변환한다.
// 이미 우리 파트너스 링크거나 쿠팡 링크가 아니면 원본을 그대로 돌려주고,
// 변환 실패해도 원본을 그대로 돌려준다 — 저장 자체를 막으면 안 된다.
export async function convertToPartnerLink(url) {
  const trimmed = String(url || "").trim();
  if (!trimmed) return trimmed;
  if (trimmed.includes(OWN_AFFILIATE_TAG)) return trimmed;

  let host = "";
  try {
    host = new URL(trimmed).hostname.toLowerCase();
  } catch {
    return trimmed;
  }
  if (!CONVERTIBLE_COUPANG_HOSTS.has(host)) return trimmed;

  try {
    const response = await fetchWithTimeout(`${COUPANG_ENDPOINT}/deeplink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: trimmed })
    });
    if (!response.ok) return trimmed;
    const body = await response.json();
    return body?.links?.[0]?.shortenUrl || trimmed;
  } catch {
    return trimmed;
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
