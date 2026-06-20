import foodRules from "../data/foodRules.json";
import { todayIso } from "./date";
import { findProductClassifierMatch } from "./productClassifier";

function normalizeKeywordText(value) {
  return String(value || "").replace(/\s/g, "").toLowerCase();
}

function matchesAnyKeyword(normalizedName, words = []) {
  return words.some((word) => normalizedName.includes(normalizeKeywordText(word)));
}

function findKeywordExpiryRule(normalizedName, predicate = () => true) {
  return (foodRules.keywordExpiryDays || []).find((entry) =>
    predicate(entry) && matchesAnyKeyword(normalizedName, entry.words)
  );
}

export function suggestedStorage(name = "", category = "기타", fallbackStorage = "냉장") {
  const normalized = normalizeKeywordText(name);
  const freshCategories = ["육류/생선", "유제품", "채소/과일", "신선식품"];
  const classifierMatch = findProductClassifierMatch(name);

  if (category === "냉동식품" || matchesAnyKeyword(normalized, foodRules.frozenStorageWords)) {
    return "냉동";
  }

  if (freshCategories.includes(category)) {
    return fallbackStorage || "냉장";
  }

  if (
    (foodRules.roomStorageCategories || []).includes(category) ||
    matchesAnyKeyword(normalized, foodRules.roomStorageWords)
  ) {
    return "실온";
  }

  if (classifierMatch?.storage && category === classifierMatch.category) {
    return classifierMatch.storage;
  }

  return fallbackStorage || "냉장";
}

export function suggestedExpiryDays(name = "", category = "기타", storage = "") {
  const normalized = normalizeKeywordText(name);
  let matched = findKeywordExpiryRule(normalized);
  const classifierMatch = findProductClassifierMatch(name);

  if (matched && matched.days <= 14 && (foodRules.longShelfCategories || []).includes(category)) {
    matched = findKeywordExpiryRule(normalized, (entry) => entry.days > 14) || null;
  }

  const categoryDays = foodRules.categoryExpiryDays || {};
  const baseDays = matched?.days ||
    (classifierMatch?.category === category ? classifierMatch.days : null) ||
    categoryDays[category] ||
    categoryDays["기타"] ||
    7;

  if (storage === "냉동" && category !== "약") {
    return Math.max(baseDays, 60);
  }

  if (storage === "실온" && category === "유제품") {
    if (normalized.includes("멸균")) {
      return Math.max(baseDays, 60);
    }
    return 1;
  }

  return baseDays;
}

export function suggestedExpiryDate(name = "", category = "기타", storage = "") {
  return todayIso(suggestedExpiryDays(name, category, storage));
}
