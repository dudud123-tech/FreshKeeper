import { getAuthHeaders } from "./authApi";

const GROWTH_ENDPOINT = "https://freshkeeper-ocr-feedback.dndud123.workers.dev/api/growth";

export async function fetchGrowthProfile() {
  const response = await fetch(`${GROWTH_ENDPOINT}/profile`, {
    headers: await getAuthHeaders()
  });
  if (!response.ok) throw new Error(`growth_profile_failed_${response.status}`);
  return response.json();
}

export async function fetchGrowthReport() {
  const response = await fetch(`${GROWTH_ENDPOINT}/report`, {
    headers: await getAuthHeaders()
  });
  if (!response.ok) throw new Error(`growth_report_failed_${response.status}`);
  return response.json();
}

export async function putGrowthEvents(events) {
  const response = await fetch(`${GROWTH_ENDPOINT}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...await getAuthHeaders() },
    body: JSON.stringify({ events })
  });
  if (!response.ok) throw new Error(`growth_events_failed_${response.status}`);
  return response.json();
}
