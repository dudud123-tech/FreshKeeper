const MAX_LINES = 300;
const MAX_TEXT_LENGTH = 140;
const MAX_FAMILY_ITEMS = 500;
const MAX_AI_OCR_LINES = 180;
const MAX_AI_CANDIDATES = 30;
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_GEMINI_FALLBACK_MODEL = "gemini-2.5-flash-lite";
const WORKERS_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct";
const AI_CANDIDATE_NOISE_WORDS = [
  "\uCF54\uC2A4\uD2B8\uCF54",
  "\uCF54\uB9AC\uC544",
  "\uD68C\uC6D0",
  "\uB9CC\uB8CC",
  "\uB300\uD45C",
  "\uC8FC\uC18C",
  "\uB300\uAD6C",
  "\uCCA8\uB2E8\uB85C",
  "\uC9C0\uC810",
  "\uAC70\uB798",
  "\uAD6C\uBD84",
  "\uAD6C\uB9E4",
  "\uD310\uB9E4",
  "\uD569\uACC4",
  "\uC18C\uACC4",
  "\uBD80\uAC00\uC138",
  "\uACFC\uC138",
  "\uBA74\uC138",
  "\uCE74\uB4DC",
  "\uC2B9\uC778",
  "\uD3EC\uC778\uD2B8",
  "\uC601\uC218\uC99D",
  "\uCFE0\uD3F0",
  "\uD560\uC778",
  "\uC804\uD654",
  "\uC0C1\uD488\uC218",
  "\uC0AC\uC5C5\uC790",
  "\uD604\uB300",
  "\uC0BC\uC131\uD398\uC774",
  "\uC5D0\uB204\uB9AC",
  "\uC801\uB9BD",
  "\uBC18\uD488",
  "\uD658\uBD88",
  "\uAD50\uD658",
  "\uC815\uC0C1\uC0C1\uD488",
  "\uBAA8\uBC14\uC77C",
  "\uBC1C\uD589",
  "\uC810\uD3EC",
  "\uD0A4\uC624\uC2A4\uD06C",
  "pos",
  "vat",
  "card",
  "member",
  "wholesale",
  "barcode",
  "receipt"
];
const AI_CANDIDATE_ALLOW_HINTS = [
  "\uC6B0\uC720",
  "\uC694\uAC70\uD2B8",
  "\uCE58\uC988",
  "\uACC4\uB780",
  "\uC544\uC774\uC2A4\uD06C\uB9BC",
  "\uC2A4\uB0B5",
  "\uACFC\uC790",
  "\uD0C4\uC0B0\uC218",
  "\uB808\uBAAC",
  "\uBB3C\uD68C",
  "\uC21C\uC0B4",
  "\uD56B\uB3C4\uADF8",
  "\uBCF6\uC74C\uBC25",
  "\uD06C\uB77C\uC0C1",
  "\uACE0\uAE30",
  "\uC0DD\uC120",
  "\uCC44\uC18C",
  "\uACFC\uC77C",
  "\uAE40\uCE58",
  "\uB77C\uBA74",
  "\uBE75",
  "\uCEE4\uD53C",
  "\uC74C\uB8CC",
  "\uC18C\uC2A4",
  "\uB9CC\uB450",
  "\uB0C9\uB3D9",
  "\uD06C\uB9BC",
  "\uB780"
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/health") {
      return json({
        ok: true,
        service: "freshkeeper-ocr-feedback",
        ai: {
          geminiProxyUrl: Boolean(env.GEMINI_PROXY_URL),
          geminiProxyToken: Boolean(env.GEMINI_PROXY_TOKEN),
          geminiApiKey: Boolean(env.GEMINI_API_KEY),
          workersAi: Boolean(env.AI)
        }
      });
    }

    if (request.method === "POST" && url.pathname === "/api/ocr-feedback") {
      return handleOcrFeedback(request, env);
    }

    if (request.method === "POST" && url.pathname === "/api/receipt-candidates") {
      return handleReceiptCandidates(request, env);
    }

    if (request.method === "POST" && url.pathname === "/api/family-groups") {
      return handleCreateFamilyGroup(request, env);
    }

    const familyItemsMatch = url.pathname.match(/^\/api\/family-groups\/([A-Z0-9]{6,12})\/items$/);
    if (familyItemsMatch && request.method === "GET") {
      return handleGetFamilyItems(familyItemsMatch[1], env);
    }

    if (familyItemsMatch && request.method === "PUT") {
      return handlePutFamilyItems(familyItemsMatch[1], request, env);
    }

    return json({ ok: false, error: "not_found" }, 404);
  }
};

