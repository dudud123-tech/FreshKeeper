const OCR_FEEDBACK_ENDPOINT = "https://freshkeeper-ocr-feedback.dndud123.workers.dev/api/ocr-feedback";

export function maskFeedbackText(text) {
  return text
    .replace(/\b\d{2,3}-\d{2,4}-\d{4}\b/g, "[PHONE]")
    .replace(/\b\d{3}-\d{2}-\d{5}\b/g, "[BIZ_NO]")
    .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, "[CARD]")
    .replace(/\b\d{8,}\b/g, "[NUMBER]")
    .replace(/\b20\d{2}[-./년\s]?\d{1,2}[-./월\s]?\d{1,2}일?\b/g, "[DATE]");
}

export function buildOcrFeedbackPayload({ appVersion, lines, selectedIds }) {
  const selectedIdSet = new Set(selectedIds);
  return {
    appVersion,
    parserVersion: "rules-v1",
    deviceLocale: "ko-KR",
    storeHint: "",
    ocrLines: lines.map((line) => ({
      text: maskFeedbackText(line.text || ""),
      selected: selectedIdSet.has(line.id),
      box: line.box || null
    }))
  };
}

export function feedbackFingerprint(payload) {
  return JSON.stringify(payload.ocrLines.map((line) => [line.text, line.selected ? 1 : 0, line.box?.x ?? null, line.box?.y ?? null]));
}

export async function sendOcrFeedback(payload) {
  const response = await fetch(OCR_FEEDBACK_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`feedback_upload_failed_${response.status}`);
  }

  return response.json();
}
