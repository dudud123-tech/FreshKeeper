import { Fragment, useMemo, useState } from "react";
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { typography } from "../theme/typography";
import { DEFAULT_PURCHASE_URL } from "../constants/purchase";
import { statusFor, timelineFor } from "../utils/date";
import { getFoodImageSource } from "../utils/foodImages";
import BannerAdSlot from "./BannerAdSlot";

const searchIcon = require("../../assets/actions/inventory-search.png");
const filterIcon = require("../../assets/actions/inventory-filter.png");
const expandContentIcon = require("../../assets/actions/expand_content.png");
const collapseContentIcon = require("../../assets/actions/collapse_content_80dp.png");
const shoppingCartIcon = require("../../assets/actions/shopping_cart_80dp.png");
const undoIcon = require("../../assets/actions/undo.png");
const editNoteIcon = require("../../assets/actions/edit_note_80dp.png");
const deleteIcon = require("../../assets/actions/delete_80dp_.png");
const forkSpoonIcon = require("../../assets/actions/fork_spoon_80dp.png");
const bookmarkOffIcon = require("../../assets/actions/bookmark_off.png");
const bookmarkOnIcon = require("../../assets/actions/bookmark_on.png");
const COMPLETED_VISIBLE_DAYS = 90;
const EDIT_COPY = {
  editing: "\uC218\uC815 \uC911",
  productName: "\uC0C1\uD488\uBA85",
  purchaseUrl: "\uAD6C\uB9E4 \uB9C1\uD06C",
  purchasePlaceholder: DEFAULT_PURCHASE_URL,
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
  setCategoryFilter,
  favoriteFilter,
  setFavoriteFilter,
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
  completeItem,
  restoreItem,
  toggleFavorite,
  onChangeItemImage,
  onItemLayout,
  reminderDays,
  expiryType
}) {
  const [query, setQuery] = useState("");
  const [controlsVisible, setControlsVisible] = useState(false);
  const [editorVisible, setEditorVisible] = useState(true);
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
  const editCategoryOptions = useMemo(() => orderedCategoryOptions(categories), [categories]);
  const listRenderKey = `inventory-list-${inventoryScope}-${sortMode}-${categoryFilter}-${favoriteFilter}-${focusItemId || "all"}`;
  const itemKeyPrefix = sortMode === "등록일순" ? "created" : "expiry";

  async function openPurchaseUrl(url) {
    const rawUrl = String(url || "").trim();
    if (!rawUrl) return;
    const nextUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    try {
      // canOpenURL은 Android 11+ 패키지 가시성 정책 때문에 실제로 열리는 링크도
      // false를 반환하는 경우가 흔해서(false negative), 사전 체크 없이 바로 열고
      // 실패하면 그때 안내한다.
      await Linking.openURL(nextUrl);
    } catch {
      Alert.alert("링크 열기 실패", "이 링크를 열 수 없습니다.");
    }
  }

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
          <Pressable style={[styles.toolButton, editorVisible && styles.toolButtonActive]} onPress={() => setEditorVisible((current) => !current)}>
            <Image
              source={editorVisible ? expandContentIcon : collapseContentIcon}
              resizeMode="contain"
              style={[styles.toolIcon, editorVisible && styles.toolIconActive]}
            />
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
                <View
                  style={[styles.itemCard, isEditing && styles.itemCardEditing]}
                  onLayout={(event) => onItemLayout(itemKey, event, isEditing)}
                >
                  {isEditing ? (
                    <View style={styles.editPanel}>
                      <View style={styles.editBanner}>
                        <Text style={styles.editBannerText}>{EDIT_COPY.editing}</Text>
                        <View style={styles.editBannerActions}>
                          <Pressable style={styles.editBannerCancelAction} onPress={cancelEdit}>
                            <Text style={styles.editBannerCancelText}>{EDIT_COPY.cancel}</Text>
                          </Pressable>
                          <Pressable style={styles.editBannerSaveAction} onPress={saveEdit}>
                            <Text style={styles.editBannerSaveText}>{EDIT_COPY.save}</Text>
                          </Pressable>
                        </View>
                      </View>
                      {editForm.purchaseUrl?.trim() ? (
                        <View style={styles.affiliateDisclosureBanner}>
                          <Text style={styles.affiliateDisclosureText}>
                            {"이 포스팅은 쿠팡 파트너스 활동의 일환으로,\n이에 따른 일정액의 수수료를 제공받습니다."}
                          </Text>
                        </View>
                      ) : null}
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
                      <Field label={EDIT_COPY.purchaseUrl}>
                        <TextInput
                          value={editForm.purchaseUrl || ""}
                          onChangeText={(value) => setEditForm((current) => ({ ...current, purchaseUrl: value }))}
                          placeholder={EDIT_COPY.purchasePlaceholder}
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
                      <Field label={EDIT_COPY.expiry}>
                        <DateButton
                          value={editForm.expiry}
                          onPress={() => openCalendar(editForm.expiry, (value) => setEditForm((current) => ({ ...current, expiry: value })))}
                        />
                      </Field>
                    </View>
                  ) : (
                    <View style={styles.itemContentRow}>
                      <Pressable onPress={() => onChangeItemImage?.(item.id)}>
                        <Image source={getFoodImageSource(item)} resizeMode="cover" style={styles.itemImage} />
                      </Pressable>
                      <View style={styles.itemContent}>
                        <View style={styles.itemHeader}>
                          <View style={styles.itemTitleRow}>
                            <Text style={styles.itemName} numberOfLines={1}>{displayName}</Text>
                            <Text style={[styles.storagePill, getStoragePillStyle(storageLabel)]}>{storageLabel}</Text>
                          </View>
                          <Text style={[styles.badge, isCompletedScope ? styles.completedBadge : styles[status.tone]]}>
                            {isCompletedScope ? "완료" : status.label}
                          </Text>
                        </View>
                        <Text style={styles.meta}>{isCompletedScope ? completedMeta : dateMeta}</Text>
                        {isCompletedScope ? (
                          <>
                            <Text style={styles.completedMeta}>{completionTimingLabel(item)}</Text>
                            {editorVisible ? (
                              <View style={styles.inlineActionRow}>
                                <PurchaseIconButton purchaseUrl={item.purchaseUrl} onOpenPurchase={openPurchaseUrl} />
                                <CardIconButton
                                  icon={undoIcon}
                                  onPress={() => restoreItem(item.id)}
                                  accessibilityLabel="보관함으로 되돌리기"
                                />
                                <FavoriteIconButton
                                  active={Boolean(item.favorite)}
                                  onPress={() => toggleFavorite(item.id)}
                                />
                                <CardIconButton
                                  icon={editNoteIcon}
                                  onPress={() => startEdit(item)}
                                  accessibilityLabel="상품 수정"
                                />
                                <CardIconButton
                                  icon={deleteIcon}
                                  onPress={() => removeItem(item.id)}
                                  danger
                                  accessibilityLabel="상품 삭제"
                                />
                              </View>
                            ) : null}
                          </>
                        ) : (
                          <ExpiryTimeline timeline={timeline}>
                            {editorVisible ? (
                              <>
                                <PurchaseIconButton purchaseUrl={item.purchaseUrl} onOpenPurchase={openPurchaseUrl} />
                                <CardIconButton
                                  icon={forkSpoonIcon}
                                  onPress={() => completeItem(item.id)}
                                  accessibilityLabel="다 먹어서 완료"
                                />
                                <FavoriteIconButton
                                  active={Boolean(item.favorite)}
                                  onPress={() => toggleFavorite(item.id)}
                                />
                                <CardIconButton
                                  icon={editNoteIcon}
                                  onPress={() => startEdit(item)}
                                  accessibilityLabel="상품 수정"
                                />
                                <CardIconButton
                                  icon={deleteIcon}
                                  onPress={() => removeItem(item.id)}
                                  danger
                                  accessibilityLabel="상품 삭제"
                                />
                              </>
                            ) : null}
                          </ExpiryTimeline>
                        )}
                      </View>
                    </View>
                  )}
                </View>
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

function Field({ label, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function InlineField({ label, children }) {
  return (
    <View style={styles.inlineField}>
      <Text style={styles.inlineLabel}>{label}</Text>
      <View style={styles.inlineFieldControl}>{children}</View>
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

function DateButton({ value, onPress }) {
  return (
    <Pressable style={styles.dateButton} onPress={onPress}>
      <Text style={styles.dateText}>{formatDateLabel(value)}</Text>
    </Pressable>
  );
}

function formatDateLabel(value) {
  const [year, month, day] = value.split("-");
  return `${Number(year)}\uB144 ${Number(month)}\uC6D4 ${Number(day)}\uC77C`;
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

function PurchaseIconButton({ purchaseUrl, onOpenPurchase, style }) {
  const hasPurchaseUrl = Boolean(String(purchaseUrl || "").trim());
  return (
    <Pressable
      style={[styles.purchaseIconButton, style, !hasPurchaseUrl && styles.purchaseIconButtonDisabled]}
      onPress={() => hasPurchaseUrl && onOpenPurchase?.(purchaseUrl)}
      disabled={!hasPurchaseUrl}
      accessibilityRole="button"
      accessibilityLabel={hasPurchaseUrl ? "구매 링크 열기" : "구매 링크 없음"}
    >
      <Image
        source={shoppingCartIcon}
        resizeMode="contain"
        style={[styles.purchaseIcon, !hasPurchaseUrl && styles.purchaseIconDisabled]}
      />
    </Pressable>
  );
}

function FavoriteIconButton({ active, onPress }) {
  return (
    <Pressable
      style={[styles.favoriteIconButton, active && styles.favoriteIconButtonActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={active ? "즐겨찾기 해제" : "즐겨찾기 등록"}
    >
      <Image
        source={active ? bookmarkOnIcon : bookmarkOffIcon}
        resizeMode="contain"
        style={styles.favoriteIconImage}
      />
    </Pressable>
  );
}

function CardIconButton({ icon, onPress, danger = false, accessibilityLabel }) {
  return (
    <Pressable
      style={[styles.cardIconButton, danger && styles.cardIconButtonDanger]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Image
        source={icon}
        resizeMode="contain"
        style={[styles.cardIcon, danger && styles.cardIconDanger]}
      />
    </Pressable>
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

function completionTimingLabel(item) {
  if (!item?.completedAt || !item?.expiry) return "소비기한 기준 정보가 부족합니다.";
  const completed = new Date(item.completedAt);
  const [year, month, day] = String(item.expiry).split("-").map(Number);
  const expiry = new Date(year, month - 1, day);
  if (Number.isNaN(completed.getTime()) || Number.isNaN(expiry.getTime())) return "소비기한 기준 정보가 부족합니다.";
  const diff = Math.ceil((expiry - completed) / 86400000);
  if (diff > 0) return `소비기한 ${diff}일 전에 완료`;
  if (diff === 0) return "소비기한 당일 완료";
  return `소비기한 ${Math.abs(diff)}일 후 완료`;
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
  field: {
    gap: 7,
    marginTop: 8
  },
  inlineField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6
  },
  inlineLabel: {
    ...typography.captionStrong,
    width: 58,
    color: "#68716b"
  },
  inlineFieldControl: {
    flex: 1
  },
  fieldCompact: {
    gap: 5,
    marginTop: 6
  },
  label: {
    ...typography.captionStrong,
    color: "#68716b",
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
    minHeight: 32,
    width: 72,
    paddingHorizontal: 4,
    paddingVertical: 5
  },
  choiceActive: {
    borderColor: "#1f7a5a",
    backgroundColor: "#1f7a5a"
  },
  choiceText: {
    ...typography.label,
    color: "#18201c",
  },
  choiceTextCompact: {
    ...typography.captionStrong,
    textAlign: "center"
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
  editPanel: {
    gap: 10
  },
  editBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderRadius: 999,
    backgroundColor: "#fff0e7",
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  editBannerText: {
    ...typography.captionStrong,
    color: "#d95f3d",
  },
  editBannerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  editBannerCancelAction: {
    minHeight: 28,
    borderRadius: 999,
    backgroundColor: "#fff",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  editBannerSaveAction: {
    minHeight: 28,
    borderRadius: 999,
    backgroundColor: "#d95f3d",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  editBannerCancelText: {
    ...typography.captionStrong,
    color: "#d95f3d",
  },
  editBannerSaveText: {
    ...typography.captionStrong,
    color: "#fff",
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
  affiliateDisclosureBanner: {
    // 공정위 지침 + 쿠팡 파트너스 가이드: 대가성 문구는 게시물 최상단에, 본문보다
    // 크거나 눈에 띄는 색으로 노출해야 한다(2026-08-04 최종 승인 반려 후 위치 수정).
    borderRadius: 10,
    backgroundColor: "#fff0e7",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  affiliateDisclosureText: {
    ...typography.bodyStrong,
    color: "#d95f3d"
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
  purchaseIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#b9dfcf",
    backgroundColor: "#edf7f2",
    alignItems: "center",
    justifyContent: "center"
  },
  purchaseIconButtonDisabled: {
    borderColor: "#e0e4e1",
    backgroundColor: "#f3f5f3"
  },
  purchaseIcon: {
    width: 21,
    height: 21,
    tintColor: "#1f7a5a"
  },
  purchaseIconDisabled: {
    opacity: 0.28,
    tintColor: "#68716b"
  },
  inlineActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8
  },
  favoriteIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ece8df",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center"
  },
  favoriteIconButtonActive: {
    borderColor: "#f0d88a",
    backgroundColor: "#ffffff"
  },
  favoriteIconImage: {
    width: 19,
    height: 19
  },
  cardIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d4e7df",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center"
  },
  cardIconButtonDanger: {
    borderColor: "#efd8d3",
    backgroundColor: "#fff7f5"
  },
  cardIcon: {
    width: 21,
    height: 21,
    tintColor: "#1f7a5a"
  },
  cardIconDanger: {
    tintColor: "#9f3929"
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
