const MAX_LINES = 300;
import { createRemoteJWKSet, jwtVerify } from "jose";

const MAX_TEXT_LENGTH = 140;
const MAX_FAMILY_ITEMS = 500;
const MAX_AI_OCR_LINES = 180;
const MAX_AI_CANDIDATES = 30;
const MAX_CLASSIFICATION_NAMES = 30;
const MAX_CLASSIFICATION_FEEDBACK_ITEMS = 30;
const MIN_COMMUNITY_VOTES = 3;
const MIN_COMMUNITY_AGREEMENT = 0.6;
const DEFAULT_CLASSIFICATION = {
  category: "기타",
  storage: "냉장",
  expiryDays: 7,
  source: "default",
  confidence: 0
};
const PRODUCT_CATEGORIES = new Set([
  "유제품",
  "육류/생선",
  "채소/과일",
  "신선식품",
  "냉동식품",
  "가공식품",
  "건어물/건조식품",
  "소스류",
  "음료",
  "간식",
  "약",
  "기타"
]);
const PRODUCT_STORAGE_TYPES = new Set(["냉장", "냉동", "실온"]);
const AUTH_SESSION_DAYS = 30;
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const KAKAO_JWKS = createRemoteJWKSet(new URL("https://kauth.kakao.com/.well-known/jwks.json"));
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
  "상품명",
  "단가",
  "수량",
  "금액",
  "단가수량금액",
  "총품목수량",
  "총판매상품수",
  "발행일",
  "할부거래",
  "약관보기",
  "차량번호",
  "출차",
  "일시불",
  "브랜드매장",
  "매장고지",
  "물참조",
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
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
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

    if (request.method === "POST" && url.pathname === "/api/auth/google") {
      return handleGoogleLogin(request, env);
    }

    if (request.method === "POST" && url.pathname === "/api/auth/kakao") {
      return handleKakaoLogin(request, env);
    }

    if (request.method === "POST" && url.pathname === "/api/auth/naver") {
      return handleNaverLogin(request, env);
    }

    if (request.method === "GET" && url.pathname === "/api/auth/session") {
      return handleGetAuthSession(request, env);
    }

    if (request.method === "POST" && url.pathname === "/api/auth/logout") {
      return handleLogout(request, env);
    }

    if (request.method === "POST" && url.pathname === "/api/receipt-candidates") {
      return handleReceiptCandidates(request, env);
    }

    if (request.method === "POST" && url.pathname === "/api/product-classifications/resolve") {
      return handleResolveProductClassifications(request, env);
    }

    if (request.method === "POST" && url.pathname === "/api/product-classifications/feedback") {
      return handleProductClassificationFeedback(request, env);
    }

    if (request.method === "POST" && url.pathname === "/api/product-exclusions/resolve") {
      return handleResolveProductExclusions(request, env);
    }

    if (request.method === "POST" && url.pathname === "/api/product-exclusions") {
      return handleUpdateProductExclusions(request, env);
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

async function handleGoogleLogin(request, env) {
  if (!env.DB) return json({ ok: false, error: "missing_d1_binding" }, 500);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const idToken = safeString(payload?.idToken, 5000);
  const clientId = normalizeClientId(payload?.clientId);
  if (!idToken || !clientId) return json({ ok: false, error: "invalid_login_payload" }, 400);

  const audiences = googleClientAudiences(env);
  if (!audiences.length) return json({ ok: false, error: "google_auth_not_configured" }, 503);

  let claims;
  try {
    const verified = await jwtVerify(idToken, GOOGLE_JWKS, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: audiences
    });
    claims = verified.payload;
  } catch (error) {
    console.warn(JSON.stringify({
      event: "google_login_rejected",
      error: safeString(error?.code || error?.message, 120)
    }));
    return json({ ok: false, error: "invalid_google_token" }, 401);
  }

  const providerSubject = safeString(claims?.sub, 255);
  const email = safeString(claims?.email, 254);
  const emailVerified = claims?.email_verified === true;
  if (!providerSubject || !email || !emailVerified) {
    return json({ ok: false, error: "unverified_google_account" }, 401);
  }

  const now = new Date().toISOString();
  const existing = await env.DB.prepare(
    `SELECT id FROM accounts WHERE provider = 'google' AND provider_subject = ?`
  ).bind(providerSubject).first();
  const accountId = existing?.id || crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO accounts
      (id, provider, provider_subject, email, display_name, avatar_url, created_at, updated_at)
     VALUES (?, 'google', ?, ?, ?, ?, ?, ?)
     ON CONFLICT(provider, provider_subject) DO UPDATE SET
       email = excluded.email,
       display_name = excluded.display_name,
       avatar_url = excluded.avatar_url,
       updated_at = excluded.updated_at`
  ).bind(
    accountId,
    providerSubject,
    email,
    safeString(claims?.name, 120),
    safeString(claims?.picture, 500),
    now,
    now
  ).run();

  await bindAccountDevice(env.DB, accountId, clientId, now);
  const session = await createAuthSession(env.DB, accountId, now);
  const account = await getAccountById(env.DB, accountId);

  return json({
    ok: true,
    token: session.token,
    expiresAt: session.expiresAt,
    user: publicAccount(account),
    migrated: true
  });
}

async function handleKakaoLogin(request, env) {
  if (!env.DB) return json({ ok: false, error: "missing_d1_binding" }, 500);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const idToken = safeString(payload?.idToken, 5000);
  const clientId = normalizeClientId(payload?.clientId);
  if (!idToken || !clientId) return json({ ok: false, error: "invalid_login_payload" }, 400);

  const nativeAppKey = safeString(env.KAKAO_NATIVE_APP_KEY, 255);
  if (!nativeAppKey) return json({ ok: false, error: "kakao_auth_not_configured" }, 503);

  let claims;
  try {
    const verified = await jwtVerify(idToken, KAKAO_JWKS, {
      issuer: "https://kauth.kakao.com",
      audience: nativeAppKey
    });
    claims = verified.payload;
  } catch (error) {
    console.warn(JSON.stringify({
      event: "kakao_login_rejected",
      error: safeString(error?.code || error?.message, 120)
    }));
    return json({ ok: false, error: "invalid_kakao_token" }, 401);
  }

  const providerSubject = safeString(claims?.sub, 255);
  if (!providerSubject) return json({ ok: false, error: "invalid_kakao_account" }, 401);

  const now = new Date().toISOString();
  const existing = await env.DB.prepare(
    `SELECT id FROM accounts WHERE provider = 'kakao' AND provider_subject = ?`
  ).bind(providerSubject).first();
  const accountId = existing?.id || crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO accounts
      (id, provider, provider_subject, email, display_name, avatar_url, created_at, updated_at)
     VALUES (?, 'kakao', ?, ?, ?, ?, ?, ?)
     ON CONFLICT(provider, provider_subject) DO UPDATE SET
       email = excluded.email,
       display_name = excluded.display_name,
       avatar_url = excluded.avatar_url,
       updated_at = excluded.updated_at`
  ).bind(
    accountId,
    providerSubject,
    safeString(claims?.email, 254) || null,
    safeString(claims?.nickname, 120),
    safeString(claims?.picture, 500),
    now,
    now
  ).run();

  await bindAccountDevice(env.DB, accountId, clientId, now);
  const session = await createAuthSession(env.DB, accountId, now);
  const account = await getAccountById(env.DB, accountId);

  return json({
    ok: true,
    token: session.token,
    expiresAt: session.expiresAt,
    user: publicAccount(account),
    migrated: true
  });
}

