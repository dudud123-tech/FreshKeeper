import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { typography } from "../theme/typography";
import { DEFAULT_PURCHASE_URL } from "../constants/purchase";
import { todayIso, weekdayLabel } from "../utils/date";
import { DEFAULT_PLAN_TIME, planTimeFor, PLAN_REPEATS, repeatLabel } from "../utils/mealPlan";
import { TabButton, TimeField } from "./CommonControls";

// 상품 수정 시트. 예전에는 InventoryList 안에 있었는데, 먹는 일정 화면에서도
// 같은 시트를 띄워야 해서 밖으로 뺐다. AppShell이 현재 페이지만 그리기 때문에
// InventoryList 안에 두면 일정 화면에서는 아예 마운트되지 않는다.
// 그래서 App.js의 overlays에서 한 번만 그린다(2026-08-24).

const EDIT_COPY = {
  editing: "\uC218\uC815 \uC911",
  productName: "\uC0C1\uD488\uBA85",
  purchaseUrl: "\uAD6C\uB9E4 \uB9C1\uD06C",
  purchasePlaceholder: DEFAULT_PURCHASE_URL,
  plannedDate: "\uBA39\uC744 \uB0A0",
  plannedWeekday: "\uBA39\uC744 \uC694\uC77C",
  plannedTime: "\uC54C\uB9BC \uC2DC\uAC04",
  planRepeat: "\uBC18\uBCF5",
  planReset: "\uC77C\uC815 \uCD08\uAE30\uD654",
  memo: "\uBA54\uBAA8",
  memoPlaceholder: "\uC608: \uD574\uB3D9 \uD544\uC694, \uC5C4\uB9C8 \uB4DC\uB9B4 \uAC83",
  tabBasic: "\uAE30\uD55C\u00B7\uC77C\uC815",
  tabDetail: "\uBD84\uB958\u00B7\uB9C1\uD06C",
  category: "\uCE74\uD14C\uACE0\uB9AC",
  storage: "\uBCF4\uAD00",
  expiry: "\uC18C\uBE44\uAE30\uD55C",
  cancel: "\uCDE8\uC18C",
  save: "\uC800\uC7A5"
};

const CATEGORY_EDIT_ORDER = [
  "\uC720\uC81C\uD488",
  "\uCC44\uC18C/\uACFC\uC77C",
  "\uC721\uB958/\uC0DD\uC120",
  "\uC2E0\uC120\uC2DD\uD488",
  "\uB0C9\uB3D9\uC2DD\uD488",
  "\uAC00\uACF5\uC2DD\uD488",
  "\uAC74\uC5B4\uBB3C/\uAC74\uC870\uC2DD\uD488",
  "\uC18C\uC2A4\uB958",
  "\uC74C\uB8CC",
  "\uAC04\uC2DD",
  "\uC57D",
  "\uAE30\uD0C0"
];

const COMPACT_CATEGORY_LABELS = {
  "\uAC74\uC5B4\uBB3C/\uAC74\uC870\uC2DD\uD488": "\uAC74\uC5B4\uBB3C",
  "\uAC00\uACF5\uC2DD\uD488": "\uAC00\uACF5",
  "\uB0C9\uB3D9\uC2DD\uD488": "\uB0C9\uB3D9",
  "\uC2E0\uC120\uC2DD\uD488": "\uC2E0\uC120"
};

  // 예전에는 이 편집 폼을 목록 카드 안에서 펼쳤다. 카테고리 12개 칩이 날짜 필드
  // 위를 차지해서 소비기한·먹을 날을 고치려면 매번 아래까지 스크롤해야 했고,
  // 카드가 길어져 목록도 밀렸다. 바텀시트로 띄워 넓은 화면에서 수정하게 바꿨다(2026-08-23).