async function handleReceiptCandidates(request, env) {
  const requestId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const hasAiProvider = Boolean(env.GEMINI_PROXY_URL || env.GEMINI_API_KEY || env.AI);

  let payload;
  try {
    payload = await request.json();
  } catch {
    await saveAiReceiptLog(env, {
      requestId,
      createdAt,
      ok: false,
      error: "invalid_json",
      detail: "",
      lines: [],
      localCandidates: [],
      aiCandidates: []
    });
    return json({ ok: false, requestId, error: "invalid_json", candidates: [] }, 400);
  }

  const lines = normalizeCandidateLines(payload?.lines);
  if (!lines.length) {
    await saveAiReceiptLog(env, {
      requestId,
      createdAt,
      appVersion: safeString(payload?.appVersion, 80),
      ok: false,
      error: "no_lines",
      detail: "",
      lines: [],
      localCandidates: [],
      aiCandidates: []
    });
    return json({ ok: false, requestId, error: "no_lines", candidates: [] }, 400);
  }

  const localCandidates = Array.isArray(payload?.localCandidates)
    ? payload.localCandidates.map((name) => safeString(name, 80)).filter(Boolean).slice(0, MAX_AI_CANDIDATES)
    : [];
  const appVersion = safeString(payload?.appVersion, 80);

  const prompt = buildCandidatePrompt(lines, localCandidates);
  const model = safeString(env.GEMINI_MODEL, 80) || DEFAULT_GEMINI_MODEL;
  if (!hasAiProvider) {
    const fallbackCandidates = normalizeLocalAiFallback(localCandidates, lines);
    await saveAiReceiptLog(env, {
      requestId,
      createdAt,
      appVersion,
      ok: false,
      error: "missing_ai_provider",
      detail: "",
      lines,
      localCandidates,
      aiCandidates: fallbackCandidates
    });
    return json({ ok: true, requestId, provider: "local-rules", model: "", candidates: fallbackCandidates });
  }

  const geminiResult = await requestGeminiCandidates(env, model, prompt, lines, localCandidates);

  if (geminiResult.ok) {
    const provider = geminiResult.provider || "gemini";
    const usedModel = geminiResult.model || model;
    await saveAiReceiptLog(env, {
      requestId,
      createdAt,
      appVersion,
      ok: true,
      provider,
      model: usedModel,
      lines,
      localCandidates,
      aiCandidates: geminiResult.candidates
    });
    return json({ ok: true, requestId, provider, model: usedModel, candidates: geminiResult.candidates });
  }

  if (env.AI) {
    const workersAiResult = await requestWorkersAiCandidates(env, prompt, lines, localCandidates);
    if (workersAiResult.ok) {
      await saveAiReceiptLog(env, {
        requestId,
        createdAt,
        appVersion,
        ok: true,
        provider: "workers-ai",
        model: WORKERS_AI_MODEL,
        fallbackFrom: geminiResult.error,
        detail: geminiResult.detail,
        lines,
        localCandidates,
        aiCandidates: workersAiResult.candidates
      });
      return json({
        ok: true,
        requestId,
        provider: "workers-ai",
        model: WORKERS_AI_MODEL,
        fallbackFrom: geminiResult.error,
        candidates: workersAiResult.candidates
      });
    }
  }

  await saveAiReceiptLog(env, {
    requestId,
    createdAt,
    appVersion,
    ok: false,
    provider: "gemini",
    model,
    error: geminiResult.error,
    detail: geminiResult.detail,
    lines,
    localCandidates,
    aiCandidates: []
  });

  return json(
    {
      ok: false,
      requestId,
      error: geminiResult.error,
      detail: geminiResult.detail,
      candidates: []
    },
    geminiResult.status === 429 ? 429 : 502
  );
}