async function handleNaverLogin(request, env) {
  if (!env.DB) return json({ ok: false, error: "missing_d1_binding" }, 500);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const accessToken = safeString(payload?.accessToken, 5000);
  const clientId = normalizeClientId(payload?.clientId);
  if (!accessToken || !clientId) return json({ ok: false, error: "invalid_login_payload" }, 400);

  let profileResult;
  try {
    const profileResponse = await fetch("https://openapi.naver.com/v1/nid/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      redirect: "manual"
    });
    if (!profileResponse.ok) {
      console.warn(JSON.stringify({
        event: "naver_login_rejected",
        status: profileResponse.status
      }));
      return json({ ok: false, error: "invalid_naver_token" }, 401);
    }
    profileResult = await profileResponse.json();
  } catch (error) {
    console.warn(JSON.stringify({
      event: "naver_profile_request_failed",
      error: safeString(error?.message, 120)
    }));
    return json({ ok: false, error: "naver_profile_unavailable" }, 503);
  }

  const profile = profileResult?.response;
  const providerSubject = safeString(profile?.id, 255);
  if (profileResult?.resultcode !== "00" || !providerSubject) {
    return json({ ok: false, error: "invalid_naver_account" }, 401);
  }

  const now = new Date().toISOString();
  const existing = await env.DB.prepare(
    `SELECT id FROM accounts WHERE provider = 'naver' AND provider_subject = ?`
  ).bind(providerSubject).first();
  const accountId = existing?.id || crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO accounts
      (id, provider, provider_subject, email, display_name, avatar_url, created_at, updated_at)
     VALUES (?, 'naver', ?, ?, ?, ?, ?, ?)
     ON CONFLICT(provider, provider_subject) DO UPDATE SET
       email = excluded.email,
       display_name = excluded.display_name,
       avatar_url = excluded.avatar_url,
       updated_at = excluded.updated_at`
  ).bind(
    accountId,
    providerSubject,
    safeString(profile?.email, 254) || null,
    safeString(profile?.nickname || profile?.name, 120),
    safeString(profile?.profile_image, 500),
    now,
    now
  ).run();

  await bindAccountDevice(env.DB, accountId, clientId, now);
  const session = await createAuthSession(env.DB, accountId, now);
  const account = await getAccountById(env.DB, accountId);

  return json({
    ok: true,
    token: session.token,
    expiresAt: session.expiresAt,
    user: publicAccount(account),
    migrated: true
  });
}

async function handleGetAuthSession(request, env) {
  if (!env.DB) return json({ ok: false, error: "missing_d1_binding" }, 500);
  const session = await authenticatedSession(request, env.DB);
  if (!session) return json({ ok: false, error: "unauthorized" }, 401);
  return json({
    ok: true,
    expiresAt: session.expires_at,
    user: publicAccount(session)
  });
}

async function handleLogout(request, env) {
  if (!env.DB) return json({ ok: false, error: "missing_d1_binding" }, 500);
  const token = bearerToken(request);
  if (!token) return json({ ok: true });
  await env.DB.prepare(
    `UPDATE auth_sessions SET revoked_at = ? WHERE token_hash = ?`
  ).bind(new Date().toISOString(), await sha256(token)).run();
  return json({ ok: true });
}

async function createAuthSession(db, accountId, createdAt) {
  const token = randomToken();
  const expiresAtDate = new Date(createdAt);
  expiresAtDate.setUTCDate(expiresAtDate.getUTCDate() + AUTH_SESSION_DAYS);
  const expiresAt = expiresAtDate.toISOString();

  await db.prepare(
    `INSERT INTO auth_sessions (id, account_id, token_hash, created_at, expires_at, revoked_at)
     VALUES (?, ?, ?, ?, ?, NULL)`
  ).bind(crypto.randomUUID(), accountId, await sha256(token), createdAt, expiresAt).run();
  return { token, expiresAt };
}

async function authenticatedSession(request, db) {
  const token = bearerToken(request);
  if (!token) return null;
  return db.prepare(
    `SELECT s.account_id, s.expires_at, a.provider, a.email, a.display_name, a.avatar_url
     FROM auth_sessions s
     JOIN accounts a ON a.id = s.account_id
     WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?
     LIMIT 1`
  ).bind(await sha256(token), new Date().toISOString()).first();
}

async function bindAccountDevice(db, accountId, clientId, now) {
  const accountSubjectKey = `account:${accountId}`;
  const deviceSubjectKey = `device:${clientId}`;
  await db.batch([
    db.prepare(
      `DELETE FROM product_classification_preferences
       WHERE subject_key = ? AND normalized_name IN (
         SELECT normalized_name FROM product_classification_preferences WHERE subject_key = ?
       )`
    ).bind(accountSubjectKey, deviceSubjectKey),
    db.prepare(
      `UPDATE product_classification_preferences
       SET subject_key = ?, account_id = ?, updated_at = ?
       WHERE subject_key = ?`
    ).bind(accountSubjectKey, accountId, now, deviceSubjectKey),
    db.prepare(
      `DELETE FROM product_candidate_exclusions
       WHERE subject_key = ? AND normalized_name IN (
         SELECT normalized_name FROM product_candidate_exclusions WHERE subject_key = ?
       )`
    ).bind(accountSubjectKey, deviceSubjectKey),
    db.prepare(
      `UPDATE product_candidate_exclusions
       SET subject_key = ?, account_id = ?, updated_at = ?
       WHERE subject_key = ?`
    ).bind(accountSubjectKey, accountId, now, deviceSubjectKey),
    db.prepare(
      `INSERT INTO account_devices (client_id, account_id, linked_at, last_seen_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(client_id) DO UPDATE SET
         account_id = excluded.account_id,
         last_seen_at = excluded.last_seen_at`
    ).bind(clientId, accountId, now, now)
  ]);
}

function googleClientAudiences(env) {
  return String(env.GOOGLE_WEB_CLIENT_ID || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function bearerToken(request) {
  const match = request.headers.get("Authorization")?.match(/^Bearer\s+([A-Za-z0-9_-]{32,})$/i);
  return match?.[1] || "";
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function getAccountById(db, accountId) {
  return db.prepare(
    `SELECT id AS account_id, provider, email, display_name, avatar_url FROM accounts WHERE id = ?`
  ).bind(accountId).first();
}

function publicAccount(row) {
  return {
    id: row?.account_id || "",
    provider: row?.provider || "",
    email: row?.email || "",
    displayName: row?.display_name || "",
    avatarUrl: row?.avatar_url || ""
  };
}

async function handleResolveProductClassifications(request, env) {
  if (!env.DB) return json({ ok: false, error: "missing_d1_binding" }, 500);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const names = normalizeClassificationNames(payload?.names);
  if (!names.length) return json({ ok: false, error: "no_names" }, 400);

  const clientId = normalizeClientId(payload?.clientId);
  const session = await authenticatedSession(request, env.DB);
  const accountId = session?.account_id || "";
  const subjectKey = classificationSubjectKey(clientId, accountId);
  const statements = [];
  const keywordResult = await env.DB.prepare(
    `SELECT normalized_keyword, display_keyword, category, storage, expiry_days, priority
     FROM product_classification_keyword_rules
     ORDER BY priority DESC, length(normalized_keyword) DESC`
  ).all();
  const keywordRules = keywordResult?.results || [];

  for (const item of names) {
    statements.push(
      env.DB.prepare(
        `SELECT final_category, final_storage, final_expiry_days, updated_at
         FROM product_classification_preferences
         WHERE subject_key = ? AND normalized_name = ?
         LIMIT 1`
      ).bind(subjectKey, item.normalizedName),
      env.DB.prepare(
        `SELECT final_category, final_storage, final_expiry_days
         FROM product_classification_preferences
         WHERE normalized_name = ?
         LIMIT 200`
      ).bind(item.normalizedName),
      env.DB.prepare(
        `SELECT display_name, category, storage, expiry_days, source, updated_at
         FROM product_classification_catalog
         WHERE normalized_name = ?
         LIMIT 1`
      ).bind(item.normalizedName)
    );
  }

  let queryResults;
  try {
    queryResults = await env.DB.batch(statements);
  } catch (error) {
    console.error(JSON.stringify({
      event: "product_classification_resolve_failed",
      error: safeString(error?.message, 300),
      nameCount: names.length
    }));
    return json({ ok: false, error: "classification_query_failed" }, 500);
  }

  const classifications = names.map((item, index) => {
    const resultOffset = index * 3;
    const personal = queryResults[resultOffset]?.results?.[0];
    const communityRows = queryResults[resultOffset + 1]?.results || [];
    const catalog = queryResults[resultOffset + 2]?.results?.[0];

    if (personal) {
      return {
        name: item.name,
        normalizedName: item.normalizedName,
        category: personal.final_category,
        storage: personal.final_storage,
        expiryDays: personal.final_expiry_days,
        source: accountId ? "user-personal" : "device-personal",
        confidence: 1,
        sampleCount: 1
      };
    }

    const community = chooseCommunityClassification(communityRows);
    if (community) {
      return {
        name: item.name,
        normalizedName: item.normalizedName,
        ...community
      };
    }

    if (catalog) {
      return {
        name: item.name,
        normalizedName: item.normalizedName,
        category: catalog.category,
        storage: catalog.storage,
        expiryDays: catalog.expiry_days,
        source: catalog.source || "catalog",
        confidence: 0.8,
        sampleCount: 0
      };
    }

    const keywordRule = keywordRules.find((rule) =>
      rule.normalized_keyword && item.normalizedName.includes(rule.normalized_keyword)
    );
    if (keywordRule) {
      return {
        name: item.name,
        normalizedName: item.normalizedName,
        category: keywordRule.category,
        storage: keywordRule.storage,
        expiryDays: keywordRule.expiry_days,
        source: "server-keyword-rule",
        confidence: 0.65,
        sampleCount: 0
      };
    }

    return {
      name: item.name,
      normalizedName: item.normalizedName,
      ...DEFAULT_CLASSIFICATION,
      sampleCount: 0
    };
  });

  return json({ ok: true, classifications });
}

async function handleProductClassificationFeedback(request, env) {
  if (!env.DB) return json({ ok: false, error: "missing_d1_binding" }, 500);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const clientId = normalizeClientId(payload?.clientId);
  if (!clientId) return json({ ok: false, error: "invalid_client_id" }, 400);

  const session = await authenticatedSession(request, env.DB);
  const accountId = session?.account_id || "";
  const subjectKey = classificationSubjectKey(clientId, accountId);
  const items = normalizeClassificationFeedbackItems(payload?.items);
  if (!items.length) return json({ ok: false, error: "no_valid_items" }, 400);

  const now = new Date().toISOString();
  const statements = items.map((item) =>
    env.DB.prepare(
      `INSERT INTO product_classification_preferences
        (subject_key, account_id, client_id, normalized_name, original_name,
         predicted_category, predicted_storage, predicted_expiry_days, predicted_source,
         final_category, final_storage, final_expiry_days, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(subject_key, normalized_name) DO UPDATE SET
         account_id = excluded.account_id,
         client_id = excluded.client_id,
         original_name = excluded.original_name,
         predicted_category = excluded.predicted_category,
         predicted_storage = excluded.predicted_storage,
         predicted_expiry_days = excluded.predicted_expiry_days,
         predicted_source = excluded.predicted_source,
         final_category = excluded.final_category,
         final_storage = excluded.final_storage,
         final_expiry_days = excluded.final_expiry_days,
         updated_at = excluded.updated_at`
    ).bind(
      subjectKey,
      accountId || null,
      clientId,
      item.normalizedName,
      item.name,
      item.predictedCategory,
      item.predictedStorage,
      item.predictedExpiryDays,
      item.predictedSource,
      item.finalCategory,
      item.finalStorage,
      item.finalExpiryDays,
      now,
      now
    )
  );

  try {
    await env.DB.batch(statements);
  } catch (error) {
    console.error(JSON.stringify({
      event: "product_classification_feedback_failed",
      error: safeString(error?.message, 300),
      itemCount: items.length
    }));
    return json({ ok: false, error: "classification_feedback_failed" }, 500);
  }

  return json({ ok: true, savedCount: items.length });
}

async function handleResolveProductExclusions(request, env) {
  if (!env.DB) return json({ ok: false, error: "missing_d1_binding" }, 500);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const clientId = normalizeClientId(payload?.clientId);
  if (!clientId) return json({ ok: false, error: "invalid_client_id" }, 400);
  const names = normalizeExclusionNames(payload?.names);
  if (!names.length) return json({ ok: true, excludedNames: [] });

  const session = await authenticatedSession(request, env.DB);
  const subjectKey = classificationSubjectKey(clientId, session?.account_id || "");
  const placeholders = names.map(() => "?").join(", ");
  const result = await env.DB.prepare(
    `SELECT normalized_name
     FROM product_candidate_exclusions
     WHERE subject_key = ? AND normalized_name IN (${placeholders})`
  ).bind(subjectKey, ...names.map((item) => item.normalizedName)).all();

  return json({
    ok: true,
    excludedNames: (result?.results || []).map((row) => row.normalized_name)
  });
}

async function handleUpdateProductExclusions(request, env) {
  if (!env.DB) return json({ ok: false, error: "missing_d1_binding" }, 500);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const clientId = normalizeClientId(payload?.clientId);
  if (!clientId) return json({ ok: false, error: "invalid_client_id" }, 400);
  const exclude = normalizeExclusionNames(payload?.exclude);
  const include = normalizeExclusionNames(payload?.include);
  if (!exclude.length && !include.length) {
    return json({ ok: true, excludedCount: 0, includedCount: 0 });
  }

  const session = await authenticatedSession(request, env.DB);
  const accountId = session?.account_id || "";
  const subjectKey = classificationSubjectKey(clientId, accountId);
  const now = new Date().toISOString();
  const statements = [];

  for (const item of exclude) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO product_candidate_exclusions
          (subject_key, account_id, client_id, normalized_name, original_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(subject_key, normalized_name) DO UPDATE SET
           original_name = excluded.original_name,
           updated_at = excluded.updated_at`
      ).bind(subjectKey, accountId || null, clientId, item.normalizedName, item.name, now, now)
    );
  }

  for (const item of include) {
    statements.push(
      env.DB.prepare(
        `DELETE FROM product_candidate_exclusions
         WHERE subject_key = ? AND normalized_name = ?`
      ).bind(subjectKey, item.normalizedName)
    );
  }

  await env.DB.batch(statements);
  return json({ ok: true, excludedCount: exclude.length, includedCount: include.length });
}

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

  let response = await fetchGeminiDirect(env, model, prompt);
  if (isRetryableGeminiError(response.status)) {
    await delay(900);
    response = await fetchGeminiDirect(env, model, prompt);
  }

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
  return { ok: true, candidates: normalizeAiCandidates(parsed?.candidates, lines, localCandidates), provider: "gemini", model };
}

