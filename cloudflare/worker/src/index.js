const MAX_LINES = 300;
import { createRemoteJWKSet, jwtVerify } from "jose";

const MAX_TEXT_LENGTH = 140;
const MAX_FAMILY_ITEMS = 500;
const MAX_FAMILY_IMAGE_BYTES = 350 * 1024;
const FAMILY_RETENTION_DAYS = 90;
const MAX_AI_OCR_LINES = 180;
const MAX_AI_CANDIDATES = 30;
const MAX_CLASSIFICATION_NAMES = 30;
const MAX_CLASSIFICATION_FEEDBACK_ITEMS = 30;
const MIN_COMMUNITY_VOTES = 3;
const MIN_COMMUNITY_AGREEMENT = 0.6;
const MIN_GLOBAL_EXCLUSION_VOTERS = 3;
const RANKINGS_DISPLAY_LIMIT = 30;
// 개발자 본인이 릴리즈 테스트 중 등록한 것으로 확인된 계정/기기 — 전체 랭킹 집계에서 제외.
// (2026-08-08) 로그인 계정 2개: dndud123@gmail.com(Google), 팔촌아재(Naver, 개인정보처리방침의 그 개발자).
// 익명 device: 8개는 전부 개발자의 고정 테스트 영수증(국내산백오이2개입1개 + 국내산청경채150g1팩 +
// 오뚜기옛날자른당면300g1개 + 홍루이젠호밀빵햄치즈샌드위치74g2개 세트)을 반복 등록한 재설치 흔적으로
// 본인이 직접 확인해줌 — 다른 익명 device: 기록은 이 세트가 없어 그대로 둠.
const RANKINGS_EXCLUDED_SUBJECT_KEYS = [
  "account:453e4abb-c648-4c42-9155-f8f21ac77e1b",
  "account:452735c3-3b2e-4cf0-b966-2326060aca08",
  "device:device_mrt849mm_i3ba32k7d84qdryl",
  "device:device_ms7hrcyj_iz4wkrsyv9i0wvhp",
  "device:device_msacd8c4_ewn29e26zv67b0sp",
  "device:device_msdrm42e_gavrt0j13yn08t2i",
  "device:device_msg0orcz_vctfnmcula2efqlw",
  "device:device_msh9fvy4_n8a3me6aa1azrkix",
  "device:device_msi8y23l_tm2ohu1on2y8jlfy",
  "device:device_msizihce_sg0dt0z4ihbduqgo"
];
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
const GROWTH_LEVEL_XP_THRESHOLDS = [0, 30, 80, 150, 250, 380, 540, 730, 950, 1200];
const MAX_GROWTH_EVENTS_PER_REQUEST = 200;
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

