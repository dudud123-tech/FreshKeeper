import { useEffect, useMemo, useRef, useState } from "react";
import { daysUntil } from "../utils/date";
import { fetchGrowthProfile, putGrowthEvents } from "../services/growthApi";

const REGISTER_XP_PER_ITEM = 5;
const COMPLETE_XP_PER_ITEM = 10;
const URGENT_COMPLETE_XP_PER_ITEM = 15;
const EXPIRED_ITEM_PENALTY_XP = 8;

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