async function requestGeminiCandidates(env, model, prompt, lines, localCandidates) {
  if (env.GEMINI_PROXY_URL) {
    const proxyResult = await requestGeminiProxyCandidates(env, model, prompt, lines, localCandidates);
    if (proxyResult.ok) return proxyResult;
    return proxyResult;
  }

  if (!env.GEMINI_API_KEY) {
    return {
      ok: false,
      status: 503,
      error: "missing_gemini_api_key",
      detail: "GEMINI_API_KEY is not configured."
    };
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: candidateResponseSchema()
        }
      })
    }
  );

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: `gemini_${response.status}`,
      detail: safeString(await response.text(), 500)
    };
  }

  const geminiJson = await response.json();
  const text = geminiJson?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
  const parsed = parseCandidateJson(text);
  return { ok: true, candidates: normalizeAiCandidates(parsed?.candidates, lines, localCandidates) };
}

async function requestGeminiProxyCandidates(env, model, prompt, lines, localCandidates) {
  try {
    const headers = { "Content-Type": "application/json" };
    if (env.GEMINI_PROXY_TOKEN) {
      headers.Authorization = `Bearer ${env.GEMINI_PROXY_TOKEN}`;
    }

    const fallbackModel = safeString(env.GEMINI_FALLBACK_MODEL, 80) || DEFAULT_GEMINI_FALLBACK_MODEL;
    let usedModel = model;
    let response = await fetchGeminiProxy(env, usedModel, prompt, headers);
    if ((response.status === 429 || response.status === 503) && fallbackModel && fallbackModel !== usedModel) {
      usedModel = fallbackModel;
      response = await fetchGeminiProxy(env, usedModel, prompt, headers);
    }
    if (response.status === 429 || response.status === 503) {
      await delay(900);
      response = await fetchGeminiProxy(env, usedModel, prompt, headers);
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: `gemini_proxy_${response.status}`,
        detail: safeString(await response.text(), 500)
      };
    }

    const proxyJson = await response.json();
    if (proxyJson?.ok === false) {
      return {
        ok: false,
        status: safeNumber(proxyJson?.status) || response.status,
        error: safeString(proxyJson?.error, 80) || "gemini_proxy_error",
        detail: safeString(proxyJson?.detail, 500)
      };
    }
    const parsed = Array.isArray(proxyJson?.candidates) ? proxyJson : parseCandidateJson(proxyJson?.text);
    return {
      ok: true,
      candidates: normalizeAiCandidates(parsed?.candidates, lines, localCandidates),
      provider: "gemini-proxy",
      model: usedModel
    };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      error: "gemini_proxy_failed",
      detail: safeString(error?.message, 500)
    };
  }
}

function fetchGeminiProxy(env, model, prompt, headers) {
  return fetch(env.GEMINI_PROXY_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      prompt,
      proxyToken: env.GEMINI_PROXY_TOKEN || "",
      responseSchema: candidateResponseSchema()
    })
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestWorkersAiCandidates(env, prompt, lines, localCandidates) {
  try {
    const response = await env.AI.run(WORKERS_AI_MODEL, {
      messages: [
        {
          role: "system",
          content: "Return only valid JSON. Do not include markdown."
        },
        {
          role: "user",
          content: `${prompt}\n\nReturn exactly this JSON shape: {"candidates":[{"name":"서울우유 1L","confidence":0.86,"reason":"product line"}]}`
        }
      ],
      temperature: 0.1,
      max_tokens: 900
    });

    const text = response?.response || response?.result?.response || "";
    const parsed = parseCandidateJson(text);
    return { ok: true, candidates: normalizeAiCandidates(parsed?.candidates, lines, localCandidates) };
  } catch (error) {
    return { ok: false, error: "workers_ai_failed", detail: safeString(error?.message, 300) };
  }
}

function candidateResponseSchema() {
  return {
    type: "OBJECT",
    properties: {
      candidates: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING" },
            confidence: { type: "NUMBER" },
            reason: { type: "STRING" }
          },
          required: ["name", "confidence"],
          propertyOrdering: ["name", "confidence", "reason"]
        }
      }
    },
    required: ["candidates"],
    propertyOrdering: ["candidates"]
  };
}

function parseCandidateJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text || "").match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      return JSON.parse(match[0]);
    } catch {
      return {};
    }
  }
}

