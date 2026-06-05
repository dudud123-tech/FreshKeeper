export function labelForAiProvider(provider) {
  if (provider === "gemini-proxy") return "Gemini";
  if (provider === "workers-ai") return "Cloudflare Workers AI";
  if (provider === "local-rules") return "기본 규칙";
  return provider || "알 수 없음";
}

export function labelForAiFallback(fallbackFrom) {
  if (!fallbackFrom) return "";
  if (fallbackFrom === "gemini_503") return "Gemini 과부하로 예비 분석 사용";
  if (fallbackFrom === "gemini_429") return "Gemini 사용량 제한으로 예비 분석 사용";
  if (fallbackFrom.startsWith("gemini_")) return "Gemini 실패로 예비 분석 사용";
  if (fallbackFrom === "unauthorized") return "프록시 인증 실패로 예비 분석 사용";
  if (fallbackFrom === "no_ai_credit") return "AI 사용권이 없어 기본 추출 사용";
  if (fallbackFrom === "request_failed") return "AI 요청 실패로 기본 추출 사용";
  return `${fallbackFrom} 후 예비 분석 사용`;
}
