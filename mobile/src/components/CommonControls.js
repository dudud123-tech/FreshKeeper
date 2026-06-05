import { Pressable, StyleSheet, Text, View } from "react-native";
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

export function PrimaryButton({ label, onPress }) {
  return (
    <Pressable style={styles.primaryButton} onPress={onPress}>
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
    color: "#68716b",
    fontSize: 12,
    fontWeight: "800"
  },
  summaryValue: {
    color: "#18201c",
    fontSize: 23,
    fontWeight: "900",
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
    color: "#68716b",
    fontWeight: "900"
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
    color: "#68716b",
    fontSize: 13,
    fontWeight: "900"
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
    color: "#68716b",
    fontSize: 13,
    fontWeight: "800"
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
    color: "#18201c",
    fontSize: 15,
    fontWeight: "900"
  },
  dateTextCompact: {
    fontSize: 14
  },
  dateSubText: {
    color: "#68716b",
    fontSize: 12,
    marginTop: 2
  },
  choices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7
  },
  choice: {
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2ddd3",
    backgroundColor: "#f4f1eb",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  choiceCompact: {
    height: 34,
    paddingHorizontal: 9
  },
  choiceActive: {
    backgroundColor: "#1f7a5a",
    borderColor: "#1f7a5a"
  },
  choiceText: {
    color: "#18201c",
    fontWeight: "800"
  },
  choiceTextCompact: {
    fontSize: 13
  },
  choiceTextActive: {
    color: "#fff"
  },
  primaryButton: {
    height: 44,
    borderRadius: 8,
    backgroundColor: "#1f7a5a",
    alignItems: "center",
    justifyContent: "center"
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "900"
  },
  secondaryButton: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2ddd3",
    backgroundColor: "#f4f1eb",
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryButtonText: {
    color: "#18201c",
    fontWeight: "900"
  }
});