async function saveAiReceiptLog(env, log) {
  if (!env.DB) return;

  const requestId = log.requestId || crypto.randomUUID();
  const createdAt = log.createdAt || new Date().toISOString();
  const lines = Array.isArray(log.lines) ? log.lines : [];
  const localCandidates = Array.isArray(log.localCandidates) ? log.localCandidates : [];
  const aiCandidates = Array.isArray(log.aiCandidates) ? log.aiCandidates : [];

  const statements = [
    env.DB.prepare(
      `INSERT INTO ai_receipt_requests
        (id, created_at, app_version, provider, model, fallback_from, ok, error, detail, line_count, local_candidate_count, ai_candidate_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      requestId,
      createdAt,
      safeString(log.appVersion, 80),
      safeString(log.provider, 40),
      safeString(log.model, 80),
      safeString(log.fallbackFrom, 80),
      log.ok ? 1 : 0,
      safeString(log.error, 80),
      safeString(log.detail, 500),
      lines.length,
      localCandidates.length,
      aiCandidates.length
    )
  ];

  for (const line of lines) {
    const masked = maskSensitiveText(line.text).slice(0, MAX_TEXT_LENGTH);
    statements.push(
      env.DB.prepare(
        `INSERT INTO ai_receipt_request_lines
          (id, request_id, line_index, text_masked, text_hash)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(crypto.randomUUID(), requestId, line.index, masked, await sha256(masked))
    );
  }

  for (let index = 0; index < localCandidates.length; index += 1) {
    const name = safeString(localCandidates[index], 80);
    if (!name) continue;
    statements.push(
      env.DB.prepare(
        `INSERT INTO ai_receipt_local_candidates
          (id, request_id, candidate_index, name, name_hash)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(crypto.randomUUID(), requestId, index, name, await sha256(name))
    );
  }

  for (let index = 0; index < aiCandidates.length; index += 1) {
    const candidate = aiCandidates[index];
    const name = safeString(candidate?.name, 80);
    if (!name) continue;
    statements.push(
      env.DB.prepare(
        `INSERT INTO ai_receipt_ai_candidates
          (id, request_id, candidate_index, name, name_hash, confidence, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(),
        requestId,
        index,
        name,
        await sha256(name),
        safeNumber(candidate?.confidence),
        safeString(candidate?.reason, 120)
      )
    );
  }

  await env.DB.batch(statements);
}

async function handleCreateFamilyGroup(request, env) {
  if (!env.DB) return json({ ok: false, error: "missing_d1_binding" }, 500);

  let payload = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const requestedCode = normalizeFamilyCode(payload?.code);
  const now = new Date().toISOString();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = requestedCode || randomFamilyCode();
    try {
      await env.DB.prepare(
        `INSERT INTO family_groups (code, created_at, updated_at, item_count)
         VALUES (?, ?, ?, 0)
         ON CONFLICT(code) DO NOTHING`
      ).bind(code, now, now).run();

      const group = await env.DB.prepare(`SELECT code, created_at, updated_at, item_count FROM family_groups WHERE code = ?`).bind(code).first();
      return json({ ok: true, group });
    } catch (error) {
      if (requestedCode) return json({ ok: false, error: "create_failed" }, 500);
    }
  }

  return json({ ok: false, error: "code_generation_failed" }, 500);
}

async function handleGetFamilyItems(code, env) {
  if (!env.DB) return json({ ok: false, error: "missing_d1_binding" }, 500);

  const groupCode = normalizeFamilyCode(code);
  if (!groupCode) return json({ ok: false, error: "invalid_code" }, 400);

  const group = await env.DB.prepare(`SELECT code, created_at, updated_at, item_count FROM family_groups WHERE code = ?`).bind(groupCode).first();
  if (!group) return json({ ok: false, error: "group_not_found" }, 404);

  const { results } = await env.DB.prepare(
    `SELECT item_id, name, category, storage, expiry_type, expiry, created_at, updated_at
     FROM family_group_items
     WHERE group_code = ? AND deleted = 0
     ORDER BY expiry ASC, name ASC
     LIMIT ?`
  ).bind(groupCode, MAX_FAMILY_ITEMS).all();

  return json({
    ok: true,
    group,
    items: (results || []).map((row) => ({
      id: row.item_id,
      name: row.name,
      category: row.category,
      storage: row.storage,
      expiryType: row.expiry_type,
      expiry: row.expiry,
      createdAt: row.created_at,
      syncedAt: row.updated_at
    }))
  });
}

