import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { daysUntil, daysUntilFrom, parseIsoDate, toIsoDate } from "../utils/date";
import {
  DEFAULT_PLAN_TIME,
  formatPlanTime,
  groupPlannedItemsByTime,
  hasPlan,
  mealLabel,
  PLAN_NOTIFICATION_LOOKAHEAD_DAYS
} from "../utils/mealPlan";

const NOTIFICATION_CHANNEL_ID = "freshkeeper-expiry-alerts-v2";
const EXPIRY_LOOKAHEAD_DAYS = 30;

// 먹는 일정 알림은 안드로이드 채널을 분리한다 — 소비기한 알림과 성격이 달라서
// 사용자가 OS 알림 설정에서 한쪽만 끌 수 있어야 한다(2026-08-19).
//
// ⚠️ 안드로이드 채널은 한 번 만들어지면 앱이 중요도·소리·진동을 바꿀 수 없다
// (그때부터는 사용자 소관). 그래서 알림 세기를 올릴 때는 반드시 채널 ID의 버전을
// 같이 올려야 새 설정이 실제로 적용된다. v1 → v2: 알림이 잘 체감되지 않는다는
// 피드백으로 중요도를 MAX로 올리고 진동을 길게 바꿨다(2026-08-23).
const PLAN_NOTIFICATION_CHANNEL_ID = "freshkeeper-plan-alerts-v2";

// 한 번에 예약할 수 있는 일정 알림 수 상한. 상품마다 시간을 따로 잡을 수 있게 되면서
// 예약 건수가 상품 수만큼 늘어날 수 있어, 안드로이드 예약 한도를 넘지 않게 막아둔다.
const MAX_PLAN_NOTIFICATIONS = 60;

export function configureExpiryNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
      priority: Notifications.AndroidNotificationPriority.MAX
    })
  });
}

function notificationSummaryForDate(items, reminderDays, baseDate) {
  return items.reduce(
    (acc, item) => {
      const days = daysUntilFrom(item, baseDate);
      if (days < 0) {
        acc.expired += 1;
        acc.items.push({ ...item, days, rank: 0 });
      }
      if (days >= 0 && days <= reminderDays) {
        acc.urgent += 1;
        acc.items.push({ ...item, days, rank: days === 0 ? 1 : 2 });
      }
      if (days === 0) acc.today += 1;
      return acc;
    },
    { urgent: 0, today: 0, expired: 0, items: [] }
  );
}

function notificationTitle(summary) {
  const sortedItems = [...summary.items].sort((a, b) => a.rank - b.rank || a.days - b.days);
  const primaryName = sortedItems[0]?.name?.trim();
  const extraCount = Math.max(sortedItems.length - 1, 0);
  if (!primaryName) return summary.expired > 0 ? "만료 상품을 확인하세요" : "임박 상품을 확인하세요";
  return `${primaryName}${extraCount > 0 ? ` 외 ${extraCount}건` : ""} 확인하세요`;
}

function notificationBody(summary) {
  const parts = [];
  if (summary.expired > 0) parts.push(`만료 ${summary.expired}개`);
  if (summary.today > 0) parts.push(`오늘까지 ${summary.today}개`);
  const upcoming = Math.max(summary.urgent - summary.today, 0);
  if (upcoming > 0) parts.push(`임박 ${upcoming}개`);
  const base = parts.length > 0 ? `${parts.join(", ")}가 있어요.` : "오늘 확인할 임박/만료 상품이 없습니다.";
  const memos = memoLines(summary.items);
  return memos ? `${base}\n${memos}` : base;
}

