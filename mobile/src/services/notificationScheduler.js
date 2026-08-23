import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { daysUntil, daysUntilFrom, parseIsoDate, toIsoDate } from "../utils/date";
import { hasPlan, isPlannableItem, mealLabel, SCHEDULE_LOOKAHEAD_DAYS } from "../utils/mealPlan";

const NOTIFICATION_CHANNEL_ID = "freshkeeper-expiry-alerts-v2";
const NOTIFICATION_LOOKAHEAD_DAYS = 30;

// 먹는 일정 알림은 안드로이드 채널을 분리한다 — 소비기한 알림과 성격이 달라서
// 사용자가 OS 알림 설정에서 한쪽만 끌 수 있어야 한다(2026-08-19).
const PLAN_NOTIFICATION_CHANNEL_ID = "freshkeeper-plan-alerts-v1";

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
  return parts.length > 0 ? `${parts.join(", ")}가 있어요.` : "오늘 확인할 임박/만료 상품이 없습니다.";
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
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#1f7a5a"
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
export async function scheduleAllNotifications(items, reminderDays, settings, planSettings) {
  if (Platform.OS === "web") return "웹에서는 알림을 예약하지 않습니다.";

  await Notifications.cancelAllScheduledNotificationsAsync();

  const expiryEnabled = Boolean(settings?.enabled);
  const planEnabled = Boolean(planSettings?.enabled);
  if (!expiryEnabled && !planEnabled) return "알림 꺼짐";

  const unavailableReason = await prepareNotifications();
  if (unavailableReason) return unavailableReason;

  const expiryCount = expiryEnabled ? await scheduleExpiryDigests(items, reminderDays, settings) : 0;
  const planCount = planEnabled ? await schedulePlanReminders(items, planSettings) : 0;

  const parts = [];
  if (expiryEnabled) parts.push(`소비기한 ${expiryCount}일치`);
  if (planEnabled) parts.push(`일정 ${planCount}일치`);
  return parts.length > 0 ? `${parts.join(" · ")} 알림 예약됨` : "예약할 알림 없음";
}

async function scheduleExpiryDigests(items, reminderDays, settings) {
  let scheduledCount = 0;
  const now = new Date();
  for (let offset = 0; offset < NOTIFICATION_LOOKAHEAD_DAYS; offset += 1) {
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

// 그 날 먹기로 한 상품을 하루 한 건으로 묶어서 알린다. 날짜마다 1건이라 최대
// SCHEDULE_LOOKAHEAD_DAYS건 — 소비기한 알림(최대 30건)과 합쳐도 안드로이드 예약 한도에 여유가 있다.
async function schedulePlanReminders(items, planSettings) {
  let scheduledCount = 0;
  const now = new Date();

  for (let offset = 0; offset < SCHEDULE_LOOKAHEAD_DAYS; offset += 1) {
    const triggerDate = new Date();
    triggerDate.setDate(triggerDate.getDate() + offset);
    triggerDate.setHours(planSettings.hour, planSettings.minute, 0, 0);
    if (triggerDate <= now) continue;

    const targetDate = toIsoDate(triggerDate);
    const plannedItems = items.filter(
      (item) => hasPlan(item) && isPlannableItem(item) && item.plannedDate === targetDate
    );
    if (plannedItems.length === 0) continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: planNotificationTitle(plannedItems),
        body: planNotificationBody(plannedItems),
        priority: Notifications.AndroidNotificationPriority.HIGH,
        sound: "default",
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

  return scheduledCount;
}

function planNotificationTitle(plannedItems) {
  const primary = plannedItems[0];
  const primaryName = primary?.name?.trim() || "먹기로 한 상품";
  const slot = primary?.plannedMeal ? `${mealLabel(primary.plannedMeal)} ` : "";
  const extraCount = Math.max(plannedItems.length - 1, 0);
  return `오늘 ${slot}${primaryName}${extraCount > 0 ? ` 외 ${extraCount}건` : ""}`;
}

function planNotificationBody(plannedItems) {
  // 소비기한이 임박한 게 섞여 있으면 같이 알려준다 — 두 축이 만나는 지점이라
  // "오늘 먹기로 했는데 마침 기한도 오늘"인 상품을 놓치지 않게 한다.
  const urgentCount = plannedItems.filter((item) => daysUntil(item.expiry) <= 0).length;
  const base = `오늘 먹기로 한 상품 ${plannedItems.length}개가 있어요.`;
  return urgentCount > 0 ? `${base} 그중 ${urgentCount}개는 오늘까지입니다.` : base;
}
