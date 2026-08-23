import { useEffect, useState } from "react";
import { configureExpiryNotificationHandler, scheduleAllNotifications } from "../services/notificationScheduler";

export const DEFAULT_NOTIFICATION_SETTINGS = { enabled: true, hour: 9, minute: 0 };
// 먹는 일정 알림 기본값. 소비기한 알림(아침 9시)과 겹치지 않게 저녁 준비 시간대로 잡았다.
export const DEFAULT_PLAN_NOTIFICATION_SETTINGS = { enabled: true, hour: 17, minute: 0 };

configureExpiryNotificationHandler();

export function normalizeNotificationSettings(value) {
  return { ...DEFAULT_NOTIFICATION_SETTINGS, ...(value || {}) };
}

export function normalizePlanNotificationSettings(value) {
  return { ...DEFAULT_PLAN_NOTIFICATION_SETTINGS, ...(value || {}) };
}

// 소비기한 알림과 먹는 일정 알림을 함께 관리한다. 둘을 따로 예약하면
// scheduleAllNotifications 안의 전체 취소가 서로의 예약을 지우기 때문에
// 반드시 한 훅에서 한 번에 예약해야 한다(notificationScheduler.js 주석 참고).
export function useAppNotifications({ items, reminderDays, settingsReady }) {
  const [notificationSettings, setNotificationSettings] = useState(DEFAULT_NOTIFICATION_SETTINGS);
  const [planNotificationSettings, setPlanNotificationSettings] = useState(DEFAULT_PLAN_NOTIFICATION_SETTINGS);
  const [notificationStatus, setNotificationStatus] = useState("알림 꺼짐");

  useEffect(() => {
    if (!settingsReady) return;
    let cancelled = false;
    scheduleAllNotifications(items, reminderDays, notificationSettings, planNotificationSettings)
      .then((status) => {
        if (!cancelled) setNotificationStatus(status);
      })
      .catch(() => {
        if (!cancelled) setNotificationStatus("알림 예약 실패");
      });

    return () => {
      cancelled = true;
    };
  }, [items, reminderDays, notificationSettings, planNotificationSettings, settingsReady]);

  return {
    notificationSettings,
    setNotificationSettings,
    planNotificationSettings,
    setPlanNotificationSettings,
    notificationStatus,
    normalizeNotificationSettings,
    normalizePlanNotificationSettings
  };
}
