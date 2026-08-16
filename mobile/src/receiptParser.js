const MAX_CANDIDATES = 20;
const MIN_SCORE = 3;

const noiseWords = [
  "대표",
  "대표자",
  "사업자",
  "주소",
  "전화",
  "tel",
  "매장",
  "영수증",
  "주문내역",
  "교환",
  "환불",
  "고객",
  "센터",
  "문의",
  "포인트",
  "멤버",
  "적립",
  "쿠폰",
  "행사",
  "행사상품",
  "에누리",
  "면세",
  "과세",
  "부가세",
  "합계",
  "상품명",
  "단가",
  "수량",
  "금액",
  "단가수량금액",
  "총품목수량",
  "총판매상품수",
  "소계",
  "총액",
  "결제",
  "승인",
  "카드",
  "현금",
  "잔돈",
  "거스름",
  "할인",
  "봉투",
  "바코드",
  "barcode",
  "pos",
  "reg",
  "vat",
  "costco",
  "whole sale",
  "wholesale",
  "다이소",
  "이마트",
  "홈플러스",
  "롯데마트",
  "청바지",
  "의류",
  "양말",
  "수건",
  "문구",
  "완구",
  "건전지",
  "충전기",
  "케이블",
  "샛별배송",
  "품절",
  "반품",
  "주문번호",
  "배송완료",
  "배송조회",
  "배송주문관리",
  "바로구매",
  "장바구니",
  "전체상품장바구니담기",
  "주문한상품",
  "로켓프레시",
  "후기작성",
  "전체상품다시담기",
  "주문상품",
  // 쿠팡 앱이 아니라 쿠팡 모바일 웹(mc.coupang.com/ssr/mobile/order/list)으로 열렸을
  // 때만 보이는 하단 내비게이션/헤더 문구. 앱 전용 문구와 어휘가 달라서 기존 목록엔
  // 없었다(2026-08-15, "쿠팡 주문내역 바로가기"가 앱 대신 브라우저로 열려서 처음 발견됨).
  "쿠팡홈",
  "마이쿠팡",
  "카테고리",
  "검색",
  "화장품",
  "샴푸",
  "헤어린스",
  "세제",
  "표백제",
  "섬유유연제",
  "방향제",
  "탈취제",
  "락스",
  "청소포",
  "청소솔",
  "휴지",
  "물티슈",
  "키친타월",
  "마스크",
  "생리대",
  "기저귀",
  "칫솔",
  "치약",
  "비누",
  "바디워시",
  "화장지",
  "배송비",
  "배송료",
  "택배비",
  "배달비",
  "배달팁",
  "수세미",
  "고무장갑",
  "위생장갑",
  "지퍼백",
  "호일",
  "종이컵",
  "종이접시",
  "냄비",
  "프라이팬",
  "도마",
  "국자",
  "뒤집개",
  "밀폐용기",
  "텀블러",
  "보온병",
  "청소기",
  "걸레",
  "빗자루",
  "쓰레기봉투",
  "종량제봉투",
  "손소독제",
  "면봉",
  "반창고",
  "감기약",
  "소화제",
  "파스",
  "샤워타월",
  "때수건",
  "신발",
  "슬리퍼",
  "우산",
  "장갑",
  "사료",
  "배변패드",
  "고양이모래",
  "화분",
  "비료",
  "워셔액",
  "세차",
  "도서",
  "잡지",
  "커튼",
  "러그",
  "핫팩",
  "손난로",
  "배송",
  "택배",
  "포장비",
  "서비스요금",
  "봉사료",
  "부가가치세"
];

const noisePatterns = [
  /정상상품.*신선\s*7\s*일/i,
  /\[?\s*구\s*매\s*\]?/i,
  /발행\s*일/i,
  /할부\s*거래/i,
  /약관\s*보기/i,
  /차량\s*번호/i,
  /출차/i,
  /일시\s*불/i,
  /브랜드\s*매장/i,
  /매장\s*고지/i,
  /물참조/i,
  /^CPN$/i,
  /^SCO\s*:/i,
  /균일가\s*\d+\s*원/i,
  /총\s*\d+\s*건/,
  /주문\s*(접기|펼치기)/,
  /상품\s*(모두)?\s*보기/
];