// 강제 업데이트 기준. 이 값보다 낮은 versionCode로 실행 중인 앱은 새 화면으로
// 막고 스토어로 유도한다. 새 버전을 강제하고 싶을 때 이 숫자만 올리고 배포하면 됨
// (앱 재빌드 불필요 — mobile/android/app/build.gradle의 versionCode와는 별개다).
const MIN_SUPPORTED_ANDROID_VERSION_CODE = 1;
const ANDROID_PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.palchonajae.freshkeeper";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/privacy") {
      return htmlPage(privacyPolicyHtml());
    }

    if (request.method === "GET" && url.pathname === "/account-deletion") {
      return htmlPage(accountDeletionHtml());
    }

    if (request.method === "GET" && url.pathname === "/api/app-version") {
      return json({
        ok: true,
        android: {
          minSupportedVersionCode: MIN_SUPPORTED_ANDROID_VERSION_CODE,
          playStoreUrl: ANDROID_PLAY_STORE_URL
        }
      });
    }

    if (request.method === "GET" && url.pathname === "/rankings") {
      return handleProductRankingsPage(request, env);
    }

    if (request.method === "GET" && url.pathname === "/api/health") {
      return json({
        ok: true,
        service: "freshkeeper-ocr-feedback",
        ai: {
          geminiProxyUrl: Boolean(env.GEMINI_PROXY_URL),
          geminiProxyToken: Boolean(env.GEMINI_PROXY_TOKEN),
          geminiApiKey: Boolean(env.GEMINI_API_KEY),
          workersAi: Boolean(env.AI)
        },
        coupang: {
          accessKey: Boolean(env.COUPANG_ACCESS_KEY),
          secretKey: Boolean(env.COUPANG_SECRET_KEY)
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

    if (request.method === "DELETE" && url.pathname === "/api/auth/account") {
      return handleDeleteAccount(request, env);
    }

    if (request.method === "POST" && url.pathname === "/api/receipt-candidates") {
      return handleReceiptCandidates(request, env);
    }

    if (request.method === "POST" && url.pathname === "/api/coupang/deeplink") {
      return handleCoupangDeeplink(request, env);
    }

    if (request.method === "GET" && url.pathname === "/api/coupang/search") {
      return handleCoupangSearch(request, env);
    }

    if (request.method === "GET" && url.pathname === "/api/coupang/goldbox") {
      return handleCoupangGoldbox(request, env);
    }

    if (request.method === "GET" && url.pathname === "/api/coupang/bestcategories") {
      return handleCoupangBestCategories(request, env);
    }

    if (request.method === "GET" && url.pathname === "/admin/coupang/commission") {
      return handleCoupangCommissionReport(request, env);
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

    if (request.method === "GET" && url.pathname === "/api/growth/profile") {
      return handleGetGrowthProfile(request, env);
    }

    if (request.method === "GET" && url.pathname === "/api/growth/report") {
      return handleGetGrowthReport(request, env);
    }

    if (request.method === "POST" && url.pathname === "/api/growth/events") {
      return handlePutGrowthEvents(request, env);
    }

    if (request.method === "POST" && url.pathname === "/api/family-groups") {
      return handleCreateFamilyGroup(request, env);
    }

    const familyGroupMatch = url.pathname.match(/^\/api\/family-groups\/([A-Z0-9]{6,12})$/);
    if (familyGroupMatch && request.method === "DELETE") {
      return handleDeleteFamilyGroup(familyGroupMatch[1], request, env);
    }

    const familyMemberMatch = url.pathname.match(/^\/api\/family-groups\/([A-Z0-9]{6,12})\/members\/me$/);
    if (familyMemberMatch && request.method === "DELETE") {
      return handleLeaveFamilyGroup(familyMemberMatch[1], request, env);
    }

    const familyMembersMatch = url.pathname.match(/^\/api\/family-groups\/([A-Z0-9]{6,12})\/members$/);
    if (familyMembersMatch && request.method === "GET") {
      return handleGetFamilyMembers(familyMembersMatch[1], request, env);
    }

    const familyJoinRequestsMatch = url.pathname.match(/^\/api\/family-groups\/([A-Z0-9]{6,12})\/join-requests$/);
    if (familyJoinRequestsMatch && request.method === "GET") {
      return handleGetFamilyJoinRequests(familyJoinRequestsMatch[1], request, env);
    }

    const familyMyJoinRequestMatch = url.pathname.match(/^\/api\/family-groups\/([A-Z0-9]{6,12})\/join-requests\/me$/);
    if (familyMyJoinRequestMatch && request.method === "GET") {
      return handleGetMyFamilyJoinRequest(familyMyJoinRequestMatch[1], request, env);
    }

    const familyJoinRequestAccountMatch = url.pathname.match(/^\/api\/family-groups\/([A-Z0-9]{6,12})\/join-requests\/([A-Za-z0-9-]{20,80})$/);
    if (familyJoinRequestAccountMatch && request.method === "PATCH") {
      return handleDecideFamilyJoinRequest(
        familyJoinRequestAccountMatch[1],
        familyJoinRequestAccountMatch[2],
        request,
        env
      );
    }

    const familyMemberAccountMatch = url.pathname.match(/^\/api\/family-groups\/([A-Z0-9]{6,12})\/members\/([A-Za-z0-9-]{20,80})$/);
    if (familyMemberAccountMatch && request.method === "DELETE") {
      return handleRemoveFamilyMember(familyMemberAccountMatch[1], familyMemberAccountMatch[2], request, env);
    }

    const familyImageMatch = url.pathname.match(/^\/api\/family-groups\/([A-Z0-9]{6,12})\/items\/([^/]+)\/image$/);
    if (familyImageMatch && request.method === "PUT") {
      return handlePutFamilyImage(familyImageMatch[1], familyImageMatch[2], request, env);
    }

    if (familyImageMatch && request.method === "GET") {
      return handleGetFamilyImage(familyImageMatch[1], familyImageMatch[2], request, env);
    }

    const familyItemsMatch = url.pathname.match(/^\/api\/family-groups\/([A-Z0-9]{6,12})\/items$/);
    if (familyItemsMatch && request.method === "GET") {
      return handleGetFamilyItems(familyItemsMatch[1], request, env);
    }

    if (familyItemsMatch && request.method === "PUT") {
      return handlePutFamilyItems(familyItemsMatch[1], request, env);
    }

    return json({ ok: false, error: "not_found" }, 404);
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(deleteStaleFamilyGroups(env));
  }
};

function htmlPage(content) {
  return new Response(content, {
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer"
    }
  });
}

function publicPage(title, body) {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} | 오늘까지야</title>
  <style>
    :root { color-scheme: light; --ink: #18201c; --muted: #5f6963; --green: #1f7a5a; --line: #dfe6e1; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #f6faf7; color: var(--ink); font-family: "Noto Sans KR", sans-serif; line-height: 1.75; }
    main { width: min(760px, calc(100% - 32px)); margin: 40px auto; padding: 36px; background: white; border: 1px solid var(--line); border-radius: 22px; }
    h1 { margin-top: 0; font-size: 2rem; line-height: 1.25; }
    h2 { margin-top: 2rem; font-size: 1.25rem; }
    p, li { color: var(--muted); }
    a { color: var(--green); }
    .meta { color: var(--green); font-weight: 700; }
    .contact { padding: 18px; background: #edf7f2; border-radius: 14px; }
    @media (max-width: 560px) { main { margin: 0; width: 100%; padding: 24px 20px 40px; border: 0; border-radius: 0; } }
  </style>
</head>
<body><main>${body}</main></body>
</html>`;
}

function privacyPolicyHtml() {
  return publicPage("개인정보처리방침", `
    <h1>오늘까지야 개인정보처리방침</h1>
    <p class="meta">시행일: 2026년 7월 4일</p>
    <p>팔촌아재(이하 "개발자")는 오늘까지야 앱 이용자의 개인정보를 중요하게 생각하며, 관련 법령과 Google Play 정책에 따라 개인정보를 처리합니다.</p>
    <h2>1. 처리하는 정보와 목적</h2>
    <ul>
      <li>선택적 소셜 로그인: Google, 카카오 또는 네이버가 제공하는 계정 식별자, 이메일, 표시 이름, 프로필 이미지. 로그인, 계정 식별, 사용자별 상품 분류·제외 설정 동기화에 사용합니다.</li>
      <li>앱 기능 정보: 상품명, 카테고리, 보관 방식, 소비기한, 구매 링크, 알림 설정. 보관함과 소비기한 알림 제공에 사용합니다.</li>
      <li>사진과 OCR 정보: 사용자가 선택하거나 촬영한 영수증·주문내역·상품 이미지와 인식된 텍스트. 상품 후보 추출과 등록에 사용합니다.</li>
      <li>가족 공유 정보: 공유 코드, 그룹 소유자·참여자, 상품명·카테고리·보관 방식·소비기한·완료 상태·완료일. 로그인 사용자의 가족 보관함 동기화에 사용하며 D1에 저장합니다. 그룹 구성원에게는 표시 이름, 프로필 사진과 그룹 내 역할이 표시되며 이메일 주소는 표시하지 않습니다.</li>
      <li>가족 공유 사진: 사용자가 동의하고 등록한 상품 사진을 낮은 해상도로 압축해 R2에 저장하며 가족 그룹 안에서만 표시합니다.</li>
      <li>성장 기록: 로그인 사용자의 상품 등록, 완료, 만료 이벤트와 경험치 기록. 관리 단계와 진행률 표시 및 계정 간 이어 쓰기에 사용합니다.</li>
      <li>품질 개선 정보: 사용자가 학습 개선 전송을 켠 경우 OCR 텍스트, 선택·제외 결과, 앱 버전, 처리 식별자. 상품 추출 품질 개선에 사용합니다.</li>
    </ul>
    <h2>2. 권한 사용</h2>
    <p>카메라와 사진 접근 권한은 사용자가 영수증, 주문내역 또는 상품 사진을 직접 촬영하거나 선택할 때만 사용합니다. 알림 권한은 소비기한 임박·만료 알림을 제공하는 데 사용합니다.</p>
    <h2>3. 외부 서비스</h2>
    <ul>
      <li>Google, Kakao, NAVER: 사용자가 선택한 소셜 로그인 인증</li>
      <li>Cloudflare: 로그인 계정·세션, 상품 설정, 가족 공유 및 선택적 품질 개선 데이터 처리</li>
    </ul>
    <p>전송되는 정보는 HTTPS로 암호화됩니다. 개발자는 개인정보를 광고 목적으로 판매하지 않습니다.</p>
    <h2>4. 보관과 삭제</h2>
    <p>기기 내 상품 정보는 사용자가 앱에서 삭제하거나 앱 데이터를 삭제할 때 제거됩니다. 로그인 사용자의 성장 기록은 계정 삭제 시 함께 삭제됩니다. 가족 공유 그룹은 마지막 사용 후 90일 동안 활동이 없으면 D1 상품 정보와 R2 사진을 자동 삭제합니다. 소유자가 그룹을 삭제하거나 계정을 삭제할 때도 소유 그룹의 공유 데이터와 사진을 삭제합니다. 법령상 보관 의무가 있는 경우에는 해당 기간만 분리 보관한 뒤 삭제합니다.</p>
    <p>계정 및 서버 데이터 삭제는 <a href="/account-deletion">계정 삭제 안내</a>에 따라 요청할 수 있습니다.</p>
    <h2>5. 아동의 개인정보</h2>
    <p>오늘까지야는 아동을 대상으로 설계된 앱이 아니며, 고의로 아동의 개인정보를 수집하지 않습니다.</p>
    <h2>6. 방침 변경</h2>
    <p>처리 내용이 변경되면 이 페이지에 시행일과 변경 내용을 알립니다.</p>
    <h2>7. 문의</h2>
    <div class="contact">
      <strong>개발자: 팔촌아재</strong><br>
      이메일: <a href="mailto:palchonajae@gmail.com">palchonajae@gmail.com</a>
    </div>
  `);
}

function accountDeletionHtml() {
  return publicPage("계정 삭제 안내", `
    <h1>오늘까지야 계정 삭제 안내</h1>
    <p>오늘까지야 소셜 로그인 계정과 서버에 연결된 데이터는 앱의 설정 &gt; 계정 &gt; 계정 및 서버 데이터 삭제에서 직접 삭제할 수 있습니다. 앱을 사용할 수 없는 경우 아래 이메일로 요청해 주세요.</p>
    <h2>요청 방법</h2>
    <ol>
      <li><a href="mailto:palchonajae@gmail.com?subject=%EC%98%A4%EB%8A%98%EA%B9%8C%EC%A7%80%EC%95%BC%20%EA%B3%84%EC%A0%95%20%EC%82%AD%EC%A0%9C%20%EC%9A%94%EC%B2%AD">palchonajae@gmail.com</a>으로 메일을 보냅니다.</li>
      <li>제목에 "오늘까지야 계정 삭제 요청"을 적습니다.</li>
      <li>로그인 제공자(Google·카카오·네이버)와 로그인 이메일을 적습니다.</li>
    </ol>
    <p>계정 삭제 시 계정, 로그인 세션, 성장 기록, 상품 분류·제외 설정, 가족 그룹 멤버십을 삭제합니다. 사용자가 소유한 가족 그룹의 공유 상품 정보와 압축 사진도 함께 삭제합니다. 법령상 보관이 필요한 정보는 해당 기간만 분리 보관한 뒤 삭제합니다.</p>
    <h2>앱에서 삭제</h2>
    <p>설정 &gt; 계정 &gt; 계정 및 서버 데이터 삭제를 선택하고 확인하면 즉시 삭제를 요청할 수 있습니다.</p>
    <h2>문의</h2>
    <div class="contact">
      <strong>개발자: 팔촌아재</strong><br>
      이메일: <a href="mailto:palchonajae@gmail.com">palchonajae@gmail.com</a>
    </div>
  `);
}

async function handleProductRankingsPage(request, env) {
  if (!env.DB) return htmlPage(publicPage("전체 랭킹", "<h1>전체 랭킹</h1><p>서버 데이터베이스가 설정되지 않았습니다.</p>"));

  const excludedPlaceholders = RANKINGS_EXCLUDED_SUBJECT_KEYS.map(() => "?").join(", ");
  const [summary, ranking] = await Promise.all([
    env.DB.prepare(
      `SELECT COUNT(DISTINCT subject_key) as userCount, COUNT(DISTINCT normalized_name) as productCount
       FROM product_classification_preferences
       WHERE subject_key NOT IN (${excludedPlaceholders})`
    ).bind(...RANKINGS_EXCLUDED_SUBJECT_KEYS).first(),
    env.DB.prepare(
      `SELECT normalized_name, COUNT(DISTINCT subject_key) as userCount
       FROM product_classification_preferences
       WHERE subject_key NOT IN (${excludedPlaceholders})
       GROUP BY normalized_name
       ORDER BY userCount DESC, normalized_name ASC
       LIMIT ?`
    ).bind(...RANKINGS_EXCLUDED_SUBJECT_KEYS, RANKINGS_DISPLAY_LIMIT).all()
  ]);

  const rows = ranking?.results || [];
  const userCount = Number(summary?.userCount) || 0;
  const productCount = Number(summary?.productCount) || 0;
  const updatedAt = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

  const rankMedal = (rank) => (rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : String(rank));

  const rowsHtml = rows.length
    ? rows
        .map(
          (row, index) => `<li class="rank-item">
            <span class="rank-badge">${rankMedal(index + 1)}</span>
            <span class="rank-name">${escapeHtml(row.normalized_name)}</span>
            <span class="rank-count">${Number(row.userCount) || 0}명 등록</span>
          </li>`
        )
        .join("")
    : `<li class="rank-empty">아직 등록된 상품이 없어요.</li>`;

  return htmlPage(
    publicPage(
      "전체 랭킹",
      `
    <style>
      .rank-list { list-style: none; margin: 24px 0 0; padding: 0; }
      .rank-item { display: flex; align-items: center; gap: 14px; padding: 12px 4px; border-bottom: 1px solid var(--line); }
      .rank-item:last-child { border-bottom: 0; }
      .rank-badge { width: 32px; flex-shrink: 0; text-align: center; font-weight: 700; color: var(--green); }
      .rank-name { flex: 1; font-weight: 600; color: var(--ink); word-break: break-all; }
      .rank-count { flex-shrink: 0; color: var(--muted); font-size: 0.9rem; white-space: nowrap; }
      .rank-empty { color: var(--muted); padding: 12px 4px; }
      .rank-note { margin-top: 24px; font-size: 0.9rem; }
    </style>
    <h1>전체 랭킹</h1>
    <p class="meta">지금까지 ${userCount.toLocaleString("ko-KR")}명이 참여해서 ${productCount.toLocaleString("ko-KR")}개 상품을 등록했어요</p>
    <p>다른 사람들은 어떤 상품을 많이 등록했는지, 등록해본 사람이 몇 명인지 순위로 보여드려요. 상위 ${RANKINGS_DISPLAY_LIMIT}개까지만 표시해요.</p>
    <ol class="rank-list">${rowsHtml}</ol>
    <p class="rank-note">아직 참여 인원이 많지 않아 순위가 자주 바뀔 수 있어요 · 갱신: ${escapeHtml(updatedAt)}</p>
  `
    )
  );
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

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
  const kakaoProfile = payload?.profile && typeof payload.profile === "object" ? payload.profile : {};
  const kakaoEmail = safeString(claims?.email, 254) || safeString(kakaoProfile.email, 254) || null;
  const kakaoDisplayName = safeString(claims?.nickname, 120) || safeString(kakaoProfile.nickname, 120);
  const kakaoAvatarUrl = normalizeAvatarUrl(
    safeString(claims?.picture, 500) || safeString(kakaoProfile.profileImageUrl, 500)
  );

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
    kakaoEmail,
    kakaoDisplayName,
    kakaoAvatarUrl,
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

async function handleDeleteAccount(request, env) {
  if (!env.DB) return json({ ok: false, error: "missing_d1_binding" }, 500);
  const session = await authenticatedSession(request, env.DB);
  if (!session) return json({ ok: false, error: "unauthorized" }, 401);

  const ownedGroups = await env.DB.prepare(
    `SELECT code FROM family_groups WHERE owner_account_id = ? AND deleted_at IS NULL`
  ).bind(session.account_id).all();
  for (const group of ownedGroups.results || []) await deleteFamilyGroupData(group.code, env);

  await env.DB.batch([
    env.DB.prepare(`DELETE FROM family_group_join_requests WHERE account_id = ?`).bind(session.account_id),
    env.DB.prepare(`DELETE FROM family_group_members WHERE account_id = ?`).bind(session.account_id),
    env.DB.prepare(`DELETE FROM auth_sessions WHERE account_id = ?`).bind(session.account_id),
    env.DB.prepare(`DELETE FROM account_devices WHERE account_id = ?`).bind(session.account_id),
    env.DB.prepare(`DELETE FROM growth_events WHERE account_id = ?`).bind(session.account_id),
    env.DB.prepare(`DELETE FROM product_classification_preferences WHERE account_id = ?`).bind(session.account_id),
    env.DB.prepare(`DELETE FROM product_candidate_exclusions WHERE account_id = ?`).bind(session.account_id),
    env.DB.prepare(`DELETE FROM accounts WHERE id = ?`).bind(session.account_id)
  ]);
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
    avatarUrl: normalizeAvatarUrl(row?.avatar_url || "")
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
  const normalizedNameValues = names.map((item) => item.normalizedName);

  const [personalResult, globalResult] = await Promise.all([
    env.DB.prepare(
      `SELECT normalized_name
       FROM product_candidate_exclusions
       WHERE subject_key = ? AND normalized_name IN (${placeholders})`
    ).bind(subjectKey, ...normalizedNameValues).all(),
    env.DB.prepare(
      `SELECT normalized_name
       FROM product_candidate_exclusions
       WHERE normalized_name IN (${placeholders})
       GROUP BY normalized_name
       HAVING COUNT(DISTINCT subject_key) >= ?`
    ).bind(...normalizedNameValues, MIN_GLOBAL_EXCLUSION_VOTERS).all()
  ]);

  const excludedNames = new Set([
    ...(personalResult?.results || []).map((row) => row.normalized_name),
    ...(globalResult?.results || []).map((row) => row.normalized_name)
  ]);

  return json({
    ok: true,
    excludedNames: [...excludedNames]
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

// 쿠팡 파트너스 Open API 딥링크 변환. 문서: 파일/쿠팡/api_guide.md
const COUPANG_API_HOST = "https://api-gateway.coupang.com";
const COUPANG_DEEPLINK_PATH = "/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink";
const MAX_COUPANG_URLS_PER_REQUEST = 10;
const COUPANG_HOSTS = new Set(["www.coupang.com", "coupang.com", "m.coupang.com", "link.coupang.com"]);

async function handleCoupangDeeplink(request, env) {
  const accessKey = safeString(env.COUPANG_ACCESS_KEY, 200);
  const secretKey = safeString(env.COUPANG_SECRET_KEY, 200);
  if (!accessKey || !secretKey) return json({ ok: false, error: "coupang_not_configured" }, 503);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const rawUrls = Array.isArray(payload?.urls) ? payload.urls : payload?.url ? [payload.url] : [];
  const candidateUrls = rawUrls
    .map((value) => safeString(value, 2000))
    .filter((value) => isCoupangUrl(value))
    .slice(0, MAX_COUPANG_URLS_PER_REQUEST);

  if (!candidateUrls.length) return json({ ok: false, error: "no_valid_coupang_urls" }, 400);

  // link.coupang.com/a/... 같은 단축 링크(쿠팡 앱 "공유하기"로 만든 링크 등)는
  // 딥링크 API가 그대로 못 받는다 — 리다이렉트를 한 번 풀어서 실제 상품 URL을 얻는다.
  const urls = (await Promise.all(candidateUrls.map(resolveCoupangShortUrl))).filter(Boolean);
  if (!urls.length) return json({ ok: false, error: "no_valid_coupang_urls" }, 400);

  const authorization = await signCoupangRequest("POST", COUPANG_DEEPLINK_PATH, secretKey, accessKey);

  let coupangResponse;
  try {
    coupangResponse = await fetch(`${COUPANG_API_HOST}${COUPANG_DEEPLINK_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authorization
      },
      body: JSON.stringify({ coupangUrls: urls })
    });
  } catch (error) {
    console.warn(JSON.stringify({ event: "coupang_deeplink_fetch_failed", error: safeString(error?.message, 200) }));
    return json({ ok: false, error: "coupang_request_failed" }, 502);
  }

  const body = await coupangResponse.json().catch(() => null);
  if (!coupangResponse.ok || !body || body.rCode !== "0") {
    console.warn(JSON.stringify({
      event: "coupang_deeplink_rejected",
      status: coupangResponse.status,
      rCode: body?.rCode,
      message: safeString(body?.rMessage || body?.message, 200)
    }));
    return json({ ok: false, error: "coupang_deeplink_failed" }, 502);
  }

  const links = Array.isArray(body.data)
    ? body.data
        .map((entry) => ({
          originalUrl: safeString(entry?.originalUrl, 2000),
          shortenUrl: safeString(entry?.shortenUrl, 500)
        }))
        .filter((entry) => entry.originalUrl && entry.shortenUrl)
    : [];

  return json({ ok: true, links });
}

