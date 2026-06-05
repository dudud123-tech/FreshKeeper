const DEFAULT_MODEL = "gemini-2.5-flash";

function doGet() {
  return jsonResponse({
    ok: true,
    service: "freshkeeper-gemini-apps-script-proxy"
  });
}

function doPost(event) {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty("GEMINI_API_KEY");
  const expectedToken = props.getProperty("GEMINI_PROXY_TOKEN") || "";

  if (!apiKey) {
    return jsonResponse({ ok: false, error: "missing_gemini_api_key" }, 503);
  }

  let payload;
  try {
    payload = JSON.parse(event.postData.contents || "{}");
  } catch (error) {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }

  if (expectedToken) {
    const authHeader = getHeader(event, "authorization");
    const bodyToken = safeString(payload.proxyToken, 200);
    if (authHeader !== "Bearer " + expectedToken && bodyToken !== expectedToken) {
      return jsonResponse({ ok: false, error: "unauthorized" }, 401);
    }
  }

  const prompt = safeString(payload.prompt, 30000);
  if (!prompt) {
    return jsonResponse({ ok: false, error: "missing_prompt" }, 400);
  }

  const model = safeString(payload.model, 80) || props.getProperty("GEMINI_MODEL") || DEFAULT_MODEL;
  const responseSchema = payload.responseSchema || candidateResponseSchema();
  const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(model) +
    ":generateContent?key=" +
    encodeURIComponent(apiKey);

  const geminiResponse = UrlFetchApp.fetch(endpoint, {
    method: "post",
    contentType: "application/json",
    muteHttpExceptions: true,
    payload: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: responseSchema
      }
    })
  });

  const status = geminiResponse.getResponseCode();
  const bodyText = geminiResponse.getContentText();

  if (status < 200 || status >= 300) {
    return jsonResponse({
      ok: false,
      status: status,
      error: "gemini_" + status,
      detail: safeString(bodyText, 1000)
    }, status);
  }

  let geminiJson;
  try {
    geminiJson = JSON.parse(bodyText);
  } catch (error) {
    return jsonResponse({ ok: false, error: "invalid_gemini_json" }, 502);
  }

  const text = ((geminiJson.candidates || [])[0]?.content?.parts || [])
    .map(function(part) { return part.text || ""; })
    .join("");
  const parsed = parseCandidateJson(text);

  return jsonResponse({
    ok: true,
    provider: "gemini-apps-script",
    model: model,
    candidates: normalizeCandidates(parsed.candidates)
  });
}

function getHeader(event, name) {
  const headers = event.headers || {};
  const lowerName = name.toLowerCase();
  for (const key in headers) {
    if (String(key).toLowerCase() === lowerName) {
      return headers[key];
    }
  }
  return "";
}

function normalizeCandidates(candidates) {
  if (!Array.isArray(candidates)) return [];
  return candidates.slice(0, 30).map(function(candidate) {
    return {
      name: safeString(candidate && candidate.name, 80),
      confidence: typeof (candidate && candidate.confidence) === "number" ? candidate.confidence : 0,
      reason: safeString(candidate && candidate.reason, 120)
    };
  }).filter(function(candidate) {
    return candidate.name;
  });
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
  } catch (error) {
    const match = String(text || "").match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      return JSON.parse(match[0]);
    } catch (innerError) {
      return {};
    }
  }
}

function jsonResponse(body, status) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

function safeString(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}
