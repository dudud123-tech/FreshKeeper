import { useEffect, useRef, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { typography } from "../theme/typography";

const settingsTabs = [
  { id: "alert", label: "알림", icon: require("../../assets/settings/setting-alert.png") },
  { id: "share", label: "가족", icon: require("../../assets/settings/setting-share.png") },
  { id: "feedback", label: "학습", icon: require("../../assets/settings/setting-ai.png") },
  { id: "account", label: "계정" }
];
const reminderOptions = [0, 1, 2, 3, 4, 5, 6, 7];
const notificationHourOptions = Array.from({ length: 24 }, (_, index) => index);
const notificationMinuteOptions = Array.from({ length: 60 }, (_, index) => index);
const googleAuthIcon = require("../../assets/auth/google-logo.png");
const kakaoAuthIcon = require("../../assets/auth/kakaotalk-logo.png");
const naverAuthIcon = require("../../assets/auth/naver-logo.png");

export default function SettingsPanel({
  settingsTab,
  setSettingsTab,
  reminderDays,
  setReminderDays,
  notificationSettings,
  setNotificationSettings,
  shareFamilyDigest,
  familyCodeInput,
  setFamilyCodeInput,
  normalizeFamilyCode,
  createFamilyShareCode,
  connectFamilyShareCode,
  familySettings,
  pullFamilyItems,
  disconnectFamilyShare,
  familyStatus,
  feedbackSettings,
  setFeedbackSettings,
  feedbackStatus,
  authUser,
  authReady,
  authBusy,
  authProviderBusy,
  authStatus,
  googleLoginConfigured,
  kakaoLoginConfigured,
  naverLoginConfigured,
  loginWithGoogle,
  loginWithKakao,
  loginWithNaver,
  logout
}) {
  const [authSheetVisible, setAuthSheetVisible] = useState(false);
  const socialLoginConfigured = googleLoginConfigured || kakaoLoginConfigured || naverLoginConfigured;

  useEffect(() => {
    if (authUser) setAuthSheetVisible(false);
  }, [authUser]);

  return (
    <View style={styles.settingsBox}>
      <Modal visible={authSheetVisible} transparent animationType="fade" onRequestClose={() => setAuthSheetVisible(false)}>
        <Pressable style={styles.authSheetBackdrop} onPress={() => setAuthSheetVisible(false)}>
          <ScrollView
            contentContainerStyle={styles.authSheetScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable style={styles.authSheetCard} onPress={() => {}}>
              <View style={styles.authSheetHero}>
                <View style={styles.authSheetHeroGlow} />
                <View style={styles.authSheetAvatar}>
                  <PersonGlyph />
                </View>
              </View>
              <Text style={styles.authSheetTitle}>로그인 / 회원가입</Text>
              <Text style={styles.authSheetSubtitle}>5초만에 간편하게 시작하세요</Text>

              <Pressable
                style={styles.authProviderButton}
                onPress={loginWithGoogle}
                disabled={!authReady || authBusy || !googleLoginConfigured}
              >
                <AuthProviderLogo source={googleAuthIcon} small />
                <Text style={styles.authProviderButtonText}>
                  {authProviderBusy === "google" ? "로그인 중..." : "Google로 계속"}
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.authProviderButton,
                  (!authReady || authBusy || !kakaoLoginConfigured) && styles.authProviderButtonDisabled
                ]}
                onPress={loginWithKakao}
                disabled={!authReady || authBusy || !kakaoLoginConfigured}
              >
                <AuthProviderLogo source={kakaoAuthIcon} />
                <Text style={styles.authProviderButtonText}>
                  {authProviderBusy === "kakao" ? "로그인 중..." : "카카오로 계속"}
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.authProviderButton,
                  (!authReady || authBusy || !naverLoginConfigured) && styles.authProviderButtonDisabled
                ]}
                onPress={loginWithNaver}
                disabled={!authReady || authBusy || !naverLoginConfigured}
              >
                <AuthProviderLogo source={naverAuthIcon} />
                <Text style={styles.authProviderButtonText}>
                  {authProviderBusy === "naver" ? "로그인 중..." : "네이버로 계속"}
                </Text>
              </Pressable>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Modal>

      <ScrollView
        horizontal
        style={styles.settingsTabsScroller}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.settingsTopTabs}
      >
        {settingsTabs.map((tab) => (
          <Pressable
            key={tab.id}
            style={[styles.settingsTabButton, settingsTab === tab.id && styles.settingsTabButtonActive]}
            onPress={() => setSettingsTab(tab.id)}
          >
            {tab.icon ? (
              <Image
                source={tab.icon}
                resizeMode="contain"
                style={[
                  styles.settingsTabIcon,
                  tab.id === "alert" && styles.settingsTabIconAlert,
                  tab.id === "feedback" && styles.settingsTabIconFeedback,
                  tab.id === "account" && styles.settingsTabIconAccount,
                  settingsTab === tab.id && styles.settingsTabIconActive
                ]}
              />
            ) : (
              <View style={[styles.accountTabIcon, settingsTab === tab.id && styles.accountTabIconActive]}>
                <Image
                  source={require("../../assets/settings/account.png")}
                  resizeMode="contain"
                  style={styles.accountTabImage}
                />
              </View>
            )}
            <Text
              style={[styles.settingsTabText, settingsTab === tab.id && styles.settingsTabTextActive]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {settingsTab === "alert" ? (
      <View>
        <Text style={styles.settingGroupTitle}>알림</Text>
        <View style={styles.reminderBox}>
          <Text style={styles.label}>임박 알림기준</Text>
          <Text style={styles.settingDescription}>
            {reminderDays === 0 ? "당일 상품만 임박으로 표시합니다." : `만료 ${reminderDays}일 전부터 임박으로 표시합니다.`}
          </Text>
          <ReminderWheel
            options={reminderOptions}
            value={reminderDays}
            onChange={setReminderDays}
          />
        </View>
        <View style={[styles.dailyAlertBox, notificationSettings.enabled && styles.dailyAlertBoxActive]}>
          <Pressable
            style={styles.dailyAlertHeader}
            onPress={() => setNotificationSettings((current) => ({ ...current, enabled: !current.enabled }))}
          >
            <View style={styles.dailyAlertCopy}>
              <Text style={styles.dailyAlertTitle}>임박·만료 상품을 하루 한 번 알려드려요.</Text>
            </View>
            <View style={[styles.toggleSwitch, notificationSettings.enabled && styles.toggleSwitchActive]}>
              <View style={[styles.toggleKnob, notificationSettings.enabled && styles.toggleKnobActive]} />
            </View>
          </Pressable>
          <View style={styles.timePickerRow}>
            <TimeSelect
              value={notificationSettings.hour}
              options={notificationHourOptions}
              formatValue={(value) => `${String(value).padStart(2, "0")}시`}
              onChange={(hour) => setNotificationSettings((current) => ({ ...current, hour }))}
            />
            <TimeSelect
              value={notificationSettings.minute}
              options={notificationMinuteOptions}
              formatValue={(value) => `${String(value).padStart(2, "0")}분`}
              onChange={(minute) => setNotificationSettings((current) => ({ ...current, minute }))}
            />
          </View>
        </View>
      </View>
      ) : null}

      {settingsTab === "share" ? (
      <View>
        <Text style={styles.settingGroupTitle}>가족 공유</Text>
        <View style={styles.shareBox}>
          <View style={styles.shareCopy}>
            <Text style={styles.dailyAlertTitle}>가족에게 공유</Text>
            <Text style={styles.settingDescription}>임박/만료 상품을 카카오톡이나 문자로 보낼 수 있습니다.</Text>
          </View>
          <Pressable style={styles.shareButton} onPress={shareFamilyDigest}>
            <Text style={styles.shareButtonText}>공유하기</Text>
          </Pressable>
        </View>
        <View style={styles.familySyncBox}>
          <View style={styles.shareCopy}>
            <Text style={styles.dailyAlertTitle}>같이 쓰는 보관함</Text>
            <Text style={styles.settingDescription}>로그인 없이 공유코드가 같은 가족끼리 보관 목록을 맞춰 둡니다.</Text>
          </View>
          <TextInput
            value={familyCodeInput}
            onChangeText={(value) => setFamilyCodeInput(normalizeFamilyCode(value))}
            placeholder="공유코드"
            autoCapitalize="characters"
            style={styles.familyCodeInput}
          />
          <View style={styles.familyActionRow}>
            <Pressable style={styles.familyGhostButton} onPress={createFamilyShareCode}>
              <Text style={styles.familyGhostButtonText}>새 코드</Text>
            </Pressable>
            <Pressable style={styles.familyPrimaryButton} onPress={connectFamilyShareCode}>
              <Text style={styles.familyPrimaryButtonText}>연결</Text>
            </Pressable>
          </View>
          {familySettings.enabled ? (
            <View style={styles.familyActionRow}>
              <Pressable style={styles.familyGhostButton} onPress={() => pullFamilyItems(familySettings.code, { mergeLocal: true })}>
                <Text style={styles.familyGhostButtonText}>새로고침</Text>
              </Pressable>
              <Pressable style={styles.familyDangerButton} onPress={disconnectFamilyShare}>
                <Text style={styles.familyDangerButtonText}>연결 해제</Text>
              </Pressable>
            </View>
          ) : null}
          <Text style={styles.notificationStatus}>{familyStatus}</Text>
        </View>
      </View>
      ) : null}

      {settingsTab === "feedback" ? (
      <View>
        <Text style={styles.settingGroupTitle}>상품 인식</Text>
        <View style={[styles.dailyAlertBox, styles.feedbackBox, feedbackSettings.enabled && styles.dailyAlertBoxActive]}>
          <Pressable
            style={styles.dailyAlertHeader}
            onPress={() => setFeedbackSettings((current) => ({ ...current, enabled: !current.enabled }))}
          >
            <View style={styles.dailyAlertCopy}>
              <Text style={styles.dailyAlertTitle}>인식 품질 향상 참여</Text>
              <Text style={styles.settingDescription}>
                선택하거나 제외한 인식 결과를 익명으로 보내 상품 인식을 더 정확하게 만듭니다.
              </Text>
            </View>
            <View style={[styles.toggleSwitch, feedbackSettings.enabled && styles.toggleSwitchActive]}>
              <View style={[styles.toggleKnob, feedbackSettings.enabled && styles.toggleKnobActive]} />
            </View>
          </Pressable>
          <Text style={styles.notificationStatus}>{feedbackStatus}</Text>
        </View>
      </View>
      ) : null}

      {settingsTab === "account" ? (
      <View>
        <Text style={styles.settingGroupTitle}>계정</Text>
        <View style={styles.accountBox}>
          {authUser ? (
            <>
              <View style={styles.accountProfileRow}>
                {authUser.avatarUrl ? (
                  <Image source={{ uri: authUser.avatarUrl }} style={styles.accountAvatar} />
                ) : (
                  <View style={styles.accountAvatar}>
                    <PersonGlyph size="large" active />
                  </View>
                )}
                <View style={styles.accountProfileCopy}>
                  <Text style={styles.dailyAlertTitle}>{authUser.displayName || "사용자"}</Text>
                  {authUser.email ? <Text style={styles.accountEmail}>{authUser.email}</Text> : null}
                </View>
              </View>
              <Text style={styles.settingDescription}>
                이 계정으로 수정한 상품 분류와 제외 설정을 기억합니다.
              </Text>
              <Pressable
                style={[styles.accountSecondaryButton, authBusy && styles.accountButtonDisabled]}
                disabled={authBusy}
                onPress={logout}
              >
                <Text style={styles.accountSecondaryButtonText}>{authBusy ? "처리 중..." : "로그아웃"}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.dailyAlertTitle}>내 상품 설정 이어 쓰기</Text>
              <Text style={styles.settingDescription}>
                소셜 계정으로 로그인하면 수정한 상품 분류와 제외 설정을 다른 기기에서도 이어서 사용할 수 있어요.
              </Text>
              <Pressable
                style={[
                  styles.accountPrimaryButton,
                  (!authReady || authBusy || !socialLoginConfigured) && styles.accountButtonDisabled
                ]}
                disabled={!authReady || authBusy || !socialLoginConfigured}
                onPress={() => setAuthSheetVisible(true)}
              >
                <Text style={styles.accountPrimaryButtonText}>
                  {!socialLoginConfigured
                    ? "소셜 로그인 설정 필요"
                    : authBusy
                      ? "계정 확인 중..."
                      : "로그인 / 회원가입"}
                </Text>
              </Pressable>
            </>
          )}
          <Text style={styles.notificationStatus}>{authReady ? authStatus : "로그인 정보를 확인하는 중입니다."}</Text>
        </View>
      </View>
      ) : null}

    </View>
  );
}

function PersonGlyph({ active = false, size = "normal" }) {
  const isLarge = size === "large";
  return (
    <View style={[styles.personGlyph, isLarge && styles.personGlyphLarge]}>
      <View style={[styles.personHead, active && styles.personHeadActive]} />
      <View style={[styles.personShoulders, active && styles.personShouldersActive]} />
    </View>
  );
}

function AuthProviderLogo({ source, small = false }) {
  return (
    <Image
      source={source}
      resizeMode="contain"
      style={[styles.authProviderLogoImage, small && styles.authProviderLogoImageSmall]}
    />
  );
}

function ReminderWheel({ options, value, onChange }) {
  const scrollRef = useRef(null);
  const itemHeight = 44;

  useEffect(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(options.indexOf(value), 0) * itemHeight,
        animated: false
      });
    });
  }, [options, value]);

  function selectFromOffset(offsetY) {
    const index = Math.max(0, Math.min(options.length - 1, Math.round(offsetY / itemHeight)));
    onChange(options[index]);
  }

  return (
    <View style={styles.reminderWheel}>
      <View pointerEvents="none" style={styles.reminderWheelSelection} />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        decelerationRate="fast"
        nestedScrollEnabled
        contentContainerStyle={styles.reminderWheelContent}
        onMomentumScrollEnd={(event) => selectFromOffset(event.nativeEvent.contentOffset.y)}
      >
        {options.map((option) => {
          const active = option === value;
          return (
            <Pressable
              key={option}
              style={styles.reminderWheelItem}
              onPress={() => {
                onChange(option);
                scrollRef.current?.scrollTo({
                  y: options.indexOf(option) * itemHeight,
                  animated: true
                });
              }}
            >
              <Text style={[styles.reminderWheelText, active && styles.reminderWheelTextActive]}>
                {option === 0 ? "당일" : `${option}일 전`}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function TimeSelect({ value, options, formatValue, onChange }) {
  const currentIndex = options.indexOf(value);
  const decreaseDisabled = currentIndex <= 0;
  const increaseDisabled = currentIndex >= options.length - 1;

  return (
    <View style={styles.timeSelect}>
      <View style={styles.timeSelectControls}>
        <Pressable style={[styles.timeStepButton, decreaseDisabled && styles.timeStepButtonDisabled]} disabled={decreaseDisabled} onPress={() => onChange(options[currentIndex - 1])}>
          <Text style={[styles.timeStepText, decreaseDisabled && styles.timeStepTextDisabled]}>-</Text>
        </Pressable>
        <Text style={styles.timeSelectValue}>{formatValue(value)}</Text>
        <Pressable style={[styles.timeStepButton, increaseDisabled && styles.timeStepButtonDisabled]} disabled={increaseDisabled} onPress={() => onChange(options[currentIndex + 1])}>
          <Text style={[styles.timeStepText, increaseDisabled && styles.timeStepTextDisabled]}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  settingsBox: {
    marginTop: 0,
    marginLeft: 0,
    marginRight: 0,
    paddingVertical: 2,
    paddingHorizontal: 0,
    borderRadius: 8,
    backgroundColor: "transparent",
    position: "relative",
    minHeight: 360
  },
  settingsTopTabs: {
    gap: 9,
    paddingTop: 2,
    paddingBottom: 28
  },
  settingsTabsScroller: {
    height: 112,
    flexGrow: 0,
    flexShrink: 0
  },
  settingsTabButton: {
    width: 78,
    minHeight: 82,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 6,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e6ebe8"
  },
  settingsTabButtonActive: {
    backgroundColor: "#fff",
    borderColor: "#1f7a5a"
  },
  settingsTabIcon: {
    width: 40,
    height: 40,
    opacity: 0.78
  },
  settingsTabIconActive: {
    opacity: 1
  },
  settingsTabIconAlert: {
    width: 32,
    height: 32,
    marginTop: 4
  },
  settingsTabIconFeedback: {
    width: 42,
    height: 42,
    marginTop: 0
  },
  settingsTabIconAccount: {
    width: 34,
    height: 34,
    marginTop: 2
  },
  accountTabIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent"
  },
  accountTabIconActive: {
    backgroundColor: "transparent"
  },
  accountTabImage: {
    width: 34,
    height: 34
  },
  settingsTabText: {
    ...typography.captionStrong,
    color: "#545d58",
  },
  settingsTabTextActive: {
    color: "#1f7a5a"
  },
  settingDescription: {
    ...typography.body,
    color: "#606a64",
    marginTop: 4
  },
  settingGroupTitle: {
    ...typography.sectionTitle,
    color: "#14583f",
    marginBottom: 24
  },
  label: {
    ...typography.cardTitle,
    color: "#18201c",
    marginBottom: 6
  },
  reminderBox: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e3e8e5",
    backgroundColor: "#fff",
    padding: 16
  },
  notificationStatus: {
    ...typography.badge,
    color: "#14583f",
    marginTop: 8
  },
  dailyAlertBox: {
    marginTop: 24,
    borderRadius: 22,
    backgroundColor: "#fff",
    padding: 18,
    borderWidth: 1,
    borderColor: "#e3e8e5"
  },
  dailyAlertBoxActive: {
    borderColor: "#b9dfcf",
    backgroundColor: "#fff"
  },
  feedbackBox: {
    marginTop: 0,
    borderRadius: 18,
    borderColor: "#e6ebe8",
    padding: 16
  },
  dailyAlertHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16
  },
  dailyAlertCopy: {
    flex: 1,
    paddingTop: 2
  },
  dailyAlertTitle: {
    ...typography.cardTitle,
    color: "#18201c",
  },
  toggleSwitch: {
    flexShrink: 0,
    width: 52,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#d8d2c8",
    padding: 3,
    justifyContent: "center"
  },
  toggleSwitchActive: {
    backgroundColor: "#1f7a5a"
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fff"
  },
  toggleKnobActive: {
    transform: [{ translateX: 22 }]
  },
  reminderWheel: {
    height: 132,
    marginTop: 14,
    borderRadius: 16,
    backgroundColor: "#f7faf8",
    overflow: "hidden"
  },
  reminderWheelContent: {
    paddingVertical: 44
  },
  reminderWheelSelection: {
    position: "absolute",
    left: 8,
    right: 8,
    top: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#e4f4ed"
  },
  reminderWheelItem: {
    height: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  reminderWheelText: {
    ...typography.label,
    color: "#8a938d",
  },
  reminderWheelTextActive: {
    color: "#14583f",
    fontSize: 16,
    fontWeight: "800"
  },
  aiCreditBox: {
    marginTop: 0,
    borderRadius: 18,
    backgroundColor: "#fff",
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "#e6ebe8"
  },
  aiCreditHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10
  },
  aiCreditPill: {
    ...typography.badge,
    minWidth: 70,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#1f7a5a",
    color: "#fff",
    textAlign: "center"
  },
  aiCreditGrid: {
    flexDirection: "row",
    gap: 8
  },
  aiCreditStat: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: "#f5f8f6",
    padding: 10
  },
  aiCreditLabel: {
    ...typography.badge,
    color: "#6c7771",
    marginBottom: 3
  },
  aiCreditValue: {
    ...typography.cardTitle,
    color: "#12362a",
  },
  aiCreditButton: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#b9dfcf",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center"
  },
  aiCreditButtonText: {
    ...typography.label,
    color: "#14583f",
  },
  planBox: {
    paddingTop: 2,
    paddingBottom: 10,
    gap: 8
  },
  planHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  planEyebrow: {
    ...typography.captionStrong,
    color: "#6c7771",
    marginBottom: 2
  },
  planTitle: {
    ...typography.sectionTitle,
    color: "#102019",
  },
  planRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  planChip: {
    ...typography.captionStrong,
    color: "#14583f",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#dde5e1",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  shareBox: {
    marginTop: 0,
    gap: 12,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e6ebe8",
    padding: 16
  },
  shareCopy: {
    gap: 2
  },
  shareButton: {
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: "#1f7a5a",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  shareButtonText: {
    ...typography.label,
    color: "#fff",
  },
  familySyncBox: {
    marginTop: 14,
    gap: 12,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e6ebe8",
    padding: 16
  },
  familyCodeInput: {
    ...typography.cardTitle,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d9d2c6",
    backgroundColor: "#fff",
    color: "#18201c",
    letterSpacing: 0,
    paddingHorizontal: 12
  },
  familyActionRow: {
    flexDirection: "row",
    gap: 8
  },
  familyPrimaryButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: "#1f7a5a",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  familyPrimaryButtonText: {
    ...typography.label,
    color: "#fff",
  },
  familyGhostButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#b9dfcf",
    backgroundColor: "#edf7f2",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  familyGhostButtonText: {
    ...typography.label,
    color: "#14583f",
  },
  familyDangerButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e7b8ad",
    backgroundColor: "#fff4f1",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  familyDangerButtonText: {
    ...typography.label,
    color: "#a73727",
  },
  accountBox: {
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e6ebe8",
    padding: 16,
    gap: 12
  },
  accountProfileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  accountAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent"
  },
  accountProfileCopy: {
    flex: 1,
    minWidth: 0
  },
  accountEmail: {
    ...typography.caption,
    color: "#606a64",
    marginTop: 2
  },
  accountPrimaryButton: {
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: "#1f7a5a",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14
  },
  accountPrimaryButtonText: {
    ...typography.label,
    color: "#fff",
  },
  accountSecondaryButton: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d8dfdb",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14
  },
  accountSecondaryButtonText: {
    ...typography.label,
    color: "#4f5a54",
  },
  accountButtonDisabled: {
    opacity: 0.48
  },
  authSheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.48)",
    justifyContent: "center"
  },
  authSheetScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 12
  },
  authSheetCard: {
    marginHorizontal: 16,
    borderRadius: 26,
    backgroundColor: "#fff",
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 18
  },
  authSheetHero: {
    height: 84,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4
  },
  authSheetHeroGlow: {
    position: "absolute",
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(31, 122, 90, 0.12)",
    shadowColor: "#1f7a5a",
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 }
  },
  authSheetAvatar: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent"
  },
  authSheetTitle: {
    ...typography.sectionTitle,
    textAlign: "center",
    color: "#151b18",
    marginBottom: 8
  },
  authSheetSubtitle: {
    ...typography.body,
    textAlign: "center",
    color: "#59635d",
    marginBottom: 12
  },
  authProviderButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dde4e0",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    marginBottom: 9,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4
  },
  authProviderButtonDisabled: {
    opacity: 0.55
  },
  authProviderLogoImage: {
    width: 28,
    height: 28,
    marginRight: 16
  },
  authProviderLogoImageSmall: {
    width: 23,
    height: 23,
    marginLeft: 3,
    marginRight: 18
  },
  authProviderButtonText: {
    ...typography.bodyStrong,
    color: "#1c2320"
  },
  personGlyph: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "flex-start",
    backgroundColor: "transparent"
  },
  personGlyphLarge: {
    width: 28,
    height: 28
  },
  personHead: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "#1f7a5a",
    backgroundColor: "transparent",
    marginTop: 1
  },
  personHeadActive: {
    borderColor: "#1f7a5a"
  },
  personShoulders: {
    width: 10,
    height: 6,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    borderWidth: 1,
    borderColor: "#1f7a5a",
    borderBottomWidth: 0,
    marginTop: 3,
    backgroundColor: "transparent"
  },
  personShouldersActive: {
    borderColor: "#1f7a5a"
  },
  timePickerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 0,
    marginTop: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e3e8e5",
    backgroundColor: "#fff",
    overflow: "hidden"
  },
  timeSelect: {
    flex: 1,
    minWidth: 130,
    padding: 10
  },
  timeSelectControls: {
    minHeight: 50,
    borderRadius: 15,
    borderWidth: 0,
    backgroundColor: "#f6f8f7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    overflow: "hidden"
  },
  timeSelectValue: {
    ...typography.label,
    color: "#14583f",
  },
  timeStepButton: {
    width: 42,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#edf7f2"
  },
  timeStepButtonDisabled: {
    backgroundColor: "#f4f6f5"
  },
  timeStepText: {
    color: "#14583f",
    fontSize: 21,
    fontWeight: "800"
  },
  timeStepTextDisabled: {
    color: "#b8b1a7"
  }
});
