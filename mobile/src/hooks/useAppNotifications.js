import { useCallback, useEffect, useState } from "react";
import {
  configureExpiryNotificationHandler,
  getNotificationDiagnostics,
  scheduleAllNotifications,
  scheduleTestNotification
} from "../services/notificationScheduler";

export const DEFAULT_NOTIFICATION_SETTINGS = { enabled: true, hour: 9, minute: 0 };

configureExpiryNotificationHandler();

export function normalizeNotificationSettings(value) {
  return { ...DEFAULT_NOTIFICATION_SETTINGS, ...(value || {}) };
}

// 소비기한 알림과 먹는 일정 알림을 함께 관리한다. 둘을 따로 예약하면
// scheduleAllNotifications 안의 전체 취소가 서로의 예약을 지우기 때문에
// 반드시 한 훅에서 한 번에 예약해야 한다(notificationScheduler.js 주석 참고).
//
// 일정 알림에는 설정이 없다 — 상품마다 시각을 따로 갖는 구조라 공통 설정이
// 들어갈 자리가 없다. 그래서 items가 바뀌면 그때그때 다시 예약된다.
export function useAppNotifications({ items, reminderDays, settingsReady }) {
  const [notificationSettings, setNotificationSettings] = useState(DEFAULT_NOTIFICATION_SETTINGS);
  const [notificationStatus, setNotificationStatus] = useState("알림 꺼짐");

  useEffect(() => {
    if (!settingsReady) return;
    let cancelled = false;
    scheduleAllNotifications(items, reminderDays, notificationSettings)
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

  // 기기에서 알림이 왜 안 오는지 가려내기 위한 진단. 설정 > 알림에서 부른다.
  const refreshNotificationDiagnostics = useCallback(() => getNotificationDiagnostics(), []);
  const sendTestNotification = useCallback(() => scheduleTestNotification(), []);

  return {
    notificationSettings,
    setNotificationSettings,
    notificationStatus,
    normalizeNotificationSettings,
    refreshNotificationDiagnostics,
    sendTestNotification
  };
}
