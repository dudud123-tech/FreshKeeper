import AsyncStorage from "@react-native-async-storage/async-storage";
import { requireOptionalNativeModule } from "expo-modules-core";
import { getClientId } from "./clientIdentity";

const AUTH_API_BASE = "https://freshkeeper-ocr-feedback.dndud123.workers.dev/api/auth";
const AUTH_TOKEN_KEY = "fresh-keeper-auth-token-v1";
const AUTH_USER_KEY = "fresh-keeper-auth-user-v1";
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "";
const KAKAO_NATIVE_APP_KEY = process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY || "";
const NAVER_CLIENT_ID = process.env.EXPO_PUBLIC_NAVER_CLIENT_ID || "";
const NAVER_CLIENT_SECRET = process.env.EXPO_PUBLIC_NAVER_CLIENT_SECRET || "";
const NAVER_APP_NAME = "오늘까지야";

let sessionToken = "";
let secureStoreModulePromise = null;
let initializedKakaoAppKey = "";
let initializedNaverCredentials = "";

export function isGoogleLoginConfigured() {
  return Boolean(GOOGLE_WEB_CLIENT_ID);
}

export function isKakaoLoginConfigured() {
  return Boolean(KAKAO_NATIVE_APP_KEY);
}

export function isNaverLoginConfigured() {
  return Boolean(NAVER_CLIENT_ID && NAVER_CLIENT_SECRET);
}

export async function restoreAuthSession() {
  const token = await authToken();
  if (!token) return { user: null, configured: isGoogleLoginConfigured() };

  try {
    const response = await fetch(`${AUTH_API_BASE}/session`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (response.status === 401) {
      await clearStoredAuth();
      return { user: null, configured: isGoogleLoginConfigured() };
    }
    if (!response.ok) throw new Error(`auth_session_failed_${response.status}`);
    const body = await response.json();
    await authStorageSet(AUTH_USER_KEY, JSON.stringify(body.user || null));
    return { user: body.user || null, configured: isGoogleLoginConfigured() };
  } catch {
    return {
      user: await storedUser(),
      configured: isGoogleLoginConfigured(),
      offline: true
    };
  }
}

export async function signInWithGoogle() {
  if (!GOOGLE_WEB_CLIENT_ID) throw new Error("google_client_id_missing");

  const google = await import("react-native-nitro-google-signin");
  const {
    GoogleOneTapSignIn,
    isCancelledResponse,
    isNoSavedCredentialFoundResponse,
    isSuccessResponse
  } = google;

  GoogleOneTapSignIn.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    scopes: ["openid", "profile", "email"]
  });
  await GoogleOneTapSignIn.checkPlayServices();

  let result = await GoogleOneTapSignIn.signIn();
  if (isNoSavedCredentialFoundResponse(result)) {
    result = await GoogleOneTapSignIn.createAccount();
  }
  if (isNoSavedCredentialFoundResponse(result)) {
    result = await GoogleOneTapSignIn.presentExplicitSignIn();
  }
  if (isCancelledResponse(result)) return { cancelled: true, user: null };
  if (!isSuccessResponse(result) || !result.data?.idToken) {
    throw new Error("google_id_token_missing");
  }

  const clientId = await getClientId();
  const response = await fetch(`${AUTH_API_BASE}/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idToken: result.data.idToken,
      clientId
    })
  });
  if (!response.ok) {
    const body = await safeJson(response);
    throw new Error(body?.error || `google_login_failed_${response.status}`);
  }

  const body = await response.json();
  sessionToken = body.token || "";
  await authStorageSet(AUTH_TOKEN_KEY, sessionToken);
  await authStorageSet(AUTH_USER_KEY, JSON.stringify(body.user || null));
  return { cancelled: false, user: body.user || null, expiresAt: body.expiresAt || "" };
}

export async function signInWithKakao() {
  if (!KAKAO_NATIVE_APP_KEY) throw new Error("kakao_native_app_key_missing");

  await initializeKakao();
  const { login, me } = await import("@react-native-kakao/user");
  const result = await login();
  if (!result?.idToken) throw new Error("kakao_id_token_missing");
  const profile = await me().catch(() => null);

  const clientId = await getClientId();
  const response = await fetch(`${AUTH_API_BASE}/kakao`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idToken: result.idToken,
      clientId,
      profile: profile ? {
        email: profile.email || "",
        nickname: profile.nickname || "",
        profileImageUrl: profile.profileImageUrl || profile.thumbnailImageUrl || ""
      } : null
    })
  });
  if (!response.ok) {
    const body = await safeJson(response);
    throw new Error(body?.error || `kakao_login_failed_${response.status}`);
  }

  const body = await response.json();
  sessionToken = body.token || "";
  await authStorageSet(AUTH_TOKEN_KEY, sessionToken);
  await authStorageSet(AUTH_USER_KEY, JSON.stringify(body.user || null));
  return { cancelled: false, user: body.user || null, expiresAt: body.expiresAt || "" };
}

export async function signInWithNaver() {
  if (!isNaverLoginConfigured()) throw new Error("naver_credentials_missing");

  const NaverLogin = await initializeNaver();
  const result = await NaverLogin.login();
  if (!result?.isSuccess || !result.successResponse?.accessToken) {
    if (result?.failureResponse?.isCancel) return { cancelled: true, user: null };
    throw new Error(
      result?.failureResponse?.lastErrorDescriptionFromNaverSDK
      || result?.failureResponse?.message
      || result?.failureResponse?.lastErrorCodeFromNaverSDK
      || "naver_access_token_missing"
    );
  }

  const clientId = await getClientId();
  const response = await fetch(`${AUTH_API_BASE}/naver`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accessToken: result.successResponse.accessToken,
      clientId
    })
  });
  if (!response.ok) {
    const body = await safeJson(response);
    throw new Error(body?.error || `naver_login_failed_${response.status}`);
  }

  const body = await response.json();
  sessionToken = body.token || "";
  await authStorageSet(AUTH_TOKEN_KEY, sessionToken);
  await authStorageSet(AUTH_USER_KEY, JSON.stringify(body.user || null));
  return { cancelled: false, user: body.user || null, expiresAt: body.expiresAt || "" };
}

export async function signOutAccount() {
  const token = await authToken();
  if (token) {
    try {
      await fetch(`${AUTH_API_BASE}/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch {
      // Local logout must still succeed if the network is unavailable.
    }
  }

  try {
    const { GoogleOneTapSignIn } = await import("react-native-nitro-google-signin");
    await GoogleOneTapSignIn.signOut();
  } catch {
    // Native Google module may not exist until the next development build.
  }
  try {
    if (KAKAO_NATIVE_APP_KEY) {
      await initializeKakao();
      const { logout } = await import("@react-native-kakao/user");
      await logout();
    }
  } catch {
    // Kakao may not be linked yet, or this device may not have a Kakao token.
  }
  try {
    if (isNaverLoginConfigured()) {
      const NaverLogin = await initializeNaver();
      await NaverLogin.logout();
    }
  } catch {
    // Naver may not be linked yet, or this device may not have a Naver token.
  }
  await clearStoredAuth();
}

