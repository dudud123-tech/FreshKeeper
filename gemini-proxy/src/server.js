import http from "node:http";

const DEFAULT_MODEL = "gemini-2.5-flash";
const MAX_BODY_BYTES = 512 * 1024;

const port = Number(process.env.PORT || 8789);

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (request.method === "GET" && url.pathname === "/health") {
    return sendJson(response, 200, { ok: true, service: "freshkeeper-gemini-proxy" });
  }

  if (request.method !== "POST" || url.pathname !== "/api/gemini-candidates") {
    return sendJson(response, 404, { ok: false, error: "not_found" });
  }

  if (!process.env.GEMINI_API_KEY) {
    return sendJson(response, 503, { ok: false, error: "missing_gemini_api_key" });
  }

  const expectedToken = process.env.GEMINI_PROXY_TOKEN || "";
  if (expectedToken) {
    const authHeader = request.headers.authorization || "";
    if (authHeader !== `Bearer ${expectedToken}`) {
      return sendJson(response, 401, { ok: false, error: "unauthorized" });
    }
  }

  let payload;
  try {
    payload = JSON.parse(await readBody(request));
  } catch {
    return sendJson(response, 400, { ok: false, error: "invalid_json" });
  }

  const prompt = safeString(payload.prompt, 30000);
  if (!prompt) {
    return sendJson(response, 400, { ok: false, error: "missing_prompt" });
  }

  const model = safeString(payload.model, 80) || process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const responseSchema = payload.responseSchema && typeof payload.responseSchema === "object"
    ? payload.responseSchema
    : candidateResponseSchema();

  const geminiResult = await callGemini({ model, prompt, responseSchema });
  if (!geminiResult.ok) {
    return sendJson(response, geminiResult.status || 502, geminiResult);
  }

  return sendJson(response, 200, geminiResult);
});

server.listen(port, () => {
  console.log(`freshkeeper-gemini-proxy listening on ${port}`);
});

async function callGemini({ model, prompt, responseSchema }) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema
      }
    })
  });

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: `gemini_${response.status}`,
      detail: safeString(await response.text(), 1000)
    };
  }

  const geminiJson = await response.json();
  const text = geminiJson?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
  const parsed = parseCandidateJson(text);

  return {
    ok: true,
    provider: "gemini-proxy",
    model,
    candidates: normalizeCandidates(parsed.candidates)
  };
}

function normalizeCandidates(candidates) {
  if (!Array.isArray(candidates)) return [];

  return candidates.slice(0, 30).map((candidate) => ({
    name: safeString(candidate?.name, 80),
    confidence: typeof candidate?.confidence === "number" && Number.isFinite(candidate.confidence)
      ? candidate.confidence
      : 0,
    reason: safeString(candidate?.reason, 120)
  })).filter((candidate) => candidate.name);
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

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > MAX_BODY_BYTES) {
        reject(new Error("body_too_large"));
        request.destroy();
        return;
      }
      body += chunk;
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

function safeString(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}
