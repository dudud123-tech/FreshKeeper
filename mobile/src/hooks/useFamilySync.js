import { useEffect, useRef, useState } from "react";
import { Alert, AppState, Share } from "react-native";
import {
  cleanItemForFamilySync,
  createOrOpenFamilyGroup,
  decideFamilyJoinRequest,
  deleteFamilyGroup,
  familySnapshot,
  fetchFamilyItems,
  fetchFamilyJoinRequests,
  fetchFamilyMembers,
  fetchMyFamilyJoinRequest,
  leaveFamilyGroup,
  normalizeFamilyCode,
  putFamilyItems,
  removeFamilyMember,
  uploadFamilyItemImage
} from "../services/familyApi";
import { daysUntil, todayIso } from "../utils/date";
import { buildFamilyShareMessage } from "../utils/familyShare";

export const DEFAULT_FAMILY_SETTINGS = {
  enabled: false,
  code: "",
  role: "",
  consentAccepted: false,
  pendingCode: "",
  pendingMode: "replace"
};

export function normalizeFamilySettings(value) {
  return { ...DEFAULT_FAMILY_SETTINGS, ...(value || {}) };
}

export function useFamilySync({ items, setItems, settingsReady, reminderDays, defaultExpiryType, authUser }) {
  const [familySettings, setFamilySettings] = useState(DEFAULT_FAMILY_SETTINGS);
  const [familyCodeInput, setFamilyCodeInput] = useState("");
  const [familyStatus, setFamilyStatus] = useState("공유 보관함 꺼짐");
  const [familyItemCount, setFamilyItemCount] = useState(0);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [familyJoinRequests, setFamilyJoinRequests] = useState([]);
  const familySyncTimerRef = useRef(null);
  const familyPullingRef = useRef(false);
  const familyPushingRef = useRef(false);
  const lastFamilySnapshotRef = useRef("");
  const familyVersionRef = useRef("");

  useEffect(() => {
    if (!settingsReady || !authUser || !familySettings.enabled || !familySettings.code) return;
    pullFamilyItems(familySettings.code, { silent: true });
  }, [settingsReady, authUser?.id, familySettings.enabled, familySettings.code]);

  useEffect(() => {
    if (!settingsReady || !authUser || !familySettings.pendingCode || familySettings.enabled) return;
    const checkPendingRequest = () => checkFamilyJoinRequest(familySettings.pendingCode, { silent: true });
    checkPendingRequest();
    const intervalId = setInterval(checkPendingRequest, 15_000);
    return () => clearInterval(intervalId);
  }, [settingsReady, authUser?.id, familySettings.pendingCode, familySettings.enabled]);

  useEffect(() => {
    if (!settingsReady || !authUser || !familySettings.enabled || !familySettings.code || familySettings.role !== "owner") return;
    const refreshOwnerRequests = () => refreshFamilyJoinRequests(familySettings.code);
    refreshOwnerRequests();
    const intervalId = setInterval(refreshOwnerRequests, 10_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshOwnerRequests();
    });
    return () => {
      clearInterval(intervalId);
      subscription.remove();
    };
  }, [settingsReady, authUser?.id, familySettings.enabled, familySettings.code, familySettings.role]);

  useEffect(() => {
    if (!settingsReady || !authUser || !familySettings.enabled || !familySettings.code) return;

    const refreshFromServer = () => {
      const hasPendingLocalChanges = makeFamilySnapshot(items) !== lastFamilySnapshotRef.current;
      if (hasPendingLocalChanges || familyPushingRef.current) return;
      pullFamilyItems(familySettings.code, { silent: true });
    };
    const intervalId = setInterval(refreshFromServer, 30_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshFromServer();
    });

    return () => {
      clearInterval(intervalId);
      subscription.remove();
    };
  }, [items, settingsReady, authUser?.id, familySettings.enabled, familySettings.code]);

  useEffect(() => {
    if (!settingsReady || !authUser || !familySettings.enabled || !familySettings.code) return;
    if (familyPullingRef.current) return;

    const snapshot = makeFamilySnapshot(items);
    if (snapshot === lastFamilySnapshotRef.current) return;
    if (familySyncTimerRef.current) clearTimeout(familySyncTimerRef.current);

    familySyncTimerRef.current = setTimeout(() => {
      pushFamilyItems(familySettings.code);
    }, 900);

    return () => {
      if (familySyncTimerRef.current) clearTimeout(familySyncTimerRef.current);
    };
  }, [items, settingsReady, authUser?.id, familySettings.enabled, familySettings.code]);

  useEffect(() => {
    if (authUser || !familySettings.enabled) return;
    setFamilySettings(DEFAULT_FAMILY_SETTINGS);
    setFamilyStatus("가족 공유는 로그인이 필요합니다.");
  }, [authUser?.id]);

  function cleanItem(item) {
    return cleanItemForFamilySync(item, { defaultExpiryType, todayIso });
  }

  function makeFamilySnapshot(sourceItems) {
    return familySnapshot(sourceItems, { defaultExpiryType, todayIso });
  }

  function mergeFamilyItems(localItems, remoteItems) {
    const merged = new Map();
    const localPlansById = localPlanMap(localItems);
    remoteItems.forEach((item) => merged.set(item.id, normalizeRemoteItem(item, localPlansById)));
    localItems.forEach((item) => {
      // 서버에 보내지 않는 로컬 사진 URI와 기기 전용 필드는 동기화 후에도 보존한다.
      merged.set(item.id, { ...item, ...cleanItem(item) });
    });
    return [...merged.values()].sort((a, b) => daysUntil(a.expiry) - daysUntil(b.expiry));
  }

  // ⚠️ 먹는 일정(plannedDate/plannedMeal/plannedTime/planRepeat)과 메모는 기기
  // 로컬 전용이라 서버에 없다. 그런데
  // pullFamilyItems가 addLocal 없이 호출되면(30초 주기 새로고침이 그렇다) 이 함수
  // 결과로 items를 통째로 갈아끼우므로, 여기서 기존 로컬 값을 이어붙이지 않으면
  // 가족 공유를 켠 사용자는 일정이 30초마다 사라진다(2026-08-19).
  function normalizeRemoteItem(item, localPlansById) {
    const localPlan = localPlansById?.get(String(item.id)) || {};
    return {
      ...cleanItem(item),
      imageUri: item.imageUri || "",
      familyImageUri: item.imageUri || "",
      plannedDate: localPlan.plannedDate || "",
      plannedMeal: localPlan.plannedMeal || "",
      plannedTime: localPlan.plannedTime || "",
      planRepeat: localPlan.planRepeat || "",
      memo: localPlan.memo || ""
    };
  }

  function localPlanMap(sourceItems) {
    return new Map(
      sourceItems
        .filter((item) => item?.plannedDate || item?.memo)
        .map((item) => [
          String(item.id),
          {
            plannedDate: item.plannedDate || "",
            plannedMeal: item.plannedMeal || "",
            plannedTime: item.plannedTime || "",
            planRepeat: item.planRepeat || "",
            memo: item.memo || ""
          }
        ])
    );
  }

  async function shareFamilyDigest() {
    const message = buildFamilyShareMessage(items, reminderDays);
    if (!message) {
      Alert.alert("공유할 상품 없음", "현재 임박 또는 만료된 상품이 없습니다.");
      return;
    }

    try {
      await Share.share({
        message,
        title: "오늘까지야 소비기한 알림"
      });
    } catch {
      Alert.alert("공유 실패", "공유창을 열지 못했습니다. 다시 시도해 주세요.");
    }
  }

  async function shareFamilyCode(code = familySettings.code) {
    const familyCode = normalizeFamilyCode(code);
    if (!familyCode) {
      Alert.alert("공유코드 없음", "먼저 가족 보관함 코드를 만들어 주세요.");
      return;
    }

    try {
      await Share.share({
        title: "오늘까지야 가족 보관함 초대",
        message: `오늘까지야 가족 보관함에 초대합니다.\n\n공유 코드: ${familyCode}\n\n앱에서 설정 > 가족 > 공유 코드로 참여를 눌러 입력해 주세요.`
      });
    } catch {
      Alert.alert("공유 실패", "공유창을 열지 못했습니다. 다시 시도해 주세요.");
    }
  }

  async function pullFamilyItems(code, options = {}) {
    if (!authUser) {
      setFamilyStatus("가족 공유는 로그인이 필요합니다.");
      return;
    }
    const familyCode = normalizeFamilyCode(code);
    if (!familyCode || familyPullingRef.current) return;
    try {
      familyPullingRef.current = true;
      if (!options.silent) setFamilyStatus("공유 보관함을 불러오는 중입니다.");
      const [result, membersResult] = await Promise.all([
        fetchFamilyItems(familyCode),
        fetchFamilyMembers(familyCode).catch(() => ({ members: [] }))
      ]);
      const nextRole = result.group?.role || familySettings.role;
      const requestsResult = nextRole === "owner"
        ? await fetchFamilyJoinRequests(familyCode).catch(() => ({ requests: [] }))
        : { requests: [] };
      const remoteItems = Array.isArray(result.items) ? result.items : [];
      const localPlansById = localPlanMap(items);
      const normalizedRemoteItems = remoteItems.map((item) => normalizeRemoteItem(item, localPlansById));
      const nextItems = options.addLocal
        ? mergeFamilyItems(items, normalizedRemoteItems)
        : normalizedRemoteItems;
      familyVersionRef.current = result.group?.updatedAt || "";
      lastFamilySnapshotRef.current = makeFamilySnapshot(
        options.addLocal ? normalizedRemoteItems : nextItems
      );
      setItems(nextItems);
      setFamilyItemCount(nextItems.length);
      setFamilyMembers(Array.isArray(membersResult.members) ? membersResult.members : []);
      setFamilyJoinRequests(Array.isArray(requestsResult.requests) ? requestsResult.requests : []);
      setFamilySettings((current) => ({
        ...current,
        enabled: true,
        code: familyCode,
        role: nextRole || current.role,
        pendingCode: "",
        pendingMode: "replace"
      }));
      setFamilyStatus(`${familyCode} 연결됨 · 서버 상품 ${nextItems.length}개`);
      if (options.addLocal && makeFamilySnapshot(nextItems) !== lastFamilySnapshotRef.current) {
        setTimeout(() => pushFamilyItems(familyCode, nextItems), 300);
      }
    } catch (error) {
      if (isUnavailableFamilyGroupError(error)) {
        clearFamilyConnection("가족 공유 그룹이 삭제되어 연결을 해제했습니다.");
      } else if (!options.silent) {
        setFamilyStatus("공유 보관함을 불러오지 못했습니다.");
      }
    } finally {
      familyPullingRef.current = false;
    }
  }

  async function pushFamilyItems(code, sourceItems = items) {
    if (!authUser) return;
    const familyCode = normalizeFamilyCode(code);
    if (!familyCode || familyPushingRef.current) return;
    const snapshot = makeFamilySnapshot(sourceItems);
    if (snapshot === lastFamilySnapshotRef.current) return;

    try {
      familyPushingRef.current = true;
      setFamilyStatus("공유 보관함 동기화 중입니다.");
      const result = await putFamilyItems(
        familyCode,
        sourceItems,
        { defaultExpiryType, todayIso },
        familyVersionRef.current
      );
      familyVersionRef.current = result.updatedAt || familyVersionRef.current;
      const nextItems = [...sourceItems];
      let failedImageCount = 0;
      for (let index = 0; index < nextItems.length; index += 1) {
        const item = nextItems[index];
        const needsUpload = item.imageUri
          && !/^https?:\/\//i.test(item.imageUri)
          && item.familyImageSourceUri !== item.imageUri;
        if (!needsUpload) continue;
        try {
          const uploaded = await uploadFamilyItemImage(familyCode, item);
          if (uploaded?.imageUri) {
            nextItems[index] = {
              ...item,
              familyImageUri: uploaded.imageUri,
              familyImageSourceUri: item.imageUri
            };
          }
        } catch (error) {
          failedImageCount += 1;
          console.warn("Family image upload failed", item.id, error);
        }
      }
      lastFamilySnapshotRef.current = makeFamilySnapshot(nextItems);
      if (nextItems.some((item, index) => item !== sourceItems[index])) setItems(nextItems);
      setFamilyItemCount(result.itemCount);
      setFamilyStatus(
        failedImageCount
          ? `${familyCode} 상품 동기화 완료 · 사진 ${failedImageCount}개 업로드 실패`
          : `${familyCode} 연결됨 · ${result.itemCount}개 자동 동기화`
      );
    } catch (error) {
      if (String(error?.message || "").includes("family_sync_conflict")) {
        setFamilyStatus("다른 기기의 변경사항을 반영합니다.");
        await pullFamilyItems(familyCode);
      } else {
        setFamilyStatus("공유 보관함 동기화 실패");
      }
    } finally {
      familyPushingRef.current = false;
    }
  }

  async function createFamilyShareCode() {
    if (!authUser) {
      setFamilyStatus("가족 공유는 로그인이 필요합니다.");
      return;
    }
    if (!familySettings.consentAccepted) {
      setFamilyStatus("가족 공유 데이터 저장 및 사진 업로드에 동의해 주세요.");
      return;
    }
    try {
      setFamilyStatus("공유코드를 만드는 중입니다.");
      const result = await createOrOpenFamilyGroup("", true);
      const code = result.group?.code;
      if (!code) throw new Error("missing_code");
      setFamilyCodeInput(code);
      setFamilySettings((current) => ({
        ...current,
        enabled: true,
        code,
        role: result.group?.role || "owner"
      }));
      familyVersionRef.current = result.group?.updatedAt || result.group?.updated_at || "";
      lastFamilySnapshotRef.current = "";
      await pushFamilyItems(code, items);
      await refreshFamilyMembers(code);
      setFamilyStatus(`${code} 연결됨 · 가족에게 코드를 알려주세요.`);
    } catch {
      setFamilyStatus("공유코드를 만들지 못했습니다.");
    }
  }

  async function connectFamilyShareCode(mode = "replace") {
    if (!authUser) {
      setFamilyStatus("가족 공유는 로그인이 필요합니다.");
      return;
    }
    if (!familySettings.consentAccepted) {
      setFamilyStatus("가족 공유 데이터 저장 및 사진 업로드에 동의해 주세요.");
      return;
    }
    const code = normalizeFamilyCode(familyCodeInput);
    if (code.length < 6) {
      Alert.alert("공유코드 확인", "6자리 이상의 공유코드를 입력해 주세요.");
      return;
    }

    try {
      setFamilyStatus("공유 보관함에 연결하는 중입니다.");
      const result = await createOrOpenFamilyGroup(code, true);
      if (result.pendingApproval) {
        setFamilySettings((current) => ({
          ...current,
          enabled: false,
          code: "",
          role: "",
          pendingCode: code,
          pendingMode: mode
        }));
        setFamilyStatus(`${code} 가입 승인을 기다리고 있습니다.`);
        Alert.alert("가입 요청 완료", "가족 관리자에게 가입 요청을 보냈습니다. 승인되면 자동으로 연결됩니다.");
        return;
      }
      setFamilySettings((current) => ({
        ...current,
        enabled: true,
        code,
        role: result.group?.role || "member"
      }));
      familyVersionRef.current = result.group?.updatedAt || result.group?.updated_at || "";
      lastFamilySnapshotRef.current = "";
      await pullFamilyItems(code, { addLocal: mode === "add" });
    } catch {
      setFamilyStatus("공유 보관함에 연결하지 못했습니다.");
    }
  }

  async function disconnectFamilyShare() {
    if (!familySettings.code) return;
    try {
      let status;
      if (familySettings.role === "owner") {
        await deleteFamilyGroup(familySettings.code);
        status = "가족 공유 그룹과 서버 데이터를 삭제했습니다.";
      } else {
        await leaveFamilyGroup(familySettings.code);
        status = "가족 공유 그룹에서 나왔습니다.";
      }
      clearFamilyConnection(status);
    } catch (error) {
      if (isUnavailableFamilyGroupError(error)) {
        clearFamilyConnection("이미 삭제된 가족 그룹의 연결을 해제했습니다.");
      } else {
        setFamilyStatus("가족 공유 해제에 실패했습니다.");
      }
    }
  }

  async function refreshFamilyMembers(code = familySettings.code) {
    if (!code || !authUser) return;
    try {
      const [membersResult, requestsResult] = await Promise.all([
        fetchFamilyMembers(code),
        fetchFamilyJoinRequests(code).catch(() => ({ requests: [] }))
      ]);
      setFamilyMembers(Array.isArray(membersResult.members) ? membersResult.members : []);
      setFamilyJoinRequests(Array.isArray(requestsResult.requests) ? requestsResult.requests : []);
    } catch {
      // 상품 동기화는 멤버 목록 조회 실패와 독립적으로 계속 동작한다.
    }
  }

  async function refreshFamilyJoinRequests(code = familySettings.code) {
    if (!code || !authUser || familySettings.role !== "owner") return;
    try {
      const result = await fetchFamilyJoinRequests(code);
      setFamilyJoinRequests(Array.isArray(result.requests) ? result.requests : []);
    } catch {
      // 가입 요청 알림 실패는 상품 동기화나 가족 목록 표시를 막지 않는다.
    }
  }

  async function removeMember(accountId) {
    if (!familySettings.code || familySettings.role !== "owner") return;
    try {
      await removeFamilyMember(familySettings.code, accountId);
      await refreshFamilyMembers();
      setFamilyStatus("가족 멤버를 내보냈습니다.");
    } catch {
      setFamilyStatus("가족 멤버를 내보내지 못했습니다.");
    }
  }

  async function checkFamilyJoinRequest(code = familySettings.pendingCode, options = {}) {
    const familyCode = normalizeFamilyCode(code);
    if (!familyCode || !authUser) return;
    try {
      const result = await fetchMyFamilyJoinRequest(familyCode);
      if (result.status === "approved") {
        const mode = familySettings.pendingMode || "replace";
        setFamilyStatus("가입이 승인되어 공유 보관함을 연결합니다.");
        const opened = await createOrOpenFamilyGroup(familyCode, true);
        setFamilySettings((current) => ({
          ...current,
          enabled: true,
          code: familyCode,
          role: opened.group?.role || "member",
          pendingCode: "",
          pendingMode: "replace"
        }));
        familyVersionRef.current = opened.group?.updatedAt || opened.group?.updated_at || "";
        lastFamilySnapshotRef.current = "";
        await pullFamilyItems(familyCode, { addLocal: mode === "add" });
      } else if (result.status === "rejected") {
        setFamilySettings((current) => ({ ...current, pendingCode: "", pendingMode: "replace" }));
        setFamilyStatus("가족 관리자가 가입 요청을 거절했습니다.");
        if (!options.silent) Alert.alert("가입 요청 거절", "가족 관리자에게 공유 코드를 다시 확인해 주세요.");
      } else if (!options.silent) {
        setFamilyStatus(`${familyCode} 가입 승인을 기다리고 있습니다.`);
      }
    } catch {
      if (!options.silent) setFamilyStatus("가입 요청 상태를 확인하지 못했습니다.");
    }
  }

  async function decideJoinRequest(accountId, action) {
    if (!familySettings.code || familySettings.role !== "owner") return;
    try {
      await decideFamilyJoinRequest(familySettings.code, accountId, action);
      await refreshFamilyMembers();
      setFamilyStatus(action === "approve" ? "가족 가입을 승인했습니다." : "가족 가입 요청을 거절했습니다.");
    } catch {
      setFamilyStatus("가입 요청을 처리하지 못했습니다.");
    }
  }

  function clearFamilyConnection(status) {
    setFamilySettings(DEFAULT_FAMILY_SETTINGS);
    setFamilyCodeInput("");
    lastFamilySnapshotRef.current = "";
    familyVersionRef.current = "";
    setFamilyItemCount(0);
    setFamilyMembers([]);
    setFamilyJoinRequests([]);
    setFamilyStatus(status);
  }

  function isUnavailableFamilyGroupError(error) {
    return /family_access_denied|group_not_found|family_(?:fetch|leave|delete)_failed_(?:403|404)/.test(
      String(error?.message || "")
    );
  }

  return {
    familySettings,
    setFamilySettings,
    familyCodeInput,
    setFamilyCodeInput,
    familyStatus,
    familyItemCount,
    familyMembers,
    familyJoinRequests,
    normalizeFamilyCode,
    normalizeFamilySettings,
    shareFamilyDigest,
    shareFamilyCode,
    createFamilyShareCode,
    connectFamilyShareCode,
    pullFamilyItems,
    disconnectFamilyShare,
    removeMember,
    checkFamilyJoinRequest,
    decideJoinRequest
  };
}
