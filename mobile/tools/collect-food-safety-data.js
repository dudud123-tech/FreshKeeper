const fs = require("fs");
const path = require("path");

const SERVICE_ID = "I1250";
const API_BASE = "http://openapi.foodsafetykorea.go.kr/api";
const ROOT = path.resolve(__dirname, "..");
const KEY_PATH = path.resolve(__dirname, "인증키.txt");
const OUT_DIR = path.resolve(__dirname, "food-safety-api-data");

const DEFAULT_KEYWORDS = [
  "우유",
  "멸균우유",
  "요거트",
  "요구르트",
  "치즈",
  "모짜렐라",
  "크림치즈",
  "버터",
  "생크림",
  "계란",
  "달걀",
  "두부",
  "순두부",
  "연두부",
  "콩나물",
  "숙주",
  "돼지고기",
  "한돈",
  "삼겹살",
  "목살",
  "갈비",
  "소고기",
  "한우",
  "불고기",
  "닭고기",
  "닭가슴살",
  "닭다리",
  "오리",
  "햄",
  "소시지",
  "베이컨",
  "생선",
  "고등어",
  "연어",
  "참치",
  "갈치",
  "조기",
  "명태",
  "멸치",
  "새우",
  "오징어",
  "낙지",
  "전복",
  "조개",
  "상추",
  "깻잎",
  "시금치",
  "청경채",
  "미나리",
  "청양고추",
  "양파",
  "마늘",
  "고추",
  "부추",
  "버섯",
  "애호박",
  "오이",
  "당근",
  "감자",
  "고구마",
  "대파",
  "무",
  "배추",
  "양배추",
  "브로콜리",
  "봄동",
  "우엉",
  "시래기",
  "나물",
  "사과",
  "바나나",
  "딸기",
  "토마토",
  "포도",
  "복숭아",
  "귤",
  "오렌지",
  "키위",
  "수박",
  "참외",
  "배",
  "블루베리",
  "샌드위치",
  "김밥",
  "라면",
  "국수",
  "파스타",
  "당면",
  "햇반",
  "즉석밥",
  "쌀",
  "현미",
  "귀리",
  "죽",
  "만두",
  "볶음밥",
  "냉동밥",
  "돈까스",
  "치킨",
  "피자",
  "핫도그",
  "떡볶이",
  "어묵",
  "유부",
  "묵",
  "도토리묵",
  "아이스크림",
  "미역",
  "미역줄기",
  "김",
  "김자반",
  "다시마",
  "젓갈",
  "명란",
  "새우젓",
  "김치",
  "참깨",
  "볶음참깨",
  "들깨",
  "고추장",
  "된장",
  "쌈장",
  "간장",
  "소스",
  "굴소스",
  "돈까스소스",
  "스테이크소스",
  "초장",
  "케첩",
  "마요네즈",
  "드레싱",
  "식초",
  "참기름",
  "들기름",
  "올리고당",
  "물엿",
  "설탕",
  "원당",
  "소금",
  "후추",
  "꿀",
  "잼",
  "주스",
  "음료",
  "탄산",
  "커피",
  "차",
  "과자",
  "스낵",
  "쿠키",
  "초콜릿",
  "사탕",
  "젤리",
  "빵",
  "케이크",
  "시리얼",
  "그래놀라",
  "밀가루",
  "부침가루",
  "튀김가루",
  "카레",
  "짜장"
];

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

