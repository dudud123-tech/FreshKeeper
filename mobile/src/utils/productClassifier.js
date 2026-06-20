import productClassifier from "../data/productClassifier.json";

export function normalizeProductText(value) {
  return String(value || "").replace(/\s/g, "").toLowerCase();
}

export function findProductClassifierMatch(name) {
  const normalized = normalizeProductText(name);
  if (normalized.length < (productClassifier.minMatchLength || 3)) return null;

  for (const rule of productClassifier.productRules || []) {
    const ruleName = rule.n || "";
    if (!ruleName) continue;

    const exact = normalized === ruleName;
    const containsRule = ruleName.length >= 5 && normalized.includes(ruleName);
    const containedByRule = normalized.length >= 8 && ruleName.includes(normalized);

    if (exact || containsRule || containedByRule) {
      return {
        category: rule.category,
        storage: rule.storage,
        days: rule.days,
        matchedName: rule.name,
        matchedType: rule.type,
        source: "food-safety-product"
      };
    }
  }

  return null;
}