async function prepareNotifications() {
  if (Platform.OS === "web") return "웹에서는 알림을 사용할 수 없습니다.";

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
      name: "소비기한 알림",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#1f7a5a"
    });
    await Notifications.setNotificationChannelAsync(PLAN_NOTIFICATION_CHANNEL_ID, {
      name: "먹는 일정 알림",
      // MAX여야 화면 위로 튀어나오는 헤드업 알림이 뜬다. HIGH는 소리는 나도
      // 상단바에만 조용히 쌓여서 놓치기 쉬웠다.
      importance: Notifications.AndroidImportance.MAX,
      // 짧게 세 번 떨던 기본 패턴 대신 길게-짧게-길게로 바꿔 다른 앱 알림과 구분되게 한다.
      vibrationPattern: [0, 400, 200, 400, 200, 600],
      enableVibrate: true,
      enableLights: true,
      lightColor: "#1f7a5a",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: "default"
    });
  }

  const permission = await Notifications.getPermissionsAsync();
  let finalStatus = permission.status;
  if (finalStatus !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }

  return finalStatus === "granted" ? null : "알림 권한이 꺼져 있습니다.";
}

// ⚠️ 소비기한 알림과 먹는 일정 알림을 반드시 이 한 함수에서 같이 예약한다.
// 맨 앞의 cancelAllScheduledNotificationsAsync()가 예약된 알림을 전부 지우기
// 때문에, 두 종류를 각각 다른 함수에서 예약하면 나중에 부른 쪽이 앞쪽 예약을
// 통째로 날려버린다(2026-08-19).
export async function scheduleAllNotifications(items, reminderDays, settings) {
  if (Platform.OS === "web") return "웹에서는 알림을 예약하지 않습니다.";

  await Notifications.cancelAllScheduledNotificationsAsync();

  const expiryEnabled = Boolean(settings?.enabled);
  // 먹는 일정 알림에는 on/off 설정이 없다. 소비기한 알림은 상품만 등록하면
  // 저절로 오지만 일정 알림은 사용자가 먹을 날을 직접 잡은 상품만 대상이라,
  // 일정을 안 잡은 상태가 곧 꺼둔 상태다. 설정에 토글을 두면 같은 일을 두 번
  // 하게 되고 "상품마다 다른 시각"이라는 모델과도 어긋난다(2026-08-23).
  const hasAnyPlan = items.some(hasPlan);
  if (!expiryEnabled && !hasAnyPlan) return "알림 꺼짐";

  const unavailableReason = await prepareNotifications();
  if (unavailableReason) return unavailableReason;

  const expiryCount = expiryEnabled ? await scheduleExpiryDigests(items, reminderDays, settings) : 0;
  const planCount = await schedulePlanReminders(items);

  const parts = [];
  if (expiryEnabled) parts.push(`소비기한 ${expiryCount}일치`);
  if (planCount > 0) parts.push(`일정 ${planCount}건`);
  return parts.length > 0 ? `${parts.join(" · ")} 알림 예약됨` : "예약할 알림 없음";
}

async function scheduleExpiryDigests(items, reminderDays, settings) {
  let scheduledCount = 0;
  const now = new Date();
  for (let offset = 0; offset < EXPIRY_LOOKAHEAD_DAYS; offset += 1) {
    const triggerDate = new Date();
    triggerDate.setDate(triggerDate.getDate() + offset);
    triggerDate.setHours(settings.hour, settings.minute, 0, 0);
    if (triggerDate <= now) continue;

    const baseDate = parseIsoDate(toIsoDate(triggerDate));
    const summary = notificationSummaryForDate(items, reminderDays, baseDate);
    if (summary.urgent === 0 && summary.expired === 0) continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: notificationTitle(summary),
        body: notificationBody(summary),
        priority: Notifications.AndroidNotificationPriority.MAX,
        sound: "default",
        data: { screen: "inventory", type: "expiry-digest" }
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
        channelId: NOTIFICATION_CHANNEL_ID
      }
    });
    scheduledCount += 1;
  }

  return scheduledCount;
}

