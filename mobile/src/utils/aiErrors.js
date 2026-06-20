export function aiFallbackCodeFromError(error) {
  if (!error) return "request_failed";
  if (error.code) return error.code;
  if (error.status) return `http_${error.status}`;
  return "request_failed";
}

export function aiFallbackMessage(errorOrCode) {
  const code = typeof errorOrCode === "string" ? errorOrCode : aiFallbackCodeFromError(errorOrCode);
  const status = typeof errorOrCode === "object" && errorOrCode ? errorOrCode.status : 0;

  if (status === 429 || code.includes("429")) {
    return {
      title: "AI 사용량이 잠시 제한됐어요",
      body: "지금은 AI 정리를 바로 쓰기 어려워요. 대신 영수증에서 필요한 줄을 직접 고르는 방식으로 이어갈게요.",
      status: "AI 사용량 제한으로 빠른 추출 방식으로 전환했습니다."
    };
  }

  if (status === 400 || code.includes("400") || code === "invalid_json" || code === "no_lines") {
    return {
      title: "AI가 영수증을 해석하지 못했어요",
      body: "영수증 내용이 부족하거나 형식이 맞지 않았어요. 인식된 OCR 줄에서 직접 상품을 골라주세요.",
      status: "AI 해석 실패로 빠른 추출 방식으로 전환했습니다."
    };
  }

  if (status === 503 || code.includes("503")) {
    return {
      title: "AI 서버가 잠시 불안정해요",
      body: "잠시 후 다시 시도할 수 있어요. 지금은 영수증에서 직접 줄을 고르는 방식으로 이어갈게요.",
      status: "AI 서버 오류로 빠른 추출 방식으로 전환했습니다."
    };
  }

  if (code.includes("gemini_400")) {
    return {
      title: "AI가 결과를 만들지 못했어요",
      body: "이번 영수증은 AI가 상품만 분리하기 어려웠어요. OCR 줄을 직접 선택해서 등록해 주세요.",
      status: "AI 결과 생성 실패로 빠른 추출 방식으로 전환했습니다."
    };
  }

  return {
    title: "AI 정리를 사용할 수 없어요",
    body: "AI 요청이 실패했어요. 대신 영수증에서 필요한 줄을 직접 고르는 방식으로 이어갈게요.",
    status: "AI 요청 실패로 빠른 추출 방식으로 전환했습니다."
  };
}
