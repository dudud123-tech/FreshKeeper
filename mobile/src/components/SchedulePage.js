import { useMemo, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { typography } from "../theme/typography";
import { statusFor, todayIso, weekdayLabel } from "../utils/date";
import { getFoodImageSource } from "../utils/foodImages";
import {
  DEFAULT_PLAN_TIME,
  formatPlanTime,
  groupPlannedItemsByDate,
  hasPlan,
  isPlannableItem,
  isRepeating,
  PLAN_REPEATS,
  repeatLabel,
  overduePlannedItems,
  planTimeFor,
  scheduleDateLabel,
  upcomingScheduleDates
} from "../utils/mealPlan";
import { ChoiceGroup, DateButton, TimeField } from "./CommonControls";
import ItemDetailModal from "./ItemDetailModal";
import BannerAdSlot from "./BannerAdSlot";

const completeIcon = require("../../assets/actions/fork_spoon_80dp.png");


// 먹는 일정 화면. 오늘부터 30일(SCHEDULE_LOOKAHEAD_DAYS)을 날짜별 세로 목록으로
// 보여주되 일정이 있는 날만 그린다 — 빈 날까지 전부 그리면 30줄이 대부분 "일정 없음"이
// 되어 정작 잡아둔 일정이 묻힌다(2026-08-23). 완료 체크는 보관함과 같은
// completeItem을 그대로 쓰므로 두 화면이 하나의 상품 상태를 공유한다(2026-08-19).
//
// 끼니(아침·점심·저녁) 그룹은 남아 있지만 고를 수는 없다 — 상품마다 알림 시각을
// 직접 정하는 방식으로 갈음했다. 끼니를 고를 수 있던 시절 데이터가 여전히 그
// 그룹으로 묶이도록 표시 로직만 남겨 둔다(2026-08-23).
export default function SchedulePage({
  items,
  setItemPlan,
  clearItemPlan,
  completeItem,
  openCalendar
}) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerDate, setPickerDate] = useState(() => todayIso());
  const [pickerTime, setPickerTime] = useState(DEFAULT_PLAN_TIME);
  const [pickerRepeat, setPickerRepeat] = useState("");
  // 값이 있으면 "새 상품 추가"가 아니라 "이 상품의 일정 수정" 모드다.
  const [editingItem, setEditingItem] = useState(null);
  // 상품명을 누르면 뜨는 상세 카드. 보관함과 같은 팝업을 쓴다. 스냅샷 대신
  // id만 들고 매번 목록에서 찾아, 완료·해제로 빠지면 저절로 닫힌다(2026-08-24).
  const [detailItemId, setDetailItemId] = useState("");
  const detailItem = useMemo(
    () => (detailItemId ? items.find((item) => String(item.id) === detailItemId) || null : null),
    [items, detailItemId]
  );

  const dates = useMemo(() => upcomingScheduleDates(), []);
  const days = useMemo(() => groupPlannedItemsByDate(items, dates), [items, dates]);
  const overdue = useMemo(() => overduePlannedItems(items), [items]);
  const unplannedItems = useMemo(
    () => items.filter((item) => isPlannableItem(item) && !hasPlan(item)),
    [items]
  );
  const plannedDays = useMemo(() => days.filter((day) => day.items.length > 0), [days]);
  const plannedCount = useMemo(
    () => days.reduce((total, day) => total + day.items.length, 0),
    [days]
  );

  function openPicker() {
    setEditingItem(null);
    setPickerDate(todayIso());
    setPickerTime(DEFAULT_PLAN_TIME);
    setPickerRepeat("");
    setPickerVisible(true);
  }

  function openPickerForItem(item) {
    setEditingItem(item);
    setPickerDate(item.plannedDate || todayIso());
    setPickerTime(planTimeFor(item, DEFAULT_PLAN_TIME));
    setPickerRepeat(item.planRepeat || "");
    setPickerVisible(true);
  }

  function assignItem(itemId) {
    setItemPlan(itemId, {
      plannedDate: pickerDate,
      // 끼니는 더 이상 고르게 하지 않는다(상품마다 알림 시각을 직접 정하는 걸로
      // 갈음). 다만 setItemPlan이 빠진 필드를 ""로 덮어쓰기 때문에, 끼니를
      // 고를 수 있던 시절에 잡아둔 상품의 값은 그대로 넘겨 보존한다(2026-08-23).
      plannedMeal: editingItem?.plannedMeal || "",
      plannedTime: pickerTime,
      planRepeat: pickerRepeat
    });
    setPickerVisible(false);
    setEditingItem(null);
  }

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        {/* 지난 날짜에 잡힌 채 완료 안 된 일정. 그냥 사라지면 놓치기 쉬워 맨 위에 따로 모은다. */}
        {overdue.length > 0 ? (
          <View style={styles.overdueCard}>
            <Text style={styles.overdueTitle}>날짜가 지난 일정 {overdue.length}개</Text>
            {overdue.map((item) => (
              <ScheduleRow
                key={item.id}
                item={item}
                onComplete={() => completeItem(item.id)}
                onClear={() => clearItemPlan(item.id)}
                onEdit={() => openPickerForItem(item)}
                onOpenDetail={() => setDetailItemId(String(item.id))}
                showPlannedDate
              />
            ))}
          </View>
        ) : null}

        {plannedDays.map((day) => (
          <View key={day.date} style={styles.dayBlock}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayTitle}>{scheduleDateLabel(day.date)}</Text>
              <Text style={styles.dayCount}>{`${day.items.length}개`}</Text>
            </View>

            {day.groups.map((group) => (
              <View key={`${day.date}-${group.mealId || "allday"}`} style={styles.mealGroup}>
                {day.groups.length > 1 || group.mealId ? (
                  <Text style={styles.mealLabel}>{group.label}</Text>
                ) : null}
                {group.items.map((item) => (
                  <ScheduleRow
                    key={item.id}
                    item={item}
                    onComplete={() => completeItem(item.id)}
                    onClear={() => clearItemPlan(item.id)}
                    onEdit={() => openPickerForItem(item)}
                    onOpenDetail={() => setDetailItemId(String(item.id))}
                  />
                ))}
              </View>
            ))}
          </View>
        ))}

        {plannedCount === 0 && overdue.length === 0 ? (
          <Text style={styles.emptyText}>상품을 골라 언제 먹을지 정해두면 그날 알려드릴게요.</Text>
        ) : null}

        <Pressable style={styles.addButton} onPress={openPicker}>
          <Text style={styles.addButtonText}>+ 먹을 상품 추가하기</Text>
        </Pressable>

        <BannerAdSlot />
      </ScrollView>

      <ItemDetailModal
        item={detailItem}
        completedScope={false}
        editLabel="일정 바꾸기"
        onClose={() => setDetailItemId("")}
        onEdit={() => {
          const target = detailItem;
          setDetailItemId("");
          if (target) openPickerForItem(target);
        }}
      />

      <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingItem ? `${editingItem.name} 일정 바꾸기` : "언제 먹을까요?"}
            </Text>

            {/* 비타민·약처럼 계속 챙겨 먹는 상품을 위한 반복. 보관함 편집과 같은 이유로
                맨 위에 둔다 — 매일 반복이면 날짜를 물어볼 필요가 없다. */}
            <ChoiceGroup
              label="반복"
              options={PLAN_REPEATS.map((option) => option.id)}
              value={pickerRepeat}
              onChange={setPickerRepeat}
              formatLabel={(option) => repeatLabel(option)}
              compact
            />

            {/* 날짜 선택은 기존 CalendarModal(App.js의 openCalendar 콜백)을 그대로 재사용한다. */}
            {pickerRepeat !== "daily" ? (
              <>
                <Text style={styles.modalLabel}>{pickerRepeat === "weekly" ? "먹을 요일" : "날짜"}</Text>
                <DateButton value={pickerDate} onPress={() => openCalendar(pickerDate, setPickerDate)} compact showWeekday />
                {pickerRepeat === "weekly" ? (
                  <Text style={styles.modalHint}>{`매주 ${weekdayLabel(pickerDate)}요일에 알려드려요.`}</Text>
                ) : null}
              </>
            ) : null}

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
function ScheduleRow({ item, onComplete, onClear, onEdit, onOpenDetail, showPlannedDate = false }) {
  const status = statusFor(item);
  const timeLabel = formatPlanTime(planTimeFor(item, DEFAULT_PLAN_TIME));
  const repeatSuffix = isRepeating(item) ? ` · ${repeatLabel(item.planRepeat)} 반복` : "";
  return (
    <View style={styles.row}>
      <Image source={getFoodImageSource(item)} resizeMode="cover" style={styles.rowImage} />
      <Pressable style={styles.rowBody} onPress={onEdit}>
        <Pressable
          onPress={onOpenDetail}
          accessibilityRole="button"
          accessibilityLabel={`${item.name} 자세히 보기`}
        >
          <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
        </Pressable>
        <Text style={styles.rowMeta}>
          {showPlannedDate ? `${item.plannedDate} · ` : ""}
          소비기한 {item.expiry}
        </Text>
        {timeLabel ? <Text style={styles.rowTime}>{`⏰ ${timeLabel} 알림${repeatSuffix}`}</Text> : null}
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
  emptyText: {
    ...typography.caption,
    color: "#68716b",
    textAlign: "center",
    marginTop: 28
  },
  modalHint: {
    ...typography.caption,
    color: "#3f8f6d",
    marginTop: 6
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