const foodHints = [
  "우유",
  "두유",
  "요거트",
  "요구르트",
  "치즈",
  "버터",
  "크림",
  "계란",
  "달걀",
  "고기",
  "한우",
  "소고기",
  "쇠고기",
  "돼지",
  "돈육",
  "닭",
  "생선",
  "연어",
  "참치",
  "고등어",
  "사과",
  "바나나",
  "딸기",
  "토마토",
  "상추",
  "양파",
  "감자",
  "고구마",
  "당근",
  "오이",
  "샐러드",
  "생수",
  "탄산수",
  "먹는샘물",
  "라면",
  "햇반",
  "김치",
  "두부",
  "소스",
  "참기름",
  "통조림",
  "스팸",
  "어묵",
  "커피",
  "주스",
  "콜라",
  "사이다",
  "음료",
  "과자",
  "초콜릿",
  "쿠키",
  "빵",
  "케이크",
  "젤리",
  "프로즌",
  "냉동",
  "만두",
  "피자"
];

export function parseReceiptLines(text) {
  const normalizedLines = text
    .split(/\n+/)
    .map((line, index) => ({ index, raw: line, normalized: normalizeLine(line) }))
    .filter((line) => line.normalized);
  const isKurlyOrder = normalizedLines.some((line) =>
    /(샛별배송|전체\s*상품\s*다시\s*담기|후기\s*작성)/.test(line.normalized)
  );
  const lines = isKurlyOrder
    ? normalizedLines.filter((line, index, allLines) => !isKurlySubtitleLine(line, allLines[index - 1]))
    : normalizedLines;

  const scored = lines
    .map((line, index, allLines) => scoreLine(line, index, allLines.length))
    .filter((candidate) => candidate.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  return dedupeCandidates(scored)
    .sort((a, b) => a.index - b.index)
    .map((candidate) => candidate.name)
    .slice(0, MAX_CANDIDATES);
}

// 네이티브(OpenCV) 상품 사진 매칭은 썸네일 옆 줄을 좌표만 보고 고르기 때문에 가격 줄을
// 상품명으로 오인해 그대로 후보로 만들 수 있다. 그런 후보를 JS 파서 기준으로 다시 검증한다.
export function isProductNameCandidate(text) {
  return parseReceiptLines(String(text || "")).length > 0;
}

function scoreLine(line, visualIndex, totalLines) {
  const original = line.normalized;
  const compact = original.replace(/\s/g, "");
  const cleaned = cleanProductName(original);
  let score = 0;

  if (!cleaned) return { ...line, name: "", score: -10 };
  if (isPriceOnlyLine(original)) return { ...line, name: "", score: -10 };
  if (isNoiseLine(original) || isNoiseLine(cleaned)) score -= 8;
  if (hasPricePattern(original)) score += 4;
  if (hasQuantityPattern(original)) score += 1;
  if (foodHints.some((word) => compact.toLowerCase().includes(word.toLowerCase()))) score += 3;
  if (/[가-힣]/.test(cleaned)) score += 2;
  if (/[A-Za-z]/.test(cleaned)) score += 1;
  if (cleaned.length >= 3 && cleaned.length <= 28) score += 2;
  if (cleaned.length > 36) score -= 3;
  if (isMostlyDigits(cleaned)) score -= 8;
  if (isCodeLike(cleaned)) score -= 6;
  if (/^\d/.test(cleaned)) score -= 4;
  if (/RC$/i.test(cleaned.replace(/\s/g, ""))) score -= 2;
  if (visualIndex < Math.max(2, totalLines * 0.08)) score -= 1;
  if (isAfterPaymentArea(original)) score -= 6;

  return {
    ...line,
    name: cleaned,
    score
  };
}

function dedupeCandidates(candidates) {
  const seen = [];
  const results = [];

  for (const candidate of candidates) {
    const key = candidateKey(candidate.name);

    if (!key) continue;
    const duplicateIndex = seen.findIndex((previousKey) => isNearDuplicateKey(previousKey, key));
    if (duplicateIndex >= 0) {
      if (candidate.index < results[duplicateIndex].index) {
        seen[duplicateIndex] = key;
        results[duplicateIndex] = candidate;
      }
      continue;
    }
    seen.push(key);
    results.push(candidate);
  }

  return results;
}

function isKurlySubtitleLine(line, previousLine) {
  if (!previousLine) return false;
  if (hasPricePattern(previousLine.normalized) || hasPricePattern(line.normalized)) return false;
  const previousBrand = previousLine.normalized.match(/^\[([^\]]{1,20})\]/)?.[1];
  const currentBrand = line.normalized.match(/^\[([^\]]{1,20})\]/)?.[1];
  return Boolean(previousBrand && currentBrand && previousBrand === currentBrand);
}

