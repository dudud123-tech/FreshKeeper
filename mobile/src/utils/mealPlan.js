import { parseIsoDate, todayIso, toIsoDate } from "./date";

// 상품에 붙는 "언제 먹을지" 정보는 item.plannedDate("YYYY-MM-DD")와
// item.plannedMeal(아래 id 중 하나, 빈 값이면 "종일") 두 필드뿐이다. 상품 하나당
// 일정 하나라서 별도 엔티티를 만들지 않는다. 두 필드 모두 기기 로컬 전용 —
// 가족 공유로 서버에 올리지 않는다(familyApi.js의 cleanItemForFamilySync 참고).
// defaultTime은 끼니를 고를 때 알림 시간을 자동으로 채워주는 값이다. 사용자가
// 그 뒤에 시간을 직접 바꾸면 그 값이 우선한다(item.plannedTime).
export const MEAL_SLOTS = [
  { id: "breakfast", label: "아침", defaultTime: "08:00" },
  { id: "lunch", label: "점심", defaultTime: "12:00" },
  { id: "dinner", label: "저녁", defaultTime: "18:00" }
];

// 끼니를 안 고른 일정이 모이는 자리. 실제 저장값은 빈 문자열이고 화면·알림에서만 이 라벨을 쓴다.
export const ALL_DAY_LABEL = "종일";

// 일정 화면이 보여주는 날짜 수. 알림 예약 범위(notificationScheduler.js)도 같은 값을 쓴다.
export const SCHEDULE_LOOKAHEAD_DAYS = 7;

export function mealLabel(mealId) {
  return MEAL_SLOTS.find((slot) => slot.id === mealId)?.label || ALL_DAY_LABEL;
}

export function mealDefaultTime(mealId) {
  return MEAL_SLOTS.find((slot) => slot.id === mealId)?.defaultTime || "";
}

export function isValidPlanTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ""));
}

// 상품별 알림 시각. 우선순위는 ①상품에 직접 지정한 시간 ②끼니 기본 시간
// ③설정의 일정 알림 시간(fallback). 상품마다 시간을 따로 두기 전에 만든
// 일정에는 plannedTime이 없으므로 이 폴백 순서가 있어야 한다(2026-08-23).
export function planTimeFor(item, fallbackTime) {
  if (isValidPlanTime(item?.plannedTime)) return item.plannedTime;
  const mealTime = mealDefaultTime(item?.plannedMeal);
  if (mealTime) return mealTime;
  return isValidPlanTime(fallbackTime) ? fallbackTime : "";
}

export function formatPlanTime(time) {
  if (!isValidPlanTime(time)) return "";
  const [hour, minute] = time.split(":").map(Number);
  const isAfternoon = hour >= 12;
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${isAfternoon ? "오후" : "오전"} ${displayHour}:${String(minute).padStart(2, "0")}`;
}

export function toPlanTime(hour, minute) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function planTimeParts(time, fallback = "18:00") {
  const source = isValidPlanTime(time) ? time : fallback;
  const [hour, minute] = source.split(":").map(Number);
  return { hour, minute };
}

export function isPlannableItem(item) {
  return item?.status !== "completed";
}

export function hasPlan(item) {
  return Boolean(item?.plannedDate);
}

// 일정이 잡힌 순서대로 정렬할 때 쓰는 값. 끼니를 안 정한 "종일"은 그 날의 맨 뒤로 보낸다.
function mealOrder(mealId) {
  const index = MEAL_SLOTS.findIndex((slot) => slot.id === mealId);
  return index === -1 ? MEAL_SLOTS.length : index;
}

export function comparePlannedItems(left, right) {
  const dateDiff = String(left.plannedDate || "").localeCompare(String(right.plannedDate || ""));
  if (dateDiff !== 0) return dateDiff;
  const mealDiff = mealOrder(left.plannedMeal) - mealOrder(right.plannedMeal);
  if (mealDiff !== 0) return mealDiff;
  return String(left.name || "").localeCompare(String(right.name || ""));
}

// 일정 화면에서 쓸 "오늘부터 N일" 날짜 문자열 목록.
export function upcomingScheduleDates(days = SCHEDULE_LOOKAHEAD_DAYS) {
  return Array.from({ length: days }, (_, offset) => todayIso(offset));
}

// 일정이 잡힌 상품을 날짜 → 끼니 순서로 묶는다. 완료된 상품은 일정에서 빠진다 —
// 일정 화면의 체크가 곧 기존 "완료" 처리라서(useInventory.completeItem) 완료되면
// 그 날 목록에서 자연히 사라져야 한다.
export function groupPlannedItemsByDate(items, dates) {
  const allowedDates = new Set(dates);
  const buckets = new Map(dates.map((date) => [date, []]));

  items.forEach((item) => {
    if (!hasPlan(item) || !isPlannableItem(item)) return;
    if (!allowedDates.has(item.plannedDate)) return;
    buckets.get(item.plannedDate).push(item);
  });

  return dates.map((date) => {
    const dayItems = buckets.get(date).sort(comparePlannedItems);
    const groups = [...MEAL_SLOTS.map((slot) => slot.id), ""]
      .map((mealId) => ({
        mealId,
        label: mealLabel(mealId),
        items: dayItems.filter((item) => (item.plannedMeal || "") === mealId)
      }))
      .filter((group) => group.items.length > 0);
    return { date, items: dayItems, groups };
  });
}

// 지난 날짜에 잡혀 있는데 아직 완료 안 된 일정. 조용히 사라지면 사용자가 놓치므로
// 일정 화면 맨 위에서 따로 보여준다.
export function overduePlannedItems(items, fromDate = todayIso()) {
  return items
    .filter((item) => hasPlan(item) && isPlannableItem(item) && item.plannedDate < fromDate)
    .sort(comparePlannedItems);
}

export function scheduleDateLabel(dateIso) {
  const date = parseIsoDate(dateIso);
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  const base = `${date.getMonth() + 1}/${date.getDate()}(${weekday})`;
  const today = todayIso();
  if (dateIso === today) return `오늘 ${base}`;
  if (dateIso === toIsoDate(new Date(parseIsoDate(today).getTime() + 86400000))) return `내일 ${base}`;
  return base;
}

// 보관함 카드에 붙는 짧은 일정 뱃지("8/19 저녁").
export function planBadgeLabel(item) {
  if (!hasPlan(item)) return "";
  const date = parseIsoDate(item.plannedDate);
  const meal = item.plannedMeal ? ` ${mealLabel(item.plannedMeal)}` : "";
  const time = isValidPlanTime(item.plannedTime) ? ` ${formatPlanTime(item.plannedTime)}` : "";
  return `${date.getMonth() + 1}/${date.getDate()}${meal}${time}`;
}

// 알림 예약용으로 "같은 날 같은 시각"인 상품을 한 건으로 묶는다. 상품마다 알림을
// 따로 쏘면 같은 시각에 알림이 여러 개 쏟아지고 예약 건수도 불필요하게 늘어난다.
export function groupPlannedItemsByTime(items, dateIso, fallbackTime) {
  const buckets = new Map();

  items.forEach((item) => {
    if (!hasPlan(item) || !isPlannableItem(item)) return;
    if (item.plannedDate !== dateIso) return;
    const time = planTimeFor(item, fallbackTime);
    if (!isValidPlanTime(time)) return;
    if (!buckets.has(time)) buckets.set(time, []);
    buckets.get(time).push(item);
  });

  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([time, bucketItems]) => ({ time, items: bucketItems.sort(comparePlannedItems) }));
}
