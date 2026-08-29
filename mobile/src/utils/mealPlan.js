import { parseIsoDate, todayIso, toIsoDate, weekdayLabel } from "./date";

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

// 비타민·약처럼 계속 챙겨 먹는 상품을 위한 반복. item.planRepeat에 id가 저장되고
// 빈 값이면 그 날 하루짜리 일정이다(2026-08-23).
export const PLAN_REPEATS = [
  { id: "", label: "안 함" },
  { id: "daily", label: "매일" },
  { id: "weekly", label: "매주" }
];

export function repeatLabel(repeatId) {
  return PLAN_REPEATS.find((option) => option.id === repeatId)?.label || "안 함";
}

export function isRepeating(item) {
  return Boolean(item?.planRepeat) && PLAN_REPEATS.some((option) => option.id === item.planRepeat && option.id);
}

// 일정 화면이 보여주는 날짜 수. 한 달 앞까지 훑어볼 수 있게 30일을 보여준다.
export const SCHEDULE_LOOKAHEAD_DAYS = 30;

// 알림을 미리 예약해 두는 범위. 화면 조회 기간과 일부러 분리했다 — 매일 반복
// 상품이 있으면 예약 건수가 날짜 수만큼 불어나 MAX_PLAN_NOTIFICATIONS 상한을
// 금방 채우고, 그러면 뒤쪽 상품이 알림을 못 받는다. 앱을 열 때마다 다시
// 예약하므로 화면만 30일로 늘리고 예약은 7일로 둔다(2026-08-23).
export const PLAN_NOTIFICATION_LOOKAHEAD_DAYS = 7;

// 새 일정을 잡을 때 알림 시각 칸에 처음 채워지는 값. 예전에는 설정 화면에서
// 사용자가 정하게 했지만, 일정 알림은 상품마다 시각을 따로 갖는 구조라
// "모든 상품 공통 시각"이라는 설정이 모델과 맞지 않아 없앴다. 저녁 끼니와
// 같은 시각으로 맞춰 둔다(2026-08-23).
export const DEFAULT_PLAN_TIME = "18:00";

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

// 이 상품이 그 날짜에 해당하는가. 반복이 없으면 지정한 날 하루뿐이고,
// 반복이 있으면 시작일(plannedDate) 이후로 매일/매주 같은 요일에 걸린다.
// 그날 일정이 있는지만 답한다. 이미 먹었는지는 여기서 보지 않는다 — 먹었다고
// 목록에서 사라지면 체크한 게 맞는지 확인할 방법이 없다는 피드백(2026-08-29)으로,
// 화면은 계속 보여주고 표시만 바꾼다. 알림 예약은 아래 planDoneOn으로 따로 거른다.
export function planOccursOn(item, dateIso) {
  if (!hasPlan(item)) return false;
  if (dateIso < item.plannedDate) return false;
  if (!isRepeating(item)) return dateIso === item.plannedDate;
  if (item.planRepeat === "daily") return true;
  if (item.planRepeat === "weekly") {
    return parseIsoDate(dateIso).getDay() === parseIsoDate(item.plannedDate).getDay();
  }
  return dateIso === item.plannedDate;
}

// 일정이 잡힌 상품을 날짜 → 끼니 순서로 묶는다. 완료된 상품은 일정에서 빠진다 —
// 일정 화면의 체크가 곧 기존 "완료" 처리라서(useInventory.completeItem) 완료되면
// 그 날 목록에서 자연히 사라져야 한다.
export function groupPlannedItemsByDate(items, dates) {
  const buckets = new Map(dates.map((date) => [date, []]));

  items.forEach((item) => {
    if (!hasPlan(item) || !isPlannableItem(item)) return;
    dates.forEach((date) => {
      if (planOccursOn(item, date)) buckets.get(date).push(item);
    });
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
// 일정 화면 맨 위에서 따로 보여준다. 반복 상품은 오늘 몫이 항상 다시 잡히므로
// "밀린 일정"으로 쌓지 않는다.
export function scheduleDateLabel(dateIso) {
  const date = parseIsoDate(dateIso);
  const base = `${date.getMonth() + 1}/${date.getDate()}(${weekdayLabel(dateIso)})`;
  const today = todayIso();
  if (dateIso === today) return `오늘 ${base}`;
  if (dateIso === toIsoDate(new Date(parseIsoDate(today).getTime() + 86400000))) return `내일 ${base}`;
  return base;
}

// 보관함 카드에 붙는 짧은 일정 뱃지("8/19 저녁").
// 그날 몫을 이미 끝냈는가.
export function planDoneOn(item, dateIso) {
  return Boolean(item?.planDoneDate) && item.planDoneDate === dateIso;
}

export function planBadgeLabel(item) {
  if (!hasPlan(item)) return "";
  const date = parseIsoDate(item.plannedDate);
  // 반복 상품은 특정 날짜보다 "매일/매주"라는 주기가 더 중요한 정보다.
  const when = isRepeating(item) ? repeatLabel(item.planRepeat) : `${date.getMonth() + 1}/${date.getDate()}`;
  const meal = item.plannedMeal ? ` ${mealLabel(item.plannedMeal)}` : "";
  const time = isValidPlanTime(item.plannedTime) ? ` ${formatPlanTime(item.plannedTime)}` : "";
  // 오늘 몫을 끝냈으면 그 사실을 같이 보여준다. 버튼만 바뀌면 눌러도 화면이
  // 그대로인 것처럼 보인다는 피드백(2026-08-29)으로 상세 카드와 보관함 뱃지에
  // 다 나오도록 여기에 붙인다.
  const done = item.planDoneDate && item.planDoneDate === todayIso() ? " · 오늘 먹음" : "";
  return `${when}${meal}${time}${done}`;
}

// 알림 예약용으로 "같은 날 같은 시각"인 상품을 한 건으로 묶는다. 상품마다 알림을
// 따로 쏘면 같은 시각에 알림이 여러 개 쏟아지고 예약 건수도 불필요하게 늘어난다.
export function groupPlannedItemsByTime(items, dateIso, fallbackTime) {
  const buckets = new Map();

  items.forEach((item) => {
    if (!hasPlan(item) || !isPlannableItem(item)) return;
    if (!planOccursOn(item, dateIso)) return;
    // 이미 먹은 날은 알림을 걸지 않는다. 목록에는 남지만 알림은 필요 없다.
    if (planDoneOn(item, dateIso)) return;
    const time = planTimeFor(item, fallbackTime);
    if (!isValidPlanTime(time)) return;
    if (!buckets.has(time)) buckets.set(time, []);
    buckets.get(time).push(item);
  });

  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([time, bucketItems]) => ({ time, items: bucketItems.sort(comparePlannedItems) }));
}