function candidateKey(value) {
  return value
    .replace(/\s/g, "")
    .replace(/(?:IRC|RC)$/i, "")
    .replace(/[ㄱ-ㅎㅏ-ㅣ]/g, "")
    .replace(/\d+(g|G|kg|KG|ml|ML|개|입|종|팩|봉|ea|EA|x|X)?/g, "")
    .replace(/[()[\].,\-]/g, "")
    .replace(/택$/g, "")
    .toLowerCase();
}

function isNearDuplicateKey(a, b) {
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  if (shorter.length < 5) return false;
  return longer.includes(shorter) && shorter.length / longer.length >= 0.68;
}

function cleanProductName(line) {
  let cleaned = normalizeLine(line)
    .replace(/^\[[0-9A-Z-]+\]\s*/i, "")
    .replace(/\[[0-9A-Z-]+\]/gi, "")
    .replace(/\b\d{8,}\b/g, "")
    .replace(/\s+\d{1,3}(?:,\d{3})+(?:\s+\d+)?(?:\s+\d{1,3}(?:,\d{3})+)?\s*$/g, "")
    .replace(/\s+\d+\s*[xX]\s*\d{1,3}(?:,\d{3})+\s*$/g, "")
    .replace(/\s+\d{1,3}(?:,\d{3})+\s*원?\s*$/g, "")
    .replace(/\s+\d+\s*원\s*$/g, "")
    .replace(/\s+[-−]\d[\d,]*\s*원?\s*$/g, "")
    .replace(/(?<=[가-힣])\s+(?=[가-힣])/g, "")
    .replace(/(?<=[가-힣])\s+(?=\d)/g, "")
    .replace(/(?<=\d)\s+(?=[가-힣A-Za-z])/g, "")
    .replace(/\b[0-9A-Z]{1,2}\b$/i, "")
    .replace(/\s*(?:IRC|RC)\s*$/i, "")
    .replace(/[ㄱ-ㅎㅏ-ㅣ]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  cleaned = cleaned.replace(/^\*+/, "").replace(/\*+$/, "").trim();
  if (!/[가-힣A-Za-z]/.test(cleaned)) return "";
  return cleaned;
}

function normalizeLine(line) {
  return line
    .replace(/[|｜]/g, " ")
    .replace(/[^\p{L}\p{N}\s.,:/()[\]\-*]/gu, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function hasPricePattern(line) {
  return /\d{1,3}(?:,\d{3})+/.test(line) || /\d+\s*원/.test(line);
}

function hasQuantityPattern(line) {
  return /\d+\s*(개|입|봉|팩|g|G|kg|KG|ml|ML|L|ea|EA|x|X)/.test(line);
}

function isNoiseLine(line) {
  const lowered = line.toLowerCase().replace(/\s/g, "");
  return (
    noiseWords.some((word) => lowered.includes(word.toLowerCase().replace(/\s/g, ""))) ||
    noisePatterns.some((pattern) => pattern.test(line)) ||
    /^\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}/.test(line) ||
    /^\d{2}:\d{2}/.test(line) ||
    /^[\d\s,.:()[\]\-]+$/.test(line)
  );
}

function isAfterPaymentArea(line) {
  return /(합계|결제|승인|카드|현금|잔돈|거스름|부가\s*세|과세|면세)/i.test(line);
}

// "6,500원 1개", "9,765원 10,500원 1개"처럼 가격과 수량만 있는 줄은 상품명이 아니다.
// cleanProductName의 가격 제거 정규식들은 가격이 줄 "끝"에 붙어 있는 경우만 처리하므로
// 줄 전체가 가격인 경우는 그대로 통과해 버린다. 그런 줄을 여기서 명시적으로 걸러낸다.
function isPriceOnlyLine(line) {
  const withoutPriceAndQuantity = line
    .replace(/\s/g, "")
    .replace(/\d{1,3}(?:,\d{3})+\s*원?/g, "")
    .replace(/\d+\s*원/g, "")
    .replace(/\d+\s*(개|입|팩|봉|병|캔|매|장|줄|박스|세트|종)/g, "")
    .replace(/[()[\].,\-·]/g, "");
  return !/[가-힣A-Za-z]{2,}/.test(withoutPriceAndQuantity);
}

function isMostlyDigits(line) {
  const compact = line.replace(/\s/g, "");
  if (!compact) return true;
  const digits = compact.replace(/\D/g, "").length;
  return digits / compact.length > 0.6;
}

function isCodeLike(line) {
  const compact = line.replace(/\s/g, "");
  return /^[A-Z0-9-]{4,}$/i.test(compact) && !/[가-힣]/.test(compact);
}
