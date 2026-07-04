import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAuthHeaders } from "./authApi";
import { getClientId } from "./clientIdentity";

const WORKER_API_BASE = "https://freshkeeper-ocr-feedback.dndud123.workers.dev/api";
const API_BASE = `${WORKER_API_BASE}/product-classifications`;
const CACHE_KEY = "fresh-keeper-product-classification-cache-v1";
const EXCLUSION_CACHE_KEY = "fresh-keeper-product-exclusion-cache-v1";
const REQUEST_TIMEOUT_MS = 6000;
const MAX_CACHE_ITEMS = 500;

export function normalizeProductName(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export async function resolveProductClassifications(names) {
  const normalizedNames = uniqueProductNames(names);
  if (!normalizedNames.length) return {};

  const clientId = await getClientId();
  const authHeaders = await getAuthHeaders();
  try {
    const response = await fetchWithTimeout(`${API_BASE}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({
        clientId,
        names: normalizedNames.map((item) => item.name)
      })
    });

    if (!response.ok) throw new Error(`classification_resolve_failed_${response.status}`);
    const body = await response.json();
    const resultMap = classificationMap(body?.classifications);
    await mergeClassificationCache(resultMap);
    return resultMap;
  } catch {
    return readClassificationCache(normalizedNames.map((item) => item.normalizedName));
  }
}

export async function sendProductClassificationFeedback(items) {
  const normalizedItems = Array.isArray(items) ? items.filter(Boolean).slice(0, 30) : [];
  if (!normalizedItems.length) return { ok: true, savedCount: 0 };

  const clientId = await getClientId();
  const authHeaders = await getAuthHeaders();
  const response = await fetchWithTimeout(`${API_BASE}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({ clientId, items: normalizedItems })
  });
  if (!response.ok) throw new Error(`classification_feedback_failed_${response.status}`);

  const body = await response.json();
  const cacheEntries = {};
  for (const item of normalizedItems) {
    const normalizedName = normalizeProductName(item.name);
    if (!normalizedName) continue;
    cacheEntries[normalizedName] = {
      name: item.name,
      normalizedName,
      category: item.finalCategory,
      storage: item.finalStorage,
      expiryDays: item.finalExpiryDays,
      source: "device-personal",
      confidence: 1,
      sampleCount: 1,
      cachedAt: new Date().toISOString()
    };
  }
  await mergeClassificationCache(cacheEntries);
  return body;
}

export async function filterExcludedProductNames(names) {
  const normalizedNames = uniqueProductNames(names);
  if (!normalizedNames.length) return [];
  const clientId = await getClientId();
  const authHeaders = await getAuthHeaders();

  try {
    const response = await fetchWithTimeout(`${WORKER_API_BASE}/product-exclusions/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({
        clientId,
        names: normalizedNames.map((item) => item.name)
      })
    });
    if (!response.ok) throw new Error(`product_exclusions_resolve_failed_${response.status}`);
    const body = await response.json();
    const excludedSet = new Set(Array.isArray(body?.excludedNames) ? body.excludedNames : []);
    const cached = await readExclusionCache();
    for (const item of normalizedNames) cached.delete(normalizeExcludedProductName(item.name));
    for (const normalizedName of excludedSet) cached.add(normalizedName);
    await replaceExclusionCache(cached);
    return normalizedNames
      .filter((item) => !excludedSet.has(normalizeExcludedProductName(item.name)))
      .map((item) => item.name);
  } catch {
    const excludedSet = await readExclusionCache();
    return normalizedNames
      .filter((item) => !excludedSet.has(normalizeExcludedProductName(item.name)))
      .map((item) => item.name);
  }
}

export async function setProductExclusion(name, excluded) {
  const normalizedName = normalizeExcludedProductName(name);
  if (normalizedName.length < 2) return;

  const cached = await readExclusionCache();
  if (excluded) cached.add(normalizedName);
  else cached.delete(normalizedName);
  await replaceExclusionCache(cached);

  const clientId = await getClientId();
  const authHeaders = await getAuthHeaders();
  const response = await fetchWithTimeout(`${WORKER_API_BASE}/product-exclusions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({
      clientId,
      exclude: excluded ? [name] : [],
      include: excluded ? [] : [name]
    })
  });
  if (!response.ok) throw new Error(`product_exclusions_update_failed_${response.status}`);
}

function normalizeExcludedProductName(value) {
  return normalizeProductName(value).replace(/(?:irc|rc)$/i, "");
}

function uniqueProductNames(names) {
  const seen = new Set();
  const results = [];
  for (const value of Array.isArray(names) ? names.slice(0, 30) : []) {
    const name = String(value || "").trim().slice(0, 140);
    const normalizedName = normalizeProductName(name);
    if (normalizedName.length < 2 || seen.has(normalizedName)) continue;
    seen.add(normalizedName);
    results.push({ name, normalizedName });
  }
  return results;
}

function classificationMap(classifications) {
  const results = {};
  for (const item of Array.isArray(classifications) ? classifications : []) {
    const normalizedName = normalizeProductName(item?.normalizedName || item?.name);
    if (!normalizedName || !item?.category || !item?.storage) continue;
    results[normalizedName] = {
      name: String(item.name || ""),
      normalizedName,
      category: item.category,
      storage: item.storage,
      expiryDays: normalizeExpiryDays(item.expiryDays),
      source: item.source || "server",
      confidence: Number(item.confidence) || 0,
      sampleCount: Number(item.sampleCount) || 0,
      cachedAt: new Date().toISOString()
    };
  }
  return results;
}

function normalizeExpiryDays(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 7;
  return Math.max(0, Math.min(3650, Math.round(number)));
}

async function readClassificationCache(normalizedNames) {
  try {
    const stored = JSON.parse(await AsyncStorage.getItem(CACHE_KEY) || "{}");
    const results = {};
    for (const normalizedName of normalizedNames) {
      if (stored[normalizedName]) results[normalizedName] = stored[normalizedName];
    }
    return results;
  } catch {
    return {};
  }
}

async function mergeClassificationCache(entries) {
  if (!entries || !Object.keys(entries).length) return;
  try {
    const current = JSON.parse(await AsyncStorage.getItem(CACHE_KEY) || "{}");
    const merged = { ...current, ...entries };
    const trimmed = Object.fromEntries(
      Object.entries(merged)
        .sort(([, left], [, right]) => String(right?.cachedAt || "").localeCompare(String(left?.cachedAt || "")))
        .slice(0, MAX_CACHE_ITEMS)
    );
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(trimmed));
  } catch {
    // Cache failures must not block product registration.
  }
}

async function readExclusionCache() {
  try {
    const values = JSON.parse(await AsyncStorage.getItem(EXCLUSION_CACHE_KEY) || "[]");
    return new Set(Array.isArray(values) ? values.filter(Boolean) : []);
  } catch {
    return new Set();
  }
}

async function replaceExclusionCache(values) {
  try {
    await AsyncStorage.setItem(EXCLUSION_CACHE_KEY, JSON.stringify([...values].slice(-MAX_CACHE_ITEMS)));
  } catch {
    // Exclusion cache failures must not block OCR.
  }
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
