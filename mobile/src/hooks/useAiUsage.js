import { useMemo, useState } from "react";
import { Alert } from "react-native";
import {
  AI_AD_CREDIT_LIMIT,
  AI_DAILY_AD_LIMIT,
  AI_FREE_MONTHLY_LIMIT,
  DEFAULT_AI_USAGE_SETTINGS,
  consumeAiUsageCredit,
  normalizeAiUsageSettings as normalizeAiUsageSettingsBase,
  refundAiUsageCredit
} from "../utils/aiUsage";
import { todayIso } from "../utils/date";

export function useAiUsage() {
  const [aiUsageSettings, setAiUsageSettings] = useState(DEFAULT_AI_USAGE_SETTINGS);
  const [aiUsageStatus, setAiUsageStatus] = useState("");

  const normalizedAiUsage = useMemo(() => normalizeAiUsageSettings(aiUsageSettings), [aiUsageSettings]);
  const aiFreeRemaining = Math.max(AI_FREE_MONTHLY_LIMIT - normalizedAiUsage.freeUsed, 0);
  const aiTotalRemaining = aiFreeRemaining + normalizedAiUsage.adCredits;
  const aiAdRemainingToday = Math.max(AI_DAILY_AD_LIMIT - normalizedAiUsage.adWatchCount, 0);

  function normalizeAiUsageSettings(value) {
    return normalizeAiUsageSettingsBase(value, todayIso);
  }

  function chargeAiUsage() {
    const charge = consumeAiUsageCredit(aiUsageSettings, todayIso);
    setAiUsageSettings(charge.next);
    return charge;
  }

  function refundAiUsage(source) {
    if (!source) return;
    setAiUsageSettings((current) => refundAiUsageCredit(current, source, todayIso));
  }

  function showAiCreditRequired() {
    setAiUsageStatus("AI 정리 횟수를 모두 사용했습니다. 광고를 보고 1회를 충전할 수 있습니다.");
    Alert.alert("AI 정리 횟수 부족", "이번 달 무료 횟수와 광고 충전 횟수를 모두 사용했습니다.", [
      { text: "빠른 추출로 계속", style: "cancel" },
      { text: "광고 보고 1회 충전", onPress: simulateRewardedAd }
    ]);
  }

  function simulateRewardedAd() {
    const current = normalizeAiUsageSettings(aiUsageSettings);
    if (current.adCredits >= AI_AD_CREDIT_LIMIT) {
      Alert.alert("충전 한도", `광고 충전은 최대 ${AI_AD_CREDIT_LIMIT}회까지 보유할 수 있습니다.`);
      return;
    }
    if (current.adWatchCount >= AI_DAILY_AD_LIMIT) {
      Alert.alert("오늘 한도", `광고 충전은 하루 ${AI_DAILY_AD_LIMIT}회까지 가능합니다.`);
      return;
    }

    setAiUsageStatus("광고를 불러오는 중입니다...");
    setTimeout(() => {
      setAiUsageSettings((latest) => {
        const normalized = normalizeAiUsageSettings(latest);
        if (normalized.adCredits >= AI_AD_CREDIT_LIMIT || normalized.adWatchCount >= AI_DAILY_AD_LIMIT) return normalized;
        return {
          ...normalized,
          adCredits: Math.min(normalized.adCredits + 1, AI_AD_CREDIT_LIMIT),
          adWatchDate: todayIso(),
          adWatchCount: normalized.adWatchCount + 1
        };
      });
      setAiUsageStatus("광고 시청 완료. AI 정리 1회가 충전되었습니다.");
      Alert.alert("충전 완료", "AI 정리 1회가 충전되었습니다.");
    }, 1800);
  }

  return {
    aiUsageSettings,
    setAiUsageSettings,
    aiUsageStatus,
    normalizedAiUsage,
    aiFreeRemaining,
    aiTotalRemaining,
    aiAdRemainingToday,
    aiFreeMonthlyLimit: AI_FREE_MONTHLY_LIMIT,
    aiAdCreditLimit: AI_AD_CREDIT_LIMIT,
    aiDailyAdLimit: AI_DAILY_AD_LIMIT,
    normalizeAiUsageSettings,
    chargeAiUsage,
    refundAiUsage,
    showAiCreditRequired,
    simulateRewardedAd
  };
}