// 상품마다 정한 시각에 알린다. 같은 날 같은 시각인 상품은 한 건으로 묶어서
// 알림이 동시에 여러 개 쏟아지지 않게 한다. 시간을 따로 안 정한 상품은
// 끼니 기본 시간 → 설정의 일정 알림 시간 순으로 폴백한다(mealPlan.planTimeFor).
async function schedulePlanReminders(items) {
  let scheduledCount = 0;
  const now = new Date();
  // 화면에서 일정을 잡을 때 시각도 함께 저장하므로 여기까지 오는 상품은
  // 대개 자기 시각을 갖고 있다. 이 폴백은 시각이 저장되기 전에 만들어진
  // 예전 데이터가 알림에서 아예 빠지지 않게 하는 안전망이다.
  const fallbackTime = DEFAULT_PLAN_TIME;

  for (let offset = 0; offset < PLAN_NOTIFICATION_LOOKAHEAD_DAYS; offset += 1) {
    const dayDate = new Date();
    dayDate.setDate(dayDate.getDate() + offset);
    const targetDate = toIsoDate(dayDate);

    for (const group of groupPlannedItemsByTime(items, targetDate, fallbackTime)) {
      if (scheduledCount >= MAX_PLAN_NOTIFICATIONS) return scheduledCount;

      const [hour, minute] = group.time.split(":").map(Number);
      const triggerDate = new Date(dayDate);
      triggerDate.setHours(hour, minute, 0, 0);
      if (triggerDate <= now) continue;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: planNotificationTitle(group.items, group.time),
          body: planNotificationBody(group.items),
          priority: Notifications.AndroidNotificationPriority.MAX,
          sound: "default",
          vibrate: [0, 400, 200, 400, 200, 600],
          data: { screen: "schedule", type: "meal-plan" }
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
          channelId: PLAN_NOTIFICATION_CHANNEL_ID
        }
      });
      scheduledCount += 1;
    }
  }

  return scheduledCount;
}

function planNotificationTitle(plannedItems, time) {
  const primary = plannedItems[0];
  const primaryName = primary?.name?.trim() || "먹기로 한 상품";
  const slot = primary?.plannedMeal ? `${mealLabel(primary.plannedMeal)} ` : "";
  const extraCount = Math.max(plannedItems.length - 1, 0);
  const timeLabel = formatPlanTime(time);
  const prefix = timeLabel ? `${timeLabel} ` : "";
  return `${prefix}${slot}${primaryName}${extraCount > 0 ? ` 외 ${extraCount}건` : ""} 드세요`;
}

function planNotificationBody(plannedItems) {
  // 소비기한이 임박한 게 섞여 있으면 같이 알려준다 — 두 축이 만나는 지점이라
  // "오늘 먹기로 했는데 마침 기한도 오늘"인 상품을 놓치지 않게 한다.
  const urgentCount = plannedItems.filter((item) => daysUntil(item.expiry) <= 0).length;
  const names = plannedItems.map((item) => item.name?.trim()).filter(Boolean).join(", ");
  const base = names ? `${names} 먹기로 한 시간이에요.` : "먹기로 한 상품이 있어요.";
  const withUrgent = urgentCount > 0 ? `${base} 그중 ${urgentCount}개는 오늘까지입니다.` : base;
  const memos = memoLines(plannedItems);
  return memos ? `${withUrgent}\n${memos}` : withUrgent;
}

// 상품에 적어둔 메모를 알림에 함께 보여준다("해동 필요" 같은 건 그 시각에
// 알아야 쓸모가 있다). 알림 본문이 길어지지 않게 최대 3건까지만 싣는다.
const MAX_MEMO_LINES = 3;
const MEMO_LINE_MAX_LENGTH = 40;

function memoLines(items) {
  return items
    .filter((item) => item?.memo?.trim())
    .slice(0, MAX_MEMO_LINES)
    .map((item) => {
      const memo = item.memo.trim().replace(/\s+/g, " ");
      const clipped = memo.length > MEMO_LINE_MAX_LENGTH ? `${memo.slice(0, MEMO_LINE_MAX_LENGTH)}…` : memo;
      return `📝 ${item.name?.trim() || "메모"}: ${clipped}`;
    })
    .join("\n");
}
