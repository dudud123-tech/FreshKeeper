import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

const settingsTabs = [
  { id: "plan", label: "플랜" },
  { id: "alert", label: "알림" },
  { id: "share", label: "공유" },
  { id: "ai", label: "AI" }
];
const reminderOptions = [0, 1, 2, 3, 4, 5];
const notificationHourOptions = Array.from({ length: 24 }, (_, index) => index);
const notificationMinuteOptions = Array.from({ length: 60 }, (_, index) => index);

export default function SettingsPanel({
  settingsTab,
  setSettingsTab,
  aiTotalRemaining,
  aiFreeMonthlyLimit,
  reminderDays,
  setReminderDays,
  notificationSettings,
  setNotificationSettings,
  notificationStatus,
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
  aiAdCreditLimit,
  aiDailyAdLimit,
  aiFreeRemaining,
  normalizedAiUsage,
  aiAdRemainingToday,
  simulateRewardedAd,
  aiUsageStatus,
  feedbackSettings,
  setFeedbackSettings,
  feedbackStatus,
  appVersion
}) {
  return (
    <View style={styles.settingsBox}>
      <View style={styles.settingsSidebar}>
        {settingsTabs.map((tab) => (
          <Pressable
            key={tab.id}
            style={[styles.settingsTabButton, settingsTab === tab.id && styles.settingsTabButtonActive]}
            onPress={() => setSettingsTab(tab.id)}
          >
            <Text style={[styles.settingsTabText, settingsTab === tab.id && styles.settingsTabTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={[styles.planBox, settingsTab !== "plan" && styles.hiddenSettingSection]}>
        <View style={styles.planHeaderRow}>
          <View style={styles.dailyAlertCopy}>
            <Text style={styles.planEyebrow}>현재 플랜</Text>
            <Text style={styles.planTitle}>무료</Text>
          </View>
          <Text style={styles.aiCreditPill}>AI {aiTotalRemaining}회</Text>
        </View>
        <Text style={styles.settingDescription}>개인 보관함, 알림, OCR/AI 정리를 사용할 수 있습니다.</Text>
        <View style={styles.planRow}>
          <Text style={styles.planChip}>무료 AI 월 {aiFreeMonthlyLimit}회</Text>
          <Text style={styles.planChip}>광고 충전 가능</Text>
          <Text style={styles.planChip}>Plus · 광고 없음 · AI 월 50회</Text>
          <Text style={styles.planChip}>Family · 가족 보관함 공유</Text>
        </View>
      </View>

      <View style={[settingsTab !== "alert" && styles.hiddenSettingSection]}>
        <Text style={styles.settingGroupTitle}>알림</Text>
        <Text style={styles.label}>임박 알림기준</Text>
        <Text style={styles.settingDescription}>
          {reminderDays === 0 ? "당일 상품만 임박으로 표시합니다." : `만료 ${reminderDays}일 전부터 임박으로 표시합니다.`}
        </Text>
        <ChoicePills
          options={reminderOptions}
          value={reminderDays}
          onChange={setReminderDays}
          formatLabel={(value) => (value === 0 ? "당일" : `${value}일 전`)}
        />
        <View style={[styles.dailyAlertBox, notificationSettings.enabled && styles.dailyAlertBoxActive]}>
          <Pressable
            style={styles.dailyAlertHeader}
            onPress={() => setNotificationSettings((current) => ({ ...current, enabled: !current.enabled }))}
          >
            <View style={styles.dailyAlertCopy}>
              <Text style={styles.dailyAlertTitle}>하루 알림</Text>
              <Text style={styles.settingDescription}>임박/만료 상품이 있을 때 하루 한 번 알려줍니다.</Text>
            </View>
            <View style={[styles.toggleSwitch, notificationSettings.enabled && styles.toggleSwitchActive]}>
              <View style={[styles.toggleKnob, notificationSettings.enabled && styles.toggleKnobActive]} />
            </View>
          </Pressable>
          <View style={styles.timePickerRow}>
            <TimeSelect
              label="시간"
              value={notificationSettings.hour}
              options={notificationHourOptions}
              formatValue={(value) => `${String(value).padStart(2, "0")}시`}
              onChange={(hour) => setNotificationSettings((current) => ({ ...current, hour }))}
            />
            <TimeSelect
              label="분"
              value={notificationSettings.minute}
              options={notificationMinuteOptions}
              formatValue={(value) => `${String(value).padStart(2, "0")}분`}
              onChange={(minute) => setNotificationSettings((current) => ({ ...current, minute }))}
            />
          </View>
          <Text style={styles.notificationStatus}>
            {notificationSettings.enabled ? `${String(notificationSettings.hour).padStart(2, "0")}:${String(notificationSettings.minute).padStart(2, "0")} · ${notificationStatus}` : "알림이 꺼져 있습니다."}
          </Text>
        </View>
      </View>

      <View style={[settingsTab !== "share" && styles.hiddenSettingSection]}>
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

      <View style={[settingsTab !== "ai" && styles.hiddenSettingSection]}>
        <Text style={styles.settingGroupTitle}>AI / 학습</Text>
        <View style={styles.aiCreditBox}>
          <View style={styles.aiCreditHeader}>
            <View style={styles.dailyAlertCopy}>
              <Text style={styles.dailyAlertTitle}>AI 정리 사용권</Text>
              <Text style={styles.settingDescription}>무료 월 {aiFreeMonthlyLimit}회, 광고 1회 시 AI 1회를 충전합니다.</Text>
            </View>
            <Text style={styles.aiCreditPill}>{aiTotalRemaining}회 남음</Text>
          </View>
          <View style={styles.aiCreditGrid}>
            <View style={styles.aiCreditStat}>
              <Text style={styles.aiCreditLabel}>무료</Text>
              <Text style={styles.aiCreditValue}>{aiFreeRemaining}/{aiFreeMonthlyLimit}</Text>
            </View>
            <View style={styles.aiCreditStat}>
              <Text style={styles.aiCreditLabel}>광고 충전</Text>
              <Text style={styles.aiCreditValue}>{normalizedAiUsage.adCredits}/{aiAdCreditLimit}</Text>
            </View>
            <View style={styles.aiCreditStat}>
              <Text style={styles.aiCreditLabel}>오늘 광고</Text>
              <Text style={styles.aiCreditValue}>{aiAdRemainingToday}/{aiDailyAdLimit}</Text>
            </View>
          </View>
          <Pressable style={styles.aiCreditButton} onPress={simulateRewardedAd}>
            <Text style={styles.aiCreditButtonText}>광고 보고 AI 1회 충전</Text>
          </Pressable>
          {aiUsageStatus ? <Text style={styles.notificationStatus}>{aiUsageStatus}</Text> : null}
        </View>
        <View style={[styles.dailyAlertBox, feedbackSettings.enabled && styles.dailyAlertBoxActive]}>
          <Pressable
            style={styles.dailyAlertHeader}
            onPress={() => setFeedbackSettings((current) => ({ ...current, enabled: !current.enabled }))}
          >
            <View style={styles.dailyAlertCopy}>
              <Text style={styles.dailyAlertTitle}>학습 개선 데이터 전송</Text>
              <Text style={styles.settingDescription}>선택/제외한 OCR 줄만 익명으로 보내 상품 추출을 개선합니다.</Text>
            </View>
            <View style={[styles.toggleSwitch, feedbackSettings.enabled && styles.toggleSwitchActive]}>
              <View style={[styles.toggleKnob, feedbackSettings.enabled && styles.toggleKnobActive]} />
            </View>
          </Pressable>
          <Text style={styles.notificationStatus}>{feedbackStatus}</Text>
        </View>
      </View>

      <Text style={styles.appVersionText}>{appVersion}</Text>
    </View>
  );
}

function ChoicePills({ options, value, onChange, formatLabel = (option) => option }) {
  return (
    <View style={styles.choiceWrap}>
      {options.map((option) => {
        const active = option === value;
        return (
          <Pressable key={option} style={[styles.choice, active && styles.choiceActive]} onPress={() => onChange(option)}>
            <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{formatLabel(option)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TimeSelect({ label, value, options, formatValue, onChange }) {
  const currentIndex = options.indexOf(value);
  const decreaseDisabled = currentIndex <= 0;
  const increaseDisabled = currentIndex >= options.length - 1;

  return (
    <View style={styles.timeSelect}>
      <Text style={styles.timeSelectLabel}>{label}</Text>
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
    marginLeft: -14,
    marginRight: -14,
    paddingVertical: 0,
    paddingRight: 24,
    paddingLeft: 104,
    borderRadius: 8,
    backgroundColor: "transparent",
    position: "relative",
    minHeight: 360
  },
  settingsSidebar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 76,
    paddingVertical: 0,
    paddingHorizontal: 0,
    borderRightWidth: 1,
    borderRightColor: "#e2ddd3",
    backgroundColor: "#fff",
    gap: 0,
    overflow: "hidden"
  },
  settingsTabButton: {
    minHeight: 56,
    borderRadius: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee8df"
  },
  settingsTabButtonActive: {
    backgroundColor: "#1f7a5a"
  },
  settingsTabText: {
    color: "#65716a",
    fontSize: 13,
    fontWeight: "900"
  },
  settingsTabTextActive: {
    color: "#fff"
  },
  hiddenSettingSection: {
    display: "none"
  },
  settingDescription: {
    color: "#68716b",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2
  },
  settingGroupTitle: {
    color: "#14583f",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 8
  },
  label: {
    color: "#68716b",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 8
  },
  appVersionText: {
    color: "#8a938d",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 14
  },
  notificationStatus: {
    color: "#14583f",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 8
  },
  dailyAlertBox: {
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: "#f4fbf8",
    padding: 10
  },
  dailyAlertBoxActive: {
    borderColor: "#b9dfcf",
    backgroundColor: "#f4fbf8"
  },
  dailyAlertHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  dailyAlertCopy: {
    flex: 1
  },
  dailyAlertTitle: {
    color: "#18201c",
    fontSize: 15,
    fontWeight: "900"
  },
  toggleSwitch: {
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
  choiceWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  choice: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d9cfc0",
    backgroundColor: "#f7f3eb",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  choiceActive: {
    backgroundColor: "#1f7a5a",
    borderColor: "#1f7a5a"
  },
  choiceText: {
    color: "#18201c",
    fontWeight: "900"
  },
  choiceTextActive: {
    color: "#fff"
  },
  aiCreditBox: {
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: "#f7f3eb",
    padding: 10,
    gap: 8
  },
  aiCreditHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10
  },
  aiCreditPill: {
    minWidth: 70,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#1f7a5a",
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center"
  },
  aiCreditGrid: {
    flexDirection: "row",
    gap: 8
  },
  aiCreditStat: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: "#f7f3eb",
    padding: 8
  },
  aiCreditLabel: {
    color: "#6c7771",
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 3
  },
  aiCreditValue: {
    color: "#12362a",
    fontSize: 17,
    fontWeight: "900"
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
    color: "#14583f",
    fontSize: 14,
    fontWeight: "900"
  },
  planBox: {
    paddingTop: 14,
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
    color: "#6c7771",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 2
  },
  planTitle: {
    color: "#102019",
    fontSize: 20,
    fontWeight: "900"
  },
  planRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  planChip: {
    color: "#14583f",
    fontSize: 12,
    fontWeight: "900",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d7cfc1",
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  shareBox: {
    marginTop: 12,
    gap: 10
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
    color: "#fff",
    fontWeight: "900"
  },
  familySyncBox: {
    marginTop: 12,
    gap: 10
  },
  familyCodeInput: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d9d2c6",
    backgroundColor: "#fff",
    color: "#18201c",
    fontSize: 16,
    fontWeight: "900",
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
    color: "#fff",
    fontWeight: "900"
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
    color: "#14583f",
    fontWeight: "900"
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
    color: "#a73727",
    fontWeight: "900"
  },
  timePickerRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12
  },
  timeSelect: {
    flex: 1,
    gap: 6
  },
  timeSelectLabel: {
    color: "#68716b",
    fontSize: 12,
    fontWeight: "900"
  },
  timeSelectControls: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d9e9e2",
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    overflow: "hidden"
  },
  timeSelectValue: {
    color: "#14583f",
    fontSize: 16,
    fontWeight: "900"
  },
  timeStepButton: {
    width: 42,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#edf7f2"
  },
  timeStepButtonDisabled: {
    backgroundColor: "#f5f2eb"
  },
  timeStepText: {
    color: "#14583f",
    fontSize: 21,
    fontWeight: "900"
  },
  timeStepTextDisabled: {
    color: "#b8b1a7"
  }
});