async function handlePutFamilyItems(code, request, env) {
  if (!env.DB) return json({ ok: false, error: "missing_d1_binding" }, 500);

  const groupCode = normalizeFamilyCode(code);
  if (!groupCode) return json({ ok: false, error: "invalid_code" }, 400);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const items = normalizeFamilyItems(payload?.items);
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO family_groups (code, created_at, updated_at, item_count)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(code) DO UPDATE SET updated_at = excluded.updated_at, item_count = excluded.item_count`
  ).bind(groupCode, now, now, items.length).run();

  const statements = [
    env.DB.prepare(`UPDATE family_group_items SET deleted = 1, updated_at = ? WHERE group_code = ?`).bind(now, groupCode)
  ];

  for (const item of items) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO family_group_items
          (group_code, item_id, name, category, storage, expiry_type, expiry, created_at, updated_at, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
         ON CONFLICT(group_code, item_id) DO UPDATE SET
           name = excluded.name,
           category = excluded.category,
           storage = excluded.storage,
           expiry_type = excluded.expiry_type,
           expiry = excluded.expiry,
           created_at = excluded.created_at,
           updated_at = excluded.updated_at,
           deleted = 0`
      ).bind(
        groupCode,
        item.id,
        item.name,
        item.category,
        item.storage,
        item.expiryType,
        item.expiry,
        item.createdAt,
        now
      )
    );
  }

  await env.DB.batch(statements);

  return json({ ok: true, code: groupCode, itemCount: items.length, updatedAt: now });
}

async function handleOcrFeedback(request, env) {
  if (!env.DB) return json({ ok: false, error: "missing_d1_binding" }, 500);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const normalized = normalizePayload(payload);
  if (!normalized.lines.length) {
    return json({ ok: false, error: "no_lines" }, 400);
  }

  const receiptId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const selectedCount = normalized.lines.filter((line) => line.selected).length;
  const rejectedCount = normalized.lines.length - selectedCount;

  const statements = [
    env.DB.prepare(
      `INSERT INTO receipt_feedback
        (id, created_at, app_version, parser_version, device_locale, store_hint, line_count, selected_count, rejected_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      receiptId,
      createdAt,
      normalized.appVersion,
      normalized.parserVersion,
      normalized.deviceLocale,
      normalized.storeHint,
      normalized.lines.length,
      selectedCount,
      rejectedCount
    )
  ];

  for (const line of normalized.lines) {
    const masked = maskSensitiveText(line.text).slice(0, MAX_TEXT_LENGTH);
    statements.push(
      env.DB.prepare(
        `INSERT INTO ocr_feedback_lines
          (id, receipt_id, line_index, text_masked, text_hash, selected, x, y, width, height)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(),
        receiptId,
        line.index,
        masked,
        await sha256(masked),
        line.selected ? 1 : 0,
        line.box?.x ?? null,
        line.box?.y ?? null,
        line.box?.width ?? null,
        line.box?.height ?? null
      )
    );
  }

  await env.DB.batch(statements);

  return json({
    ok: true,
    receiptId,
    lineCount: normalized.lines.length,
    selectedCount,
    rejectedCount
  });
}

function normalizePayload(payload) {
  const lines = Array.isArray(payload?.ocrLines) ? payload.ocrLines : [];

  return {
    appVersion: safeString(payload?.appVersion, 80),
    parserVersion: safeString(payload?.parserVersion, 80),
    deviceLocale: safeString(payload?.deviceLocale, 40),
    storeHint: safeString(payload?.storeHint, 80),
    lines: lines.slice(0, MAX_LINES).map((line, index) => ({
      index,
      text: safeString(line?.text, MAX_TEXT_LENGTH),
      selected: Boolean(line?.selected),
      box: normalizeBox(line?.box)
    })).filter((line) => line.text.length > 0)
  };
}

function normalizeCandidateLines(lines) {
  if (!Array.isArray(lines)) return [];
  return lines
    .slice(0, MAX_AI_OCR_LINES)
    .map((line, index) => ({
      index: Number.isInteger(line?.index) ? line.index : index,
      text: maskSensitiveText(safeString(line?.text, MAX_TEXT_LENGTH))
    }))
    .filter((line) => line.text.length > 0);
}