async function requestGeminiProxyCandidates(env, model, prompt, lines, localCandidates) {
  try {
    const headers = { "Content-Type": "application/json" };
    if (env.GEMINI_PROXY_TOKEN) {
      headers.Authorization = `Bearer ${env.GEMINI_PROXY_TOKEN}`;
    }

    const fallbackModel = safeString(env.GEMINI_FALLBACK_MODEL, 80) || DEFAULT_GEMINI_FALLBACK_MODEL;
    let usedModel = model;
    let result = await readGeminiProxyResult(env, usedModel, prompt, headers, lines, localCandidates);
    if (!result.ok && isRetryableGeminiError(result.status, result.error)) {
      await delay(900);
      result = await readGeminiProxyResult(env, usedModel, prompt, headers, lines, localCandidates);
    }
    if (!result.ok && isRetryableGeminiError(result.status, result.error) && fallbackModel && fallbackModel !== usedModel) {
      usedModel = fallbackModel;
      result = await readGeminiProxyResult(env, usedModel, prompt, headers, lines, localCandidates);
    }
    return result.ok ? { ...result, model: usedModel } : result;
  } catch (error) {
    return {
      ok: false,
      status: 502,
      error: "gemini_proxy_failed",
      detail: safeString(error?.message, 500)
    };
  }
}