function isCoupangUrl(value) {
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    return COUPANG_HOSTS.has(new URL(value).hostname.toLowerCase());
  } catch {
    return false;
  }
}

// link.coupang.com/a/... 같은 단축 링크는 리다이렉트(Location 헤더)만 한 번 읽어서
// 실제 상품 URL로 바꾼다 — 페이지 본문은 요청하지 않는다(redirect: "manual").
// www.coupang.com/m.coupang.com/coupang.com URL은 이미 원본이라 그대로 돌려준다.
async function resolveCoupangShortUrl(url) {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (host !== "link.coupang.com") return url;

  try {
    const response = await fetch(url, { redirect: "manual" });
    const location = response.headers.get("location");
    return location && isCoupangUrl(location) ? location : null;
  } catch (error) {
    console.warn(JSON.stringify({ event: "coupang_short_url_resolve_failed", error: safeString(error?.message, 200) }));
    return null;
  }
}

// 상품명으로 쿠팡을 검색해 파트너스 링크가 이미 붙은 productUrl을 받아온다.
// 문서: 파일/쿠팡/문서.md의 "GET /products/search". 분당 최대 50회 호출 제한(쿠팡 측).
const COUPANG_SEARCH_PATH = "/v2/providers/affiliate_open_api/apis/openapi/products/search";
const MAX_COUPANG_SEARCH_LIMIT = 10;