function buildCandidatePrompt(lines, localCandidates) {
  const numberedLines = lines.map((line) => `${line.index}: ${line.text}`).join("\n");
  const localCandidateText = localCandidates.length ? localCandidates.map((name) => `- ${name}`).join("\n") : "(none)";
  return [
    "You are extracting purchased inventory item names from Korean receipt OCR for an expiry-date app.",
    "Return only real products the user may store at home. Be conservative: if uncertain, omit.",
    "Every returned name must be directly supported by OCR text or by a rule-based candidate that also appears in OCR evidence.",
    "Do not infer or invent a cleaner product name unless the OCR text clearly supports it.",
    "",
    "A valid product usually matches one of these patterns:",
    "- a Korean product-name line with nearby price and quantity columns on the same row",
    "- a Korean product-name line immediately before or after a numeric product code line",
    "- a rule-based local candidate that appears in OCR text",
    "",
    "Never return these as products:",
    "- store/company/branch names, addresses, phone numbers, business numbers, member information",
    "- dates, POS/order IDs, receipt numbers, card/payment lines, approval numbers, points",
    "- subtotal, total, tax, VAT, cash/card payment, balance, change",
    "- barcode/item-code-only lines, price-only lines, quantity-only lines, mostly numeric lines",
    "- discount/coupon/event rows such as 2+1, 50% discount, coupon, point discount, auto discount",
    "- refund/exchange policy, app promotion, notices, headers, footers",
    "Known non-products to reject: " + AI_CANDIDATE_NOISE_WORDS.slice(0, 24).join(", ") + ".",
    "",
    "Name cleanup rules:",
    "- Remove leading bullets such as *, -, brackets, and obvious OCR separators.",
    "- Join Korean fragments only when they are clearly one product name.",
    "- Keep useful size/flavor/count words only when they distinguish the product, such as 1L, 30 pieces, lemon flavor, boneless.",
    "- Do not include price, quantity, barcode, discount text, or store words in the name.",
    "",
    "Output rules:",
    "- Return at most 20 candidates.",
    "- Confidence must be 0.5-0.95.",
    "- Use lower confidence for noisy OCR or partially reconstructed names.",
    "- Use short reasons that mention the supporting OCR evidence.",
    "",
    "Rule-based candidates from the app:",
    localCandidateText,
    "",
    "OCR lines:",
    numberedLines
  ].join("\n");
}

function normalizeAiCandidates(candidates, lines = [], localCandidates = []) {
  if (!Array.isArray(candidates)) return normalizeLocalAiFallback(localCandidates, lines);
  const seen = new Set();
  const results = [];

  for (const candidate of candidates) {
    const name = cleanAiProductName(candidate?.name);
    const key = name.replace(/\s/g, "").toLowerCase();
    if (!name || !isLikelyAiProductName(name) || !isSupportedByReceiptText(name, lines, localCandidates) || seen.has(key)) continue;
    seen.add(key);
    results.push({
      name,
      confidence: safeNumber(candidate?.confidence) ?? 0,
      reason: safeString(candidate?.reason, 120)
    });
    if (results.length >= MAX_AI_CANDIDATES) break;
  }

  return results.length ? results : normalizeLocalAiFallback(localCandidates, lines);
}

