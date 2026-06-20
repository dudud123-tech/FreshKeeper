import foodRules from "./data/foodRules.json";
import { findProductClassifierMatch } from "./utils/productClassifier";

export const categories = foodRules.categories;

function normalizeKeywordText(value) {
  return String(value || "").replace(/\s/g, "").toLowerCase();
}

function matchesAnyKeyword(normalizedName, words = []) {
  return words.some((word) => normalizedName.includes(normalizeKeywordText(word)));
}

export function suggestCategory(name) {
  const normalized = normalizeKeywordText(name);

  for (const [category, words] of Object.entries(foodRules.priorityCategoryKeywords || {})) {
    if (matchesAnyKeyword(normalized, words)) {
      return category;
    }
  }

  const classifierMatch = findProductClassifierMatch(name);
  if (classifierMatch?.category) {
    return classifierMatch.category;
  }

  for (const [category, words] of Object.entries(foodRules.categoryKeywords || {})) {
    if (matchesAnyKeyword(normalized, words)) {
      return category;
    }
  }

  return "기타";
}
