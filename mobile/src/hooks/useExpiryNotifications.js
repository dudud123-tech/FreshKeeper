import { useEffect, useState } from "react";
import { configureExpiryNotificationHandler, scheduleExpiryNotifications } from "../services/notificationScheduler";

export const DEFAULT_NOTIFICATION_SETTINGS = { enabled: false, hour: 9, minute: 0 };

configureExpiryNotificationHandler();

export function normalizeNotificationSettings(value) {
  return { ...DEFAULT_NOTIFICATION_SETTINGS, ...(value || {}) };
}

export function useExpiryNotifications({ items, reminderDays, settingsReady }) {
  const [notificationSettings, setNotificationSettings] = useState(DEFAULT_NOTIFICATION_SETTINGS);
  const [notificationStatus, setNotificationStatus] = useState("알림 꺼짐");

  useEffect(() => {
    if (!settingsReady) return;
    let cancelled = false;
    scheduleExpiryNotifications(items, reminderDays, notificationSettings)
      .then((status) => {
        if (!cancelled) setNotificationStatus(status);
      })
      .catch(() => {
        if (!cancelled) setNotificationStatus("알림 예약 실패");
      });

    return () => {
      cancelled = true;
    };
  }, [items, reminderDays, notificationSettings, settingsReady]);

  return {
    notificationSettings,
    setNotificationSettings,
    notificationStatus,
    normalizeNotificationSettings
  };
}
