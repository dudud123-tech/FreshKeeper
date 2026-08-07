import * as ImageManipulator from "expo-image-manipulator";
import { getAuthHeaders } from "./authApi";

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
    createdAt: item.createdAt || new Date().toISOString(),
    status: item.status === "completed" ? "completed" : "active",
    completedAt: item.status === "completed" ? item.completedAt || "" : "",
    favorite: Boolean(item.favorite),
    purchaseUrl: item.purchaseUrl || ""
  };
}

export function familySnapshot(items, options) {
  return JSON.stringify(items.map((item) => ({
    ...cleanItemForFamilySync(item, options),
    imageSyncKey: item.imageUri || "",
    uploadedImageSource: item.familyImageSourceUri || ""
  })).sort((a, b) => a.id.localeCompare(b.id)));
}

export async function createOrOpenFamilyGroup(code = "", consentAccepted = false) {
  const response = await fetch(FAMILY_GROUP_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...await getAuthHeaders() },
    body: JSON.stringify({ ...(code ? { code } : {}), consentAccepted })
  });
  if (!response.ok) throw new Error(`family_create_failed_${response.status}`);
  return response.json();
}

export async function fetchFamilyItems(code) {
  const response = await fetch(`${FAMILY_GROUP_ENDPOINT}/${code}/items`, {
    headers: await getAuthHeaders()
  });
  if (!response.ok) throw await familyResponseError(response, "family_fetch_failed");
  return response.json();
}

export async function fetchFamilyMembers(code) {
  const response = await fetch(`${FAMILY_GROUP_ENDPOINT}/${code}/members`, {
    headers: await getAuthHeaders()
  });
  if (!response.ok) throw await familyResponseError(response, "family_members_failed");
  return response.json();
}

export async function fetchFamilyJoinRequests(code) {
  const response = await fetch(`${FAMILY_GROUP_ENDPOINT}/${code}/join-requests`, {
    headers: await getAuthHeaders()
  });
  if (!response.ok) throw await familyResponseError(response, "family_join_requests_failed");
  return response.json();
}

export async function fetchMyFamilyJoinRequest(code) {
  const response = await fetch(`${FAMILY_GROUP_ENDPOINT}/${code}/join-requests/me`, {
    headers: await getAuthHeaders()
  });
  if (!response.ok) throw await familyResponseError(response, "family_join_request_status_failed");
  return response.json();
}

export async function decideFamilyJoinRequest(code, accountId, action) {
  const response = await fetch(
    `${FAMILY_GROUP_ENDPOINT}/${code}/join-requests/${encodeURIComponent(accountId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...await getAuthHeaders() },
      body: JSON.stringify({ action })
    }
  );
  if (!response.ok) throw await familyResponseError(response, "family_join_request_decision_failed");
  return response.json();
}

export async function putFamilyItems(code, items, options, expectedUpdatedAt = "") {
  const response = await fetch(`${FAMILY_GROUP_ENDPOINT}/${code}/items`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...await getAuthHeaders() },
    body: JSON.stringify({
      items: items.map((item) => cleanItemForFamilySync(item, options)),
      expectedUpdatedAt
    })
  });
  if (!response.ok) {
    let body = {};
    try {
      body = await response.json();
    } catch {
      body = {};
    }
    throw new Error(body.error || `family_put_failed_${response.status}`);
  }
  return response.json();
}

export async function uploadFamilyItemImage(code, item) {
  if (!item?.imageUri || /^https?:\/\//i.test(item.imageUri)) return null;
  let compressed = await ImageManipulator.manipulateAsync(
    item.imageUri,
    [{ resize: { width: 640 } }],
    { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
  );
  let blob = await (await fetch(compressed.uri)).blob();
  if (blob.size > 350 * 1024) {
    compressed = await ImageManipulator.manipulateAsync(
      item.imageUri,
      [{ resize: { width: 480 } }],
      { compress: 0.35, format: ImageManipulator.SaveFormat.JPEG }
    );
    blob = await (await fetch(compressed.uri)).blob();
  }
  if (blob.size > 350 * 1024) throw new Error("family_image_too_large");

  const response = await fetch(
    `${FAMILY_GROUP_ENDPOINT}/${code}/items/${encodeURIComponent(item.id)}/image`,
    {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg", ...await getAuthHeaders() },
      body: blob
    }
  );
  if (!response.ok) throw new Error(`family_image_upload_failed_${response.status}`);
  return response.json();
}

export async function leaveFamilyGroup(code) {
  const response = await fetch(`${FAMILY_GROUP_ENDPOINT}/${code}/members/me`, {
    method: "DELETE",
    headers: await getAuthHeaders()
  });
  if (!response.ok) throw await familyResponseError(response, "family_leave_failed");
  return response.json();
}

export async function deleteFamilyGroup(code) {
  const response = await fetch(`${FAMILY_GROUP_ENDPOINT}/${code}`, {
    method: "DELETE",
    headers: await getAuthHeaders()
  });
  if (!response.ok) throw await familyResponseError(response, "family_delete_failed");
  return response.json();
}

export async function removeFamilyMember(code, accountId) {
  const response = await fetch(`${FAMILY_GROUP_ENDPOINT}/${code}/members/${encodeURIComponent(accountId)}`, {
    method: "DELETE",
    headers: await getAuthHeaders()
  });
  if (!response.ok) throw await familyResponseError(response, "family_member_remove_failed");
  return response.json();
}

async function familyResponseError(response, fallback) {
  try {
    const body = await response.json();
    return new Error(body?.error || `${fallback}_${response.status}`);
  } catch {
    return new Error(`${fallback}_${response.status}`);
  }
}
