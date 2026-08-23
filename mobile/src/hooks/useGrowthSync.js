import { useEffect, useMemo, useRef, useState } from "react";
import { daysUntil } from "../utils/date";
import { fetchGrowthProfile, putGrowthEvents } from "../services/growthApi";

// 성장 XP. 등록은 낮게, "기한 내에 실제로 먹은 것"은 높게 둔다 — 영수증·쿠팡
// 캡처 한 번에 10개가 한꺼번에 등록되기 때문에, 등록에 무게를 실으면 관리를
// 안 해도 레벨이 뛴다(등록 5XP 시절 6개만 등록해도 레벨 2였다). 2026-08-23에
// 전체를 약 1/3로 낮춰 만렙까지 열심히 써도 1년쯤 걸리게 맞췄다.
//
// ⚠️ useGrowthSync.js와 HomePage.js 두 곳에 같은 값이 있다(로그인 사용자는
// 서버 적립, 비로그인은 로컬 계산). 한쪽만 바꾸면 두 값이 어긋난다.
// ⚠️ 이미 적립된 XP는 D1의 growth_events에 xp_delta로 남아 있어 소급되지
// 않는다. 값을 바꿔도 기존 사용자 레벨은 내려가지 않고, 앞으로 쌓일 XP만 준다.
const REGISTER_XP_PER_ITEM = 1;
const COMPLETE_XP_PER_ITEM = 6;
const URGENT_COMPLETE_XP_PER_ITEM = 9;
const EXPIRED_ITEM_PENALTY_XP = 5;

export function useGrowthSync({ items, reminderDays, authUser }) {
  const [growthProfile, setGrowthProfile] = useState(null);
  const [growthDashboardReport, setGrowthDashboardReport] = useState(null);
  const lastSignatureRef = useRef("");

  const growthEvents = useMemo(() => {
    return buildGrowthEvents(items, reminderDays);
  }, [items, reminderDays]);

  useEffect(() => {
    if (!authUser?.id) {
      setGrowthProfile(null);
      setGrowthDashboardReport(null);
      lastSignatureRef.current = "";
      return;
    }

    let cancelled = false;
    fetchGrowthProfile()
      .then((body) => {
        if (!cancelled) {
          setGrowthProfile(body.profile || null);
          setGrowthDashboardReport(body.report || null);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [authUser?.id]);

  useEffect(() => {
    if (!authUser?.id) return;
    const signature = JSON.stringify(growthEvents.map((event) => event.eventKey));
    if (signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;

    let cancelled = false;
    putGrowthEvents(growthEvents)
      .then((body) => {
        if (!cancelled) {
          setGrowthProfile(body.profile || null);
          setGrowthDashboardReport(body.report || null);
        }
      })
      .catch(() => {
        lastSignatureRef.current = "";
      });

    return () => {
      cancelled = true;
    };
  }, [authUser?.id, growthEvents]);

  return {
    growthProfile,
    growthDashboardReport
  };
}

function buildGrowthEvents(items, reminderDays) {
  const events = [];

  items.forEach((item) => {
    const itemId = String(item.id || "");
    if (!itemId) return;

    events.push({
      eventKey: `register:${itemId}`,
      type: "register",
      itemId,
      xpDelta: REGISTER_XP_PER_ITEM,
      createdAt: item.createdAt || new Date().toISOString(),
      metadata: {
        name: item.name || "",
        category: item.category || "",
        storage: item.storage || ""
      }
    });

    if (item.status === "completed") {
      const completedAt = new Date(item.completedAt || 0);
      const expiryAt = new Date(`${item.expiry}T23:59:59`);
      if (!Number.isNaN(completedAt.getTime()) && !Number.isNaN(expiryAt.getTime()) && completedAt <= expiryAt) {
        const daysLeftWhenCompleted = Math.ceil((expiryAt.getTime() - completedAt.getTime()) / 86400000);
        const isUrgent = daysLeftWhenCompleted <= reminderDays;
        events.push({
          eventKey: `complete:${itemId}`,
          type: isUrgent ? "complete_urgent" : "complete",
          itemId,
          xpDelta: isUrgent ? URGENT_COMPLETE_XP_PER_ITEM : COMPLETE_XP_PER_ITEM,
          createdAt: item.completedAt || new Date().toISOString(),
          metadata: {
            expiry: item.expiry || "",
            daysLeftWhenCompleted
          }
        });
      }
    } else if (daysUntil(item.expiry) < 0) {
      events.push({
        eventKey: `expired:${itemId}:${item.expiry || ""}`,
        type: "expired",
        itemId,
        xpDelta: -EXPIRED_ITEM_PENALTY_XP,
        createdAt: new Date().toISOString(),
        metadata: {
          expiry: item.expiry || ""
        }
      });
    }
  });

  return events;
}
