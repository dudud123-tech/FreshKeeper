// 상품 카드/팝업에서 같이 쓰는 날짜 라벨들. 예전에는 InventoryList 안에만
// 있었는데 상세 팝업이 일정 화면에서도 쓰이게 되면서 밖으로 뺐다(2026-08-24).

export function createdDateLabel(item) {
  if (typeof item?.createdAt === "string" && item.createdAt.length >= 10) {
    return item.createdAt.slice(0, 10);
  }
  if (typeof item?.expiry === "string" && item.expiry.length >= 10) {
    return item.expiry.slice(0, 10);
  }
  return "-";
}

export function completionTimingLabel(item) {
  if (!item?.completedAt || !item?.expiry) return "소비기한 기준 정보가 부족합니다.";
  const completed = new Date(item.completedAt);
  const [year, month, day] = String(item.expiry).split("-").map(Number);
  const expiry = new Date(year, month - 1, day);
  if (Number.isNaN(completed.getTime()) || Number.isNaN(expiry.getTime())) return "소비기한 기준 정보가 부족합니다.";
  const diff = Math.ceil((expiry - completed) / 86400000);
  if (diff > 0) return `소비기한 ${diff}일 전에 완료`;
  if (diff === 0) return "소비기한 당일 완료";
  return `소비기한 ${Math.abs(diff)}일 후 완료`;
}
