export function parseReceiptLines(text) {
  const seen = new Set();
  return text
    .split(/\n+/)
    .map(cleanReceiptLine)
    .filter((line) => line.length >= 2)
    .filter((line) => {
      const seenKey = line.replace(/\s/g, "").replace(/[ㄱ-ㅎㅏ-ㅣ]/g, "").replace(/\d/g, "").toLowerCase();
      if (seen.has(seenKey)) return false;
      seen.add(seenKey);
      return true;
    })
    .slice(0, 20);
}

function cleanReceiptLine(line) {
  const blockedWords = /(COSTCO|WHOLESALE|코스트코|대표자|대구시|판매|합계|소계|면세|과세|부가세|거래|구매|승인|카드|잔돈|쿠폰|상품 수|REG|PM|VAT|번호)/i;
  let cleaned = line
    .replace(/[|｜]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  cleaned = cleaned
    .replace(/(?<=[가-힣])\s+(?=[가-힣])/g, "")
    .replace(/(?<=[가-힣])\s+(?=\d)/g, "")
    .replace(/(?<=\d)\s+(?=[가-힣A-Za-z])/g, "");

  if (!cleaned || blockedWords.test(cleaned)) return "";
  if (/^\d/.test(cleaned)) return "";
  if (/^\*?\s*CPN$/i.test(cleaned)) return "";
  if (/^[A-Z0-9\s]{6,}$/i.test(cleaned) && !/[가-힣]/.test(cleaned)) return "";
  if (/\d{1,3}\s*,?\d{3}/.test(cleaned)) return "";
  if (/RC$/i.test(cleaned.replace(/\s/g, ""))) return "";

  cleaned = cleaned
    .replace(/\b\d{5,}\b/g, "")
    .replace(/\b\d{1,4}\b(?!\s*(개|g|G|ea|EA|x|X))/g, "")
    .replace(/\b[0-9A-Z]{1,2}\b$/i, "")
    .replace(/[ㄱ-ㅎㅏ-ㅣ]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!/[가-힣A-Za-z]/.test(cleaned)) return "";
  return cleaned.length >= 2 ? cleaned : "";
}