async function main() {
  const options = parseArgs(process.argv.slice(2));

  fs.mkdirSync(OUT_DIR, { recursive: true });

  if (options.mergeOnly) {
    const master = writeMasterFromHistory();
    console.log(`누적 파일 생성 완료: ${master.rows.length}건`);
    console.log(master.jsonPath);
    console.log(master.csvPath);
    return;
  }

  const apiKey = readApiKey();
  const keywords = getKeywords(options).slice(0, options.maxKeywords);

  const startedAt = new Date();
  const rows = [];
  const errors = [];
  const seen = new Set();

  console.log(`식품안전나라 ${SERVICE_ID} 수집 시작`);
  console.log(`키워드 ${keywords.length}개, 키워드당 최대 ${options.limit}건, 범위 ${options.start}~${options.end}`);

  for (let index = 0; index < keywords.length; index += 1) {
    const keyword = keywords[index];
    try {
      const resultRows = await fetchKeyword(apiKey, keyword, options);
      let added = 0;
      for (const row of resultRows) {
        const key = [
          row.PRDLST_REPORT_NO || "",
          row.PRDLST_NM || "",
          row.BSSH_NM || ""
        ].join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({ sourceKeyword: keyword, ...row });
        added += 1;
      }
      console.log(`[${index + 1}/${keywords.length}] ${keyword}: ${resultRows.length}건, 신규 ${added}건`);
    } catch (error) {
      errors.push({ keyword, error: error.message || String(error) });
      console.log(`[${index + 1}/${keywords.length}] ${keyword}: 실패 (${error.message || error})`);
    }
    await sleep(options.delayMs);
  }

  const timestamp = formatTimestamp(startedAt);
  const jsonPath = path.join(OUT_DIR, `food-safety-i1250-${timestamp}.json`);
  const csvPath = path.join(OUT_DIR, `food-safety-i1250-${timestamp}.csv`);
  const latestJsonPath = path.join(OUT_DIR, "food-safety-i1250-latest.json");
  const latestCsvPath = path.join(OUT_DIR, "food-safety-i1250-latest.csv");

  const payload = {
    serviceId: SERVICE_ID,
    collectedAt: startedAt.toISOString(),
    keywordCount: keywords.length,
    rowCount: rows.length,
    range: { start: options.start, end: options.end, limit: options.limit, page: options.page },
    keywords,
    errors,
    rows
  };

  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), "utf8");
  fs.writeFileSync(latestJsonPath, JSON.stringify(payload, null, 2), "utf8");
  fs.writeFileSync(csvPath, toExcelCsv(rows), "utf8");
  fs.writeFileSync(latestCsvPath, toExcelCsv(rows), "utf8");

  const master = writeMasterFromHistory(payload);

  console.log("");
  console.log(`완료: ${rows.length}건 저장`);
  console.log(jsonPath);
  console.log(csvPath);
  console.log(`누적: ${master.rows.length}건`);
  console.log(master.jsonPath);
  console.log(master.csvPath);
  if (errors.length) console.log(`실패 키워드: ${errors.length}개`);
}

function readApiKey() {
  if (!fs.existsSync(KEY_PATH)) {
    throw new Error(`인증키 파일이 없습니다: ${KEY_PATH}`);
  }
  const key = fs.readFileSync(KEY_PATH, "utf8").trim();
  if (!key) throw new Error("인증키.txt가 비어 있습니다.");
  return key;
}

function parseArgs(args) {
  const options = {
    limit: 30,
    start: 1,
    page: null,
    maxKeywords: 25,
    delayMs: 250,
    keywords: "",
    mergeOnly: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--limit" && next) {
      options.limit = clamp(Number(next), 1, 1000);
      index += 1;
    } else if (arg === "--start" && next) {
      options.start = clamp(Number(next), 1, 1000000);
      index += 1;
    } else if (arg === "--page" && next) {
      options.page = clamp(Number(next), 1, 1000000);
      index += 1;
    } else if (arg === "--max-keywords" && next) {
      options.maxKeywords = clamp(Number(next), 1, 2000);
      index += 1;
    } else if (arg === "--delay-ms" && next) {
      options.delayMs = clamp(Number(next), 0, 10000);
      index += 1;
    } else if (arg === "--keywords" && next) {
      options.keywords = next;
      index += 1;
    } else if (arg === "--merge-only") {
      options.mergeOnly = true;
    }
  }

  if (options.page) {
    options.start = ((options.page - 1) * options.limit) + 1;
  }
  options.end = options.start + options.limit - 1;

  return options;
}

function getKeywords(options) {
  if (options.keywords) {
    return unique(options.keywords.split(/[,\n]/).map((item) => item.trim()).filter(Boolean));
  }
  return unique(DEFAULT_KEYWORDS);
}