function fetchGeminiDirect(env, model, prompt) {
  return fetch(
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
}

async function readGeminiProxyResult(env, model, prompt, headers, lines, localCandidates) {
  const response = await fetchGeminiProxy(env, model, prompt, headers);
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
    model
  };
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

function isRetryableGeminiError(status, error = "") {
  const statusNumber = safeNumber(status);
  return statusNumber === 429 || statusNumber === 503 || /(^|_)(429|503)(_|$)/.test(String(error || ""));
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
  const selectedNames = normalized.selectedNames;
  const ruleCandidateNames = normalized.ruleCandidateNames;
  const selectedNameSet = new Set(selectedNames.map((name) => maskSensitiveText(name).slice(0, MAX_TEXT_LENGTH)));
  const userExcludedNames = [];
  const userExcludedSet = new Set();

  for (const candidateName of ruleCandidateNames) {
    const name = maskSensitiveText(candidateName).slice(0, MAX_TEXT_LENGTH);
    if (!name || selectedNameSet.has(name) || userExcludedSet.has(name)) continue;
    userExcludedSet.add(name);
    userExcludedNames.push(name);
  }

  const statements = [
    env.DB.prepare(
      `INSERT INTO receipt_feedback
        (id, created_at, app_version, parser_version, device_locale, store_hint, ai_request_id, line_count, selected_count, rejected_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      receiptId,
      createdAt,
      normalized.appVersion,
      normalized.parserVersion,
      normalized.deviceLocale,
      normalized.storeHint,
      normalized.aiRequestId,
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

  for (let index = 0; index < selectedNames.length; index += 1) {
    const name = maskSensitiveText(selectedNames[index]).slice(0, MAX_TEXT_LENGTH);
    statements.push(
      env.DB.prepare(
        `INSERT INTO receipt_feedback_selected_items
          (id, receipt_id, item_index, name_masked, name_hash)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(crypto.randomUUID(), receiptId, index, name, await sha256(name))
    );
  }

  const canStoreRuleCandidates = ruleCandidateNames.length > 0
    ? await tableExists(env.DB, "receipt_feedback_rule_candidates")
    : false;

  if (canStoreRuleCandidates) {
    for (let index = 0; index < ruleCandidateNames.length; index += 1) {
      const name = maskSensitiveText(ruleCandidateNames[index]).slice(0, MAX_TEXT_LENGTH);
      statements.push(
        env.DB.prepare(
          `INSERT INTO receipt_feedback_rule_candidates
            (id, receipt_id, candidate_index, name_masked, name_hash)
           VALUES (?, ?, ?, ?, ?)`
        ).bind(crypto.randomUUID(), receiptId, index, name, await sha256(name))
      );
    }
  }

  const canStoreUserExcludedItems = userExcludedNames.length > 0
    ? await tableExists(env.DB, "receipt_feedback_user_excluded_items")
    : false;

  if (canStoreUserExcludedItems) {
    for (let index = 0; index < userExcludedNames.length; index += 1) {
      const name = userExcludedNames[index];
      statements.push(
        env.DB.prepare(
          `INSERT INTO receipt_feedback_user_excluded_items
            (id, receipt_id, candidate_index, name_masked, name_hash)
           VALUES (?, ?, ?, ?, ?)`
        ).bind(crypto.randomUUID(), receiptId, index, name, await sha256(name))
      );
    }
  }

  await env.DB.batch(statements);

  return json({
    ok: true,
    receiptId,
    lineCount: normalized.lines.length,
    selectedCount,
    rejectedCount,
    selectedItemCount: selectedNames.length,
    ruleCandidateCount: canStoreRuleCandidates ? ruleCandidateNames.length : 0,
    ruleCandidateIgnoredCount: canStoreRuleCandidates ? 0 : ruleCandidateNames.length,
    userExcludedItemCount: canStoreUserExcludedItems ? userExcludedNames.length : 0,
    userExcludedIgnoredCount: canStoreUserExcludedItems ? 0 : userExcludedNames.length
  });
}

function normalizePayload(payload) {
  const lines = Array.isArray(payload?.ocrLines) ? payload.ocrLines : [];

  return {
    appVersion: safeString(payload?.appVersion, 80),
    parserVersion: safeString(payload?.parserVersion, 80),
    deviceLocale: safeString(payload?.deviceLocale, 40),
    storeHint: safeString(payload?.storeHint, 80),
    aiRequestId: safeString(payload?.aiRequestId, 80),
    selectedNames: Array.isArray(payload?.selectedNames)
      ? payload.selectedNames.map((name) => safeString(name, MAX_TEXT_LENGTH)).filter(Boolean).slice(0, 50)
      : [],
    ruleCandidateNames: Array.isArray(payload?.ruleCandidateNames)
      ? payload.ruleCandidateNames.map((name) => safeString(name, MAX_TEXT_LENGTH)).filter(Boolean).slice(0, 50)
      : [],
    lines: lines.slice(0, MAX_LINES).map((line, index) => ({
      index,
      text: safeString(line?.text, MAX_TEXT_LENGTH),
      selected: Boolean(line?.selected),
      box: normalizeBox(line?.box)
    })).filter((line) => line.text.length > 0)
  };
}

async function tableExists(db, tableName) {
  const row = await db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .bind(tableName)
    .first();
  return Boolean(row);
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
    const key = receiptCandidateKey(name);
    const duplicate = [...seen].some((previousKey) => isNearReceiptCandidateKey(previousKey, key));
    if (!name || !isLikelyAiProductName(name) || !isSupportedByReceiptText(name, lines, localCandidates) || duplicate) continue;
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
    .replace(/\s*(?:IRC|RC)\s*$/i, "")
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
  if (/(할인|쿠폰|에누리|적립|합계|소계|부가세|과세|면세|승인|카드|포인트|발행일|할부거래|약관보기|차량번호|출차|브랜드매장|매장고지|물참조|균일가\d*원)/.test(compact)) return false;
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
    const key = receiptCandidateKey(name);
    const duplicate = [...seen].some((previousKey) => isNearReceiptCandidateKey(previousKey, key));
    if (!name || !isLikelyAiProductName(name) || !isSupportedByReceiptText(name, lines, []) || duplicate) continue;
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
  if (/(할인|쿠폰|에누리|적립|합계|소계|부가세|과세|면세|승인|카드|포인트|발행일|할부거래|약관보기|차량번호|출차|브랜드매장|매장고지|물참조|균일가\d*원)/.test(compact)) return false;
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
    "단가수량금액",
    "총판매상품수",
    "할부거래계약서약관보기",
    "앱에차량번호등록시출차가편리합니다",
    "일부브랜드매장제외매장고지물참조",
    "정상상품에한함30일이내신선7일",
    "sco760005",
    "cpn",
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

function receiptCandidateKey(value) {
  return normalizeEvidenceText(value)
    .replace(/(?:irc|rc)$/i, "")
    .replace(/\d+(?:g|kg|ml|l|개|입|종|팩|봉|ea|x)?/gi, "");
}

function isNearReceiptCandidateKey(left, right) {
  if (!left || !right) return false;
  if (left === right) return true;
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length > right.length ? left : right;
  return shorter.length >= 4 && longer.includes(shorter) && shorter.length / longer.length >= 0.65;
}

function normalizeProductName(value) {
  return safeString(value, 140)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function normalizeClassificationNames(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const results = [];

  for (const value of values.slice(0, MAX_CLASSIFICATION_NAMES)) {
    const name = safeString(value, 140);
    const normalizedName = normalizeProductName(name);
    if (normalizedName.length < 2 || seen.has(normalizedName)) continue;
    seen.add(normalizedName);
    results.push({ name, normalizedName });
  }

  return results;
}

function normalizeExclusionNames(values) {
  return normalizeClassificationNames(values).map((item) => ({
    ...item,
    normalizedName: item.normalizedName.replace(/(?:irc|rc)$/i, "")
  })).filter((item) => item.normalizedName.length >= 2);
}

function normalizeClassificationFeedbackItems(values) {
  if (!Array.isArray(values)) return [];
  const results = [];
  const seen = new Set();

  for (const value of values.slice(0, MAX_CLASSIFICATION_FEEDBACK_ITEMS)) {
    const name = safeString(value?.name, 140);
    const normalizedName = normalizeProductName(name);
    const finalCategory = normalizeProductCategory(value?.finalCategory);
    const finalStorage = normalizeProductStorage(value?.finalStorage);
    const finalExpiryDays = normalizeExpiryDays(value?.finalExpiryDays);
    if (
      normalizedName.length < 2 ||
      seen.has(normalizedName) ||
      !finalCategory ||
      !finalStorage ||
      finalExpiryDays === null
    ) {
      continue;
    }

    seen.add(normalizedName);
    results.push({
      name,
      normalizedName,
      predictedCategory: normalizeProductCategory(value?.predictedCategory),
      predictedStorage: normalizeProductStorage(value?.predictedStorage),
      predictedExpiryDays: normalizeExpiryDays(value?.predictedExpiryDays),
      predictedSource: safeString(value?.predictedSource, 40),
      finalCategory,
      finalStorage,
      finalExpiryDays
    });
  }

  return results;
}

function normalizeProductCategory(value) {
  const category = safeString(value, 40);
  return PRODUCT_CATEGORIES.has(category) ? category : "";
}

function normalizeProductStorage(value) {
  const storage = safeString(value, 20);
  return PRODUCT_STORAGE_TYPES.has(storage) ? storage : "";
}

function normalizeExpiryDays(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(3650, Math.round(number)));
}

function normalizeClientId(value) {
  const clientId = safeString(value, 100);
  return /^[A-Za-z0-9:_-]{12,100}$/.test(clientId) ? clientId : "";
}

function classificationSubjectKey(clientId, accountId) {
  if (accountId) return `account:${accountId}`;
  if (clientId) return `device:${clientId}`;
  return "anonymous";
}

function chooseCommunityClassification(rows) {
  if (!Array.isArray(rows) || rows.length < MIN_COMMUNITY_VOTES) return null;

  const categoryWinner = mostCommonValue(rows.map((row) => row.final_category));
  if (!categoryWinner || categoryWinner.count / rows.length < MIN_COMMUNITY_AGREEMENT) return null;

  const categoryRows = rows.filter((row) => row.final_category === categoryWinner.value);
  const storageWinner = mostCommonValue(categoryRows.map((row) => row.final_storage));
  if (!storageWinner || storageWinner.count / categoryRows.length < MIN_COMMUNITY_AGREEMENT) return null;

  const matchingRows = categoryRows.filter((row) => row.final_storage === storageWinner.value);
  const expiryValues = matchingRows
    .map((row) => normalizeExpiryDays(row.final_expiry_days))
    .filter((value) => value !== null)
    .sort((left, right) => left - right);
  if (!expiryValues.length) return null;

  const middle = Math.floor(expiryValues.length / 2);
  const expiryDays = expiryValues.length % 2
    ? expiryValues[middle]
    : Math.round((expiryValues[middle - 1] + expiryValues[middle]) / 2);

  return {
    category: categoryWinner.value,
    storage: storageWinner.value,
    expiryDays,
    source: "community-consensus",
    confidence: Math.round((categoryWinner.count / rows.length) * 100) / 100,
    sampleCount: rows.length
  };
}

function mostCommonValue(values) {
  const counts = new Map();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  let winner = null;
  for (const [value, count] of counts) {
    if (!winner || count > winner.count || (count === winner.count && value.localeCompare(winner.value, "ko") < 0)) {
      winner = { value, count };
    }
  }
  return winner;
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


