import { Fragment, useMemo, useState } from "react";
import { Alert, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { typography } from "../theme/typography";
import { DEFAULT_PURCHASE_URL } from "../constants/purchase";
import { isCoupangUrl } from "../services/coupangApi";
import { statusFor, timelineFor, todayIso, weekdayLabel } from "../utils/date";
import { DEFAULT_PLAN_TIME, planBadgeLabel, planTimeFor, PLAN_REPEATS, repeatLabel } from "../utils/mealPlan";
import { TabButton, TimeField } from "./CommonControls";


import { getFoodImageSource } from "../utils/foodImages";
import BannerAdSlot from "./BannerAdSlot";

const searchIcon = require("../../assets/actions/inventory-search.png");
const filterIcon = require("../../assets/actions/inventory-filter.png");
const expandContentIcon = require("../../assets/actions/expand_content.png");
const collapseContentIcon = require("../../assets/actions/collapse_content_80dp.png");
const shoppingCartIcon = require("../../assets/actions/shopping_cart_80dp.png");
const coupangBadgeIcon = require("../../assets/actions/coupang.png");
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
  plannedDate: "\uBA39\uC744 \uB0A0",
  plannedWeekday: "\uBA39\uC744 \uC694\uC77C",
  plannedTime: "\uC54C\uB9BC \uC2DC\uAC04",
  planRepeat: "\uBC18\uBCF5",
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
  // 편집 시트 탭. 기본(상품명·소비기한·일정) / 상세(카테고리·보관·구매링크).
  // 접기 방식은 한 번 더 눌러야 해서 접근이 불편하다는 피드백으로 탭으로 바꿨다(2026-08-23).
  const [editTab, setEditTab] = useState("basic");
  // 상품명을 누르면 뜨는 큰 카드 팝업. 항목을 통째로 담아두면 수정 후에도 옛
  // 값이 남으므로 id만 들고 매번 현재 목록에서 찾는다. 완료/삭제로 목록에서
  // 빠지면 자연히 null이 되어 팝업도 닫힌다(2026-08-24).
  const [detailItemId, setDetailItemId] = useState("");
  const isCompletedScope = inventoryScope === "completed";
  const detailItem = useMemo(
    () => (detailItemId ? sortedItems.find((item) => String(item.id) === detailItemId) || null : null),
    [sortedItems, detailItemId]
  );
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
  const listRenderKey = `inventory-list-${inventoryScope}-${sortMode}-${categoryFilter}-${storageFilter}-${favoriteFilter}-${focusItemId || "all"}`;
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

  // 예전에는 이 편집 폼을 목록 카드 안에서 펼쳤다. 카테고리 12개 칩이 날짜 필드
  // 위를 차지해서 소비기한·먹을 날을 고치려면 매번 아래까지 스크롤해야 했고,
  // 카드가 길어져 목록도 밀렸다. 바텀시트로 띄워 넓은 화면에서 수정하게 바꿨다(2026-08-23).
  // 상품명을 누르면 뜨는 큰 카드 팝업. 시력이 좋지 않은 사용자를 염두에 두고
  // 사진을 크게, 글자를 목록보다 훨씬 크게, 버튼도 손가락으로 누르기 쉬운
  // 크기로 잡았다. 색만으로 상태를 알리지 않고 글자로도 같이 적는다(2026-08-24).
  function renderDetailModal() {
    if (!detailItem) return null;
    const item = detailItem;
    const status = statusFor(item);
    const planLabel = planBadgeLabel(item);
    const rows = [
      { label: "소비기한", value: item.expiry || "-" },
      { label: "보관", value: item.storage || "-" },
      { label: "카테고리", value: item.category || "-" },
      { label: "등록일", value: createdDateLabel(item) }
    ];
    if (planLabel) rows.push({ label: "먹을 날", value: planLabel });
    return (
      <Modal visible transparent animationType="fade" onRequestClose={() => setDetailItemId("")}>
        <View style={styles.detailBackdrop}>
          <Pressable style={styles.detailBackdropFill} onPress={() => setDetailItemId("")} />
          <View style={styles.detailCard}>
            <ScrollView contentContainerStyle={styles.detailScroll} showsVerticalScrollIndicator={false}>
              <Image source={getFoodImageSource(item)} resizeMode="cover" style={styles.detailImage} />
              <Text style={styles.detailName}>{String(item.name || "")}</Text>
              <View style={[styles.detailStatusBox, styles["detailStatus_" + (isCompletedScope ? "done" : status.tone)]]}>
                <Text style={[styles.detailStatusText, styles["detailStatusText_" + (isCompletedScope ? "done" : status.tone)]]}>
                  {isCompletedScope ? "먹었어요" : status.label}
                </Text>
                <Text style={styles.detailStatusSub}>
                  {isCompletedScope ? completionTimingLabel(item) : expiryType + " " + (item.expiry || "-")}
                </Text>
              </View>
              {rows.map((row) => (
                <View key={row.label} style={styles.detailRow}>
                  <Text style={styles.detailRowLabel}>{row.label}</Text>
                  <Text style={styles.detailRowValue}>{row.value}</Text>
                </View>
              ))}
              {item.memo?.trim() ? (
                <View style={styles.detailMemoBox}>
                  <Text style={styles.detailRowLabel}>메모</Text>
                  <Text style={styles.detailMemoText}>{item.memo.trim()}</Text>
                </View>
              ) : null}
            </ScrollView>
            <View style={styles.detailActions}>
              <Pressable
                style={[styles.detailButton, styles.detailButtonGhost]}
                onPress={() => setDetailItemId("")}
                accessibilityRole="button"
              >
                <Text style={styles.detailButtonGhostText}>닫기</Text>
              </Pressable>
              <Pressable
                style={[styles.detailButton, styles.detailButtonPrimary]}
                onPress={() => {
                  setDetailItemId("");
                  startEdit(item);
                }}
                accessibilityRole="button"
              >
                <Text style={styles.detailButtonPrimaryText}>수정하기</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  function renderEditSheet() {
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

  return (
    <>
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
                <View
                  style={[styles.itemCard, isEditing && styles.itemCardEditing]}
                  onLayout={(event) => onItemLayout(itemKey, event, isEditing)}
                >
                  <View style={styles.itemContentRow}>
                    <Pressable onPress={() => onChangeItemImage?.(item.id)}>
                      <Image source={getFoodImageSource(item)} resizeMode="cover" style={styles.itemImage} />
                    </Pressable>
                    <View style={styles.itemContent}>
                      <View style={styles.itemHeader}>
                        <View style={styles.itemTitleRow}>
                          <Pressable
                            style={styles.itemNamePress}
                            onPress={() => setDetailItemId(String(item.id))}
                            accessibilityRole="button"
                            accessibilityLabel={displayName + " 자세히 보기"}
                          >
                            <Text style={styles.itemName} numberOfLines={1}>{displayName}</Text>
                          </Pressable>
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
                                complete
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
                </View>
                </Fragment>
              );
            })
          )}
        </View>

        {visibleItems.length > 0 && visibleItems.length < 10 ? <BannerAdSlot /> : null}
      </View>
    </ScrollView>
    {renderEditSheet()}
    {renderDetailModal()}
    </>
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
  const isCoupang = hasPurchaseUrl && isCoupangUrl(purchaseUrl);
  return (
    <Pressable
      style={[
        styles.purchaseIconButton,
        isCoupang && styles.purchaseIconButtonCoupang,
        style,
        !hasPurchaseUrl && styles.purchaseIconButtonDisabled
      ]}
      onPress={() => hasPurchaseUrl && onOpenPurchase?.(purchaseUrl)}
      disabled={!hasPurchaseUrl}
      accessibilityRole="button"
      accessibilityLabel={hasPurchaseUrl ? "구매 링크 열기" : "구매 링크 없음"}
    >
      <Image
        source={isCoupang ? coupangBadgeIcon : shoppingCartIcon}
        resizeMode="contain"
        style={[
          isCoupang ? styles.purchaseIconCoupang : styles.purchaseIcon,
          !hasPurchaseUrl && styles.purchaseIconDisabled
        ]}
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

function CardIconButton({ icon, onPress, danger = false, complete = false, accessibilityLabel }) {
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
        style={[styles.cardIcon, danger && styles.cardIconDanger, complete && styles.cardIconComplete]}
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
    ...typography.label,
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
    ...typography.label,
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
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ebeeec"
  },
  sheetTitle: {
    ...typography.sectionTitle,
    color: "#18201c",
    flexShrink: 1
  },
  sheetHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2
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
    ...typography.body,
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
  sheetTabs: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#f1f4f2",
    borderRadius: 10,
    padding: 4,
    marginBottom: 4
  },
  planGroup: {
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d4e7df",
    backgroundColor: "#f8fbf9",
    padding: 12
  },
  planHint: {
    ...typography.caption,
    color: "#3f8f6d",
    marginTop: 6
  },
  planGroupTitle: {
    ...typography.label,
    color: "#1f7a5a",
  },
  // 상품명 터치 영역. 글자만 감싸되 목록 줄 높이는 그대로 두려고 세로 여백을 줍니다.
  itemNamePress: {
    flex: 1,
    paddingVertical: 4
  },
  // ── 상품 상세 팝업 ────────────────────────────────────────────────
  // 시력이 좋지 않은 사용자를 위해 목록보다 글자와 사진을 크게 잡습니다.
  detailBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
    backgroundColor: "rgba(24, 32, 28, 0.55)"
  },
  detailBackdropFill: {
    ...StyleSheet.absoluteFillObject
  },
  detailCard: {
    width: "100%",
    maxHeight: "88%",
    borderRadius: 22,
    backgroundColor: "#fff",
    overflow: "hidden"
  },
  detailScroll: {
    paddingBottom: 8
  },
  // 사진은 카드 폭을 꽉 채웁니다 — 상세 팝업을 여는 가장 큰 이유입니다.
  detailImage: {
    width: "100%",
    height: 220,
    backgroundColor: "#f3f6f4"
  },
  detailName: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: "800",
    color: "#18201c",
    paddingHorizontal: 20,
    paddingTop: 16
  },
  detailStatusBox: {
    borderRadius: 16,
    marginHorizontal: 20,
    marginTop: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 4
  },
  detailStatus_expired: {
    backgroundColor: "#fdecea"
  },
  detailStatus_warning: {
    backgroundColor: "#fdf1e3"
  },
  detailStatus_normal: {
    backgroundColor: "#e9f5ef"
  },
  detailStatus_done: {
    backgroundColor: "#eef1ef"
  },
  detailStatusText: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "900"
  },
  detailStatusText_expired: {
    color: "#c0392b"
  },
  detailStatusText_warning: {
    color: "#c8781f"
  },
  detailStatusText_normal: {
    color: "#1f7a5a"
  },
  detailStatusText_done: {
    color: "#5b665f"
  },
  detailStatusSub: {
    fontSize: 17,
    lineHeight: 24,
    color: "#46514a"
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginHorizontal: 20,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f2f0"
  },
  detailRowLabel: {
    fontSize: 17,
    lineHeight: 24,
    color: "#77807a"
  },
  detailRowValue: {
    fontSize: 19,
    lineHeight: 26,
    fontWeight: "700",
    color: "#18201c",
    flexShrink: 1,
    textAlign: "right"
  },
  detailMemoBox: {
    marginHorizontal: 20,
    marginTop: 14,
    gap: 6
  },
  detailMemoText: {
    fontSize: 19,
    lineHeight: 28,
    color: "#2f3a34"
  },
  // 버튼은 손가락으로 누르기 쉽게 높이를 넉넉히 잡습니다.
  detailActions: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#eef1ef"
  },
  detailButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  detailButtonGhost: {
    borderWidth: 1,
    borderColor: "#d7ddd9",
    backgroundColor: "#fff"
  },
  detailButtonGhostText: {
    fontSize: 19,
    fontWeight: "700",
    color: "#46514a"
  },
  detailButtonPrimary: {
    backgroundColor: "#1f7a5a"
  },
  detailButtonPrimaryText: {
    fontSize: 19,
    fontWeight: "800",
    color: "#fff"
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(24, 32, 28, 0.45)"
  },
  sheetBackdropFill: {
    flex: 1
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
  sheetScroll: {
    flex: 1
  },
  sheetScrollContent: {
    paddingBottom: 32
  },
  planTimeRow: {
    flexDirection: "row"
  },
  memoInput: {
    minHeight: 62,
    textAlignVertical: "top",
    paddingTop: 10
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
  purchaseIconButton: {
    // 활성/비활성이 옅은 파스텔 톤끼리라 잘 안 구분된다는 피드백(2026-08-08)으로
    // 활성 상태를 홈 화면 "구매 링크 열기" 버튼과 같은 진초록 채움으로 바꿨다 —
    // 비활성(테두리만)과 형태 자체가 달라져서 목록을 훑을 때도 바로 구분된다.
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1f7a5a",
    backgroundColor: "#1f7a5a",
    alignItems: "center",
    justifyContent: "center"
  },
  purchaseIconButtonDisabled: {
    borderColor: "#d7dbd8",
    backgroundColor: "transparent"
  },
  // coupang.png는 그 자체로 이미 빨간 원 배지라, 흰색 카트 아이콘용이던 진초록
  // 채움 위에 얹으면 원 안에 원이 붕 뜬 것처럼 보인다(2026-08-15 피드백). 배경을
  // 흰색으로 바꾸고 아래 purchaseIconCoupang에서 아이콘도 테두리에 닿을 만큼 키운다.
  // 처음엔 32px 원 그대로 뒀는데 "조금 더 키워도 될 것 같다"는 피드백(2026-08-15
  // 재확인)으로 버튼 자체도 같이 키웠다.
  // 원 컨테이너는 다른 아이콘 버튼들(즐겨찾기, 수정, 삭제 등)과 크기를 맞춘다 —
  // 색만 다르고 크기는 통일. 아이콘 자체는 purchaseIconCoupang에서 더 크게 키운다.
  purchaseIconButtonCoupang: {
    borderColor: "#e6e4df",
    backgroundColor: "#fff"
  },
  purchaseIcon: {
    width: 21,
    height: 21,
    tintColor: "#fff"
  },
  // coupang.png는 색을 가진 브랜드 배지라 tintColor를 주지 않는다. 컨테이너(32px 원)
  // 테두리에 거의 닿도록 크게 키운다.
  purchaseIconCoupang: {
    width: 40,
    height: 40
  },
  purchaseIconDisabled: {
    opacity: 0.5,
    tintColor: "#a2aaa5"
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
  // fork_spoon_80dp.png는 새로 바뀐 체크 아이콘이 초록 원+흰 체크까지 이미 색이
  // 입혀진 완성형 이미지라(쿠팡 배지와 같은 종류), 버튼 배경에 별도 초록 채움이
  // 필요 없다 — 기본(흰 배경+테두리) 그대로 두고 아이콘만 키운다.
  cardIcon: {
    width: 21,
    height: 21,
    tintColor: "#1f7a5a"
  },
  cardIconDanger: {
    tintColor: "#9f3929"
  },
  // 이미 색이 입혀진 완성형 아이콘이라 tintColor를 주지 않는다(주면 초록 원과
  // 흰 체크가 전부 한 색으로 덮여 체크 모양이 안 보인다 — 2026-08-16 실기기로 확인).
  // 컨테이너(32px 원, 테두리 1px)에 꽉 차도록 키운다.
  cardIconComplete: {
    width: 35,
    height: 35
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
