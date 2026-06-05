import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { itemCreatedDate, statusFor, timelineFor } from "../utils/date";

export default function InventoryList({
  width,
  scrollRef,
  onLayout,
  sortedItems,
  sortOptions,
  sortMode,
  setSortMode,
  categoryFilters,
  categoryFilter,
  setCategoryFilter,
  focusItemId,
  clearFocusItem,
  editingId,
  editForm,
  setEditForm,
  categories,
  storageTypes,
  suggestCategory,
  openCalendar,
  cancelEdit,
  saveEdit,
  startEdit,
  removeItem,
  onItemLayout,
  reminderDays,
  expiryType
}) {
  return (
    <ScrollView
      ref={scrollRef}
      style={{ width }}
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
      onLayout={onLayout}
    >
      <View style={styles.section}>
        <ChoiceGroup label="정렬 기준" options={sortOptions} value={sortMode} onChange={setSortMode} compact />
        <ChoiceGroup label="카테고리 필터" options={categoryFilters} value={categoryFilter} onChange={setCategoryFilter} />
        {focusItemId ? (
          <View style={styles.focusNotice}>
            <Text style={styles.focusNoticeText}>방금 등록한 상품을 보고 있습니다.</Text>
            <Pressable style={styles.focusNoticeButton} onPress={clearFocusItem}>
              <Text style={styles.focusNoticeButtonText}>전체 목록</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={styles.itemList}>
          {sortedItems.length === 0 ? (
            <Text style={styles.empty}>조건에 맞는 상품이 없습니다.</Text>
          ) : (
            sortedItems.map((item) => {
              const status = statusFor(item);
              const timeline = timelineFor(item, reminderDays);
              const isEditing = editingId === item.id && editForm;
              return (
                <View
                  key={item.id}
                  style={[styles.itemCard, isEditing && styles.itemCardEditing]}
                  onLayout={(event) => onItemLayout(item.id, event, isEditing)}
                >
                  {isEditing ? (
                    <View style={styles.editPanel}>
                      <View style={styles.editBanner}>
                        <Text style={styles.editBannerText}>수정 중</Text>
                      </View>
                      <Field label="상품명">
                        <TextInput
                          value={editForm.name}
                          onChangeText={(value) =>
                            setEditForm((current) => ({
                              ...current,
                              name: value,
                              category: suggestCategory(value)
                            }))
                          }
                          style={styles.input}
                        />
                      </Field>
                      <ChoiceGroup
                        label="카테고리"
                        options={categories}
                        value={editForm.category}
                        onChange={(value) => setEditForm((current) => ({ ...current, category: value }))}
                      />
                      <ChoiceGroup
                        label="보관"
                        options={storageTypes}
                        value={editForm.storage}
                        onChange={(value) => setEditForm((current) => ({ ...current, storage: value }))}
                      />
                      <Field label="소비기한">
                        <DateButton
                          value={editForm.expiry}
                          onPress={() => openCalendar(editForm.expiry, (value) => setEditForm((current) => ({ ...current, expiry: value })))}
                        />
                      </Field>
                      <View style={styles.cardActions}>
                        <Pressable style={styles.secondaryAction} onPress={cancelEdit}>
                          <Text style={styles.secondaryActionText}>취소</Text>
                        </Pressable>
                        <Pressable style={styles.editSaveAction} onPress={saveEdit}>
                          <Text style={styles.saveActionText}>저장</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <>
                      <View style={styles.itemHeader}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={[styles.badge, styles[status.tone]]}>{status.label}</Text>
                      </View>
                      <Text style={styles.meta}>{item.category} · {item.storage} · 등록 {itemCreatedDate(item)}</Text>
                      <Text style={styles.expiryMeta}>{expiryType} {item.expiry}</Text>
                      <ExpiryTimeline timeline={timeline} />
                      <View style={styles.cardActions}>
                        <Pressable style={styles.secondaryAction} onPress={() => startEdit(item)}>
                          <Text style={styles.secondaryActionText}>수정</Text>
                        </Pressable>
                        <Pressable style={styles.deleteAction} onPress={() => removeItem(item.id)}>
                          <Text style={styles.deleteText}>삭제</Text>
                        </Pressable>
                      </View>
                    </>
                  )}
                </View>
              );
            })
          )}
        </View>
      </View>
    </ScrollView>
  );
}

function Field({ label, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function ChoiceGroup({ label, options, value, onChange, formatLabel = (option) => option, compact = false }) {
  return (
    <View style={[styles.field, compact && styles.fieldCompact]}>
      <Text style={styles.label}>{label}</Text>
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

function DateButton({ value, onPress }) {
  return (
    <Pressable style={styles.dateButton} onPress={onPress}>
      <Text style={styles.dateText}>{formatDateLabel(value)}</Text>
      <Text style={styles.dateSubText}>{value}</Text>
    </Pressable>
  );
}

function formatDateLabel(value) {
  const [year, month, day] = value.split("-");
  return `${Number(year)}년 ${Number(month)}월 ${Number(day)}일`;
}

function ExpiryTimeline({ timeline }) {
  return (
    <View style={styles.timelineWrap}>
      <View style={styles.timelineTrack}>
        <View style={[styles.timelineFill, styles[`${timeline.tone}Fill`], { width: timeline.width }]} />
      </View>
      <Text style={[styles.timelineLabel, styles[`${timeline.tone}TimelineText`]]}>{timeline.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 16,
    paddingBottom: 18
  },
  section: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2ddd3",
    backgroundColor: "#fff",
    padding: 14,
    marginTop: 8
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
    fontWeight: "900"
  },
  choices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  choice: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d9cfc0",
    backgroundColor: "#f7f3eb",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  choiceCompact: {
    minHeight: 34,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  choiceActive: {
    borderColor: "#1f7a5a",
    backgroundColor: "#1f7a5a"
  },
  choiceText: {
    color: "#18201c",
    fontWeight: "900"
  },
  choiceTextCompact: {
    fontSize: 12
  },
  choiceTextActive: {
    color: "#fff"
  },
  focusNotice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: "#edf7f2",
    borderWidth: 1,
    borderColor: "#b9dfcf",
    padding: 10
  },
  focusNoticeText: {
    flex: 1,
    color: "#14583f",
    fontSize: 13,
    fontWeight: "900"
  },
  focusNoticeButton: {
    minHeight: 34,
    borderRadius: 8,
    backgroundColor: "#1f7a5a",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  focusNoticeButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900"
  },
  itemList: {
    gap: 10,
    marginTop: 12
  },
  empty: {
    color: "#68716b",
    textAlign: "center",
    paddingVertical: 24
  },
  itemCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2ddd3",
    backgroundColor: "#fff",
    padding: 12
  },
  itemCardEditing: {
    borderColor: "#d95f3d",
    backgroundColor: "#fffaf6"
  },
  editPanel: {
    gap: 10
  },
  editBanner: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#fff0e7",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  editBannerText: {
    color: "#d95f3d",
    fontSize: 12,
    fontWeight: "900"
  },
  input: {
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d9cfc0",
    backgroundColor: "#fff",
    color: "#18201c",
    fontSize: 16,
    fontWeight: "900",
    paddingHorizontal: 12
  },
  dateButton: {
    minHeight: 56,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d9cfc0",
    backgroundColor: "#fff",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  dateText: {
    color: "#18201c",
    fontSize: 16,
    fontWeight: "900"
  },
  dateSubText: {
    color: "#68716b",
    fontSize: 12,
    marginTop: 2
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 10
  },
  secondaryAction: {
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: "#f7f3eb",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  secondaryActionText: {
    color: "#18201c",
    fontWeight: "900"
  },
  editSaveAction: {
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: "#d95f3d",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 9
  },
  saveActionText: {
    color: "#fff",
    fontWeight: "900"
  },
  deleteAction: {
    minHeight: 38,
    borderRadius: 8,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  deleteText: {
    color: "#9f3929",
    fontWeight: "900"
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10
  },
  itemName: {
    flex: 1,
    color: "#18201c",
    fontSize: 17,
    fontWeight: "900"
  },
  badge: {
    minWidth: 54,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    overflow: "hidden",
    textAlign: "center",
    fontSize: 12,
    fontWeight: "900"
  },
  normal: {
    color: "#14583f",
    backgroundColor: "#edf7f2"
  },
  warning: {
    color: "#d95f3d",
    backgroundColor: "#fff0e7"
  },
  expired: {
    color: "#a73727",
    backgroundColor: "#fff2f0"
  },
  meta: {
    color: "#68716b",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8
  },
  expiryMeta: {
    color: "#14583f",
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 19,
    marginTop: 2
  },
  timelineWrap: {
    marginTop: 10,
    gap: 5
  },
  timelineTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#ece6dc",
    overflow: "hidden"
  },
  timelineFill: {
    height: "100%",
    borderRadius: 999
  },
  normalFill: {
    backgroundColor: "#1f7a5a"
  },
  warningFill: {
    backgroundColor: "#d95f3d"
  },
  expiredFill: {
    backgroundColor: "#a73727"
  },
  timelineLabel: {
    fontSize: 12,
    fontWeight: "900"
  },
  normalTimelineText: {
    color: "#14583f"
  },
  warningTimelineText: {
    color: "#d95f3d"
  },
  expiredTimelineText: {
    color: "#a73727"
  }
});
