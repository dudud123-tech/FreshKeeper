import { getAuthHeaders } from "./authApi";
import { getClientId } from "./clientIdentity";

const WORKER_API_BASE = "https://freshkeeper-ocr-feedback.dndud123.workers.dev/api";
const API_BASE = `${WORKER_API_BASE}/barcode-products`;
const REQUEST_TIMEOUT_MS = 6000;

// 바코드 → 상품 정보 조회.
// { ok, product } 형태로 돌려준다. 예전엔 실패해도 그냥 null을 돌려줬는데,
// 그러면 "등록된 적 없는 바코드"와 "조회 자체가 실패(오프라인/타임아웃/서버오류)"를
// 호출부가 구분할 수 없어서 — 이미 등록해 둔 바코드인데 네트워크가 잠깐 끊기면
// "처음 보는 바코드"로 잘못 안내하는 버그가 있었다(2026-08-08).
//   ok:true,  product:{...} → 등록되어 있음
//   ok:true,  product:null  → 확실히 등록된 적 없음
//   ok:false, product:null  → 조회 실패(등록 여부를 알 수 없음)
export async function lookupBarcodeProduct(barcode) {
  const trimmed = String(barcode || "").trim();
  if (!trimmed) return { ok: false, product: null };

  try {
    const response = await fetchWithTimeout(`${API_BASE}?barcode=${encodeURIComponent(trimmed)}`);
    if (!response.ok) {
      console.warn(`[barcode] lookup failed with status ${response.status}`);
      return { ok: false, product: null };
    }
    const body = await response.json();
    if (!body?.ok) return { ok: false, product: null };
    return { ok: true, product: body.product || null };
  } catch (error) {
    console.warn("[barcode] lookup threw", error?.message);
    return { ok: false, product: null };
  }
}

// 처음 보는 바코드를 사용자가 수동으로 채운 뒤 저장할 때, 다음 스캔부터는
// 다른 사용자도 바로 자동완성되도록 서버에 등록한다.
export async function registerBarcodeProduct({ barcode, name, category, storage, expiryDays }) {
  const trimmedBarcode = String(barcode || "").trim();
  const trimmedName = String(name || "").trim();
  if (!trimmedBarcode || !trimmedName) return { ok: false };

  // getClientId/getAuthHeaders도 try 안에 둔다 — 여기서 하나라도 예외를 던지면
  // fetch 자체가 시작도 안 된 채 등록이 통째로 조용히 실패하고, 다음 스캔에서
  // "처음 보는 바코드" 팝업이 다시 뜨는 버그로 이어진다(2026-08-08 확인).
  try {
    const clientId = await getClientId();
    const authHeaders = await getAuthHeaders();
    const response = await fetchWithTimeout(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({
        clientId,
        barcode: trimmedBarcode,
        name: trimmedName,
        category: category || "",
        storage: storage || "",
        expiryDays: Number.isFinite(expiryDays) ? expiryDays : null
      })
    });
    if (!response.ok) {
      console.warn(`[barcode] register failed with status ${response.status}`);
      return { ok: false };
    }
    return await response.json();
  } catch (error) {
    console.warn("[barcode] register threw", error?.message);
    return { ok: false };
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
