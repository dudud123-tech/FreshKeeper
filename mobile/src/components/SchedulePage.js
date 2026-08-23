import { useMemo, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { typography } from "../theme/typography";
import { statusFor, todayIso } from "../utils/date";
import { getFoodImageSource } from "../utils/foodImages";
import {
  formatPlanTime,
  groupPlannedItemsByDate,
  hasPlan,
  isPlannableItem,
  MEAL_SLOTS,
  mealDefaultTime,
  mealLabel,
  overduePlannedItems,
  planTimeFor,
  scheduleDateLabel,
  upcomingScheduleDates
} from "../utils/mealPlan";
import { ChoiceGroup, DateButton, TimeField } from "./CommonControls";
import BannerAdSlot from "./BannerAdSlot";

const completeIcon = require("../../assets/actions/fork_spoon_80dp.png");


// 먹는 일정 화면. 오늘부터 7일을 날짜별 세로 목록으로 보여주고, 각 날짜 안에서
// 끼니(아침·점심·저녁·종일)로 묶는다. 완료 체크는 보관함과 같은 completeItem을
// 그대로 쓰므로 두 화면이 하나의 상품 상태를 공유한다(2026-08-19).
export default function SchedulePage({
  items,
  setItemPlan,
  clearItemPlan,
  completeItem,
  openCalendar,
  planNotificationTime = "18:00"
}) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerDate, setPickerDate] = useState(() => todayIso());
  const [pickerMeal, setPickerMeal] = useState("");
  const [pickerTime, setPickerTime] = useState("18:00");
  // 값이 있으면 "새 상품 추가"가 아니라 "이 상품의 일정 수정" 모드다.
  const [editingItem, setEditingItem] = useState(null);

  const dates = useMemo(() => upcomingScheduleDates(), []);
  const days = useMemo(() => groupPlannedItemsByDate(items, dates), [items, dates]);
  const overdue = useMemo(() => overduePlannedItems(items), [items]);
  const unplannedItems = useMemo(
    () => items.filter((item) => isPlannableItem(item) && !hasPlan(item)),
    [items]
  );
  const plannedCount = useMemo(
    () => days.reduce((total, day) => total + day.items.length, 0),
    [days]
  );

  function openPicker() {
    setEditingItem(null);
    setPickerDate(todayIso());
    setPickerMeal("");
    setPickerTime(planNotificationTime);
    setPickerVisible(true);
  }

  function openPickerForItem(item) {
    setEditingItem(item);
    setPickerDate(item.plannedDate || todayIso());
    setPickerMeal(item.plannedMeal || "");
    setPickerTime(planTimeFor(item, planNotificationTime));
    setPickerVisible(true);
  }

  // 끼니를 고르면 알림 시간을 그 끼니의 기본 시간으로 맞춰준다. 매번 시간을
  // 손으로 맞추는 부담을 줄이려는 것이고, 이후 시간을 직접 바꾸면 그 값이 남는다.
  function selectMeal(nextMeal) {
    setPickerMeal(nextMeal);
    const defaultTime = mealDefaultTime(nextMeal);
    if (defaultTime) setPickerTime(defaultTime);
  }

  function assignItem(itemId) {
    setItemPlan(itemId, { plannedDate: pickerDate, plannedMeal: pickerMeal, plannedTime: pickerTime });
    setPickerVisible(false);
    setEditingItem(null);
  }

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.introCard}>
          <Text style={styles.introTitle}>먹는 일정</Text>
          <Text style={styles.introText}>
            {plannedCount > 0
              ? `앞으로 7일 동안 ${plannedCount}개를 먹기로 했어요.`
              : "상품을 골라 언제 먹을지 정해두면 그날 알려드릴게요."}
          </Text>
        </View>

        {/* 지난 날짜에 잡힌 채 완료 안 된 일정. 그냥 사라지면 놓치기 쉬워 맨 위에 따로 모은다. */}
        {overdue.length > 0 ? (
          <View style={styles.overdueCard}>
            <Text style={styles.overdueTitle}>날짜가 지난 일정 {overdue.length}개</Text>
            {overdue.map((item) => (
              <ScheduleRow
                key={item.id}
                item={item}
                planNotificationTime={planNotificationTime}
                onComplete={() => completeItem(item.id)}
                onClear={() => clearItemPlan(item.id)}
                onEdit={() => openPickerForItem(item)}
                showPlannedDate
              />
            ))}
          </View>
        ) : null}

        {days.map((day) => (
          <View key={day.date} style={styles.dayBlock}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayTitle}>{scheduleDateLabel(day.date)}</Text>
              <Text style={styles.dayCount}>{day.items.length > 0 ? `${day.items.length}개` : ""}</Text>
            </View>

            {day.groups.length === 0 ? (
              <Text style={styles.dayEmpty}>일정 없음</Text>
            ) : (
              day.groups.map((group) => (
                <View key={`${day.date}-${group.mealId || "allday"}`} style={styles.mealGroup}>
                  <Text style={styles.mealLabel}>{group.label}</Text>
                  {group.items.map((item) => (
                    <ScheduleRow
                      key={item.id}
                      item={item}
                      planNotificationTime={planNotificationTime}
                      onComplete={() => completeItem(item.id)}
                      onClear={() => clearItemPlan(item.id)}
                      onEdit={() => openPickerForItem(item)}
                    />
                  ))}
                </View>
              ))
            )}
          </View>
        ))}

        <Pressable style={styles.addButton} onPress={openPicker}>
          <Text style={styles.addButtonText}>+ 먹을 상품 추가하기</Text>
        </Pressable>

        <BannerAdSlot />
      </ScrollView>

      <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingItem ? `${editingItem.name} 일정 바꾸기` : "언제 먹을까요?"}
            </Text>

            {/* 날짜 선택은 기존 CalendarModal(App.js의 openCalendar 콜백)을 그대로 재사용한다. */}
            <Text style={styles.modalLabel}>날짜</Text>
            <DateButton value={pickerDate} onPress={() => openCalendar(pickerDate, setPickerDate)} compact />

            <ChoiceGroup
              label="끼니 (선택)"
              options={["", ...MEAL_SLOTS.map((slot) => slot.id)]}
              value={pickerMeal}
              onChange={selectMeal}
              formatLabel={(option) => (option ? mealLabel(option) : "종일")}
              compact
            />

            {/* 알림 시각은 상품마다 따로 저장된다(item.plannedTime). */}
            <Text style={styles.modalLabel}>알림 시간</Text>
            <View style={styles.timeRow}>
              <TimeField
                value={pickerTime}
                onChange={setPickerTime}
              />
            </View>

            {editingItem ? null : <Text style={styles.modalLabel}>상품 고르기</Text>}
            {editingItem ? (
              <Pressable style={styles.modalPrimary} onPress={() => assignItem(editingItem.id)}>
                <Text style={styles.modalPrimaryText}>이 시간으로 저장</Text>
              </Pressable>
            ) : (
            <ScrollView style={styles.pickerList}>
              {unplannedItems.length === 0 ? (
                <Text style={styles.pickerEmpty}>일정을 정할 상품이 없습니다. 보관함에 상품을 먼저 등록해 주세요.</Text>
              ) : (
                unplannedItems.map((item) => {
                  const status = statusFor(item);
                  return (
                    <Pressable key={item.id} style={styles.pickerRow} onPress={() => assignItem(item.id)}>
                      <Image source={getFoodImageSource(item)} resizeMode="cover" style={styles.pickerImage} />
                      <Text style={styles.pickerName} numberOfLines={1}>{item.name}</Text>
                      <Text style={[styles.pickerDday, styles[`tone_${status.tone}`]]}>{status.label}</Text>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
            )}

            <Pressable style={styles.modalClose} onPress={() => setPickerVisible(false)}>
              <Text style={styles.modalCloseText}>닫기</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

// 일정 한 줄. 소비기한 D-day를 같이 보여줘서 "언제 먹을지"와 "언제까지 먹어야 하는지"
// 두 축을 한눈에 비교할 수 있게 한다.
function ScheduleRow({ item, planNotificationTime, onComplete, onClear, onEdit, showPlannedDate = false }) {
  const status = statusFor(item);
  const timeLabel = formatPlanTime(planTimeFor(item, planNotificationTime));
  return (
    <View style={styles.row}>
      <Image source={getFoodImageSource(item)} resizeMode="cover" style={styles.rowImage} />
      <Pressable style={styles.rowBody} onPress={onEdit}>
        <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.rowMeta}>
          {showPlannedDate ? `${item.plannedDate} · ` : ""}
          소비기한 {item.expiry}
        </Text>
        {timeLabel ? <Text style={styles.rowTime}>{`⏰ ${timeLabel} 알림`}</Text> : null}
      </Pressable>
      <Text style={[styles.rowDday, styles[`tone_${status.tone}`]]}>{status.label}</Text>
      <Pressable style={styles.rowAction} onPress={onClear} accessibilityRole="button" accessibilityLabel="일정 해제">
        <Text style={styles.rowClearText}>✕</Text>
      </Pressable>
      <Pressable style={styles.rowAction} onPress={onComplete} accessibilityRole="button" accessibilityLabel="먹었어요">
        <Image source={completeIcon} resizeMode="contain" style={styles.rowCompleteIcon} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1
  },
  page: {
    paddingHorizontal: 16,
    paddingBottom: 126
  },
  introCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e6e4df",
    backgroundColor: "#fff",
    padding: 14,
    marginTop: 14,
    gap: 4
  },
  introTitle: {
    ...typography.sectionTitle,
    color: "#18201c",
  },
  introText: {
    ...typography.caption,
    color: "#68716b",
  },
  overdueCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#efd8d3",
    backgroundColor: "#fff7f5",
    padding: 12,
    marginTop: 12,
    gap: 8
  },
  overdueTitle: {
    ...typography.captionStrong,
    color: "#9f3929",
  },
  dayBlock: {
    marginTop: 18
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8
  },
  dayTitle: {
    ...typography.sectionTitle,
    color: "#18201c",
  },
  dayCount: {
    ...typography.caption,
    color: "#68716b",
  },
  dayEmpty: {
    ...typography.caption,
    color: "#a2aaa5",
    paddingVertical: 6
  },
  mealGroup: {
    marginBottom: 10,
    gap: 6
  },
  mealLabel: {
    ...typography.captionStrong,
    color: "#1f7a5a",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#e6e4df",
    backgroundColor: "#fff",
    padding: 10
  },
  rowImage: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#f3f6f4"
  },
  rowBody: {
    flex: 1,
    gap: 2
  },
  rowName: {
    ...typography.cardTitle,
    color: "#18201c",
  },
  rowMeta: {
    ...typography.caption,
    color: "#68716b",
  },
  rowTime: {
    ...typography.captionStrong,
    color: "#1f7a5a",
    marginTop: 2
  },
  timeRow: {
    flexDirection: "row",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e3e8e5",
    backgroundColor: "#fff",
    padding: 10
  },
  modalPrimary: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#1f7a5a",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14
  },
  modalPrimaryText: {
    ...typography.label,
    color: "#fff",
  },
  rowDday: {
    ...typography.captionStrong,
    flexShrink: 0
  },
  tone_normal: {
    color: "#1f7a5a"
  },
  tone_warning: {
    color: "#d95f3d"
  },
  tone_expired: {
    color: "#a73727"
  },
  rowAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  rowClearText: {
    color: "#a2aaa5",
    fontSize: 17,
    fontWeight: "700"
  },
  // fork_spoon_80dp.png는 초록 원+흰 체크가 이미 그려진 완성형 아이콘이라 tintColor를 주지 않는다.
  rowCompleteIcon: {
    width: 34,
    height: 34
  },
  addButton: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#1f7a5a",
    backgroundColor: "#f6fbf8",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20
  },
  addButtonText: {
    ...typography.label,
    color: "#1f7a5a",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(24, 32, 28, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20
  },
  modalCard: {
    width: "100%",
    maxHeight: "84%",
    borderRadius: 18,
    backgroundColor: "#fbfcfb",
    padding: 16
  },
  modalTitle: {
    ...typography.sectionTitle,
    color: "#18201c",
    marginBottom: 8
  },
  modalLabel: {
    ...typography.label,
    color: "#68716b",
    marginTop: 10,
    marginBottom: 6
  },
  pickerList: {
    maxHeight: 260,
    marginTop: 2
  },
  pickerEmpty: {
    ...typography.caption,
    color: "#68716b",
    paddingVertical: 14
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e6e4df",
    backgroundColor: "#fff",
    padding: 9,
    marginBottom: 7
  },
  pickerImage: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: "#f3f6f4"
  },
  pickerName: {
    ...typography.bodyStrong,
    color: "#18201c",
    flex: 1
  },
  pickerDday: {
    ...typography.captionStrong
  },
  modalClose: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2ddd3",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12
  },
  modalCloseText: {
    ...typography.label,
    color: "#18201c",
  }
});
