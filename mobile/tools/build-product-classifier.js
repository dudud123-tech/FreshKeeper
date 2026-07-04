const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SOURCE_PATH = path.join(__dirname, "food-safety-api-data", "food-safety-i1250-master.json");
const OUTPUT_PATH = path.join(ROOT, "src", "data", "productClassifier.json");

const CATEGORY_DAYS = {
  "유제품": 7,
  "육류/생선": 3,
  "채소/과일": 5,
  "신선식품": 3,
  "냉동식품": 90,
  "가공식품": 30,
  "건어물/건조식품": 365,
  "소스류": 90,
  "음료": 14,
  "간식": 30,
  "약": 180,
  "기타": 7
};

const TYPE_RULES = [
  rule("유제품", "냉장", 7, ["우유", "발효유", "치즈", "버터", "크림", "유가공"]),
  rule("육류/생선", "냉장", 3, ["식육", "축산", "햄", "소시지", "베이컨", "어육", "연육", "수산", "젓갈"]),
  rule("음료", "실온", 14, ["과.채음료", "과.채주스", "음료", "주스", "액상차", "침출차", "커피", "탄산", "차", "주류", "탁주", "리큐르"]),
  rule("채소/과일", "냉장", 5, ["과.채", "농산", "서류가공품", "두류가공품"]),
  rule("신선식품", "냉장", 3, ["즉석섭취식품", "즉석조리식품", "신선편의식품", "간편조리세트", "김밥", "샌드위치", "묵류", "두부"]),
  rule("냉동식품", "냉동", 90, ["만두", "빙과", "아이스크림", "냉동", "피자", "핫도그"]),
  rule("건어물/건조식품", "실온", 365, ["조미김", "가공김", "건어포", "조미건어포", "건면", "미역", "다시마"]),
  rule("소스류", "실온", 90, ["소스", "조미", "장", "고추장", "된장", "간장", "케첩", "마요네즈", "식초", "참기름", "들기름", "물엿", "올리고당", "향신료", "카레"]),
  rule("간식", "실온", 30, ["과자", "빵류", "떡류", "캔디", "초콜릿", "준초콜릿", "잼", "당류", "시리얼", "젤리", "빙과"]),
  rule("약", "실온", 180, ["건강기능식품", "영양", "환자용", "체중조절", "식단형"]),
  rule("가공식품", "실온", 30, ["곡류가공품", "기타가공품", "기타 농산가공품", "김치", "절임", "면", "유탕면", "전분", "밀가루", "가공두부", "어묵", "통조림"])
];

const NAME_PRIORITY_RULES = [
  rule("신선식품", "냉장", 21, ["동물복지란", "동물복지계란", "유정란", "반숙란", "구운란", "특란", "대란", "왕란"]),
  rule("냉동식품", "냉동", 90, ["냉동", "아이스크림", "빙과", "만두", "피자", "핫도그", "돈까스", "돈가스", "볶음밥", "솥밥"]),
  rule("신선식품", "냉장", 3, ["샌드위치", "김밥", "도시락", "초밥", "샐러드", "도토리묵", "묵", "미역줄기"]),
  rule("건어물/건조식품", "실온", 365, ["자른미역", "건미역", "미역", "다시마", "김자반", "조미김", "구운김", "멸치", "건새우", "진미채"]),
  rule("소스류", "실온", 90, ["소스", "케첩", "케찹", "마요네즈", "고추장", "된장", "쌈장", "간장", "참기름", "들기름", "올리고당", "물엿", "연두"]),
  rule("채소/과일", "냉장", 5, ["청경채", "청양고추", "미나리", "부추", "우엉", "봄동", "시래기", "시레기", "애호박"]),
  rule("육류/생선", "냉장", 3, ["한돈", "돼지고기", "돈육", "한우", "소고기", "쇠고기", "닭고기", "닭가슴살", "생선", "고등어", "새우", "오징어"]),
  rule("유제품", "냉장", 7, ["우유", "요거트", "요구르트", "치즈", "버터", "생크림"])
];

main();

function main() {
  if (!fs.existsSync(SOURCE_PATH)) {
    throw new Error(`source file not found: ${SOURCE_PATH}`);
  }

  const source = JSON.parse(fs.readFileSync(SOURCE_PATH, "utf8"));
  const rows = Array.isArray(source.rows) ? source.rows : [];
  const productRules = [];
  const typeSummary = new Map();
  const seen = new Set();

  for (const row of rows) {
    const productName = cleanText(row.PRDLST_NM);
    const normalizedName = normalize(productName);
    if (normalizedName.length < 3) continue;

    const typeName = cleanText(row.PRDLST_DCNM);
    const inferred = inferRule(productName, typeName);
    const key = `${normalizedName}|${typeName}|${inferred.category}`;
    if (seen.has(key)) continue;
    seen.add(key);

    productRules.push({
      n: normalizedName,
      name: productName,
      type: typeName,
      category: inferred.category,
      storage: inferred.storage,
      days: inferred.days,
      sourceKeyword: cleanText(row.sourceKeyword),
      reportNo: cleanText(row.PRDLST_REPORT_NO)
    });

    const summaryKey = typeName || "(unknown)";
    const summary = typeSummary.get(summaryKey) || {
      type: summaryKey,
      count: 0,
      category: inferred.category,
      storage: inferred.storage,
      days: inferred.days
    };
    summary.count += 1;
    typeSummary.set(summaryKey, summary);
  }

  productRules.sort((a, b) => b.n.length - a.n.length || a.name.localeCompare(b.name, "ko"));

  const payload = {
    generatedAt: new Date().toISOString(),
    source: "FoodSafetyKorea I1250",
    sourceRowCount: rows.length,
    productRuleCount: productRules.length,
    typeRuleCount: typeSummary.size,
    minMatchLength: 3,
    typeRules: [...typeSummary.values()].sort((a, b) => b.count - a.count || a.type.localeCompare(b.type, "ko")),
    productRules
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`created: ${OUTPUT_PATH}`);
  console.log(`productRules: ${payload.productRuleCount}`);
  console.log(`typeRules: ${payload.typeRuleCount}`);
}

function rule(category, storage, days, words) {
  return { category, storage, days, words };
}

function inferRule(productName, typeName) {
  const haystack = normalize(`${productName} ${typeName}`);

  for (const item of NAME_PRIORITY_RULES) {
    if (matches(haystack, item.words)) return pick(item);
  }

  for (const item of TYPE_RULES) {
    if (matches(haystack, item.words)) return pick(item);
  }

  return {
    category: "기타",
    storage: "냉장",
    days: CATEGORY_DAYS["기타"]
  };
}

function pick(item) {
  return {
    category: item.category,
    storage: item.storage,
    days: item.days || CATEGORY_DAYS[item.category] || CATEGORY_DAYS["기타"]
  };
}

function matches(normalizedText, words) {
  return words.some((word) => normalizedText.includes(normalize(word)));
}

function cleanText(value) {
  return String(value || "").trim();
}

function normalize(value) {
  return cleanText(value).replace(/\s/g, "").toLowerCase();
}
