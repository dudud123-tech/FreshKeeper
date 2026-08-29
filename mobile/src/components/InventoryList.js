import { Fragment, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { typography } from "../theme/typography";
import { statusFor, timelineFor } from "../utils/date";
import { completionTimingLabel, createdDateLabel } from "../utils/itemLabels";
import { planBadgeLabel } from "../utils/mealPlan";


import { getFoodImageSource } from "../utils/foodImages";
import BannerAdSlot from "./BannerAdSlot";

const searchIcon = require("../../assets/actions/inventory-search.png");
const filterIcon = require("../../assets/actions/inventory-filter.png");
const COMPLETED_VISIBLE_DAYS = 90;
export default function InventoryList({
  scrollRef,
  onLayout,
  sortedItems,
  inventoryScope,
  setInventoryScope,
  sortOptions,
  sortMode,
  setSortMode,
  categoryFilters,
  categoryFilter,
  storageFilters,
  storageFilter,
  setStorageFilter,
  setCategoryFilter,
  favoriteFilter,
  setFavoriteFilter,
  focusItemId,
  clearFocusItem,
  editingId,
  editSubmitting,
  editForm,
  setEditForm,
  categories,
  storageTypes,
  suggestCategory,
  openCalendar,
  cancelEdit,
  saveEdit,
  onItemLayout,
  reminderDays,
  expiryType,
  onOpenDetail
}) {
  const [query, setQuery] = useState("");
  const [controlsVisible, setControlsVisible] = useState(false);
  // 편집 시트 탭. 기본(상품명·소비기한·일정) / 상세(카테고리·보관·구매링크).
  // 접기 방식은 한 번 더 눌러야 해서 접근이 불편하다는 피드백으로 탭으로 바꿨다(2026-08-23).
  const [editTab, setEditTab] = useState("basic");
  // 상품명을 누르면 뜨는 큰 카드 팝업. 항목을 통째로 담아두면 수정 후에도 옛
  // 값이 남으므로 id만 들고 매번 현재 목록에서 찾는다. 완료/삭제로 목록에서
  // 빠지면 자연히 null이 되어 팝업도 닫힌다(2026-08-24).

  // 수정 시트를 열기 직전의 값. 돌아왔을 때 무엇이 바뀌었는지 빨간색으로
  // 표시하려면 비교 대상이 있어야 한다(2026-08-24).

  const isCompletedScope = inventoryScope === "completed";
  const normalizedQuery = query.trim().toLowerCase();
  const searchedItems = sortedItems.filter((item) => String(item.name || "").toLowerCase().includes(normalizedQuery));
  const completedStats = useMemo(() => summarizeCompletedItems(sortedItems), [sortedItems]);
  const visibleItems = useMemo(() => {
    if (!isCompletedScope) return searchedItems;
    return searchedItems.filter((item) => isRecentCompletedItem(item, COMPLETED_VISIBLE_DAYS));
  }, [isCompletedScope, searchedItems]);
  const visibleEntries = useMemo(() => {
    if (!isCompletedScope) return visibleItems.map((item) => ({ kind: "item", item }));
    return buildCompletedMonthEntries(visibleItems);
  }, [isCompletedScope, visibleItems]);
  const listRenderKey = `inventory-list-${inventoryScope}-${sortMode}-${categoryFilter}-${storageFilter}-${favoriteFilter}-${focusItemId || "all"}`;
  const itemKeyPrefix = sortMode === "등록일순" ? "created" : "expiry";

    return (
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
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
        </View>

        <View style={styles.scopeTabs}>
          <Pressable
            style={[styles.scopeTab, !isCompletedScope && styles.scopeTabActive]}
            onPress={() => setInventoryScope("active")}
          >
            <Text style={[styles.scopeTabText, !isCompletedScope && styles.scopeTabTextActive]}>보관 중</Text>
          </Pressable>
          <Pressable
            style={[styles.scopeTab, isCompletedScope && styles.scopeTabActive]}
            onPress={() => setInventoryScope("completed")}
          >
            <Text style={[styles.scopeTabText, isCompletedScope && styles.scopeTabTextActive]}>완료</Text>
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
            <Text style={styles.controlLabel}>보기 옵션</Text>
            <View style={styles.compactChoiceRow}>
              {[
                { value: "all", label: "전체" },
                { value: "favorite", label: "즐겨찾기" }
              ].map((option) => (
                <Pressable
                  key={option.value}
                  style={[styles.compactChoice, favoriteFilter === option.value && styles.compactChoiceActive]}
                  onPress={() => setFavoriteFilter(option.value)}
                >
                  <Text style={[styles.compactChoiceText, favoriteFilter === option.value && styles.compactChoiceTextActive]}>{option.label}</Text>
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
            {/* 홈의 전체/냉장/냉동/실온 타일로 들어오면 이 값이 미리 정해진 채로
                열린다. 왜 목록이 걸러져 있는지 여기서 보이고 되돌릴 수 있어야
                한다(2026-08-24). */}
            <Text style={styles.controlLabel}>보관</Text>
            <View style={styles.categoryWrap}>
              {(storageFilters || []).map((option) => (
                <Pressable key={String(option)} style={[styles.categoryChip, storageFilter === option && styles.categoryChipActive]} onPress={() => setStorageFilter?.(option)}>
                  <Text style={[styles.categoryChipText, storageFilter === option && styles.categoryChipTextActive]}>{option}</Text>
                </Pressable>
              ))}
            </View>
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
          {isCompletedScope ? (
            <View style={styles.completedSummaryCard}>
              <View style={styles.completedSummaryItem}>
                <Text style={styles.completedSummaryValue}>{completedStats.monthCount}</Text>
                <Text style={styles.completedSummaryLabel}>이번 달 완료</Text>
              </View>
              <View style={styles.completedSummaryDivider} />
              <View style={styles.completedSummaryItem}>
                <Text style={styles.completedSummaryValue}>{completedStats.totalCount}</Text>
                <Text style={styles.completedSummaryLabel}>전체 완료</Text>
              </View>
              <View style={styles.completedSummaryDivider} />
              <View style={styles.completedSummaryItem}>
                <Text style={styles.completedSummaryValue}>{completedStats.hiddenCount}</Text>
                <Text style={styles.completedSummaryLabel}>90일 이전</Text>
              </View>
            </View>
          ) : null}
          {isCompletedScope && completedStats.hiddenCount > 0 ? (
            <Text style={styles.completedArchiveHint}>
              최근 {COMPLETED_VISIBLE_DAYS}일 기록만 보여드려요. 오래된 완료 기록은 성장 통계에 반영됩니다.
            </Text>
          ) : null}
          {visibleItems.length === 0 ? (
            <Text style={styles.empty}>{isCompletedScope ? "아직 완료한 상품이 없습니다." : "조건에 맞는 상품이 없습니다."}</Text>
          ) : (
            visibleEntries.map((entry, index) => {
              if (entry.kind === "header") {
                return (
                  <View key={`completed-month-${entry.key}`} style={styles.completedMonthHeader}>
                    <Text style={styles.completedMonthTitle}>{entry.label}</Text>
                    <Text style={styles.completedMonthCount}>{entry.count}개</Text>
                  </View>
                );
              }
              const item = entry.item;
              const itemKey = String(item.id || `${item.name || "item"}-${item.expiry || "no-expiry"}-${index}`);
              const renderKey = `${itemKeyPrefix}-${itemKey}`;
              const displayName = String(item.name || "");
              const expiryValue = typeof item.expiry === "string" ? item.expiry : "";
              const storageLabel = String(item.storage || "");
              const status = statusFor(item);
              const timeline = timelineFor(item, reminderDays);
              const isEditing = editingId === item.id && editForm;
              const dateMeta = sortMode === "등록일순" ? `등록 ${createdDateLabel(item)}` : `${expiryType} ${expiryValue || "-"}`;
              const completedMeta = completedDateLabel(item);
              return (
                <Fragment key={renderKey}>
                {index % 10 === 8 ? <BannerAdSlot /> : null}
                {/* 카드 어디를 눌러도 상세 카드가 열린다. 예전에는 사진과 상품명만
                    눌려서, 소비기한이나 여백을 누른 사람은 아무 반응이 없었다.
                    홈은 이미 카드 전체가 눌렸던 터라 화면마다 다르기도 했다
                    (2026-08-29 피드백). 카드 안에 다른 조작 요소는 없다. */}
                <Pressable
                  style={[styles.itemCard, isEditing && styles.itemCardEditing]}
                  onLayout={(event) => onItemLayout(itemKey, event, isEditing)}
                  onPress={() => onOpenDetail(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={displayName + " 자세히 보기"}
                >
                  <View style={styles.itemContentRow}>
                    <Image source={getFoodImageSource(item)} resizeMode="cover" style={styles.itemImage} />
                    <View style={styles.itemContent}>
                      <View style={styles.itemHeader}>
                        <View style={styles.itemTitleRow}>
                          <Text style={[styles.itemName, styles.itemNamePress]} numberOfLines={1}>{displayName}</Text>
                          <Text style={[styles.storagePill, getStoragePillStyle(storageLabel)]}>{storageLabel}</Text>
                        </View>
                        <Text style={[styles.badge, isCompletedScope ? styles.completedBadge : styles[status.tone]]}>
                          {isCompletedScope ? "완료" : status.label}
                        </Text>
                      </View>
                      <Text style={styles.meta}>{isCompletedScope ? completedMeta : dateMeta}</Text>
                      {item.memo?.trim() ? (
                        <Text style={styles.memoLine} numberOfLines={2}>{item.memo.trim()}</Text>
                      ) : null}
                      {!isCompletedScope && planBadgeLabel(item) ? (
                        <Text style={styles.planBadge}>{"\uD83C\uDF7D\uFE0F " + planBadgeLabel(item)}</Text>
                      ) : null}
                      {/* 조작 버튼은 전부 상세 카드로 옮겼다. 목록은 무엇이 있고
                          언제까지인지 훑는 데만 쓰고, 누르면 상세 카드가 뜬다(2026-08-27). */}
                      {isCompletedScope ? (
                        <Text style={styles.completedMeta}>{completionTimingLabel(item)}</Text>
                      ) : (
                        <ExpiryTimeline timeline={timeline} />
                      )}
                    </View>
                  </View>
                </Pressable>
                </Fragment>
              );
            })
          )}
        </View>

        {visibleItems.length > 0 && visibleItems.length < 10 ? <BannerAdSlot /> : null}
      </View>
    </ScrollView>
  );
}

function ExpiryTimeline({ timeline, children }) {
  const width = typeof timeline?.width === "string" || typeof timeline?.width === "number" ? timeline.width : "0%";
  const tone = timeline?.tone || "normal";
  const hasActions = Boolean(children);
  return (
    <View style={[styles.timelineActionRow, hasActions ? styles.timelineActionRowVisible : styles.timelineActionRowHidden]}>
      <View style={styles.timelineWrap}>
        <View style={styles.timelineTrack}>
          <View style={[styles.timelineFill, styles[`${tone}Fill`], { width }]} />
        </View>
      </View>
      {children}
    </View>
  );
}

function completedDateLabel(item) {
  if (typeof item?.completedAt === "string" && item.completedAt.length >= 10) {
    return `완료 ${item.completedAt.slice(0, 10)}`;
  }
  return "완료일 기록 없음";
}

function summarizeCompletedItems(items) {
  const monthKey = currentMonthKey();
  return items.reduce(
    (acc, item) => {
      if (item?.status !== "completed") return acc;
      acc.totalCount += 1;
      if (completedMonthKey(item) === monthKey) acc.monthCount += 1;
      if (!isRecentCompletedItem(item, COMPLETED_VISIBLE_DAYS)) acc.hiddenCount += 1;
      return acc;
    },
    { totalCount: 0, monthCount: 0, hiddenCount: 0 }
  );
}

function buildCompletedMonthEntries(items) {
  const groups = new Map();

  items.forEach((item) => {
    const key = completedMonthKey(item);
    if (!groups.has(key)) {
      groups.set(key, { key, label: completedMonthLabel(item), items: [] });
    }
    groups.get(key).items.push(item);
  });

  return [...groups.values()]
    .sort((a, b) => b.key.localeCompare(a.key))
    .flatMap((group) => [
      { kind: "header", key: group.key, label: group.label, count: group.items.length },
      ...group.items.map((item) => ({ kind: "item", item }))
    ]);
}

function isRecentCompletedItem(item, visibleDays) {
  if (item?.favorite) return true;
  const completedTime = completedTimestamp(item);
  if (!completedTime) return true;
  return completedTime >= Date.now() - visibleDays * 86400000;
}

function completedTimestamp(item) {
  const time = new Date(item?.completedAt || 0).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function completedMonthKey(item) {
  const completed = new Date(item?.completedAt || 0);
  if (Number.isNaN(completed.getTime())) return "unknown";
  return `${completed.getFullYear()}-${String(completed.getMonth() + 1).padStart(2, "0")}`;
}

function completedMonthLabel(item) {
  const completed = new Date(item?.completedAt || 0);
  if (Number.isNaN(completed.getTime())) return "완료일 미상";
  return `${completed.getFullYear()}년 ${completed.getMonth() + 1}월`;
}

function getStoragePillStyle(storageLabel) {
  if (storageLabel === "냉동") {
    return styles.storagePillFrozen;
  }
  if (storageLabel === "실온") {
    return styles.storagePillRoom;
  }
  return styles.storagePillCold;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignSelf: "stretch"
  },
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
    ...typography.bodyStrong,
    flex: 1,
    color: "#18201c",
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
  scopeTabs: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10
  },
  scopeTab: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#dce4df",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center"
  },
  scopeTabActive: {
    borderColor: "#1f7a5a",
    backgroundColor: "#edf7f2"
  },
  scopeTabText: {
    ...typography.label,
    color: "#68716b",
  },
  scopeTabTextActive: {
    color: "#14583f"
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
    ...typography.label,
    color: "#18201c",
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
    ...typography.captionStrong,
    color: "#68716b",
  },
  compactChoiceTextActive: {
    color: "#fff"
  },
  categoryWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4
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
    ...typography.captionStrong,
    color: "#68716b",
  },
  categoryChipTextActive: {
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
    ...typography.captionStrong,
    flex: 1,
    color: "#14583f",
  },
  focusNoticeButton: {
    minHeight: 34,
    borderRadius: 8,
    backgroundColor: "#1f7a5a",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  focusNoticeButtonText: {
    ...typography.captionStrong,
    color: "#fff",
  },
  itemList: {
    gap: 8,
    marginTop: 10
  },
  completedSummaryCard: {
    minHeight: 70,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e1eee7",
    backgroundColor: "#f7fbf8",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8
  },
  completedSummaryItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3
  },
  completedSummaryValue: {
    ...typography.sectionTitle,
    color: "#1f7a5a"
  },
  completedSummaryLabel: {
    ...typography.captionStrong,
    color: "#68716b"
  },
  completedSummaryDivider: {
    width: 1,
    height: 34,
    backgroundColor: "#dfe7e2"
  },
  completedArchiveHint: {
    ...typography.caption,
    color: "#68716b",
    paddingHorizontal: 4
  },
  completedMonthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    paddingHorizontal: 2
  },
  completedMonthTitle: {
    ...typography.cardTitle,
    color: "#18201c"
  },
  completedMonthCount: {
    ...typography.captionStrong,
    color: "#1f7a5a"
  },
  empty: {
    ...typography.body,
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
  dateSubText: {
    ...typography.caption,
    color: "#68716b",
    marginTop: 2
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "flex-start",
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
    ...typography.label,
    color: "#18201c",
  },
  completeAction: {
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: "#1f7a5a",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  completeActionText: {
    ...typography.label,
    color: "#fff",
  },
  restoreAction: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#b9dfcf",
    backgroundColor: "#edf7f2",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  restoreActionText: {
    ...typography.label,
    color: "#14583f",
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
    ...typography.label,
    color: "#fff",
  },
  deleteAction: {
    minHeight: 38,
    borderRadius: 8,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  deleteText: {
    ...typography.label,
    color: "#9f3929",
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
    ...typography.cardTitle,
    flex: 1,
    color: "#18201c",
  },
  // 상품명 터치 영역. 글자만 감싸되 목록 줄 높이는 그대로 두려고 세로 여백을 줍니다.
  itemNamePress: {
    flex: 1,
    paddingVertical: 4
  },
  memoLine: {
    ...typography.caption,
    color: "#68716b",
    marginTop: 3
  },
  planBadge: {
    ...typography.captionStrong,
    color: "#1f7a5a",
    marginTop: 3
  },
  storagePill: {
    ...typography.badge,
    borderRadius: 7,
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  storagePillCold: {
    color: "#1f7a5a",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dce7e1"
  },
  storagePillFrozen: {
    color: "#3d6fd6",
    backgroundColor: "#e8f0ff"
  },
  storagePillRoom: {
    color: "#9a6a17",
    backgroundColor: "#fff1d6"
  },
  badge: {
    ...typography.captionStrong,
    textAlign: "center",
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
  completedBadge: {
    color: "#1f7a5a"
  },
  meta: {
    ...typography.caption,
    color: "#68716b",
    marginTop: 4
  },
  expiryMeta: {
    ...typography.captionStrong,
    color: "#14583f",
    marginTop: 2
  },
  completedMeta: {
    ...typography.captionStrong,
    color: "#1f7a5a",
    marginTop: 4
  },
  timelineActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  timelineActionRowVisible: {
    marginLeft: -74,
    marginTop: 10
  },
  timelineActionRowHidden: {
    marginLeft: -74,
    marginTop: 23
  },
  timelineWrap: {
    flex: 1,
    minWidth: 56
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