async function handleCoupangSearch(request, env) {
  const accessKey = safeString(env.COUPANG_ACCESS_KEY, 200);
  const secretKey = safeString(env.COUPANG_SECRET_KEY, 200);
  if (!accessKey || !secretKey) return json({ ok: false, error: "coupang_not_configured" }, 503);

  const requestUrl = new URL(request.url);
  const keyword = safeString(requestUrl.searchParams.get("keyword"), 200);
  if (!keyword) return json({ ok: false, error: "missing_keyword" }, 400);

  const requestedLimit = Number(requestUrl.searchParams.get("limit"));
  const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 5, 1), MAX_COUPANG_SEARCH_LIMIT);
  const query = `keyword=${encodeURIComponent(keyword)}&limit=${limit}`;
  const uri = `${COUPANG_SEARCH_PATH}?${query}`;

  const authorization = await signCoupangRequest("GET", uri, secretKey, accessKey);

  let coupangResponse;
  try {
    coupangResponse = await fetch(`${COUPANG_API_HOST}${uri}`, {
      method: "GET",
      headers: { Authorization: authorization }
    });
  } catch (error) {
    console.warn(JSON.stringify({ event: "coupang_search_fetch_failed", error: safeString(error?.message, 200) }));
    return json({ ok: false, error: "coupang_request_failed" }, 502);
  }

  const body = await coupangResponse.json().catch(() => null);
  if (!coupangResponse.ok || !body || body.rCode !== "0") {
    console.warn(JSON.stringify({
      event: "coupang_search_rejected",
      status: coupangResponse.status,
      rCode: body?.rCode,
      message: safeString(body?.rMessage || body?.message, 200)
    }));
    return json({ ok: false, error: "coupang_search_failed" }, 502);
  }

  const products = Array.isArray(body?.data?.productData)
    ? body.data.productData
        .map((item) => ({
          productId: safeNumber(item?.productId),
          productName: safeString(item?.productName, 200),
          productImage: safeString(item?.productImage, 1000),
          productPrice: safeNumber(item?.productPrice),
          productUrl: safeString(item?.productUrl, 1000),
          isRocket: Boolean(item?.isRocket)
        }))
        .filter((item) => item.productUrl)
    : [];

  return json({ ok: true, products });
}

// 골드박스(오늘의 특가) — 매일 오전 7:30 갱신. 문서: 파일/쿠팡/문서.md
const COUPANG_GOLDBOX_PATH = "/v2/providers/affiliate_open_api/apis/openapi/products/goldbox";

async function handleCoupangGoldbox(request, env) {
  const accessKey = safeString(env.COUPANG_ACCESS_KEY, 200);
  const secretKey = safeString(env.COUPANG_SECRET_KEY, 200);
  if (!accessKey || !secretKey) return json({ ok: false, error: "coupang_not_configured" }, 503);

  const authorization = await signCoupangRequest("GET", COUPANG_GOLDBOX_PATH, secretKey, accessKey);

  let coupangResponse;
  try {
    coupangResponse = await fetch(`${COUPANG_API_HOST}${COUPANG_GOLDBOX_PATH}`, {
      method: "GET",
      headers: { Authorization: authorization }
    });
  } catch (error) {
    console.warn(JSON.stringify({ event: "coupang_goldbox_fetch_failed", error: safeString(error?.message, 200) }));
    return json({ ok: false, error: "coupang_request_failed" }, 502);
  }

  const body = await coupangResponse.json().catch(() => null);
  if (!coupangResponse.ok || !body || body.rCode !== "0") {
    console.warn(JSON.stringify({
      event: "coupang_goldbox_rejected",
      status: coupangResponse.status,
      rCode: body?.rCode,
      message: safeString(body?.rMessage || body?.message, 200)
    }));
    return json({ ok: false, error: "coupang_goldbox_failed" }, 502);
  }

  return json({ ok: true, products: normalizeCoupangProductList(body.data) });
}

// 카테고리별 베스트 상품. 1012 = 식품(이 앱의 그로서리 카테고리들이 전부 여기 속함).
const COUPANG_BESTCATEGORIES_PATH = "/v2/providers/affiliate_open_api/apis/openapi/products/bestcategories";
const DEFAULT_COUPANG_CATEGORY_ID = 1012;

async function handleCoupangBestCategories(request, env) {
  const accessKey = safeString(env.COUPANG_ACCESS_KEY, 200);
  const secretKey = safeString(env.COUPANG_SECRET_KEY, 200);
  if (!accessKey || !secretKey) return json({ ok: false, error: "coupang_not_configured" }, 503);

  const requestUrl = new URL(request.url);
  const categoryId = Number(requestUrl.searchParams.get("categoryId")) || DEFAULT_COUPANG_CATEGORY_ID;
  const limit = Math.min(Math.max(Number(requestUrl.searchParams.get("limit")) || 10, 1), 100);
  const uri = `${COUPANG_BESTCATEGORIES_PATH}/${categoryId}?limit=${limit}`;

  const authorization = await signCoupangRequest("GET", uri, secretKey, accessKey);

  let coupangResponse;
  try {
    coupangResponse = await fetch(`${COUPANG_API_HOST}${uri}`, {
      method: "GET",
      headers: { Authorization: authorization }
    });
  } catch (error) {
    console.warn(JSON.stringify({ event: "coupang_bestcategories_fetch_failed", error: safeString(error?.message, 200) }));
    return json({ ok: false, error: "coupang_request_failed" }, 502);
  }

  const body = await coupangResponse.json().catch(() => null);
  if (!coupangResponse.ok || !body || body.rCode !== "0") {
    console.warn(JSON.stringify({
      event: "coupang_bestcategories_rejected",
      status: coupangResponse.status,
      rCode: body?.rCode,
      message: safeString(body?.rMessage || body?.message, 200)
    }));
    return json({ ok: false, error: "coupang_bestcategories_failed" }, 502);
  }

  return json({ ok: true, products: normalizeCoupangProductList(body.data) });
}

