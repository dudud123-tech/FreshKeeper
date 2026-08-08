const WORKER_API_BASE = "https://freshkeeper-ocr-feedback.dndud123.workers.dev/api";
const REQUEST_TIMEOUT_MS = 6000;

// 서버가 정해둔 최소 지원 버전을 확인한다. 실패해도(오프라인, 서버 장애 등)
// null을 돌려준다 — 서버 문제로 앱 전체를 막으면 안 된다(fail open).
export async function fetchAndroidVersionRequirement() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${WORKER_API_BASE}/app-version`, { signal: controller.signal });
    if (!response.ok) return null;
    const body = await response.json();
    return body?.android || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
