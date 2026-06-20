const fs = require("fs");
const http = require("http");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 5178);
const RULES_PATH = path.resolve(__dirname, "../../src/data/foodRules.json");
const INDEX_PATH = path.resolve(__dirname, "index.html");

function readRules() {
  return JSON.parse(fs.readFileSync(RULES_PATH, "utf8"));
}

function writeRules(nextRules) {
  const formatted = JSON.stringify(nextRules, null, 2) + "\n";
  fs.writeFileSync(RULES_PATH, formatted, "utf8");
}

function normalizeKeywordText(value) {
  return String(value || "").replace(/\s/g, "").toLowerCase();
}

function matchesAnyKeyword(normalizedName, words = []) {
  return words.some((word) => normalizedName.includes(normalizeKeywordText(word)));
}

function findMatchedWord(normalizedName, words = []) {
  return words.find((word) => normalizedName.includes(normalizeKeywordText(word))) || "";
}

function suggestCategory(name, rules) {
  const normalizedName = normalizeKeywordText(name);
  if (!normalizedName) return { category: "기타", matched: "" };

  for (const [category, words] of Object.entries(rules.priorityCategoryKeywords || {})) {
    const matched = findMatchedWord(normalizedName, words);
    if (matched) return { category, matched };
  }

  for (const category of rules.categories || []) {
    const matched = findMatchedWord(normalizedName, (rules.categoryKeywords || {})[category] || []);
    if (matched) return { category, matched };
  }

  return { category: "기타", matched: "" };
}

function findKeywordExpiry(name, category, rules) {
  const normalizedName = normalizeKeywordText(name);
  const isLongShelfCategory = (rules.longShelfCategories || []).includes(category);

  for (const group of rules.keywordExpiryDays || []) {
    const matched = findMatchedWord(normalizedName, group.words || []);
    if (!matched) continue;

    if (isLongShelfCategory && Number(group.days) < Number((rules.categoryExpiryDays || {})[category] || 0)) {
      continue;
    }

    return { days: Number(group.days), matched };
  }

  return { days: null, matched: "" };
}

function suggestStorage(name, category, rules) {
  const normalizedName = normalizeKeywordText(name);
  const freshCategories = ["육류/생선", "유제품", "채소/과일", "신선식품"];
  if (category === "냉동식품" || matchesAnyKeyword(normalizedName, rules.frozenStorageWords || [])) return "냉동";
  if (freshCategories.includes(category)) return "냉장";
  if ((rules.roomStorageCategories || []).includes(category) || matchesAnyKeyword(normalizedName, rules.roomStorageWords || [])) {
    return "실온";
  }
  return "냉장";
}

function suggestExpiryDays(name, category, storage, rules) {
  const normalizedName = normalizeKeywordText(name);
  const categoryDays = Number((rules.categoryExpiryDays || {})[category] || (rules.categoryExpiryDays || {})["기타"] || 7);
  const keyword = findKeywordExpiry(name, category, rules);
  let days = keyword.days || categoryDays;
  const notes = [];

  if (keyword.days) notes.push(`키워드 '${keyword.matched}' 기준 ${keyword.days}일`);
  else notes.push(`카테고리 '${category}' 기본 ${categoryDays}일`);

  if (storage === "냉동" && category !== "약") {
    days = Math.max(days, 60);
    notes.push("냉동 보관 최소 60일 보정");
  }

  if (storage === "실온" && category === "유제품") {
    if (normalizedName.includes("멸균")) {
      days = Math.max(days, 60);
      notes.push("멸균 유제품 실온 보관 60일 이상 보정");
    } else {
      days = 1;
      notes.push("일반 유제품 실온 보관 안전 보정 1일");
    }
  }

  return { days, notes };
}

function addDaysIso(days) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function testProduct(body) {
  const rules = readRules();
  const name = String(body.name || "").trim();
  const categoryResult = suggestCategory(name, rules);
  const storage = body.storage || suggestStorage(name, categoryResult.category, rules);
  const expiry = suggestExpiryDays(name, categoryResult.category, storage, rules);

  return {
    name,
    category: categoryResult.category,
    categoryMatchedKeyword: categoryResult.matched,
    storage,
    days: expiry.days,
    expiryDate: addDaysIso(expiry.days),
    notes: expiry.notes
  };
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  response.end(JSON.stringify(body));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) request.destroy();
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  try {
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      });
      response.end();
      return;
    }

    if (request.method === "GET" && url.pathname === "/") {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
      });
      response.end(fs.readFileSync(INDEX_PATH, "utf8"));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/rules") {
      sendJson(response, 200, { ok: true, rules: readRules() });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/rules") {
      const body = await readBody(request);
      if (!body.rules || !Array.isArray(body.rules.categories)) {
        sendJson(response, 400, { ok: false, error: "invalid_rules" });
        return;
      }
      writeRules(body.rules);
      sendJson(response, 200, { ok: true, savedAt: new Date().toISOString() });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/test") {
      const body = await readBody(request);
      sendJson(response, 200, { ok: true, result: testProduct(body) });
      return;
    }

    sendJson(response, 404, { ok: false, error: "not_found" });
  } catch (error) {
    sendJson(response, 500, { ok: false, error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Food rules editor: http://localhost:${PORT}`);
  console.log(`Editing: ${RULES_PATH}`);
});