function normalizeCoupangProductList(data) {
  if (!Array.isArray(data)) return [];
  const seenProductIds = new Set();
  return data
    .map((item) => ({
      productId: safeNumber(item?.productId),
      productName: safeString(item?.productName, 200),
      productImage: safeString(item?.productImage, 1000),
      productPrice: safeNumber(item?.productPrice),
      productUrl: safeString(item?.productUrl, 1000),
      isRocket: Boolean(item?.isRocket)
    }))
    .filter((item) => {
      if (!item.productUrl) return false;
      // 쿠팡 API 응답 자체에 같은 productId가 중복으로 들어있는 경우가 있어서
      // (앱 쪽 React 리스트 key 충돌로 이어짐) 여기서 한 번 걸러준다.
      if (item.productId != null) {
        if (seenProductIds.has(item.productId)) return false;
        seenProductIds.add(item.productId);
      }
      return true;
    });
}

// 일별 수익 리포트(클릭/주문/취소/수수료/GMV). 개발자 본인 확인용 — 반드시 토큰으로
// 보호한다(쿠팡 파트너스 수익 데이터라 아무나 URL을 알아내면 보이면 안 됨).
const COUPANG_COMMISSION_PATH = "/v2/providers/affiliate_open_api/apis/openapi/reports/commission";

async function handleCoupangCommissionReport(request, env) {
  const requestUrl = new URL(request.url);
  const reportToken = safeString(env.COUPANG_REPORT_TOKEN, 200);
  if (!reportToken || requestUrl.searchParams.get("token") !== reportToken) {
    return new Response("Not found", { status: 404 });
  }

  const accessKey = safeString(env.COUPANG_ACCESS_KEY, 200);
  const secretKey = safeString(env.COUPANG_SECRET_KEY, 200);
  if (!accessKey || !secretKey) return htmlPage("<p>COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY가 설정되지 않았습니다.</p>");

  const today = new Date();
  const endDate = requestUrl.searchParams.get("endDate") || formatYyyymmdd(today);
  const startDate = requestUrl.searchParams.get("startDate") || formatYyyymmdd(new Date(today.getTime() - 29 * 86400000));

  const query = `startDate=${startDate}&endDate=${endDate}`;
  const uri = `${COUPANG_COMMISSION_PATH}?${query}`;
  const authorization = await signCoupangRequest("GET", uri, secretKey, accessKey);

  let coupangResponse;
  try {
    coupangResponse = await fetch(`${COUPANG_API_HOST}${uri}`, {
      method: "GET",
      headers: { Authorization: authorization }
    });
  } catch (error) {
    return htmlPage(`<p>요청 실패: ${safeString(error?.message, 200)}</p>`);
  }

  const body = await coupangResponse.json().catch(() => null);
  if (!coupangResponse.ok || !body || body.rCode !== "0") {
    return htmlPage(`<p>쿠팡 응답 오류: ${safeString(body?.rMessage || body?.message, 200) || coupangResponse.status}</p>`);
  }

  const rows = Array.isArray(body.data) ? body.data : [];
  const totals = rows.reduce(
    (acc, row) => ({
      commission: acc.commission + (Number(row.commission) || 0),
      click: acc.click + (Number(row.click) || 0),
      order: acc.order + (Number(row.order) || 0),
      cancel: acc.cancel + (Number(row.cancel) || 0),
      gmv: acc.gmv + (Number(row.gmv) || 0)
    }),
    { commission: 0, click: 0, order: 0, cancel: 0, gmv: 0 }
  );

  const rowsHtml = rows
    .map(
      (row) => `<tr>
        <td>${safeString(row.date, 20)}</td>
        <td>${Number(row.click) || 0}</td>
        <td>${Number(row.order) || 0}</td>
        <td>${Number(row.cancel) || 0}</td>
        <td>${(Number(row.gmv) || 0).toLocaleString("ko-KR")}원</td>
        <td>${(Number(row.commission) || 0).toLocaleString("ko-KR")}원</td>
      </tr>`
    )
    .join("");

  return htmlPage(`
    <h1>쿠팡 파트너스 수익 리포트</h1>
    <p>${startDate} ~ ${endDate}</p>
    <table border="1" cellpadding="6" cellspacing="0">
      <thead><tr><th>날짜</th><th>클릭</th><th>주문</th><th>취소</th><th>GMV</th><th>수수료</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot><tr>
        <td>합계</td>
        <td>${totals.click}</td>
        <td>${totals.order}</td>
        <td>${totals.cancel}</td>
        <td>${totals.gmv.toLocaleString("ko-KR")}원</td>
        <td>${totals.commission.toLocaleString("ko-KR")}원</td>
      </tr></tfoot>
    </table>
  `);
}

function formatYyyymmdd(date) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

async function signCoupangRequest(method, uri, secretKey, accessKey) {
  const [path, query = ""] = uri.split("?");
  const datetime = coupangSignedDate();
  const message = `${datetime}${method}${path}${query}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  const signature = [...new Uint8Array(signatureBytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;
}

function coupangSignedDate() {
  // yyMMdd'T'HHmmss'Z', GMT. 쿠팡 가이드의 SimpleDateFormat("yyMMdd'T'HHmmss'Z'")와 동일 포맷.
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  const yy = pad(now.getUTCFullYear() % 100);
  const MM = pad(now.getUTCMonth() + 1);
  const dd = pad(now.getUTCDate());
  const HH = pad(now.getUTCHours());
  const mm = pad(now.getUTCMinutes());
  const ss = pad(now.getUTCSeconds());
  return `${yy}${MM}${dd}T${HH}${mm}${ss}Z`;
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
  const session = await authenticatedSession(request, env.DB);
  if (!session) return json({ ok: false, error: "unauthorized" }, 401);

  let payload = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const requestedCode = normalizeFamilyCode(payload?.code);
  if (payload?.consentAccepted !== true) {
    return json({ ok: false, error: "family_storage_consent_required" }, 400);
  }
  const now = new Date().toISOString();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = requestedCode || randomFamilyCode();
    try {
      let group = await env.DB.prepare(
        `SELECT code, owner_account_id, created_at, updated_at, item_count
         FROM family_groups WHERE code = ? AND deleted_at IS NULL`
      ).bind(code).first();

      if (requestedCode && !group) {
        return json({ ok: false, error: "group_not_found" }, 404);
      }
      if (!group) {
        await env.DB.prepare(
          `INSERT INTO family_groups
            (code, owner_account_id, created_at, updated_at, last_accessed_at, image_consent_at, item_count, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, NULL)`
        ).bind(code, session.account_id, now, now, now, now).run();
      } else if (!group.owner_account_id) {
        await env.DB.prepare(
          `UPDATE family_groups
           SET owner_account_id = ?, image_consent_at = COALESCE(image_consent_at, ?),
               last_accessed_at = ?, updated_at = ?
           WHERE code = ?`
        ).bind(session.account_id, now, now, now, code).run();
      }

      group = await env.DB.prepare(
        `SELECT code, owner_account_id, created_at, updated_at, item_count
         FROM family_groups WHERE code = ? AND deleted_at IS NULL`
      ).bind(code).first();
      const role = group.owner_account_id === session.account_id ? "owner" : "member";
      if (requestedCode && role !== "owner") {
        const membership = await env.DB.prepare(
          `SELECT role FROM family_group_members WHERE group_code = ? AND account_id = ?`
        ).bind(code, session.account_id).first();
        if (!membership) {
          await env.DB.prepare(
            `INSERT INTO family_group_join_requests
              (group_code, account_id, status, requested_at, decided_at)
             VALUES (?, ?, 'pending', ?, NULL)
             ON CONFLICT(group_code, account_id) DO UPDATE SET
               status = 'pending',
               requested_at = excluded.requested_at,
               decided_at = NULL`
          ).bind(code, session.account_id, now).run();
          return json({
            ok: true,
            pendingApproval: true,
            request: { code, status: "pending", requestedAt: now }
          }, 202);
        }
      }
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO family_group_members (group_code, account_id, role, joined_at, last_seen_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(group_code, account_id) DO UPDATE SET
             role = excluded.role,
             last_seen_at = excluded.last_seen_at`
        ).bind(code, session.account_id, role, now, now),
        env.DB.prepare(
          `UPDATE family_groups SET last_accessed_at = ?, updated_at = ? WHERE code = ?`
        ).bind(now, now, code)
      ]);
      return json({ ok: true, group: { ...group, role } });
    } catch (error) {
      if (requestedCode) return json({ ok: false, error: "create_failed" }, 500);
    }
  }

  return json({ ok: false, error: "code_generation_failed" }, 500);
}

