import { Fragment, useState } from "react";
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { statusFor, timelineFor } from "../utils/date";
import { getFoodImageSource } from "../utils/foodImages";
import AdSlot from "./AdSlot";

const searchIcon = require("../../assets/actions/inventory-search.png");
const filterIcon = require("../../assets/actions/inventory-filter.png");
const editIcon = require("../../assets/actions/inventory-edit.png");

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
  onChangeItemImage,
  setPagerEnabled,
  onItemLayout,
  reminderDays,
  expiryType
}) {
  const [query, setQuery] = useState("");
  const [controlsVisible, setControlsVisible] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const visibleItems = sortedItems.filter((item) => String(item.name || "").toLowerCase().includes(query.trim().toLowerCase()));
  const listRenderKey = `inventory-list-${sortMode}-${categoryFilter}-${focusItemId || "all"}`;
  const itemKeyPrefix = sortMode === "등록일순" ? "created" : "expiry";

  async function openPurchaseUrl(url) {
    const nextUrl = String(url || "").trim();
    if (!nextUrl) return;
    if (!/^https?:\/\//i.test(nextUrl)) {
      Alert.alert("링크 확인", "http:// 또는 https://로 시작하는 구매 링크를 넣어주세요.");
      return;
    }
    const supported = await Linking.canOpenURL(nextUrl);
    if (!supported) {
      Alert.alert("링크 열기 실패", "이 링크를 열 수 없습니다.");
      return;
    }
    Linking.openURL(nextUrl);
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={{ width }}
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
      onLayout={onLayout}
    >
      <View style={styles.section}>
        <View style={styles.toolRow}>
          <View style={styles.searchBox}>
            <Image source={searchIcon} resizeMode="contain" style={styles.searchIcon} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="상품명으로 검색"
              placeholderTextColor="#a0a8a2"
              style={styles.searchInput}
            />
          </View>
          <Pressable style={[styles.toolButton, controlsVisible && styles.toolButtonActive]} onPress={() => setControlsVisible((current) => !current)}>
            <Image source={filterIcon} resizeMode="contain" style={[styles.toolIcon, controlsVisible && styles.toolIconActive]} />
          </Pressable>
          <Pressable style={[styles.toolButton, editorVisible && styles.toolButtonActive]} onPress={() => setEditorVisible((current) => !current)}>
            <Image source={editIcon} resizeMode="contain" style={[styles.toolIcon, editorVisible && styles.toolIconActive]} />
          </Pressable>
        </View>

        {controlsVisible ? (
          <View style={styles.controlPanel}>
            <Text style={styles.controlLabel}>정렬 기준</Text>
            <View style={styles.compactChoiceRow}>
              {sortOptions.map((option) => (
                <Pressable
                  key={String(option)}
                  style={[styles.compactChoice, sortMode === option && styles.compactChoiceActive]}
                  onPress={() => setSortMode(option)}
                >
                  <Text style={[styles.compactChoiceText, sortMode === option && styles.compactChoiceTextActive]}>{option}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.controlLabel}>카테고리</Text>
            <View style={styles.categoryWrap}>
              {categoryFilters.map((option) => (
                <Pressable key={String(option)} style={[styles.categoryChip, categoryFilter === option && styles.categoryChipActive]} onPress={() => setCategoryFilter(option)}>
                  <Text style={[styles.categoryChipText, categoryFilter === option && styles.categoryChipTextActive]}>{option}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.controlHint}>편집 아이콘을 켜면 수정/삭제 버튼이 표시됩니다.</Text>
          </View>
        ) : null}
        {focusItemId ? (
          <View style={styles.focusNotice}>
            <Text style={styles.focusNoticeText}>방금 등록한 상품을 보고 있습니다.</Text>
            <Pressable style={styles.focusNoticeButton} onPress={clearFocusItem}>
              <Text style={styles.focusNoticeButtonText}>전체 목록</Text>
            </Pressable>
          </View>
        ) : null}
        <View key={listRenderKey} style={styles.itemList}>
          {visibleItems.length === 0 ? (
            <Text style={styles.empty}>조건에 맞는 상품이 없습니다.</Text>
          ) : (
            visibleItems.map((item, index) => {
              const itemKey = String(item.id || `${item.name || "item"}-${item.expiry || "no-expiry"}-${index}`);
              const renderKey = `${itemKeyPrefix}-${itemKey}`;
              const displayName = String(item.name || "");
              const expiryValue = typeof item.expiry === "string" ? item.expiry : "";
              const storageLabel = String(item.storage || "");
              const status = statusFor(item);
              const timeline = timelineFor(item, reminderDays);
              const isEditing = editingId === item.id && editForm;
              const dateMeta = sortMode === "등록일순" ? `등록 ${createdDateLabel(item)}` : `${expiryType} ${expiryValue || "-"}`;
              return (
                <Fragment key={renderKey}>
                {index === 8 ? <AdSlot variant="inventory" style={styles.inventoryAdSlot} /> : null}
                <View
                  style={[styles.itemCard, isEditing && styles.itemCardEditing]}
                  onLayout={(event) => onItemLayout(itemKey, event, isEditing)}
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
                      <Field label="구매 링크">
                        <TextInput
                          value={editForm.purchaseUrl || ""}
                          onChangeText={(value) => setEditForm((current) => ({ ...current, purchaseUrl: value }))}
                          placeholder="쿠팡 공유 링크를 붙여넣어 주세요"
                          placeholderTextColor="#a0a8a2"
                          autoCapitalize="none"
                          autoCorrect={false}
                          autoComplete="off"
                          importantForAutofill="no"
                          spellCheck={false}
                          keyboardType="url"
                          inputMode="url"
                          textContentType="URL"
                          returnKeyType="done"
                          disableFullscreenUI
                          style={styles.input}
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
                    <View style={styles.itemContentRow}>
                      <Pressable onLongPress={() => onChangeItemImage?.(item.id)} delayLongPress={350}>
                        <Image source={getFoodImageSource(item)} resizeMode="cover" style={styles.itemImage} />
                      </Pressable>
                      <View style={styles.itemContent}>
                        <View style={styles.itemHeader}>
                          <View style={styles.itemTitleRow}>
                            <Text style={styles.itemName} numberOfLines={1}>{displayName}</Text>
                            <Text style={styles.storagePill}>{storageLabel}</Text>
                          </View>
                          <Text style={[styles.badge, styles[status.tone]]}>{status.label}</Text>
                        </View>
                        <Text style={styles.meta}>{dateMeta}</Text>
                        <ExpiryTimeline timeline={timeline} />
                        {item.purchaseUrl ? (
                          <Pressable style={styles.purchaseAction} onPress={() => openPurchaseUrl(item.purchaseUrl)}>
                            <Text style={styles.purchaseActionText}>구매 바로가기</Text>
                          </Pressable>
                        ) : null}
                        {editorVisible ? (
                          <View style={styles.cardActions}>
                            <Pressable style={styles.secondaryAction} onPress={() => startEdit(item)}>
                              <Text style={styles.secondaryActionText}>수정</Text>
                            </Pressable>
                            <Pressable style={styles.deleteAction} onPress={() => removeItem(item.id)}>
                              <Text style={styles.deleteText}>삭제</Text>
                            </Pressable>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  )}
                </View>
                </Fragment>
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
  const width = typeof timeline?.width === "string" || typeof timeline?.width === "number" ? timeline.width : "0%";
  const tone = timeline?.tone || "normal";
  return (
    <View style={styles.timelineWrap}>
      <View style={styles.timelineTrack}>
        <View style={[styles.timelineFill, styles[`${tone}Fill`], { width }]} />
      </View>
    </View>
  );
}

function createdDateLabel(item) {
  if (typeof item?.createdAt === "string" && item.createdAt.length >= 10) {
    return item.createdAt.slice(0, 10);
  }
  if (typeof item?.expiry === "string" && item.expiry.length >= 10) {
    return item.expiry.slice(0, 10);
  }
  return "-";
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 16,
    paddingBottom: 140
  },
  section: {
    backgroundColor: "transparent",
    padding: 0,
    marginTop: 0
  },
  toolRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  searchBox: {
    flex: 1,
    minHeight: 46,
    borderRadius: 13,
    backgroundColor: "#f4f6f5",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8
  },
  searchIcon: {
    width: 22,
    height: 22,
    opacity: 0.72
  },
  searchInput: {
    flex: 1,
    color: "#18201c",
    fontSize: 14,
    fontWeight: "700",
    paddingVertical: 0
  },
  toolButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#f4f6f5",
    alignItems: "center",
    justifyContent: "center"
  },
  toolButtonActive: {
    backgroundColor: "#e5f3ec"
  },
  toolIcon: {
    width: 27,
    height: 27,
    opacity: 0.82
  },
  toolIconActive: {
    opacity: 1
  },
  controlPanel: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e6e4df",
    backgroundColor: "#fff",
    padding: 12,
    gap: 8
  },
  controlLabel: {
    color: "#18201c",
    fontSize: 13,
    fontWeight: "900"
  },
  compactChoiceRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap"
  },
  compactChoice: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e2ddd3",
    backgroundColor: "#fff",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  compactChoiceActive: {
    borderColor: "#1f7a5a",
    backgroundColor: "#1f7a5a"
  },
  compactChoiceText: {
    color: "#68716b",
    fontSize: 12,
    fontWeight: "900"
  },
  compactChoiceTextActive: {
    color: "#fff"
  },
  controlHint: {
    color: "#8a938d",
    fontSize: 11,
    fontWeight: "700"
  },
  categoryWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8
  },
  categoryChip: {
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e2ddd3",
    backgroundColor: "#fff",
    justifyContent: "center",
    paddingHorizontal: 15
  },
  categoryChipActive: {
    borderColor: "#1f7a5a",
    backgroundColor: "#1f7a5a"
  },
  categoryChipText: {
    color: "#68716b",
    fontSize: 12,
    fontWeight: "900"
  },
  categoryChipTextActive: {
    color: "#fff"
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
    gap: 8,
    marginTop: 10
  },
  inventoryAdSlot: {
    marginVertical: 2
  },
  empty: {
    color: "#68716b",
    textAlign: "center",
    paddingVertical: 24
  },
  itemCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ecebea",
    backgroundColor: "#fff",
    padding: 10
  },
  itemCardEditing: {
    borderColor: "#d95f3d",
    backgroundColor: "#fffaf6"
  },
  itemContentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  itemImage: {
    width: 62,
    height: 62,
    borderRadius: 14,
    backgroundColor: "#f3f6f4",
    overflow: "hidden"
  },
  itemContent: {
    flex: 1
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
  purchaseAction: {
    alignSelf: "flex-start",
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#b9dfcf",
    backgroundColor: "#edf7f2",
    justifyContent: "center",
    marginTop: 9,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  purchaseActionText: {
    color: "#14583f",
    fontSize: 12,
    fontWeight: "900"
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10
  },
  itemTitleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  itemName: {
    flex: 1,
    color: "#18201c",
    fontSize: 15,
    fontWeight: "900"
  },
  storagePill: {
    color: "#1f7a5a",
    backgroundColor: "#e8f4ee",
    borderRadius: 7,
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 3,
    fontSize: 10,
    fontWeight: "900"
  },
  badge: {
    textAlign: "center",
    fontSize: 13,
    fontWeight: "900"
  },
  normal: {
    color: "#3b9f44"
  },
  warning: {
    color: "#ef9b20"
  },
  expired: {
    color: "#e54135"
  },
  meta: {
    color: "#68716b",
    fontSize: 12,
    lineHeight: 19,
    marginTop: 4
  },
  expiryMeta: {
    color: "#14583f",
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 19,
    marginTop: 2
  },
  timelineWrap: {
    marginTop: 7
  },
  timelineTrack: {
    height: 5,
    borderRadius: 999,
    backgroundColor: "#e9ece9",
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
    backgroundColor: "#ef9b20"
  },
  expiredFill: {
    backgroundColor: "#e54135"
  },
});