async function fetchKeyword(apiKey, keyword, options) {
  const url = `${API_BASE}/${encodeURIComponent(apiKey)}/${SERVICE_ID}/json/${options.start}/${options.end}/PRDLST_NM=${encodeURIComponent(keyword)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const json = await response.json();
  const service = json && json[SERVICE_ID];
  const result = service && service.RESULT;

  if (result && result.CODE && result.CODE !== "INFO-000") {
    if (result.CODE === "INFO-200") return [];
    throw new Error(`${result.CODE}: ${result.MSG || "API 오류"}`);
  }

  return Array.isArray(service?.row) ? service.row : [];
}

function writeMasterFromHistory(extraPayload) {
  const payloads = readHistoryPayloads();
  if (extraPayload) payloads.push(extraPayload);

  const rows = [];
  const seen = new Set();
  const keywordSet = new Set();
  const sourceFileSet = new Set();
  let firstCollectedAt = "";
  let lastCollectedAt = "";

  for (const payload of payloads) {
    if (!payload || !Array.isArray(payload.rows)) continue;
    if (payload.fileName) sourceFileSet.add(payload.fileName);
    if (payload.collectedAt) {
      if (!firstCollectedAt || payload.collectedAt < firstCollectedAt) firstCollectedAt = payload.collectedAt;
      if (!lastCollectedAt || payload.collectedAt > lastCollectedAt) lastCollectedAt = payload.collectedAt;
    }
    for (const row of payload.rows) {
      const key = getRowKey(row);
      const sourceKeyword = row.sourceKeyword || "";
      if (sourceKeyword) keywordSet.add(sourceKeyword);
      if (seen.has(key)) {
        const existing = rows.find((item) => getRowKey(item) === key);
        if (existing && sourceKeyword) {
          const sourceKeywords = new Set(existing.sourceKeywords || [existing.sourceKeyword].filter(Boolean));
          sourceKeywords.add(sourceKeyword);
          existing.sourceKeywords = [...sourceKeywords];
          existing.sourceKeyword = existing.sourceKeywords.join("|");
        }
        continue;
      }
      seen.add(key);
      rows.push({
        ...row,
        sourceKeywords: sourceKeyword ? [sourceKeyword] : []
      });
    }
  }

  rows.sort((a, b) => {
    const left = String(a.PRDLST_NM || "");
    const right = String(b.PRDLST_NM || "");
    return left.localeCompare(right, "ko");
  });

  const masterPayload = {
    serviceId: SERVICE_ID,
    generatedAt: new Date().toISOString(),
    firstCollectedAt,
    lastCollectedAt,
    keywordCount: keywordSet.size,
    rowCount: rows.length,
    sourceFileCount: sourceFileSet.size,
    rows
  };

  const jsonPath = path.join(OUT_DIR, "food-safety-i1250-master.json");
  const csvPath = path.join(OUT_DIR, "food-safety-i1250-master.csv");
  fs.writeFileSync(jsonPath, JSON.stringify(masterPayload, null, 2), "utf8");
  fs.writeFileSync(csvPath, toExcelCsv(rows), "utf8");

  return { jsonPath, csvPath, rows };
}

function readHistoryPayloads() {
  if (!fs.existsSync(OUT_DIR)) return [];
  return fs.readdirSync(OUT_DIR)
    .filter((fileName) => /^food-safety-i1250-\d{8}-\d{6}\.json$/.test(fileName))
    .sort()
    .map((fileName) => {
      const filePath = path.join(OUT_DIR, fileName);
      try {
        return {
          ...JSON.parse(fs.readFileSync(filePath, "utf8")),
          fileName
        };
      } catch (error) {
        console.warn(`누적 제외: ${fileName} (${error.message || error})`);
        return null;
      }
    })
    .filter(Boolean);
}

function getRowKey(row) {
  return [
    row.PRDLST_REPORT_NO || "",
    row.PRDLST_NM || "",
    row.BSSH_NM || ""
  ].join("|");
}

function toCsv(rows) {
  const columns = [
    "sourceKeyword",
    "sourceKeywords",
    "PRDLST_NM",
    "PRDLST_DCNM",
    "POG_DAYCNT",
    "QLITY_MNTNC_TMLMT_DAYCNT",
    "BSSH_NM",
    "PRDLST_REPORT_NO",
    "PRMS_DT",
    "LAST_UPDT_DTM"
  ];
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((column) => csvCell(row[column])).join(","));
  }
  return lines.join("\n");
}

function toExcelCsv(rows) {
  return `\uFEFF${toCsv(rows)}`;
}

function csvCell(value) {
  const text = String(value ?? "");
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function unique(items) {
  return [...new Set(items)];
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatTimestamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join("");
}