export async function getAuthHeaders() {
  const token = await authToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getCachedAuthHeaders() {
  return sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {};
}

export async function deleteAccount() {
  const token = await authToken();
  if (!token) throw new Error("auth_required");
  const response = await fetch(`${AUTH_API_BASE}/account`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) {
    const body = await safeJson(response);
    throw new Error(body?.error || `account_delete_failed_${response.status}`);
  }
  await clearStoredAuth();
}

async function authToken() {
  if (sessionToken) return sessionToken;
  sessionToken = await authStorageGet(AUTH_TOKEN_KEY) || "";
  return sessionToken;
}

async function storedUser() {
  try {
    return JSON.parse(await authStorageGet(AUTH_USER_KEY) || "null");
  } catch {
    return null;
  }
}

async function clearStoredAuth() {
  sessionToken = "";
  await Promise.all([
    authStorageDelete(AUTH_TOKEN_KEY),
    authStorageDelete(AUTH_USER_KEY)
  ]);
}

async function authStorageGet(key) {
  try {
    const SecureStore = await secureStoreModule();
    return await SecureStore.getItemAsync(key);
  } catch {
    return AsyncStorage.getItem(key);
  }
}

async function authStorageSet(key, value) {
  try {
    const SecureStore = await secureStoreModule();
    await SecureStore.setItemAsync(key, value);
    await AsyncStorage.removeItem(key);
  } catch {
    await AsyncStorage.setItem(key, value);
  }
}

async function authStorageDelete(key) {
  await AsyncStorage.removeItem(key);
  try {
    const SecureStore = await secureStoreModule();
    await SecureStore.deleteItemAsync(key);
  } catch {
    // A development build created before SecureStore was linked can still log out locally.
  }
}

async function secureStoreModule() {
  if (!secureStoreModulePromise) {
    if (!requireOptionalNativeModule("ExpoSecureStore")) {
      throw new Error("expo_secure_store_unavailable");
    }
    secureStoreModulePromise = import("expo-secure-store");
  }
  return secureStoreModulePromise;
}

async function initializeKakao() {
  if (initializedKakaoAppKey === KAKAO_NATIVE_APP_KEY) return;
  const { initializeKakaoSDK } = await import("@react-native-kakao/core");
  await initializeKakaoSDK(KAKAO_NATIVE_APP_KEY);
  initializedKakaoAppKey = KAKAO_NATIVE_APP_KEY;
}

async function initializeNaver() {
  const credentialsKey = `${NAVER_CLIENT_ID}:${NAVER_CLIENT_SECRET}`;
  const { default: NaverLogin } = await import("@react-native-seoul/naver-login");
  if (initializedNaverCredentials !== credentialsKey) {
    NaverLogin.initialize({
      appName: NAVER_APP_NAME,
      consumerKey: NAVER_CLIENT_ID,
      consumerSecret: NAVER_CLIENT_SECRET,
      serviceUrlSchemeIOS: "freshkeeper-naver",
      disableNaverAppAuthIOS: true
    });
    initializedNaverCredentials = credentialsKey;
  }
  return NaverLogin;
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}
