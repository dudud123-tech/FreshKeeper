import { useEffect, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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

// 값을 위아래로 굴려서 고르는 휠. 설정 화면의 임박 알림기준(ReminderWheel)에서
// 쓰던 방식을 시/분 선택에도 쓰려고 일반화했다 — +- 버튼만으로 시간을 맞추는 게
// 불편하다는 피드백 때문이다(2026-08-23). 네이티브 시계 피커를 쓰면 재빌드가
// 필요해서, 이미 앱에 있는 이 방식을 재사용한다.
export function WheelSelect({ options, value, onChange, formatValue = (option) => String(option), label }) {
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
    <View style={styles.wheelColumn}>
      {label ? <Text style={styles.wheelLabel}>{label}</Text> : null}
      <View style={styles.wheel}>
        <View pointerEvents="none" style={styles.wheelSelection} />
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={itemHeight}
          decelerationRate="fast"
          nestedScrollEnabled
          contentContainerStyle={styles.wheelContent}
          onMomentumScrollEnd={(event) => selectFromOffset(event.nativeEvent.contentOffset.y)}
        >
          {options.map((option) => {
            const active = option === value;
            return (
              <Pressable
                key={String(option)}
                style={styles.wheelItem}
                onPress={() => {
                  onChange(option);
                  scrollRef.current?.scrollTo({ y: options.indexOf(option) * itemHeight, animated: true });
                }}
              >
                <Text style={[styles.wheelText, active && styles.wheelTextActive]}>{formatValue(option)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
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
  wheelColumn: {
    flex: 1,
    minWidth: 110,
    gap: 4
  },
  wheelLabel: {
    ...typography.caption,
    color: "#68716b",
    textAlign: "center"
  },
  wheel: {
    height: 132,
    borderRadius: 16,
    backgroundColor: "#f7faf8",
    overflow: "hidden"
  },
  wheelContent: {
    paddingVertical: 44
  },
  wheelSelection: {
    position: "absolute",
    left: 8,
    right: 8,
    top: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#e4f4ed"
  },
  wheelItem: {
    height: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  wheelText: {
    ...typography.label,
    color: "#8a938d",
  },
  wheelTextActive: {
    color: "#14583f",
    fontSize: 16,
    fontWeight: "800"
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