export default function ItemEditSheet({
  editForm,
  setEditForm,
  editSubmitting,
  saveEdit,
  cancelEdit,
  openCalendar,
  categories,
  storageTypes,
  suggestCategory
}) {
  // 탭 상태는 시트 자신이 들고 있는다 — 바깥에서 알 필요가 없다.
  const [editTab, setEditTab] = useState("basic");
  const editCategoryOptions = useMemo(() => orderedCategoryOptions(categories), [categories]);
    if (!editForm) return null;
    return (
      <Modal visible transparent animationType="slide" onRequestClose={cancelEdit}>
        <View style={styles.sheetBackdrop}>
          <Pressable style={styles.sheetBackdropFill} onPress={cancelEdit} />
          <View style={styles.sheetCard}>
            <View style={styles.sheetHandle} />
            {/* 헤더는 ScrollView 밖에 둔다 — 안에 있으면 메모까지 내려갔을 때 저장
                버튼이 같이 사라져서, 다 고치고 나서 위로 되돌아와야 했다.
                "수정 중" 배지는 카드 안에서 인라인으로 고치던 시절의 흔적이라
                뺐다. 바텀시트에서는 화면 전체가 이미 수정 모드고, 그 자리에는
                지금 무엇을 고치는 중인지가 더 쓸모 있다(2026-08-23). */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {editForm.name?.trim() || EDIT_COPY.editing}
              </Text>
              <View style={styles.sheetHeaderActions}>
                <Pressable style={styles.sheetCancelAction} onPress={cancelEdit} accessibilityRole="button">
                  <Text style={styles.sheetCancelText}>{EDIT_COPY.cancel}</Text>
                </Pressable>
                <Pressable
                  style={[styles.sheetSaveAction, editSubmitting && styles.sheetSaveActionDisabled]}
                  onPress={editSubmitting ? undefined : saveEdit}
                  accessibilityRole="button"
                >
                  <Text style={styles.sheetSaveText}>{editSubmitting ? "저장 중..." : EDIT_COPY.save}</Text>
                </Pressable>
              </View>
            </View>
            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.editPanel}>
                <View style={styles.sheetTabs}>
                  <TabButton active={editTab === "basic"} label={EDIT_COPY.tabBasic} onPress={() => setEditTab("basic")} />
                  <TabButton active={editTab === "detail"} label={EDIT_COPY.tabDetail} onPress={() => setEditTab("detail")} />
                </View>
                {editTab === "basic" ? (
                  <View>
                <Field label={EDIT_COPY.productName}>
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
                <Field label={EDIT_COPY.expiry}>
                      <DateButton
                        value={editForm.expiry}
                        onPress={() => openCalendar(editForm.expiry, (value) => setEditForm((current) => ({ ...current, expiry: value })))}
                      />
                    </Field>
                {/* 먹는 일정 묶음. 소비기한과 달리 "언제 먹을지" 축에 속하는 값들이라
                        한 상자로 묶어 무엇에 딸린 설정인지 눈에 보이게 한다(2026-08-23). */}
                    <View style={styles.planGroup}>
                      <Text style={styles.planGroupTitle}>{"\uCC59\uACA8 \uBA39\uAE30"}</Text>
                      {/* 반복을 맨 위에 둔다. 매일 반복이면 특정 날짜를 고르는 게 의미가
                          없고, 매주면 날짜보다 요일이 중요하다 — 무엇을 물어볼지가 반복
                          선택에 따라 달라지기 때문이다(2026-08-23). */}
                      <ChoiceGroup
                        label={EDIT_COPY.planRepeat}
                        options={PLAN_REPEATS.map((option) => option.id)}
                        value={editForm.planRepeat || ""}
                        onChange={(value) =>
                          setEditForm((current) => {
                            // 매일 반복은 날짜를 안 물어보므로 시작일이 비어 있으면 오늘로 채운다.
                            // plannedDate가 없으면 일정이 없는 것으로 취급된다(mealPlan.hasPlan).
                            const plannedDate =
                              value === "daily" && !current.plannedDate ? todayIso() : current.plannedDate;
                            return { ...current, planRepeat: value, plannedDate, ...resolvedPlanTime(current, plannedDate) };
                          })
                        }
                        formatLabel={(option) => repeatLabel(option)}
                        compact
                      />
                      {editForm.planRepeat !== "daily" ? (
                        <Field label={editForm.planRepeat === "weekly" ? EDIT_COPY.plannedWeekday : EDIT_COPY.plannedDate}>
                          <DateButton
                            value={editForm.plannedDate || todayIso()}
                            onPress={() =>
                              openCalendar(editForm.plannedDate || todayIso(), (value) =>
                                setEditForm((current) => ({ ...current, plannedDate: value, ...resolvedPlanTime(current, value) }))
                              )
                            }
                            showWeekday
                          />
                          {editForm.planRepeat === "weekly" ? (
                            <Text style={styles.planHint}>
                              {`매주 ${weekdayLabel(editForm.plannedDate || todayIso())}요일에 알려드려요.`}
                            </Text>
                          ) : null}
                        </Field>
                      ) : null}
                    {editForm.plannedDate ? (
                        <Field label={EDIT_COPY.plannedTime}>
                          <View style={styles.planTimeRow}>
                            <TimeField
                              value={planTimeFor(editForm, DEFAULT_PLAN_TIME)}
                              onChange={(next) => setEditForm((current) => ({ ...current, plannedTime: next }))}
                            />
                          </View>
                        </Field>
                      ) : null}
                      {/* 일정을 지우지 않고 처음 값으로 되돌린다 — 오늘, 기본 알림
                          시각, 반복 안 함. 지우면 상품이 일정 화면에서 통째로
                          사라져 버려서, 날짜만 잘못 잡았을 때 쓰기에는 과했다.
                          값만 바꾸고 실제 반영은 저장할 때 된다 — 이 시트의 다른
                          필드와 같은 방식이라 실수로 눌러도 취소로 되돌릴 수
                          있다(2026-08-24). */}
                      {editForm.plannedDate ? (
                        <Pressable
                          style={styles.planResetButton}
                          onPress={() =>
                            setEditForm((current) => ({
                              ...current,
                              plannedDate: todayIso(),
                              plannedMeal: "",
                              plannedTime: DEFAULT_PLAN_TIME,
                              planRepeat: ""
                            }))
                          }
                          accessibilityRole="button"
                        >
                          <Text style={styles.planResetText}>{EDIT_COPY.planReset}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                    {/* 구조화된 필드로는 못 담는 것들(해동 필요, 보관 위치, 줄 사람 등)을
                        적어두는 자유 입력 칸. 알림이 뜰 때 본문에 같이 실린다(2026-08-23). */}
                    <Field label={EDIT_COPY.memo}>
                      <TextInput
                        value={editForm.memo || ""}
                        onChangeText={(value) => setEditForm((current) => ({ ...current, memo: value }))}
                        placeholder={EDIT_COPY.memoPlaceholder}
                        placeholderTextColor="#a0a8a2"
                        multiline
                        style={[styles.input, styles.memoInput]}
                      />
                    </Field>
                  </View>
                ) : (
                  <View>
                {editForm.purchaseUrl?.trim() ? (
                        <View style={styles.affiliateDisclosureBanner}>
                          <Text style={styles.affiliateDisclosureText}>
                            {"이 포스팅은 쿠팡 파트너스 활동의 일환으로,\n이에 따른 일정액의 수수료를 제공받습니다."}
                          </Text>
                        </View>
                      ) : null}
                    <Field label={EDIT_COPY.purchaseUrl}>
                        <TextInput
                          value={editForm.purchaseUrl || ""}
                          onChangeText={(value) => setEditForm((current) => ({ ...current, purchaseUrl: value }))}
                          placeholder={EDIT_COPY.purchasePlaceholder}
                          placeholderTextColor="#a0a8a2"
                          autoCapitalize="none"
                          autoCorrect={false}
                          autoComplete="off"
                          importantForAutofill="noExcludeDescendants"
                          spellCheck={false}
                          // keyboardType="url"(안드로이드 TYPE_TEXT_VARIATION_URI)이
                          // 삼성패스 자동완성 제안을 부르는 실제 트리거로 보여서 뺐다.
                          // 대부분 링크를 붙여넣기로 넣으니 기본 키보드로도 무리 없음.
                          returnKeyType="done"
                          disableFullscreenUI
                          style={styles.input}
                        />
                      </Field>
                    <ChoiceGroup
                        label={EDIT_COPY.category}
                        options={editCategoryOptions}
                        value={editForm.category}
                        onChange={(value) => setEditForm((current) => ({ ...current, category: value }))}
                        formatLabel={formatCompactCategoryLabel}
                        compact
                      />
                    <ChoiceGroup
                        label={EDIT_COPY.storage}
                        options={storageTypes}
                        value={editForm.storage}
                        onChange={(value) => setEditForm((current) => ({ ...current, storage: value }))}
                        compact
                      />
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }

// 일정이 생기는 순간 알림 시각도 같이 확정한다. TimeField는 사용자가 칸을
// 직접 건드려야만 onChange가 뜨기 때문에, 그냥 두면 화면에는 시각이 보이는데
// plannedTime은 빈 값으로 저장돼 실제 알림이 다른 시각에 왔다(2026-08-23).
function resolvedPlanTime(form, plannedDate) {
  if (!plannedDate) return {};
  return { plannedTime: planTimeFor(form, DEFAULT_PLAN_TIME) };
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

function orderedCategoryOptions(options = []) {
  const order = new Map(CATEGORY_EDIT_ORDER.map((category, index) => [category, index]));
  return [...options].sort((left, right) => {
    const leftOrder = order.has(left) ? order.get(left) : Number.MAX_SAFE_INTEGER;
    const rightOrder = order.has(right) ? order.get(right) : Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return String(left).localeCompare(String(right), "ko");
  });
}

function formatCompactCategoryLabel(option) {
  return COMPACT_CATEGORY_LABELS[option] || option;
}

function DateButton({ value, onPress, showWeekday = false }) {
  const weekday = showWeekday ? weekdayLabel(value) : "";
  return (
    <Pressable style={styles.dateButton} onPress={onPress}>
      <Text style={styles.dateText}>{weekday ? `${formatDateLabel(value)} (${weekday})` : formatDateLabel(value)}</Text>
    </Pressable>
  );
}

function formatDateLabel(value) {
  const [year, month, day] = value.split("-");
  return `${Number(year)}\uB144 ${Number(month)}\uC6D4 ${Number(day)}\uC77C`;
}

const styles = StyleSheet.create({
  affiliateDisclosureBanner: {
    // 공정위 지침 + 쿠팡 파트너스 가이드: 대가성 문구는 게시물 최상단에, 본문보다
    // 크거나 눈에 띄는 색으로 노출해야 한다(2026-08-04 최종 승인 반려 후 위치 수정).
    borderRadius: 10,
    backgroundColor: "#fff0e7",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  affiliateDisclosureText: {
    ...typography.body,
    color: "#d95f3d"
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
  choiceActive: {
    borderColor: "#1f7a5a",
    backgroundColor: "#1f7a5a"
  },
  choiceCompact: {
    minHeight: 32,
    width: 72,
    paddingHorizontal: 4,
    paddingVertical: 5
  },
  choiceText: {
    ...typography.label,
    color: "#18201c",
  },
  choiceTextActive: {
    color: "#fff"
  },
  choiceTextCompact: {
    ...typography.label,
    textAlign: "center"
  },
  choices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  dateButton: {
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d9cfc0",
    backgroundColor: "#fff",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  dateText: {
    ...typography.body,
    color: "#18201c",
  },
  editPanel: {
    gap: 10
  },
  field: {
    gap: 7,
    marginTop: 8
  },
  fieldCompact: {
    gap: 5,
    marginTop: 6
  },
  inlineField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6
  },
  inlineFieldControl: {
    flex: 1
  },
  inlineLabel: {
    ...typography.captionStrong,
    width: 58,
    color: "#68716b"
  },
  input: {
    ...typography.body,
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d9cfc0",
    backgroundColor: "#fff",
    color: "#18201c",
    paddingHorizontal: 12
  },
  label: {
    ...typography.label,
    color: "#68716b",
  },
  memoInput: {
    minHeight: 62,
    textAlignVertical: "top",
    paddingTop: 10
  },
  planGroup: {
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d4e7df",
    backgroundColor: "#f8fbf9",
    padding: 12
  },
  planGroupTitle: {
    ...typography.label,
    color: "#1f7a5a",
  },
  // 일정을 기본값으로 되돌리는 버튼입니다. 저장을 눌러야 실제로 반영되므로
  // 위험한 동작처럼 보이지 않게 담백하게 둡니다.
  planResetButton: {
    alignSelf: "flex-start",
    minHeight: 36,
    justifyContent: "center",
    marginTop: 4,
    paddingHorizontal: 2
  },
  planResetText: {
    ...typography.label,
    color: "#68716b"
  },
  planHint: {
    ...typography.caption,
    color: "#3f8f6d",
    marginTop: 6
  },
  planTimeRow: {
    flexDirection: "row"
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(24, 32, 28, 0.45)"
  },
  sheetBackdropFill: {
    flex: 1
  },
  sheetCancelAction: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 12
  },
  sheetCancelText: {
    ...typography.label,
    color: "#68716b",
  },
  sheetCard: {
    height: "82%",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: "#fbfcfb",
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 18
  },
  sheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#d7dbd8",
    marginBottom: 6
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ebeeec"
  },
  sheetHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2
  },
  sheetSaveAction: {
    minHeight: 36,
    borderRadius: 999,
    backgroundColor: "#1f7a5a",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  sheetSaveActionDisabled: {
    opacity: 0.6
  },
  sheetSaveText: {
    ...typography.label,
    color: "#fff",
  },
  sheetScroll: {
    flex: 1
  },
  sheetScrollContent: {
    paddingBottom: 32
  },
  sheetTabs: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#f1f4f2",
    borderRadius: 10,
    padding: 4,
    marginBottom: 4
  },
  sheetTitle: {
    ...typography.sectionTitle,
    color: "#18201c",
    flexShrink: 1
  },
});
