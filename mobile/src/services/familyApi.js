const FAMILY_GROUP_ENDPOINT = "https://freshkeeper-ocr-feedback.dndud123.workers.dev/api/family-groups";

export function normalizeFamilyCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

export function cleanItemForFamilySync(item, { defaultExpiryType, todayIso }) {
  return {
    id: String(item.id || `${Date.now()}-${Math.random()}`),
    name: String(item.name || "").trim(),
    category: item.category || "",
    storage: item.storage || "",
    expiryType: item.expiryType || defaultExpiryType,
    expiry: item.expiry || todayIso(),
    createdAt: item.createdAt || new Date().toISOString()
  };
}

export function familySnapshot(items, options) {
  return JSON.stringify(items.map((item) => cleanItemForFamilySync(item, options)).sort((a, b) => a.id.localeCompare(b.id)));
}

export async function createOrOpenFamilyGroup(code = "") {
  const response = await fetch(FAMILY_GROUP_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(code ? { code } : {})
  });
  if (!response.ok) throw new Error(`family_create_failed_${response.status}`);
  return response.json();
}

export async function fetchFamilyItems(code) {
  const response = await fetch(`${FAMILY_GROUP_ENDPOINT}/${code}/items`);
  if (!response.ok) throw new Error(`family_fetch_failed_${response.status}`);
  return response.json();
}

export async function putFamilyItems(code, items, options) {
  const response = await fetch(`${FAMILY_GROUP_ENDPOINT}/${code}/items`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: items.map((item) => cleanItemForFamilySync(item, options)) })
  });
  if (!response.ok) throw new Error(`family_put_failed_${response.status}`);
  return response.json();
}
