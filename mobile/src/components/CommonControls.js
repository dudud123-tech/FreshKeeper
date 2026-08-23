import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { typography } from "../theme/typography";
import { formatDateLabel } from "../utils/date";

export function SummaryTile({ label, value, urgent, expired, active, highlighted, onPress }) {
  return (
    <Pressable style={[styles.summaryTile, urgent && styles.summaryUrgent, expired && styles.summaryExpired, active && styles.summaryActive, highlighted && styles.summaryHighlighted]} onPress={onPress}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, urgent && styles.summaryUrgentText, expired && styles.summaryExpiredText]}>{value}</Text>
    </Pressable>
  );
}

export function TabButton({ active, label, onPress }) {
  return (
    <Pressable style={[styles.tab, active && styles.tabActive]} onPress={onPress}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function PageNavButton({ active, label, onPress }) {
  return (
    <Pressable style={[styles.pageNavButton, active && styles.pageNavButtonActive]} onPress={onPress}>
      <Text style={[styles.pageNavText, active && styles.pageNavTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

export function DateButton({ value, onPress, compact = false }) {
  return (
    <Pressable style={[styles.dateButton, compact && styles.dateButtonCompact]} onPress={onPress}>
      <Text style={[styles.dateText, compact && styles.dateTextCompact]}>{formatDateLabel(value)}</Text>
      {!compact ? <Text style={styles.dateSubText}>{value}</Text> : null}
    </Pressable>
  );
}

export function ChoiceGroup({ label, options, value, onChange, formatLabel = (option) => option, compact = false, hideLabel = false }) {
  return (
    <View style={[styles.field, compact && styles.fieldCompact]}>
      {!hideLabel ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.choices}>
        {options.map((option) => (
          <Pressable key={String(option)} style={[styles.choice, compact && styles.choiceCompact, value === option && styles.choiceActive]} onPress={() => onChange(option)}>
            <Text style={[styles.choiceText, compact && styles.choiceTextCompact, value === option && styles.choiceTextActive]}>{formatLabel(option)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// "HH:MM"을 한 줄에서 직접 입력하는 컨트롤. 휠은 자리를 너무 많이 차지하고
// +- 버튼은 한 칸씩 눌러야 해서, 두 방식 다 쓰기 불편하다는 피드백으로 바꿨다(2026-08-23).
// 타이핑 중에는 사용자가 친 문자열을 그대로 두고(지우고 다시 치는 걸 막지 않게),
// 입력이 끝났을 때 유효 범위로 보정해서 확정한다.
export function TimeField({ value, onChange }) {
  const [hourText, setHourText] = useState("");
  const [minuteText, setMinuteText] = useState("");
  const [editingPart, setEditingPart] = useState("");

  const [valueHour = "18", valueMinute = "00"] = String(value || "18:00").split(":");
  const hourDisplay = editingPart === "hour" ? hourText : valueHour;
  const minuteDisplay = editingPart === "minute" ? minuteText : valueMinute;

  function commit(part, text) {
    const digits = text.replace(/\D/g, "");
    setEditingPart("");
    if (!digits) return;
    const max = part === "hour" ? 23 : 59;
    const clamped = Math.max(0, Math.min(max, Number(digits)));
    const next = String(clamped).padStart(2, "0");
    onChange(part === "hour" ? `${next}:${valueMinute}` : `${valueHour}:${next}`);
  }

  return (
    <View style={styles.timeField}>
      <TextInput
        value={hourDisplay}
        onFocus={() => {
          setEditingPart("hour");
          setHourText("");
        }}
        onChangeText={setHourText}
        onBlur={() => commit("hour", hourText)}
        onSubmitEditing={() => commit("hour", hourText)}
        keyboardType="number-pad"
        maxLength={2}
        selectTextOnFocus
        placeholder="시"
        placeholderTextColor="#a0a8a2"
        style={styles.timeFieldInput}
      />
      <Text style={styles.timeFieldColon}>:</Text>
      <TextInput
        value={minuteDisplay}
        onFocus={() => {
          setEditingPart("minute");
          setMinuteText("");
        }}
        onChangeText={setMinuteText}
        onBlur={() => commit("minute", minuteText)}
        onSubmitEditing={() => commit("minute", minuteText)}
        keyboardType="number-pad"
        maxLength={2}
        selectTextOnFocus
        placeholder="분"
        placeholderTextColor="#a0a8a2"
        style={styles.timeFieldInput}
      />
      <Text style={styles.timeFieldHint}>24시간 기준</Text>
    </View>
  );
}

export function PrimaryButton({ label, onPress, disabled }) {
  return (
    <Pressable
      style={[styles.primaryButton, disabled && styles.primaryButtonDisabled]}
      onPress={disabled ? undefined : onPress}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress }) {
  return (
    <Pressable style={styles.secondaryButton} onPress={onPress}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  summaryTile: {
    flex: 1,
    minHeight: 64,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2ddd3",
    backgroundColor: "#fff",
    padding: 10
  },
  summaryUrgent: {
    borderColor: "#f0c6ad",
    backgroundColor: "#fff6ee"
  },
  summaryExpired: {
    borderColor: "#e6aaa2",
    backgroundColor: "#fff1ef"
  },
  summaryActive: {
    borderWidth: 2,
    borderColor: "#1f7a5a"
  },
  summaryHighlighted: {
    backgroundColor: "#edf7f2",
    borderColor: "#1f7a5a"
  },
  summaryLabel: {
    ...typography.captionStrong,
    color: "#68716b",
  },
  summaryValue: {
    color: "#18201c",
    fontSize: 23,
    fontWeight: "800",
    marginTop: 5
  },
  summaryUrgentText: {
    color: "#d95f3d"
  },
  summaryExpiredText: {
    color: "#a73727"
  },
  tab: {
    minHeight: 38,
    minWidth: 78,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center"
  },
  tabActive: {
    backgroundColor: "#1f7a5a"
  },
  tabText: {
    ...typography.label,
    color: "#68716b",
  },
  tabTextActive: {
    color: "#fff"
  },
  pageNavButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2ddd3",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8
  },
  pageNavButtonActive: {
    borderColor: "#1f7a5a",
    backgroundColor: "#edf7f2"
  },
  pageNavText: {
    ...typography.captionStrong,
    color: "#68716b",
  },
  pageNavTextActive: {
    color: "#14583f"
  },
  field: {
    gap: 7,
    marginTop: 8
  },
  fieldCompact: {
    gap: 5,
    marginTop: 6
  },
  label: {
    ...typography.label,
    color: "#68716b",
  },
  dateButton: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: "#e2ddd3",
    borderRadius: 8,
    backgroundColor: "#fff",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  dateButtonCompact: {
    minHeight: 42,
    paddingVertical: 7
  },
  dateText: {
    ...typography.cardTitle,
    color: "#18201c",
  },
  dateTextCompact: {
    ...typography.bodyStrong
  },
  dateSubText: {
    ...typography.caption,
    color: "#68716b",
    marginTop: 2
  },
  choices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7
  },
  choice: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2ddd3",
    backgroundColor: "#f4f1eb",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  choiceCompact: {
    minHeight: 34,
    paddingHorizontal: 9
  },
  choiceActive: {
    backgroundColor: "#1f7a5a",
    borderColor: "#1f7a5a"
  },
  choiceText: {
    ...typography.label,
    color: "#18201c",
  },
  choiceTextCompact: {
    ...typography.captionStrong
  },
  choiceTextActive: {
    color: "#fff"
  },
  // 상자 안에 상자가 겹쳐 보이지 않게, 바깥 테두리 하나만 두고
  // 안쪽 입력칸은 배경 없이 밑줄만 준다(2026-08-23 피드백).
  timeField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2ddd3",
    backgroundColor: "#fff",
    paddingHorizontal: 12
  },
  timeFieldInput: {
    width: 44,
    height: 40,
    textAlign: "center",
    color: "#14583f",
    fontSize: 16,
    fontWeight: "800",
    paddingVertical: 0,
    borderBottomWidth: 2,
    borderBottomColor: "#d4e7df"
  },
  timeFieldColon: {
    color: "#14583f",
    fontSize: 16,
    fontWeight: "800"
  },
  timeFieldHint: {
    ...typography.body,
    color: "#8a938d",
    marginLeft: "auto"
  },
  timePickerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 0,
    marginTop: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e3e8e5",
    backgroundColor: "#fff",
    overflow: "hidden"
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: "#1f7a5a",
    alignItems: "center",
    justifyContent: "center"
  },
  primaryButtonDisabled: {
    opacity: 0.6
  },
  primaryButtonText: {
    ...typography.label,
    color: "#fff",
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2ddd3",
    backgroundColor: "#f4f1eb",
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryButtonText: {
    ...typography.label,
    color: "#18201c",
  }
});
