export function labelForAiProvider(provider) {
  if (provider === "gemini-proxy") return "Gemini";
  if (provider === "workers-ai") return "Cloudflare Workers AI";
  if (provider === "local-rules") return "기본 규칙";
  return provider || "알 수 없음";
}

export function labelForAiFallback(fallbackFrom) {
  if (!fallbackFrom) return "";
  if (fallbackFrom.includes("503")) return "AI 서버 오류로 빠른 추출 사용";
  if (fallbackFrom.includes("429")) return "AI 사용량 제한으로 빠른 추출 사용";
  if (fallbackFrom.includes("400")) return "AI 해석 실패로 빠른 추출 사용";
  if (fallbackFrom.startsWith("gemini_")) return "Gemini 실패로 예비 분석 사용";
  if (fallbackFrom.startsWith("gemini_proxy_")) return "Gemini 실패로 빠른 추출 사용";
  if (fallbackFrom.startsWith("http_")) return "AI 요청 실패로 빠른 추출 사용";
  if (fallbackFrom === "unauthorized") return "프록시 인증 실패로 예비 분석 사용";
  if (fallbackFrom === "no_ai_credit") return "AI 사용권이 없어 기본 추출 사용";
  if (fallbackFrom === "request_failed") return "AI 요청 실패로 기본 추출 사용";
  return `${fallbackFrom} 후 예비 분석 사용`;
}
