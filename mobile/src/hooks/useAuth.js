import { useEffect, useState } from "react";
import {
  deleteAccount,
  isGoogleLoginConfigured,
  isKakaoLoginConfigured,
  isNaverLoginConfigured,
  restoreAuthSession,
  signInWithGoogle,
  signInWithKakao,
  signInWithNaver,
  signOutAccount
} from "../services/authApi";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authProviderBusy, setAuthProviderBusy] = useState("");
  const [authStatus, setAuthStatus] = useState(
    isGoogleLoginConfigured() || isKakaoLoginConfigured() || isNaverLoginConfigured()
      ? "로그인하면 상품 설정을 다른 기기에서도 이어서 사용할 수 있어요."
      : "소셜 로그인 설정이 필요합니다."
  );

  useEffect(() => {
    restoreAuthSession()
      .then((result) => {
        setUser(result.user || null);
        if (result.user) {
          setAuthStatus(result.offline ? "오프라인 상태로 저장된 계정을 사용 중입니다." : "로그인되어 있습니다.");
        }
      })
      .catch(() => setAuthStatus("로그인 정보를 확인하지 못했습니다."))
      .finally(() => setAuthReady(true));
  }, []);

  async function loginWithGoogle() {
    if (authBusy) return;
    try {
      setAuthBusy(true);
      setAuthProviderBusy("google");
      setAuthStatus("Google 계정을 확인하는 중입니다.");
      const result = await signInWithGoogle();
      if (result.cancelled) {
        setAuthStatus("Google 로그인을 취소했습니다.");
        return;
      }
      setUser(result.user || null);
      setAuthStatus("기존 상품 설정을 계정에 연결했습니다.");
    } catch (error) {
      const message = String(error?.message || "");
      console.warn("Google login failed", error);
      if (message.includes("google_client_id_missing")) {
        setAuthStatus("Google Cloud Client ID 설정이 필요합니다.");
      } else if (/developer console is not set up correctly|DEVELOPER_ERROR|\[28444\]/i.test(message)) {
        setAuthStatus("Google Cloud의 Android 앱 설정이 아직 반영되지 않았습니다. 잠시 후 다시 시도해 주세요.");
      } else if (/native module|nitro/i.test(message)) {
        setAuthStatus("Google 로그인을 사용하려면 새 개발 빌드가 필요합니다.");
      } else if (message.includes("google_auth_not_configured")) {
        setAuthStatus("로그인 서버에 Google Client ID 설정이 필요합니다.");
      } else {
        setAuthStatus(`Google 로그인에 실패했습니다. (${message.slice(0, 100) || "알 수 없는 오류"})`);
      }
    } finally {
      setAuthBusy(false);
      setAuthProviderBusy("");
      setAuthReady(true);
    }
  }

  async function loginWithKakao() {
    if (authBusy) return;
    try {
      setAuthBusy(true);
      setAuthProviderBusy("kakao");
      setAuthStatus("카카오 계정을 확인하는 중입니다.");
      const result = await signInWithKakao();
      setUser(result.user || null);
      setAuthStatus("기존 상품 설정을 계정에 연결했습니다.");
    } catch (error) {
      const message = String(error?.message || "");
      console.warn("Kakao login failed", error);
      if (/cancel|canceled|cancelled|취소/i.test(message)) {
        setAuthStatus("카카오 로그인을 취소했습니다.");
      } else if (message.includes("kakao_native_app_key_missing")) {
        setAuthStatus("카카오 네이티브 앱 키 설정이 필요합니다.");
      } else if (/native module|doesn't seem to be linked|TurboModule/i.test(message)) {
        setAuthStatus("카카오 로그인을 사용하려면 새 개발 빌드가 필요합니다.");
      } else if (message.includes("kakao_auth_not_configured")) {
        setAuthStatus("로그인 서버에 카카오 앱 키 설정이 필요합니다.");
      } else {
        setAuthStatus(`카카오 로그인에 실패했습니다. (${message.slice(0, 100) || "알 수 없는 오류"})`);
      }
    } finally {
      setAuthBusy(false);
      setAuthProviderBusy("");
      setAuthReady(true);
    }
  }

  async function loginWithNaver() {
    if (authBusy) return;
    try {
      setAuthBusy(true);
      setAuthProviderBusy("naver");
      setAuthStatus("네이버 계정을 확인하는 중입니다.");
      const result = await signInWithNaver();
      if (result.cancelled) {
        setAuthStatus("네이버 로그인을 취소했습니다.");
        return;
      }
      setUser(result.user || null);
      setAuthStatus("기존 상품 설정을 계정에 연결했습니다.");
    } catch (error) {
      const message = String(error?.message || "");
      console.warn("Naver login failed", error);
      if (/cancel|canceled|cancelled|취소/i.test(message)) {
        setAuthStatus("네이버 로그인을 취소했습니다.");
      } else if (message.includes("naver_credentials_missing")) {
        setAuthStatus("네이버 Client ID와 Client Secret 설정이 필요합니다.");
      } else if (/native module|doesn't seem to be linked|TurboModule/i.test(message)) {
        setAuthStatus("네이버 로그인을 사용하려면 새 개발 빌드가 필요합니다.");
      } else {
        setAuthStatus(`네이버 로그인에 실패했습니다. (${message.slice(0, 100) || "알 수 없는 오류"})`);
      }
    } finally {
      setAuthBusy(false);
      setAuthProviderBusy("");
      setAuthReady(true);
    }
  }

  async function logout() {
    if (authBusy) return;
    try {
      setAuthBusy(true);
      setAuthProviderBusy("logout");
      await signOutAccount();
      setUser(null);
      setAuthStatus("로그아웃했습니다. 기기에서는 계속 사용할 수 있습니다.");
    } finally {
      setAuthBusy(false);
      setAuthProviderBusy("");
    }
  }

  async function removeAccount() {
    if (authBusy) return;
    try {
      setAuthBusy(true);
      setAuthProviderBusy("delete");
      await deleteAccount();
      await signOutAccount();
      setUser(null);
      setAuthStatus("계정과 서버 데이터를 삭제했습니다.");
    } catch (error) {
      setAuthStatus(`계정 삭제에 실패했습니다. (${String(error?.message || "알 수 없는 오류").slice(0, 100)})`);
    } finally {
      setAuthBusy(false);
      setAuthProviderBusy("");
    }
  }

  return {
    user,
    authReady,
    authBusy,
    authProviderBusy,
    authStatus,
    googleLoginConfigured: isGoogleLoginConfigured(),
    kakaoLoginConfigured: isKakaoLoginConfigured(),
    naverLoginConfigured: isNaverLoginConfigured(),
    loginWithGoogle,
    loginWithKakao,
    loginWithNaver,
    logout,
    removeAccount
  };
}
