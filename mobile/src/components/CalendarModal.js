import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { typography } from "../theme/typography";
import { buildCalendarWeeks, parseIsoDate, startOfMonth, todayIso, toIsoDate } from "../utils/date";

export default function CalendarModal({ visible, value, onClose, onSelect }) {
  const [month, setMonth] = useState(() => startOfMonth(parseIsoDate(value)));
  const [pickerVisible, setPickerVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      setMonth(startOfMonth(parseIsoDate(value)));
      setPickerVisible(false);
    }
  }, [visible, value]);

  const weeks = useMemo(() => buildCalendarWeeks(month), [month]);
  const selected = value;
  const today = todayIso();

  function moveMonth(offset) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  function moveYear(offset) {
    setMonth((current) => new Date(current.getFullYear() + offset, current.getMonth(), 1));
  }

  function selectMonth(monthIndex) {
    setMonth((current) => new Date(current.getFullYear(), monthIndex, 1));
    setPickerVisible(false);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <Pressable style={styles.calendarNav} onPress={() => moveMonth(-1)}>
              <Text style={styles.calendarNavText}>‹</Text>
            </Pressable>
            <Pressable style={styles.calendarTitleButton} onPress={() => setPickerVisible((current) => !current)}>
              <Text style={styles.calendarTitle}>
                {month.getFullYear()}년 {month.getMonth() + 1}월
              </Text>
              <Text style={styles.calendarTitleHint}>{pickerVisible ? "달력 보기" : "연/월 선택"}</Text>
            </Pressable>
            <Pressable style={styles.calendarNav} onPress={() => moveMonth(1)}>
              <Text style={styles.calendarNavText}>›</Text>
            </Pressable>
          </View>
          {pickerVisible ? (
            <View style={styles.monthPicker}>
              <View style={styles.yearPickerRow}>
                <Pressable style={styles.yearStepButton} onPress={() => moveYear(-1)}>
                  <Text style={styles.yearStepText}>‹</Text>
                </Pressable>
                <Text style={styles.yearPickerText}>{month.getFullYear()}년</Text>
                <Pressable style={styles.yearStepButton} onPress={() => moveYear(1)}>
                  <Text style={styles.yearStepText}>›</Text>
                </Pressable>
              </View>
              <View style={styles.monthGrid}>
                {Array.from({ length: 12 }, (_, index) => {
                  const active = index === month.getMonth();
                  return (
                    <Pressable key={index} style={[styles.monthCell, active && styles.monthCellActive]} onPress={() => selectMonth(index)}>
                      <Text style={[styles.monthCellText, active && styles.monthCellTextActive]}>{index + 1}월</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : (
            <>
              <View style={styles.weekRow}>
                {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
                  <Text key={day} style={styles.weekText}>
                    {day}
                  </Text>
                ))}
              </View>
              <View style={styles.calendarGrid}>
                {weeks.map((week, weekIndex) => (
                  <View key={`week-${weekIndex}`} style={styles.calendarWeekRow}>
                    {week.map((day, dayIndex) => {
                      if (!day) return <View key={`empty-${weekIndex}-${dayIndex}`} style={styles.dayCell} />;
                      const iso = toIsoDate(day);
                      const isSelected = iso === selected;
                      const isToday = iso === today;
                      return (
                        <Pressable key={iso} style={[styles.dayCell, isSelected && styles.daySelected, isToday && !isSelected && styles.dayToday]} onPress={() => onSelect(iso)}>
                          <Text style={[styles.dayText, isSelected && styles.daySelectedText]}>{day.getDate()}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            </>
          )}
          <View style={styles.calendarActions}>
            <Pressable style={styles.secondaryAction} onPress={onClose}>
              <Text style={styles.secondaryActionText}>닫기</Text>
            </Pressable>
            <Pressable style={styles.saveAction} onPress={() => onSelect(today)}>
              <Text style={styles.saveActionText}>오늘</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(24, 32, 28, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18
  },
  calendarCard: {
    width: "100%",
    maxWidth: 430,
    borderRadius: 8,
    backgroundColor: "#fff",
    padding: 18
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16
  },
  calendarTitle: {
    ...typography.sectionTitle,
    color: "#18201c",
  },
  calendarTitleButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 8
  },
  calendarTitleHint: {
    ...typography.badge,
    color: "#68716b",
    marginTop: 2
  },
  calendarNav: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f4f1eb"
  },
  calendarNavText: {
    color: "#18201c",
    fontSize: 30,
    fontWeight: "700"
  },
  weekRow: {
    flexDirection: "row"
  },
  weekText: {
    ...typography.label,
    flex: 1,
    color: "#68716b",
    textAlign: "center",
    marginBottom: 8
  },
  calendarGrid: {
    gap: 2
  },
  monthPicker: {
    gap: 14,
    paddingVertical: 6
  },
  yearPickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14
  },
  yearStepButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f4f1eb"
  },
  yearStepText: {
    color: "#18201c",
    fontSize: 30,
    fontWeight: "700"
  },
  yearPickerText: {
    ...typography.screenTitle,
    minWidth: 112,
    color: "#18201c",
    textAlign: "center"
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  monthCell: {
    width: "31.5%",
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2ddd3",
    backgroundColor: "#f4f1eb",
    alignItems: "center",
    justifyContent: "center"
  },
  monthCellActive: {
    backgroundColor: "#1f7a5a",
    borderColor: "#1f7a5a"
  },
  monthCellText: {
    ...typography.label,
    color: "#18201c",
  },
  monthCellTextActive: {
    color: "#fff"
  },
  calendarWeekRow: {
    flexDirection: "row"
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8
  },
  dayToday: {
    backgroundColor: "#edf7f2"
  },
  daySelected: {
    backgroundColor: "#1f7a5a"
  },
  dayText: {
    ...typography.label,
    color: "#18201c",
  },
  daySelectedText: {
    color: "#fff"
  },
  calendarActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 18
  },
  secondaryAction: {
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: "#f4f1eb",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16
  },
  secondaryActionText: {
    ...typography.label,
    color: "#18201c",
  },
  saveAction: {
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: "#1f7a5a",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  saveActionText: {
    ...typography.label,
    color: "#fff",
  }
});