function cleanAiProductName(value) {
  const text = safeString(value, 80)
    .replace(/^[\s*•·\-+]+/, "")
    .replace(/^[\[\](){}]+|[\[\](){}]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (text.length < 2) return "";
  if (/^\d[\d\s,.-]*$/.test(text)) return "";
  if (!/[\p{L}]/u.test(text)) return "";
  return text;
}

function isLikelyAiProductName(name) {
  const compact = name.replace(/\s/g, "");
  const lower = compact.toLowerCase();
  const hasAllowHint = AI_CANDIDATE_ALLOW_HINTS.some((word) => compact.includes(word.toLowerCase()));
  const digitCount = compact.match(/\d/g)?.length || 0;
  const letterCount = compact.match(/\p{L}/gu)?.length || 0;

  if (compact.length < 2) return false;
  if (/^[\d\s,.:()[\]\-T]+$/i.test(name)) return false;
  if (/\b(irc|cpn|pos|vat|member|ewholesale)\b/i.test(name)) return false;
  if (/^\d{4,}/.test(compact) && !hasAllowHint) return false;
  if (/(할인|쿠폰|에누리|적립|합계|소계|부가세|과세|면세|승인|카드|포인트)/.test(compact)) return false;
  if (isReceiptLabel(compact)) return false;
  if (AI_CANDIDATE_NOISE_WORDS.some((word) => lower.includes(word.toLowerCase()))) return false;

  if (!hasAllowHint && digitCount / compact.length > 0.35) return false;
  if (letterCount < 2) return false;

  return true;
}

function isSupportedByReceiptText(name, lines = [], localCandidates = []) {
  const needle = normalizeEvidenceText(name);
  if (needle.length < 2) return false;

  const evidenceParts = [
    ...lines.map((line) => line?.text),
    ...localCandidates
  ].map(normalizeEvidenceText).filter(Boolean);

  if (evidenceParts.some((part) => part.includes(needle) || needle.includes(part))) return true;

  const candidateLines = lines.filter((line) => isLikelyProductEvidenceLine(line?.text));
  const candidateLineParts = candidateLines.map((line) => normalizeEvidenceText(line?.text)).filter(Boolean);
  if (candidateLineParts.some((part) => part.includes(needle) || needle.includes(part))) return true;

  const needleBigrams = hangulBigrams(needle);
  if (!needleBigrams.length) return false;

  return candidateLineParts.some((part) => {
    const overlap = needleBigrams.filter((bigram) => part.includes(bigram)).length;
    return overlap / needleBigrams.length >= 0.55;
  });
}

function normalizeLocalAiFallback(localCandidates = [], lines = []) {
  const seen = new Set();
  const results = [];

  for (const value of localCandidates) {
    const name = cleanAiProductName(value);
    const key = name.replace(/\s/g, "").toLowerCase();
    if (!name || !isLikelyAiProductName(name) || !isSupportedByReceiptText(name, lines, []) || seen.has(key)) continue;
    seen.add(key);
    results.push({
      name,
      confidence: 0.52,
      reason: "rule candidate"
    });
    if (results.length >= MAX_AI_CANDIDATES) break;
  }

  return results;
}

function isLikelyProductEvidenceLine(text) {
  const compact = normalizeEvidenceText(text);
  if (compact.length < 2) return false;
  if (/^\d+$/.test(compact)) return false;
  if (isReceiptLabel(compact)) return false;
  if (AI_CANDIDATE_NOISE_WORDS.some((word) => compact.includes(normalizeEvidenceText(word)))) return false;
  if (/(할인|쿠폰|에누리|적립|합계|소계|부가세|과세|면세|승인|카드|포인트)/.test(compact)) return false;
  return /[\uAC00-\uD7A3]/.test(compact);
}

function isReceiptLabel(compactText) {
  return [
    "상품명",
    "총품목수량",
    "총품목",
    "품목수량",
    "단가수량",
    "단가",
    "수량",
    "금액",
    "결제대상금액",
    "금회발생포인트",
    "링품세계",
    "과세물",
    "부가",
    "일시불",
    "구매",
    "판매",
    "품"
  ].includes(compactText);
}

function hangulBigrams(text) {
  const hangul = [...text].filter((char) => /[\uAC00-\uD7A3]/.test(char));
  const bigrams = [];
  for (let index = 0; index < hangul.length - 1; index += 1) {
    bigrams.push(`${hangul[index]}${hangul[index + 1]}`);
  }
  return bigrams;
}

function normalizeEvidenceText(value) {
  return safeString(value, 160)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function normalizeBox(box) {
  if (!box || typeof box !== "object") return null;
  return {
    x: safeNumber(box.x),
    y: safeNumber(box.y),
    width: safeNumber(box.width),
    height: safeNumber(box.height)
  };
}

function safeString(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function safeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeFamilyCode(value) {
  if (typeof value !== "string") return "";
  const code = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  return code.length >= 6 ? code : "";
}

function randomFamilyCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");
}

function normalizeFamilyItems(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, MAX_FAMILY_ITEMS).map((item) => ({
    id: safeString(item?.id, 80) || crypto.randomUUID(),
    name: safeString(item?.name, 120),
    category: safeString(item?.category, 40),
    storage: safeString(item?.storage, 40),
    expiryType: safeString(item?.expiryType, 40),
    expiry: safeString(item?.expiry, 20),
    createdAt: safeString(item?.createdAt, 40)
  })).filter((item) => item.name && /^\d{4}-\d{2}-\d{2}$/.test(item.expiry));
}

function maskSensitiveText(text) {
  return text
    .replace(/\b\d{2,3}-\d{2,4}-\d{4}\b/g, "[PHONE]")
    .replace(/\b\d{3}-\d{2}-\d{5}\b/g, "[BIZ_NO]")
    .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, "[CARD]")
    .replace(/\b\d{8,}\b/g, "[NUMBER]")
    .replace(/\b20\d{2}[-./\s]?\d{1,2}[-./\s]?\d{1,2}\b/g, "[DATE]");
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}