async function handleGetFamilyItems(code, request, env) {
  if (!env.DB) return json({ ok: false, error: "missing_d1_binding" }, 500);
  const access = await authorizedFamilyGroup(code, request, env.DB);
  if (access.error) return access.error;
  const { groupCode, group, session, role } = access;

  const { results } = await env.DB.prepare(
    `SELECT item_id, name, category, storage, expiry_type, expiry, created_at, status, completed_at, favorite, purchase_url, updated_at, image_key
     FROM family_group_items
     WHERE group_code = ? AND deleted = 0
     ORDER BY expiry ASC, name ASC
     LIMIT ?`
  ).bind(groupCode, MAX_FAMILY_ITEMS).all();

  await touchFamilyGroup(env.DB, groupCode, session.account_id);
  return json({
    ok: true,
    group: { ...group, role },
    items: (results || []).map((row) => ({
      id: row.item_id,
      name: row.name,
      category: row.category,
      storage: row.storage,
      expiryType: row.expiry_type,
      expiry: row.expiry,
      createdAt: row.created_at,
      status: row.status === "completed" ? "completed" : "active",
      completedAt: row.completed_at || "",
      favorite: Boolean(row.favorite),
      purchaseUrl: row.purchase_url || "",
      syncedAt: row.updated_at,
      imageUri: row.image_key
        ? `${new URL(request.url).origin}/api/family-groups/${groupCode}/items/${encodeURIComponent(row.item_id)}/image`
        : ""
    }))
  });
}

async function handlePutFamilyItems(code, request, env) {
  if (!env.DB) return json({ ok: false, error: "missing_d1_binding" }, 500);
  const access = await authorizedFamilyGroup(code, request, env.DB);
  if (access.error) return access.error;
  const { groupCode, session } = access;

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const items = normalizeFamilyItems(payload?.items);
  const expectedUpdatedAt = safeString(payload?.expectedUpdatedAt, 40);
  if (expectedUpdatedAt && access.group.updatedAt !== expectedUpdatedAt) {
    return json({
      ok: false,
      error: "family_sync_conflict",
      updatedAt: access.group.updatedAt
    }, 409);
  }
  const now = new Date().toISOString();
  const previousImages = env.FAMILY_IMAGES
    ? await env.DB.prepare(
      `SELECT item_id, image_key FROM family_group_items
       WHERE group_code = ? AND deleted = 0 AND image_key IS NOT NULL`
    ).bind(groupCode).all()
    : { results: [] };

  await env.DB.prepare(
    `UPDATE family_groups
     SET updated_at = ?, last_accessed_at = ?, item_count = ?
     WHERE code = ? AND deleted_at IS NULL`
  ).bind(now, now, items.length, groupCode).run();

  const statements = [
    env.DB.prepare(`UPDATE family_group_items SET deleted = 1, updated_at = ? WHERE group_code = ?`).bind(now, groupCode)
  ];

  for (const item of items) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO family_group_items
          (group_code, item_id, name, category, storage, expiry_type, expiry, created_at, status, completed_at, favorite, purchase_url, updated_at, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
         ON CONFLICT(group_code, item_id) DO UPDATE SET
           name = excluded.name,
           category = excluded.category,
           storage = excluded.storage,
           expiry_type = excluded.expiry_type,
           expiry = excluded.expiry,
           created_at = excluded.created_at,
           status = excluded.status,
           completed_at = excluded.completed_at,
           favorite = excluded.favorite,
           purchase_url = excluded.purchase_url,
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
        item.status,
        item.completedAt,
        item.favorite ? 1 : 0,
        item.purchaseUrl || "",
        now
      )
    );
  }

  await env.DB.batch(statements);
  const activeItemIds = new Set(items.map((item) => item.id));
  const removedImageKeys = (previousImages.results || [])
    .filter((row) => !activeItemIds.has(row.item_id))
    .map((row) => row.image_key)
    .filter(Boolean);
  if (removedImageKeys.length) {
    await env.FAMILY_IMAGES.delete(removedImageKeys);
    await env.DB.prepare(
      `UPDATE family_group_items SET image_key = NULL
       WHERE group_code = ? AND deleted = 1`
    ).bind(groupCode).run();
  }
  await touchFamilyGroup(env.DB, groupCode, session.account_id);

  return json({ ok: true, code: groupCode, itemCount: items.length, updatedAt: now });
}

