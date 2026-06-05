import { daysUntil } from "./date";

function shareLabelForItem(item) {
  const days = daysUntil(item.expiry);
  if (days < 0) return `${Math.abs(days)}일 지남`;
  if (days === 0) return "오늘까지";
  return `${days}일 남음`;
}

export function buildFamilyShareMessage(items, reminderDays) {
  const targets = items
    .map((item) => ({ item, days: daysUntil(item.expiry) }))
    .filter(({ days }) => days < 0 || (days >= 0 && days <= reminderDays))
    .sort((a, b) => a.days - b.days);

  if (!targets.length) return "";

  const expired = targets.filter(({ days }) => days < 0);
  const urgent = targets.filter(({ days }) => days >= 0);
  const lines = ["오늘까지야 알림", ""];

  if (urgent.length) {
    lines.push(`임박 ${urgent.length}개`);
    urgent.slice(0, 8).forEach(({ item }) => {
      lines.push(`- ${item.name}: ${shareLabelForItem(item)}`);
    });
    if (urgent.length > 8) lines.push(`- 외 ${urgent.length - 8}개`);
    lines.push("");
  }

  if (expired.length) {
    lines.push(`만료 ${expired.length}개`);
    expired.slice(0, 8).forEach(({ item }) => {
      lines.push(`- ${item.name}: ${shareLabelForItem(item)}`);
    });
    if (expired.length > 8) lines.push(`- 외 ${expired.length - 8}개`);
  }

  return lines.join("\n").trim();
}
