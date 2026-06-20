const RECEIPT_CANDIDATE_ENDPOINT = "https://freshkeeper-ocr-feedback.dndud123.workers.dev/api/receipt-candidates";

export class ReceiptAiError extends Error {
  constructor(message, { status = 0, code = "", detail = "", requestId = "" } = {}) {
    super(message);
    this.name = "ReceiptAiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.requestId = requestId;
  }
}

export function mergeReceiptCandidates(primaryCandidates, fallbackCandidates = []) {
  const seen = new Set();
  const results = [];

  [...primaryCandidates, ...fallbackCandidates].forEach((name) => {
    const normalized = String(name || "").trim();
    const key = normalized.replace(/\s/g, "").toLowerCase();
    if (!normalized || seen.has(key)) return;
    seen.add(key);
    results.push(normalized);
  });

  return results.slice(0, 30);
}

export async function requestAiReceiptCandidates({ lines, localCandidates, appVersion }) {
  const response = await fetch(RECEIPT_CANDIDATE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      appVersion,
      localCandidates,
      lines: lines.map((line, index) => ({
        index,
        text: line.text || ""
      }))
    })
  });

  if (!response.ok) {
    let errorBody = {};
    try {
      errorBody = await response.json();
    } catch {
      errorBody = {};
    }
    const code = errorBody.error || `http_${response.status}`;
    throw new ReceiptAiError(`ai_receipt_candidates_failed_${response.status}`, {
      status: response.status,
      code,
      detail: errorBody.detail || "",
      requestId: errorBody.requestId || ""
    });
  }

  const result = await response.json();
  if (!result.ok || !Array.isArray(result.candidates)) {
    return {
      names: [],
      candidates: [],
      meta: {
        ok: Boolean(result.ok),
        requestId: result.requestId || "",
        provider: result.provider || "",
        model: result.model || "",
        fallbackFrom: result.fallbackFrom || "",
        error: result.error || ""
      }
    };
  }

  const candidates = result.candidates
    .map((candidate) => ({
      name: String(candidate?.name || "").trim(),
      confidence: typeof candidate?.confidence === "number" ? candidate.confidence : null,
      reason: String(candidate?.reason || "").trim()
    }))
    .filter((candidate) => candidate.name);

  return {
    names: candidates.map((candidate) => candidate.name),
    candidates,
    meta: {
      ok: true,
      requestId: result.requestId || "",
      provider: result.provider || "",
      model: result.model || "",
      fallbackFrom: result.fallbackFrom || "",
      error: ""
    }
  };
}