async function handlePutFamilyImage(code, encodedItemId, request, env) {
  if (!env.DB || !env.FAMILY_IMAGES) return json({ ok: false, error: "missing_family_image_binding" }, 500);
  const access = await authorizedFamilyGroup(code, request, env.DB);
  if (access.error) return access.error;
  const itemId = safeFamilyItemId(encodedItemId);
  if (!itemId) return json({ ok: false, error: "invalid_item_id" }, 400);

  const contentType = String(request.headers.get("Content-Type") || "").split(";")[0].toLowerCase();
  if (!["image/jpeg", "image/webp"].includes(contentType)) {
    return json({ ok: false, error: "unsupported_image_type" }, 415);
  }
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > MAX_FAMILY_IMAGE_BYTES) {
    return json({ ok: false, error: "image_too_large" }, 413);
  }
  const body = await request.arrayBuffer();
  if (!body.byteLength || body.byteLength > MAX_FAMILY_IMAGE_BYTES) {
    return json({ ok: false, error: "image_too_large" }, 413);
  }

  const row = await env.DB.prepare(
    `SELECT item_id FROM family_group_items
     WHERE group_code = ? AND item_id = ? AND deleted = 0`
  ).bind(access.groupCode, itemId).first();
  if (!row) return json({ ok: false, error: "item_not_found" }, 404);

  const extension = contentType === "image/webp" ? "webp" : "jpg";
  const key = `family/${access.groupCode}/${encodeURIComponent(itemId)}.${extension}`;
  await env.FAMILY_IMAGES.put(key, body, {
    httpMetadata: { contentType, cacheControl: "private, max-age=3600" },
    customMetadata: { groupCode: access.groupCode, itemId }
  });
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE family_group_items SET image_key = ?, updated_at = ?
       WHERE group_code = ? AND item_id = ?`
    ).bind(key, new Date().toISOString(), access.groupCode, itemId),
    env.DB.prepare(
      `UPDATE family_groups SET last_accessed_at = ? WHERE code = ?`
    ).bind(new Date().toISOString(), access.groupCode)
  ]);

  return json({
    ok: true,
    imageUri: `${new URL(request.url).origin}/api/family-groups/${access.groupCode}/items/${encodeURIComponent(itemId)}/image`
  });
}

async function handleGetFamilyImage(code, encodedItemId, request, env) {
  if (!env.DB || !env.FAMILY_IMAGES) return json({ ok: false, error: "missing_family_image_binding" }, 500);
  const access = await authorizedFamilyGroup(code, request, env.DB);
  if (access.error) return access.error;
  const itemId = safeFamilyItemId(encodedItemId);
  if (!itemId) return json({ ok: false, error: "invalid_item_id" }, 400);

  const row = await env.DB.prepare(
    `SELECT image_key FROM family_group_items
     WHERE group_code = ? AND item_id = ? AND deleted = 0`
  ).bind(access.groupCode, itemId).first();
  if (!row?.image_key) return json({ ok: false, error: "image_not_found" }, 404);
  const object = await env.FAMILY_IMAGES.get(row.image_key);
  if (!object) return json({ ok: false, error: "image_not_found" }, 404);

  const headers = new Headers(corsHeaders);
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  headers.set("Cache-Control", "private, max-age=3600");
  return new Response(object.body, { headers });
}

async function handleLeaveFamilyGroup(code, request, env) {
  if (!env.DB) return json({ ok: false, error: "missing_d1_binding" }, 500);
  const access = await authorizedFamilyGroup(code, request, env.DB);
  if (access.error) return access.error;
  if (access.role === "owner") {
    return json({ ok: false, error: "owner_must_delete_group" }, 409);
  }
  await env.DB.prepare(
    `DELETE FROM family_group_members WHERE group_code = ? AND account_id = ?`
  ).bind(access.groupCode, access.session.account_id).run();
  return json({ ok: true });
}

async function handleGetFamilyMembers(code, request, env) {
  if (!env.DB) return json({ ok: false, error: "missing_d1_binding" }, 500);
  const access = await authorizedFamilyGroup(code, request, env.DB);
  if (access.error) return access.error;
  const result = await env.DB.prepare(
    `SELECT m.account_id, m.role, m.joined_at, a.display_name, a.avatar_url
     FROM family_group_members m
     JOIN accounts a ON a.id = m.account_id
     WHERE m.group_code = ?
     ORDER BY CASE WHEN m.role = 'owner' THEN 0 ELSE 1 END, m.joined_at ASC`
  ).bind(access.groupCode).all();
  await touchFamilyGroup(env.DB, access.groupCode, access.session.account_id);
  return json({
    ok: true,
    members: (result.results || []).map((member) => ({
      id: member.account_id,
      displayName: member.display_name || "가족",
      avatarUrl: normalizeAvatarUrl(member.avatar_url || ""),
      role: member.role,
      joinedAt: member.joined_at,
      isMe: member.account_id === access.session.account_id
    }))
  });
}

async function handleGetFamilyJoinRequests(code, request, env) {
  if (!env.DB) return json({ ok: false, error: "missing_d1_binding" }, 500);
  const access = await authorizedFamilyGroup(code, request, env.DB);
  if (access.error) return access.error;
  if (access.role !== "owner") return json({ ok: false, error: "owner_required" }, 403);
  const result = await env.DB.prepare(
    `SELECT r.account_id, r.status, r.requested_at, a.display_name, a.avatar_url
     FROM family_group_join_requests r
     JOIN accounts a ON a.id = r.account_id
     WHERE r.group_code = ? AND r.status = 'pending'
     ORDER BY r.requested_at ASC`
  ).bind(access.groupCode).all();
  return json({
    ok: true,
    requests: (result.results || []).map((entry) => ({
      id: entry.account_id,
      displayName: entry.display_name || "사용자",
      avatarUrl: normalizeAvatarUrl(entry.avatar_url || ""),
      status: entry.status,
      requestedAt: entry.requested_at
    }))
  });
}

async function handleGetMyFamilyJoinRequest(code, request, env) {
  if (!env.DB) return json({ ok: false, error: "missing_d1_binding" }, 500);
  const groupCode = normalizeFamilyCode(code);
  if (!groupCode) return json({ ok: false, error: "invalid_code" }, 400);
  const session = await authenticatedSession(request, env.DB);
  if (!session) return json({ ok: false, error: "unauthorized" }, 401);
  const group = await env.DB.prepare(
    `SELECT code FROM family_groups WHERE code = ? AND deleted_at IS NULL`
  ).bind(groupCode).first();
  if (!group) return json({ ok: false, error: "group_not_found" }, 404);
  const member = await env.DB.prepare(
    `SELECT role FROM family_group_members WHERE group_code = ? AND account_id = ?`
  ).bind(groupCode, session.account_id).first();
  if (member) return json({ ok: true, status: "approved", role: member.role });
  const requestEntry = await env.DB.prepare(
    `SELECT status, requested_at, decided_at
     FROM family_group_join_requests WHERE group_code = ? AND account_id = ?`
  ).bind(groupCode, session.account_id).first();
  return json({
    ok: true,
    status: requestEntry?.status || "none",
    requestedAt: requestEntry?.requested_at || null,
    decidedAt: requestEntry?.decided_at || null
  });
}

async function handleDecideFamilyJoinRequest(code, accountId, request, env) {
  if (!env.DB) return json({ ok: false, error: "missing_d1_binding" }, 500);
  const access = await authorizedFamilyGroup(code, request, env.DB);
  if (access.error) return access.error;
  if (access.role !== "owner") return json({ ok: false, error: "owner_required" }, 403);
  let payload = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }
  const action = payload?.action;
  if (action !== "approve" && action !== "reject") {
    return json({ ok: false, error: "invalid_join_request_action" }, 400);
  }
  const pending = await env.DB.prepare(
    `SELECT account_id FROM family_group_join_requests
     WHERE group_code = ? AND account_id = ? AND status = 'pending'`
  ).bind(access.groupCode, accountId).first();
  if (!pending) return json({ ok: false, error: "join_request_not_found" }, 404);
  const now = new Date().toISOString();
  const statements = [
    env.DB.prepare(
      `UPDATE family_group_join_requests SET status = ?, decided_at = ?
       WHERE group_code = ? AND account_id = ?`
    ).bind(action === "approve" ? "approved" : "rejected", now, access.groupCode, accountId)
  ];
  if (action === "approve") {
    statements.push(
      env.DB.prepare(
        `INSERT INTO family_group_members (group_code, account_id, role, joined_at, last_seen_at)
         VALUES (?, ?, 'member', ?, ?)
         ON CONFLICT(group_code, account_id) DO UPDATE SET
           role = 'member',
           last_seen_at = excluded.last_seen_at`
      ).bind(access.groupCode, accountId, now, now)
    );
  }
  await env.DB.batch(statements);
  return json({ ok: true, status: action === "approve" ? "approved" : "rejected" });
}

async function handleRemoveFamilyMember(code, accountId, request, env) {
  if (!env.DB) return json({ ok: false, error: "missing_d1_binding" }, 500);
  const access = await authorizedFamilyGroup(code, request, env.DB);
  if (access.error) return access.error;
  if (access.role !== "owner") return json({ ok: false, error: "owner_required" }, 403);
  if (accountId === access.session.account_id) {
    return json({ ok: false, error: "owner_cannot_remove_self" }, 409);
  }
  const member = await env.DB.prepare(
    `SELECT role FROM family_group_members WHERE group_code = ? AND account_id = ?`
  ).bind(access.groupCode, accountId).first();
  if (!member) return json({ ok: false, error: "member_not_found" }, 404);
  if (member.role === "owner") return json({ ok: false, error: "owner_cannot_be_removed" }, 409);
  await env.DB.prepare(
    `DELETE FROM family_group_members WHERE group_code = ? AND account_id = ?`
  ).bind(access.groupCode, accountId).run();
  return json({ ok: true });
}

async function handleGetGrowthProfile(request, env) {
  if (!env.DB) return json({ ok: false, error: "missing_d1_binding" }, 500);
  const session = await authenticatedSession(request, env.DB);
  if (!session) return json({ ok: false, error: "unauthorized" }, 401);
  return json({
    ok: true,
    profile: await growthProfileForAccount(env.DB, session.account_id),
    report: await growthReportForAccount(env.DB, session.account_id)
  });
}

async function handleGetGrowthReport(request, env) {
  if (!env.DB) return json({ ok: false, error: "missing_d1_binding" }, 500);
  const session = await authenticatedSession(request, env.DB);
  if (!session) return json({ ok: false, error: "unauthorized" }, 401);
  return json({
    ok: true,
    report: await growthReportForAccount(env.DB, session.account_id)
  });
}

async function handlePutGrowthEvents(request, env) {
  if (!env.DB) return json({ ok: false, error: "missing_d1_binding" }, 500);
  const session = await authenticatedSession(request, env.DB);
  if (!session) return json({ ok: false, error: "unauthorized" }, 401);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const events = normalizeGrowthEvents(payload?.events);
  if (events.length) {
    const statements = events.map((event) =>
      env.DB.prepare(
        `INSERT OR IGNORE INTO growth_events
          (id, account_id, event_key, type, item_id, xp_delta, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(),
        session.account_id,
        event.eventKey,
        event.type,
        event.itemId,
        event.xpDelta,
        event.metadata,
        event.createdAt
      )
    );
    await env.DB.batch(statements);
  }

  return json({
    ok: true,
    profile: await growthProfileForAccount(env.DB, session.account_id),
    report: await growthReportForAccount(env.DB, session.account_id)
  });
}

async function growthProfileForAccount(db, accountId) {
  const summary = await db.prepare(
    `SELECT
       COALESCE(SUM(xp_delta), 0) AS xp,
       COUNT(*) AS events_count,
       SUM(CASE WHEN type IN ('complete', 'complete_urgent') AND xp_delta > 0 THEN 1 ELSE 0 END) AS completed_before_expiry
     FROM growth_events
     WHERE account_id = ?`
  ).bind(accountId).first();

  const xp = Math.max(0, Number(summary?.xp || 0));
  const level = growthLevelForXp(xp);
  const currentThreshold = GROWTH_LEVEL_XP_THRESHOLDS[level - 1] || 0;
  const nextThreshold = GROWTH_LEVEL_XP_THRESHOLDS[level] || currentThreshold;
  const range = Math.max(1, nextThreshold - currentThreshold);
  const progressXp = Math.max(0, xp - currentThreshold);

  return {
    xp,
    level,
    percent: level >= 10 ? 100 : Math.min(95, Math.max(8, Math.round((progressXp / range) * 100))),
    remainingXp: level >= 10 ? 0 : Math.max(0, nextThreshold - xp),
    completedBeforeExpiry: Number(summary?.completed_before_expiry || 0),
    eventsCount: Number(summary?.events_count || 0)
  };
}

