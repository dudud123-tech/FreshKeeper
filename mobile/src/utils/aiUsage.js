export const AI_FREE_MONTHLY_LIMIT = 3;
export const AI_AD_CREDIT_LIMIT = 5;
export const AI_DAILY_AD_LIMIT = 3;

export const DEFAULT_AI_USAGE_SETTINGS = {
  monthKey: currentMonthKey(),
  freeUsed: 0,
  adCredits: 0,
  adWatchDate: "",
  adWatchCount: 0
};

export function currentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function normalizeAiUsageSettings(value, todayIso) {
  const currentKey = currentMonthKey();
  const settings = { ...DEFAULT_AI_USAGE_SETTINGS, ...(value || {}) };
  const sameMonth = settings.monthKey === currentKey;
  return {
    monthKey: currentKey,
    freeUsed: sameMonth ? Math.min(Math.max(Number(settings.freeUsed) || 0, 0), AI_FREE_MONTHLY_LIMIT) : 0,
    adCredits: Math.min(Math.max(Number(settings.adCredits) || 0, 0), AI_AD_CREDIT_LIMIT),
    adWatchDate: settings.adWatchDate || "",
    adWatchCount: settings.adWatchDate === todayIso() ? Math.max(Number(settings.adWatchCount) || 0, 0) : 0
  };
}

export function aiRemainingCredits(settings, todayIso) {
  const normalized = normalizeAiUsageSettings(settings, todayIso);
  return Math.max(AI_FREE_MONTHLY_LIMIT - normalized.freeUsed, 0) + normalized.adCredits;
}

export function consumeAiUsageCredit(settings, todayIso) {
  const normalized = normalizeAiUsageSettings(settings, todayIso);
  if (AI_FREE_MONTHLY_LIMIT - normalized.freeUsed > 0) {
    return { allowed: true, next: { ...normalized, freeUsed: normalized.freeUsed + 1 }, source: "free" };
  }
  if (normalized.adCredits > 0) {
    return { allowed: true, next: { ...normalized, adCredits: normalized.adCredits - 1 }, source: "ad" };
  }
  return { allowed: false, next: normalized, source: "" };
}

export function refundAiUsageCredit(settings, source, todayIso) {
  const normalized = normalizeAiUsageSettings(settings, todayIso);
  if (source === "free") return { ...normalized, freeUsed: Math.max(normalized.freeUsed - 1, 0) };
  if (source === "ad") return { ...normalized, adCredits: Math.min(normalized.adCredits + 1, AI_AD_CREDIT_LIMIT) };
  return normalized;
}
