import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { daysUntilFrom, parseIsoDate, toIsoDate } from "../utils/date";

const NOTIFICATION_CHANNEL_ID = "freshkeeper-expiry-alerts-v2";
const NOTIFICATION_LOOKAHEAD_DAYS = 30;

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
      name: "오늘까지야 알림",
      importance: Notifications.AndroidImportance.MAX,
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

export async function scheduleExpiryNotifications(items, reminderDays, settings) {
  if (Platform.OS === "web") return "웹에서는 알림을 예약하지 않습니다.";

  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!settings.enabled) return "알림 꺼짐";

  const unavailableReason = await prepareNotifications();
  if (unavailableReason) return unavailableReason;

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

  const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
  return scheduledCount > 0 ? `${scheduledCount}일치 알림 예약됨` : `예약할 임박/만료 상품 없음 (${scheduledNotifications.length}개 예약)`;
}
