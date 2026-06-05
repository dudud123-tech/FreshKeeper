import { useEffect, useRef, useState } from "react";
import { Alert, Share } from "react-native";
import {
  cleanItemForFamilySync,
  createOrOpenFamilyGroup,
  familySnapshot,
  fetchFamilyItems,
  normalizeFamilyCode,
  putFamilyItems
} from "../services/familyApi";
import { daysUntil, todayIso } from "../utils/date";
import { buildFamilyShareMessage } from "../utils/familyShare";

export const DEFAULT_FAMILY_SETTINGS = { enabled: false, code: "" };

export function normalizeFamilySettings(value) {
  return { ...DEFAULT_FAMILY_SETTINGS, ...(value || {}) };
}

export function useFamilySync({ items, setItems, settingsReady, reminderDays, defaultExpiryType }) {
  const [familySettings, setFamilySettings] = useState(DEFAULT_FAMILY_SETTINGS);
  const [familyCodeInput, setFamilyCodeInput] = useState("");
  const [familyStatus, setFamilyStatus] = useState("공유 보관함 꺼짐");
  const familySyncTimerRef = useRef(null);
  const familyPullingRef = useRef(false);
  const familyPushingRef = useRef(false);
  const lastFamilySnapshotRef = useRef("");

  useEffect(() => {
    if (!settingsReady || !familySettings.enabled || !familySettings.code) return;
    pullFamilyItems(familySettings.code, { mergeLocal: true, silent: true });
  }, [settingsReady, familySettings.enabled, familySettings.code]);

  useEffect(() => {
    if (!settingsReady || !familySettings.enabled || !familySettings.code) return;
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
  }, [items, settingsReady, familySettings.enabled, familySettings.code]);

  function cleanItem(item) {
    return cleanItemForFamilySync(item, { defaultExpiryType, todayIso });
  }

  function makeFamilySnapshot(sourceItems) {
    return familySnapshot(sourceItems, { defaultExpiryType, todayIso });
  }

  function mergeFamilyItems(localItems, remoteItems) {
    const merged = new Map();
    remoteItems.forEach((item) => merged.set(item.id, cleanItem(item)));
    localItems.forEach((item) => merged.set(item.id, cleanItem(item)));
    return [...merged.values()].sort((a, b) => daysUntil(a.expiry) - daysUntil(b.expiry));
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

  async function pullFamilyItems(code, options = {}) {
    const familyCode = normalizeFamilyCode(code);
    if (!familyCode) return;
    try {
      familyPullingRef.current = true;
      if (!options.silent) setFamilyStatus("공유 보관함을 불러오는 중입니다.");
      const result = await fetchFamilyItems(familyCode);
      const remoteItems = Array.isArray(result.items) ? result.items : [];
      const nextItems = options.mergeLocal ? mergeFamilyItems(items, remoteItems) : remoteItems.map(cleanItem);
      lastFamilySnapshotRef.current = makeFamilySnapshot(nextItems);
      setItems(nextItems);
      setFamilyStatus(`${familyCode} 연결됨 · ${nextItems.length}개 동기화`);
      if (options.mergeLocal) {
        setTimeout(() => pushFamilyItems(familyCode, nextItems), 300);
      }
    } catch {
      if (!options.silent) setFamilyStatus("공유 보관함을 불러오지 못했습니다.");
    } finally {
      familyPullingRef.current = false;
    }
  }

  async function pushFamilyItems(code, sourceItems = items) {
    const familyCode = normalizeFamilyCode(code);
    if (!familyCode || familyPushingRef.current) return;
    const snapshot = makeFamilySnapshot(sourceItems);
    if (snapshot === lastFamilySnapshotRef.current) return;

    try {
      familyPushingRef.current = true;
      setFamilyStatus("공유 보관함 동기화 중입니다.");
      const result = await putFamilyItems(familyCode, sourceItems, { defaultExpiryType, todayIso });
      lastFamilySnapshotRef.current = snapshot;
      setFamilyStatus(`${familyCode} 연결됨 · ${result.itemCount}개 동기화`);
    } catch {
      setFamilyStatus("공유 보관함 동기화 실패");
    } finally {
      familyPushingRef.current = false;
    }
  }

  async function createFamilyShareCode() {
    try {
      setFamilyStatus("공유코드를 만드는 중입니다.");
      const result = await createOrOpenFamilyGroup();
      const code = result.group?.code;
      if (!code) throw new Error("missing_code");
      setFamilyCodeInput(code);
      setFamilySettings({ enabled: true, code });
      lastFamilySnapshotRef.current = "";
      await putFamilyItems(code, items, { defaultExpiryType, todayIso });
      lastFamilySnapshotRef.current = makeFamilySnapshot(items);
      setFamilyStatus(`${code} 연결됨 · 가족에게 코드를 알려주세요.`);
    } catch {
      setFamilyStatus("공유코드를 만들지 못했습니다.");
    }
  }

  async function connectFamilyShareCode() {
    const code = normalizeFamilyCode(familyCodeInput);
    if (code.length < 6) {
      Alert.alert("공유코드 확인", "6자리 이상의 공유코드를 입력해 주세요.");
      return;
    }

    try {
      setFamilyStatus("공유 보관함에 연결하는 중입니다.");
      await createOrOpenFamilyGroup(code);
      setFamilySettings({ enabled: true, code });
      lastFamilySnapshotRef.current = "";
      await pullFamilyItems(code, { mergeLocal: true });
    } catch {
      setFamilyStatus("공유 보관함에 연결하지 못했습니다.");
    }
  }

  function disconnectFamilyShare() {
    setFamilySettings(DEFAULT_FAMILY_SETTINGS);
    setFamilyStatus("공유 보관함 꺼짐");
    lastFamilySnapshotRef.current = "";
  }

  return {
    familySettings,
    setFamilySettings,
    familyCodeInput,
    setFamilyCodeInput,
    familyStatus,
    normalizeFamilyCode,
    normalizeFamilySettings,
    shareFamilyDigest,
    createFamilyShareCode,
    connectFamilyShareCode,
    pullFamilyItems,
    disconnectFamilyShare
  };
}
