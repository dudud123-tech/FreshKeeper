export function todayIso(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return toIsoDate(date);
}

export function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(value) {
  if (typeof value !== "string") return new Date();
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return new Date();
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

export function daysUntil(dateValue) {
  const today = parseIsoDate(todayIso());
  const target = parseIsoDate(dateValue);
  return Math.ceil((target - today) / 86400000);
}

export function statusFor(item) {
  const days = daysUntil(item.expiry);
  if (days < 0) return { label: `${Math.abs(days)}일 지남`, tone: "expired" };
  if (days === 0) return { label: "오늘까지", tone: "warning" };
  if (days <= 3) return { label: `D-${days}`, tone: "warning" };
  return { label: `D-${days}`, tone: "normal" };
}

export function timelineFor(item, reminderDays) {
  const days = daysUntil(item.expiry);
  if (days < 0) {
    return {
      label: "기한이 지났습니다",
      width: "100%",
      tone: "expired"
    };
  }
  if (days === 0) {
    return {
      label: "오늘까지",
      width: "100%",
      tone: "warning"
    };
  }
  if (days <= reminderDays) {
    const width = Math.max(24, Math.round(((reminderDays - days + 1) / Math.max(reminderDays + 1, 1)) * 100));
    return {
      label: `${days}일 남음 · 임박`,
      width: `${width}%`,
      tone: "warning"
    };
  }
  const safeWindow = Math.max(reminderDays + 7, 7);
  const width = Math.max(12, Math.round((1 - Math.min(days - reminderDays, safeWindow) / safeWindow) * 70));
  return {
    label: `${days}일 남음`,
    width: `${width}%`,
    tone: "normal"
  };
}

export function daysUntilFrom(item, baseDate) {
  const target = parseIsoDate(item.expiry);
  return Math.ceil((target - baseDate) / 86400000);
}

export function formatDateLabel(value) {
  const date = parseIsoDate(value);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export function itemCreatedDate(item) {
  const date = safeDate(item?.createdAt);
  if (date) return toIsoDate(date);
  return item?.expiry || todayIso();
}

export function itemCreatedTime(item) {
  const date = safeDate(item?.createdAt) || parseIsoDate(item?.expiry || todayIso());
  return date.getTime();
}

function safeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function buildCalendarWeeks(month) {
  const firstDay = month.getDay();
  const lastDate = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: firstDay }, () => null);
  for (let day = 1; day <= lastDate; day += 1) {
    days.push(new Date(month.getFullYear(), month.getMonth(), day));
  }
  while (days.length % 7 !== 0) days.push(null);
  const weeks = [];
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }
  return weeks;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
