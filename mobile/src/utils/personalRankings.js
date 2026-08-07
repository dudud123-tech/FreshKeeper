import { normalizeProductName } from "../services/productClassificationApi";
import { todayIso } from "./date";

// 랭킹을 보여주기에 표본이 너무 적으면(상품 몇 개만 등록한 상태) 오히려 어색하다.
// 이 밑이면 랭킹 대신 "아직 데이터가 부족해요" 빈 상태를 보여준다.
export const MIN_RANKING_SAMPLE_SIZE = 5;

// 소비기한을 넘긴 채로 처리된 상품인지 판단한다.
// - 완료(status: "completed")된 상품이면, 완료 시점이 소비기한보다 늦었는지 비교
// - 아직 활성(active) 상품이면, 오늘이 소비기한을 지났는지로 판단(방치 중)
function wasMissed(item, today) {
  if (!item?.expiry) return false;
  if (item.status === "completed") {
    if (!item.completedAt) return false;
    const completedDate = String(item.completedAt).slice(0, 10);
    return completedDate > item.expiry;
  }
  return today > item.expiry;
}

// list를 keyFn으로 묶어서 개수 순으로 정렬한 배열을 돌려준다.
// normalize가 true면 상품명 표기 차이(공백, 괄호 등)를 묶어서 센다.
// purchaseUrlFn을 주면, 같은 그룹 안에서 구매 링크가 있는 항목을 하나 찾아 붙여준다
// (카트 아이콘으로 쿠팡 파트너스 링크 열기용).
function topByCount(list, keyFn, { normalize = false, purchaseUrlFn } = {}) {
  const counts = new Map();
  const labels = new Map();
  const purchaseUrls = new Map();
  list.forEach((item) => {
    const raw = keyFn(item);
    if (!raw) return;
    const key = normalize ? normalizeProductName(raw) : raw;
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
    if (!labels.has(key)) labels.set(key, raw);
    if (purchaseUrlFn && !purchaseUrls.get(key)) {
      const url = String(purchaseUrlFn(item) || "").trim();
      if (url) purchaseUrls.set(key, url);
    }
  });
  return [...counts.entries()]
    .map(([key, count]) => ({ label: labels.get(key), count, purchaseUrl: purchaseUrls.get(key) || "" }))
    .sort((a, b) => b.count - a.count);
}

// 개인 랭킹 3종을 계산한다. 표본이 부족하면 null을 돌려준다(호출 쪽에서 빈 상태 처리).
export function computePersonalRankings(items) {
  const list = Array.isArray(items) ? items : [];
  if (list.length < MIN_RANKING_SAMPLE_SIZE) return null;

  const today = todayIso();
  const missedItems = list.filter((item) => wasMissed(item, today));

  return {
    totalCount: list.length,
    mostRegistered: topByCount(list, (item) => item.name, {
      normalize: true,
      purchaseUrlFn: (item) => item.purchaseUrl
    }).slice(0, 5),
    mostMissed: topByCount(missedItems, (item) => item.name, {
      normalize: true,
      purchaseUrlFn: (item) => item.purchaseUrl
    }).slice(0, 5),
    topCategories: topByCount(list, (item) => item.category).slice(0, 5)
  };
}