async function growthReportForAccount(db, accountId) {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);
  weekStart.setUTCHours(0, 0, 0, 0);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const summary = await db.prepare(
    `SELECT
       SUM(CASE WHEN created_at >= ? AND type IN ('complete', 'complete_urgent') THEN 1 ELSE 0 END) AS week_completed,
       SUM(CASE WHEN created_at >= ? AND type IN ('complete', 'complete_urgent') THEN 1 ELSE 0 END) AS month_completed,
       SUM(CASE WHEN created_at >= ? AND type = 'register' THEN 1 ELSE 0 END) AS week_registered,
       SUM(CASE WHEN created_at >= ? AND type = 'register' THEN 1 ELSE 0 END) AS month_registered,
       SUM(CASE WHEN created_at >= ? AND type = 'expired' THEN 1 ELSE 0 END) AS week_expired,
       SUM(CASE WHEN created_at >= ? AND type = 'expired' THEN 1 ELSE 0 END) AS month_expired
     FROM growth_events
     WHERE account_id = ?`
  ).bind(
    weekStart.toISOString(),
    monthStart.toISOString(),
    weekStart.toISOString(),
    monthStart.toISOString(),
    weekStart.toISOString(),
    monthStart.toISOString(),
    accountId
  ).first();

  const report = {
    weekCompleted: Number(summary?.week_completed || 0),
    monthCompleted: Number(summary?.month_completed || 0),
    weekRegistered: Number(summary?.week_registered || 0),
    monthRegistered: Number(summary?.month_registered || 0),
    weekExpired: Number(summary?.week_expired || 0),
    monthExpired: Number(summary?.month_expired || 0)
  };

  return {
    ...report,
    ...growthReportCopy(report)
  };
}

function growthReportCopy(report) {
  if (report.weekCompleted > 0) {
    return {
      title: "이번 주 리포트",
      body: `${report.weekCompleted}개를 버리기 전에 챙겼어요.`
    };
  }
  if (report.monthCompleted > 0) {
    return {
      title: "이번 달 리포트",
      body: `${report.monthCompleted}개를 잘 관리했어요.`
    };
  }
  if (report.weekExpired > 0 || report.monthExpired > 0) {
    return {
      title: "정리가 필요해요",
      body: "만료된 상품을 확인해 주세요."
    };
  }
  if (report.weekRegistered > 0 || report.monthRegistered > 0) {
    return {
      title: "관리 리듬 좋아요",
      body: "새로 등록한 상품을 차근차근 챙겨요."
    };
  }
  return {
    title: "관리 리듬 좋아요",
    body: "지금 급한 상품이 없어요."
  };
}

function growthLevelForXp(xp) {
  const levelIndex = GROWTH_LEVEL_XP_THRESHOLDS.reduce((currentLevel, threshold, index) => {
    return xp >= threshold ? index : currentLevel;
  }, 0);
  return Math.min(10, levelIndex + 1);
}

function normalizeGrowthEvents(events) {
  if (!Array.isArray(events)) return [];
  return events.slice(0, MAX_GROWTH_EVENTS_PER_REQUEST).map((event) => {
    const type = normalizeGrowthEventType(event?.type);
    const eventKey = safeString(event?.eventKey, 120);
    const xpDelta = Number.isInteger(event?.xpDelta)
      ? Math.max(-30, Math.min(30, event.xpDelta))
      : 0;
    if (!type || !eventKey || !xpDelta) return null;
    const createdAt = safeString(event?.createdAt, 40);
    return {
      type,
      eventKey,
      xpDelta,
      itemId: safeString(event?.itemId, 80) || null,
      metadata: JSON.stringify(event?.metadata && typeof event.metadata === "object" ? event.metadata : {}),
      createdAt: /^\d{4}-\d{2}-\d{2}T/.test(createdAt) ? createdAt : new Date().toISOString()
    };
  }).filter(Boolean);
}

function normalizeGrowthEventType(type) {
  const value = safeString(type, 40);
  return ["register", "complete", "complete_urgent", "expired"].includes(value) ? value : "";
}

async function handleDeleteFamilyGroup(code, request, env) {
  if (!env.DB) return json({ ok: false, error: "missing_d1_binding" }, 500);
  const access = await authorizedFamilyGroup(code, request, env.DB);
  if (access.error) return access.error;
  if (access.role !== "owner") return json({ ok: false, error: "owner_required" }, 403);
  await deleteFamilyGroupData(access.groupCode, env);
  return json({ ok: true });
}

async function authorizedFamilyGroup(code, request, db) {
  const groupCode = normalizeFamilyCode(code);
  if (!groupCode) return { error: json({ ok: false, error: "invalid_code" }, 400) };
  const session = await authenticatedSession(request, db);
  if (!session) return { error: json({ ok: false, error: "unauthorized" }, 401) };
  const member = await db.prepare(
    `SELECT g.code, g.owner_account_id, g.created_at, g.updated_at, g.item_count, m.role
     FROM family_groups g
     JOIN family_group_members m ON m.group_code = g.code
     WHERE g.code = ? AND m.account_id = ? AND g.deleted_at IS NULL
     LIMIT 1`
  ).bind(groupCode, session.account_id).first();
  if (!member) return { error: json({ ok: false, error: "family_access_denied" }, 403) };
  return {
    groupCode,
    session,
    role: member.role,
    group: {
      code: member.code,
      ownerAccountId: member.owner_account_id,
      createdAt: member.created_at,
      updatedAt: member.updated_at,
      itemCount: member.item_count
    }
  };
}

async function touchFamilyGroup(db, groupCode, accountId) {
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`UPDATE family_groups SET last_accessed_at = ? WHERE code = ?`).bind(now, groupCode),
    db.prepare(
      `UPDATE family_group_members SET last_seen_at = ? WHERE group_code = ? AND account_id = ?`
    ).bind(now, groupCode, accountId)
  ]);
}

function safeFamilyItemId(value) {
  try {
    const decoded = decodeURIComponent(value);
    return decoded
      && decoded.length <= 80
      && !/[\u0000-\u001f\u007f/\\]/.test(decoded)
      ? decoded
      : "";
  } catch {
    return "";
  }
}

async function deleteFamilyGroupData(groupCode, env) {
  if (env.FAMILY_IMAGES) await deleteR2Prefix(env.FAMILY_IMAGES, `family/${groupCode}/`);
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM family_group_items WHERE group_code = ?`).bind(groupCode),
    env.DB.prepare(`DELETE FROM family_group_join_requests WHERE group_code = ?`).bind(groupCode),
    env.DB.prepare(`DELETE FROM family_group_members WHERE group_code = ?`).bind(groupCode),
    env.DB.prepare(`DELETE FROM family_groups WHERE code = ?`).bind(groupCode)
  ]);
}

async function deleteR2Prefix(bucket, prefix) {
  let cursor;
  do {
    const listed = await bucket.list({ prefix, cursor, limit: 1000 });
    if (listed.objects.length) await bucket.delete(listed.objects.map((object) => object.key));
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
}

async function deleteStaleFamilyGroups(env) {
  if (!env.DB) return;
  const cutoff = new Date(Date.now() - FAMILY_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const result = await env.DB.prepare(
    `SELECT code FROM family_groups
     WHERE deleted_at IS NULL AND COALESCE(last_accessed_at, updated_at, created_at) < ?
     LIMIT 100`
  ).bind(cutoff).all();
  for (const row of result.results || []) await deleteFamilyGroupData(row.code, env);
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

function normalizeAvatarUrl(value) {
  const url = safeString(value, 500);
  if (!url) return "";
  if (url.startsWith("http://k.kakaocdn.net/")) {
    return `https://${url.slice("http://".length)}`;
  }
  return url;
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
    createdAt: safeString(item?.createdAt, 40),
    status: item?.status === "completed" ? "completed" : "active",
    completedAt: item?.status === "completed" ? safeString(item?.completedAt, 40) : "",
    favorite: Boolean(item?.favorite),
    purchaseUrl: safeString(item?.purchaseUrl, 2000)
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


