import { useEffect, useMemo, useState } from "react";
import { Alert, Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import BannerAdSlot from "./BannerAdSlot";
import { typography } from "../theme/typography";
import { daysUntil, todayIso } from "../utils/date";
import {
  DEFAULT_PLAN_TIME,
  formatPlanTime,
  isRepeating,
  overduePlannedItems,
  planOccursOn,
  planTimeFor,
  repeatLabel
} from "../utils/mealPlan";
import { getFoodImageSource } from "../utils/foodImages";
import { fetchBestCategoryProducts, isCoupangUrl } from "../services/coupangApi";
import { computePersonalRankings } from "../utils/personalRankings";

const planCompleteIcon = require("../../assets/actions/fork_spoon_80dp.png");

// "나의 랭킹" 배지 위를 사선으로 스쳐 지나가는 은은한 흰색 하이라이트.
function ShimmerHighlight() {
  const translateX = useSharedValue(-24);

  useEffect(() => {
    translateX.value = withRepeat(
      withSequence(
        withTiming(-24, { duration: 0 }),
        withTiming(100, { duration: 900 }),
        withTiming(100, { duration: 0 })
      ),
      -1
    );
  }, [translateX]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { rotate: "18deg" }]
  }));

  return <Animated.View pointerEvents="none" style={[styles.rankingBadgeShine, shimmerStyle]} />;
}

async function openExternalUrl(url) {
  const trimmed = String(url || "").trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return;
  // canOpenURL은 Android 11+ 패키지 가시성 정책 때문에 실제로 열리는 링크도
  // false를 반환하는 경우가 흔해서(false negative), 사전 체크 없이 바로 연다.
  try {
    await Linking.openURL(trimmed);
  } catch {
    // 조용히 무시 — 상품 카드는 실패해도 별도 안내 없이 그냥 아무 반응 없음
  }
}

const shoppingCartIcon = require("../../assets/actions/shopping_cart_80dp.png");
const coupangBadgeIcon = require("../../assets/actions/coupang.png");
// 다시 구매 패널의 구매 버튼이 쓴다(RepurchaseItem). 홈 상단 쿠팡 카드는
// 없앴지만 이 로고는 그쪽에서 계속 필요하다.
const coupangLogoIcon = require("../../assets/actions/coupang2.png");
const expiredDashboardIcon = require("../../assets/home/priority_high_80dp.png");
const urgentDashboardIcon = require("../../assets/home/schedule_80dp.png");
const weekDashboardIcon = require("../../assets/home/calendar_month.png");
const storedDashboardIcon = require("../../assets/tabs/kitchen.png");
// 교차 카드의 보관 열. 개수는 crossStats가 세므로 여기엔 열 정의만 둔다.
// ⚠️ 아이콘은 색이 이미 입혀진 일러스트다 — tintColor를 걸면 한 색으로 뭉개진다.
// ⚠️ 파일명은 반드시 ASCII로 둔다. 안드로이드 릴리즈 빌드는 번들 이미지를
//    drawable 리소스로 복사하는데 리소스명에 한글을 쓸 수 없다(2026-08-24).
const STORAGE_COLUMNS = [
  { key: "fridge", label: "냉장", storage: "냉장", icon: require("../../assets/storage/storage-fridge.png") },
  { key: "freezer", label: "냉동", storage: "냉동", icon: require("../../assets/storage/storage-freezer.png") },
  { key: "room", label: "실온", storage: "실온", icon: require("../../assets/storage/storage-room.png") }
];
export default function HomePage({
  items,
  summary,
  reminderDays,
  onOpenInventory,
  onOpenSchedule,
  completePlanItem,
  onChangeItemImage
}) {
  const [repurchasePanelVisible, setRepurchasePanelVisible] = useState(false);
  const [layoutWidth, setLayoutWidth] = useState(0);
  const [bestCategoryProducts, setBestCategoryProducts] = useState([]);
  const [rankingModalVisible, setRankingModalVisible] = useState(false);
  const personalRankings = useMemo(() => computePersonalRankings(items), [items]);

  useEffect(() => {
    if (!repurchasePanelVisible || bestCategoryProducts.length) return;
    let cancelled = false;
    fetchBestCategoryProducts().then((products) => {
      if (!cancelled) setBestCategoryProducts(products);
    });
    return () => {
      cancelled = true;
    };
  }, [repurchasePanelVisible, bestCategoryProducts.length]);
  const activeItems = items.filter((item) => item.status !== "completed");
  const completedItems = items.filter((item) => item.status === "completed");
  // 오늘 먹기로 한 것 + 아직 안 챙긴 지난 일정. 지난 일정을 빼면 그냥 조용히
  // 사라져서 놓치기 쉬워, 일정 화면과 같은 기준으로 위에 같이 얹는다.
  const todayPlans = useMemo(() => {
    // activeItems는 렌더마다 새로 만들어지는 배열이라 의존성으로 쓰면 메모가 안 된다.
    const today = todayIso();
    const planned = items.filter((item) => item.status !== "completed");
    return [
      ...overduePlannedItems(planned).map((item) => ({ item, overdue: true })),
      ...planned.filter((item) => planOccursOn(item, today)).map((item) => ({ item, overdue: false }))
    ];
  }, [items]);
  const urgentItems = [...activeItems]
    .filter((item) => {
      const days = daysUntil(item.expiry);
      return days >= 0 && days <= reminderDays;
    })
    .sort((a, b) => daysUntil(a.expiry) - daysUntil(b.expiry));
  const repurchaseItems = [
    ...urgentItems.filter((item) => item.purchaseUrl),
    ...completedItems
      .filter((item) => item.purchaseUrl)
      .sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime())
  ].slice(0, 5);
  const priorityCardWidth = Math.max((layoutWidth - 32 - 20) / 3, 104);
  // 보관 위치별 개수. summary(useInventory)는 소비기한 축만 세므로 여기서 만든다.
  // 완료된 상품은 빼고 지금 보관 중인 것만 센다.
  // 상태(만료/임박/이번 주/보관 중) x 보관 위치(냉장/냉동/실온) 교차 집계.
  // 기준은 useInventory의 summary와 똑같이 맞춰야 한다 — 숫자가 어긋나면
  // 홈과 보관함이 다른 말을 하게 된다(임박/이번 주는 서로 포함 관계라
  // 한 상품이 여러 줄에 동시에 잡히는 게 정상이다).
  const crossStats = useMemo(() => {
    const blank = () => ({ 냉장: 0, 냉동: 0, 실온: 0 });
    const rows = {
      expired: { total: 0, byStorage: blank() },
      urgent: { total: 0, byStorage: blank() },
      week: { total: 0, byStorage: blank() },
      all: { total: 0, byStorage: blank() }
    };
    for (const item of items) {
      if (item.status === "completed") continue;
      const days = daysUntil(item.expiry);
      const keys = ["all"];
      if (days < 0) keys.push("expired");
      else {
        if (days <= reminderDays) keys.push("urgent");
        if (days <= 7) keys.push("week");
      }
      for (const key of keys) {
        rows[key].total += 1;
        if (rows[key].byStorage[item.storage] !== undefined) rows[key].byStorage[item.storage] += 1;
      }
    }
    return rows;
  }, [items, reminderDays]);

  // 등록된 게 없어도 네 줄을 그대로 보여준다 — 숫자가 0인 것과 줄이 사라지는
  // 건 다르다. 자리가 늘 같은 곳에 있어야 눈이 익는다(2026-08-24).
  const crossRows = [
    { key: "expired", label: "만료", tone: "expired", icon: expiredDashboardIcon, filter: "expired" },
    { key: "urgent", label: "임박", tone: "urgent", icon: urgentDashboardIcon, filter: "urgent" },
    { key: "week", label: "이번 주", tone: "week", icon: weekDashboardIcon, filter: "week" },
    { key: "all", label: "전체", tone: "stored", icon: storedDashboardIcon, filter: "all" }
  ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
      onLayout={(event) => {
        const nextWidth = event.nativeEvent.layout.width;
        if (nextWidth > 0 && Math.abs(nextWidth - layoutWidth) > 0.5) {
          setLayoutWidth(nextWidth);
        }
      }}
    >
      {/* 상태(언제까지) x 보관 위치(어디에) 표. 한 줄에 다 담으려고 열 제목을
          맨 위에 한 번만 쓴다 — 줄마다 "냉장 n 냉동 n"을 반복하면 줄이 길어져
          두 줄로 접히고, 그러면 카드가 세로로 두 배가 된다.
          줄 왼쪽(아이콘~합계)을 누르면 그 상태로, 숫자 칸을 누르면 상태+보관
          위치로 걸러진 보관함이 열린다. 0은 흐리게 그려서 있는 숫자가 먼저
          눈에 들어오게 한다(2026-08-24). */}
      <View style={styles.crossCard}>
        <View style={styles.crossHeadRow}>
          {/* 열 제목 줄 왼쪽은 원래 비어 있던 자리라, 배지를 여기 넣으면
              카드 높이가 늘지 않는다(2026-08-24). */}
          <View style={styles.crossHeadSpacer}>
            <Pressable style={styles.rankingBadge} onPress={() => setRankingModalVisible(true)}>
              <ShimmerHighlight />
              <Text style={styles.rankingBadgeIcon}>🏆</Text>
              <Text style={styles.rankingBadgeText}>나의 랭킹</Text>
            </Pressable>
          </View>
          {STORAGE_COLUMNS.map((col) => (
            <View key={col.key} style={styles.crossColHead}>
              <Image source={col.icon} resizeMode="contain" style={styles.crossColIcon} />
              <Text style={styles.crossColLabel}>{col.label}</Text>
            </View>
          ))}
        </View>
        {crossRows.map((row, index) => {
          const stat = crossStats[row.key];
          return (
            <View key={row.key} style={[styles.crossRow, index > 0 && styles.crossRowDivider]}>
              <Pressable style={styles.crossRowHead} onPress={() => onOpenInventory(row.filter)}>
                <View style={[styles.crossIconWrap, styles["dashboardStatIconWrap_" + row.tone]]}>
                  <Image source={row.icon} resizeMode="contain" style={styles.crossIcon} />
                </View>
                <Text style={styles.crossLabel}>{row.label}</Text>
                <Text style={[styles.crossValue, styles["dashboardStatValue_" + row.tone]]}>{stat.total}</Text>
              </Pressable>
              {STORAGE_COLUMNS.map((col) => {
                const count = stat.byStorage[col.storage];
                return (
                  <Pressable
                    key={col.key}
                    style={styles.crossCell}
                    onPress={() => onOpenInventory(row.filter, { storage: col.storage })}
                    accessibilityRole="button"
                    accessibilityLabel={row.label + " " + col.label + " " + count + "개"}
                  >
                    <Text style={[styles.crossCellValue, count === 0 && styles.crossCellZero]}>{count}</Text>
                  </Pressable>
                );
              })}
            </View>
          );
        })}
      </View>

      <PersonalRankingModal
        visible={rankingModalVisible}
        onClose={() => setRankingModalVisible(false)}
        rankings={personalRankings}
      />

      {/* 소비기한 축("이번 주 먼저 먹을 것") 바로 위에 일정 축을 둔다. 두 축이
          위아래로 나란히 있어야 홈이 "오늘 뭘 먹지"에 답하는 화면이 된다.
          잡아둔 일정이 없으면 섹션을 통째로 감춘다 — 빈 카드를 두면 일정을
          안 쓰는 사람에게는 홈만 길어진다(2026-08-23). */}
      {todayPlans.length ? (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>오늘 먹기로 한 것</Text>
            <Pressable onPress={onOpenSchedule}>
              <Text style={styles.moreText}>일정 &gt;</Text>
            </Pressable>
          </View>
          <View style={styles.recentList}>
            {todayPlans.map(({ item, overdue }) => (
              <PlanItem
                key={item.id}
                item={item}
                overdue={overdue}
                onComplete={() => completePlanItem?.(item.id)}
              />
            ))}
          </View>
        </>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>이번 주 먼저 먹을 것</Text>
        <Pressable onPress={() => setRepurchasePanelVisible((current) => !current)}>
          <Text style={styles.moreText}>{repurchasePanelVisible ? "접기" : "다시 구매 >"}</Text>
        </Pressable>
      </View>
      {urgentItems.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.priorityRow}
        >
          {urgentItems.map((item) => (
            <PriorityCard
              key={item.id}
              item={item}
              width={priorityCardWidth}
              onPress={() => onOpenInventory("urgent")}
              onChangeItemImage={() => onChangeItemImage?.(item.id)}
            />
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>급한 상품이 없습니다</Text>
          <Text style={styles.emptyText}>소비기한이 임박하면 여기에 먼저 보여드릴게요.</Text>
        </View>
      )}

      {repurchasePanelVisible ? (
        <RepurchasePanel items={repurchaseItems} suggestedProducts={bestCategoryProducts} />
      ) : null}

      <BannerAdSlot />
    </ScrollView>
  );
}

function PersonalRankingModal({ visible, onClose, rankings }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.rankingBackdrop} onPress={onClose}>
        <ScrollView
          contentContainerStyle={styles.rankingScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable style={styles.rankingCard} onPress={() => {}}>
            <Text style={styles.rankingCardTitle}>나의 냉장고 랭킹</Text>
            {rankings ? (
              <>
                <RankingSection title="가장 많이 등록한 상품" entries={rankings.mostRegistered} unit="번" />
                <RankingSection title="소비기한을 놓친 상품" entries={rankings.mostMissed} unit="번" />
                <RankingSection title="가장 많이 다룬 카테고리" entries={rankings.topCategories} unit="개" />
              </>
            ) : (
              <View style={styles.rankingEmpty}>
                <Text style={styles.rankingEmptyText}>
                  아직 데이터가 부족해요. 상품을 몇 개 더 등록하면 나만의 랭킹을 보여드릴게요.
                </Text>
              </View>
            )}
            <Pressable style={styles.rankingCloseButton} onPress={onClose}>
              <Text style={styles.rankingCloseButtonText}>닫기</Text>
            </Pressable>
          </Pressable>
        </ScrollView>
      </Pressable>
    </Modal>
  );
}

function RankingSection({ title, entries, unit }) {
  if (!entries.length) return null;
  return (
    <View style={styles.rankingSection}>
      <Text style={styles.rankingSectionTitle}>{title}</Text>
      {entries.map((entry, index) => (
        <View key={`${entry.label}-${index}`} style={styles.rankingRow}>
          <Text style={styles.rankingRowRank}>{index + 1}</Text>
          <View style={styles.rankingRowLabelWrap}>
            <Text style={styles.rankingRowLabel} numberOfLines={1}>{entry.label}</Text>
            {entry.purchaseUrl ? (
              <Pressable
                style={[styles.rankingCartButton, isCoupangUrl(entry.purchaseUrl) && styles.rankingCartButtonCoupang]}
                onPress={() => openExternalUrl(entry.purchaseUrl)}
                accessibilityRole="button"
                accessibilityLabel="구매 링크 열기"
              >
                <Image
                  source={isCoupangUrl(entry.purchaseUrl) ? coupangBadgeIcon : shoppingCartIcon}
                  resizeMode="contain"
                  style={isCoupangUrl(entry.purchaseUrl) ? styles.rankingCartIconCoupang : styles.rankingCartIcon}
                />
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.rankingRowCount}>{entry.count}{unit}</Text>
        </View>
      ))}
    </View>
  );
}

function RepurchasePanel({ items, suggestedProducts }) {
  return (
    <View style={styles.repurchasePanel}>
      {items.length ? (
        <>
          <View style={styles.repurchasePanelHeader}>
            <View>
              <Text style={styles.repurchasePanelTitle}>다시 구매 바로가기</Text>
              <Text style={styles.repurchasePanelText}>완료했거나 임박한 상품의 구매 링크를 모아 보여드려요.</Text>
            </View>
          </View>
          <View style={styles.repurchaseList}>
            {items.map((item) => (
              <RepurchaseItem key={item.id} item={item} />
            ))}
          </View>
        </>
      ) : (
        <>
          <Text style={styles.repurchasePanelTitle}>다시 살 상품이 아직 없습니다</Text>
          <Text style={styles.repurchasePanelText}>완료한 상품이나 임박 상품에 구매 링크를 넣으면 여기에서 바로 열 수 있어요.</Text>
        </>
      )}

      {suggestedProducts?.length ? (
        <View style={styles.suggestedProductsBlock}>
          <Text style={styles.suggestedProductsTitle}>식품 인기상품</Text>
          <View style={styles.affiliateDisclosureBanner}>
            <Text style={styles.affiliateDisclosureText}>
              {"이 포스팅은 쿠팡 파트너스 활동의 일환으로,\n이에 따른 일정액의 수수료를 제공받습니다."}
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestedProductsRow}>
            {suggestedProducts.map((product, index) => (
              <CoupangProductCard key={`${product.productId}-${index}`} product={product} />
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function CoupangProductCard({ product }) {
  return (
    <Pressable style={styles.coupangProductCard} onPress={() => openExternalUrl(product.productUrl)}>
      <Image source={{ uri: product.productImage }} resizeMode="cover" style={styles.coupangProductImage} />
      <Text style={styles.coupangProductName} numberOfLines={2}>{product.productName}</Text>
      <Text style={styles.coupangProductPrice}>{(product.productPrice || 0).toLocaleString("ko-KR")}원</Text>
    </Pressable>
  );
}

function RepurchaseItem({ item }) {
  const days = daysUntil(item.expiry);
  const isCoupang = isCoupangUrl(item.purchaseUrl);

  async function openPurchaseUrl() {
    const url = String(item.purchaseUrl || "").trim();
    if (!url) {
      Alert.alert("구매 링크 없음", "보관함에서 상품을 수정해 쿠팡 공유 링크를 붙여넣으면 바로 이동할 수 있어요.");
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      Alert.alert("링크 확인", "http:// 또는 https://로 시작하는 구매 링크를 넣어주세요.");
      return;
    }
    try {
      // canOpenURL은 Android 11+ 패키지 가시성 정책 때문에 실제로 열리는 링크도
      // false를 반환하는 경우가 흔해서(false negative), 사전 체크 없이 바로 연다.
      await Linking.openURL(url);
    } catch {
      Alert.alert("링크 열기 실패", "이 링크를 열 수 없습니다.");
    }
  }

  return (
    <View style={styles.repurchaseItem}>
      <Image source={getFoodImageSource(item)} resizeMode="cover" style={styles.repurchaseItemImage} />
      <View style={styles.repurchaseItemBody}>
        <View style={styles.repurchaseItemTop}>
          <Text style={styles.repurchaseItemName} numberOfLines={1}>{item.name}</Text>
          <Text style={[styles.repurchaseDday, days <= 1 && styles.dDayDanger]}>{labelForDays(days)}</Text>
        </View>
        <Text style={styles.repurchaseMeta}>{item.storage} · {item.expiry}</Text>
        <Pressable
          style={[
            styles.purchaseButton,
            isCoupang && styles.purchaseButtonCoupang,
            !item.purchaseUrl && styles.purchaseButtonMuted
          ]}
          onPress={openPurchaseUrl}
          accessibilityRole="button"
          accessibilityLabel={item.purchaseUrl ? "구매 링크 열기" : "구매 링크 없음"}
        >
          {isCoupang ? (
            // coupang2.png는 가로로 긴 워드마크라 원형 버튼에 안 어울려서(2026-08-15
            // 피드백), 여기만 원형 아이콘 없이 로고를 텍스트 옆에 자연스럽게 붙인다.
            <Image source={coupangLogoIcon} resizeMode="contain" style={styles.purchaseCoupangLogo} />
          ) : (
            <View
              style={[styles.purchaseCartIconWrap, !item.purchaseUrl && styles.purchaseCartIconWrapMuted]}
            >
              <Image
                source={shoppingCartIcon}
                resizeMode="contain"
                style={[styles.purchaseCartIcon, !item.purchaseUrl && styles.purchaseCartIconMuted]}
              />
            </View>
          )}
          <Text
            style={[
              styles.purchaseButtonText,
              isCoupang && styles.purchaseButtonTextCoupang,
              !item.purchaseUrl && styles.purchaseButtonTextMuted
            ]}
          >
            {item.purchaseUrl ? "구매 링크 열기" : "구매 링크 등록 필요"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function PriorityCard({ item, width, onPress, onChangeItemImage }) {
  const days = daysUntil(item.expiry);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${labelForDays(days)}, ${item.storage}`}
      style={({ pressed }) => [
        styles.priorityCard,
        { width },
        pressed && styles.priorityCardPressed
      ]}
      onPress={onPress}
    >
      <View style={styles.priorityTopRow}>
        <Pressable onPress={onChangeItemImage}>
          <Image source={getFoodImageSource(item)} resizeMode="cover" style={styles.itemImage} />
        </Pressable>
      </View>
      <Text maxFontSizeMultiplier={1.3} style={styles.priorityName} numberOfLines={2}>{item.name}</Text>
      <View style={styles.priorityDdayRow}>
        <Text maxFontSizeMultiplier={1.3} style={[styles.dDay, days <= 1 && styles.dDayDanger]}>
          {labelForDays(days)}
        </Text>
        <Text maxFontSizeMultiplier={1.3} style={styles.storagePill}>{item.storage}</Text>
      </View>
    </Pressable>
  );
}

// 오늘 먹기로 한 상품 한 줄.
function PlanItem({ item, overdue, onComplete }) {
  const timeLabel = formatPlanTime(planTimeFor(item, DEFAULT_PLAN_TIME));
  const repeatSuffix = isRepeating(item) ? ` · ${repeatLabel(item.planRepeat)}` : "";
  return (
    <View style={styles.recentItem}>
      <Image source={getFoodImageSource(item)} resizeMode="cover" style={styles.recentImage} />
      <View style={styles.recentBody}>
        <Text style={styles.recentName} numberOfLines={1}>{item.name}</Text>
        <Text style={[styles.recentMeta, overdue && styles.planMetaOverdue]}>
          {overdue ? `지난 일정 · ${item.plannedDate}` : timeLabel ? `${timeLabel} 알림` : "오늘"}
          {repeatSuffix}
        </Text>
      </View>
      <Pressable
        style={styles.planCompleteButton}
        onPress={onComplete}
        accessibilityRole="button"
        accessibilityLabel={`${item.name} 먹었어요`}
      >
        <Image source={planCompleteIcon} resizeMode="contain" style={styles.planCompleteIcon} />
      </Pressable>
    </View>
  );
}

function labelForDays(days) {
  if (days < 0) return `D+${Math.abs(days)}`;
  if (days === 0) return "D-day";
  return `D-${days}`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignSelf: "stretch"
  },
  // 홈 화면 전체 여백입니다. 배너/목록의 좌우 여백과 하단 탭에 가리지 않는 아래 여백을 조정합니다.
  page: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === "android" ? 126 : 104
  },
  dashboardStatIconWrap_expired: {
    backgroundColor: "#ee645f"
  },
  dashboardStatIconWrap_urgent: {
    backgroundColor: "#ee9a35"
  },
  dashboardStatIconWrap_week: {
    backgroundColor: "#2c9f70"
  },
  dashboardStatIconWrap_stored: {
    backgroundColor: "#6e95f4"
  },
  dashboardStatValue_expired: {
    color: "#ee645f"
  },
  dashboardStatValue_urgent: {
    color: "#ee9a35"
  },
  dashboardStatValue_week: {
    color: "#2c9f70"
  },
  dashboardStatValue_stored: {
    color: "#6e95f4"
  },
  // 상태 x 보관 교차 카드입니다. 줄마다 상태 머리글 + 보관 칩으로 이뤄집니다.
  crossCard: {
    borderRadius: 18,
    backgroundColor: "#fff",
    marginTop: 16,
    paddingVertical: 4,
    shadowColor: "#0d3f2e",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2
  },
  crossRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  crossRowDivider: {
    borderTopWidth: 1,
    borderTopColor: "#f0f2f0"
  },
  crossRowHead: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  crossIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center"
  },
  crossIcon: {
    width: 19,
    height: 19,
    tintColor: "#fff"
  },
  // 상태 이름이 남는 폭을 먹어야 개수가 오른쪽에 붙는다.
  crossLabel: {
    ...typography.label,
    fontSize: 16,
    lineHeight: 22,
    color: "#3d4742",
    flex: 1
  },
  crossValue: {
    fontSize: 23,
    lineHeight: 27,
    fontWeight: "900"
  },
  // 열 제목 줄. 숫자 칸과 폭을 똑같이 맞춰야 세로로 줄이 선다.
  crossHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 14,
    paddingTop: 12,
    paddingBottom: 6
  },
  crossHeadSpacer: {
    flex: 1
  },
  crossColHead: {
    width: 46,
    alignItems: "center",
    gap: 2
  },
  // 배경 칩 없이 아이콘만 얹습니다. 색이 있는 일러스트라 tintColor는 주지 않습니다.
  crossColIcon: {
    width: 28,
    height: 28
  },
  crossColLabel: {
    ...typography.caption,
    fontSize: 12,
    color: "#9aa39d"
  },
  // 숫자 한 칸. 폭을 crossColHead와 같은 40으로 고정해 열이 어긋나지 않게 합니다.
  crossCell: {
    width: 46,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4
  },
  crossCellValue: {
    ...typography.label,
    fontSize: 17,
    lineHeight: 23,
    color: "#2f3a34"
  },
  // 0은 흐리게 — 있는 숫자가 먼저 눈에 들어오게 합니다.
  crossCellZero: {
    color: "#ccd3ce",
    fontWeight: "400"
  },
  // 통계 카드 위 "나의 랭킹" 배지입니다. overflow: hidden이라야 위를 지나가는
  // 흰 줄(rankingBadgeShine)이 알약 밖으로 삐져나오지 않습니다.
  rankingBadge: {
    alignSelf: "flex-start",
    marginLeft: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#e8f7ef",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    overflow: "hidden"
  },
  rankingBadgeShine: {
    position: "absolute",
    top: -8,
    bottom: -8,
    left: 0,
    width: 10,
    backgroundColor: "rgba(255,255,255,0.65)"
  },
  rankingBadgeIcon: {
    fontSize: 11
  },
  rankingBadgeText: {
    ...typography.captionStrong,
    color: "#1f7a5a",
    fontSize: 11
  },
  rankingBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.48)",
    justifyContent: "center"
  },
  rankingScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 12
  },
  rankingCard: {
    marginHorizontal: 16,
    borderRadius: 22,
    backgroundColor: "#fff",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 }
  },
  rankingCardTitle: {
    ...typography.sectionTitle,
    color: "#18201c",
    marginBottom: 12
  },
  rankingSection: {
    marginBottom: 16
  },
  rankingSectionTitle: {
    ...typography.bodyStrong,
    color: "#18201c",
    marginBottom: 8
  },
  rankingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 5
  },
  rankingRowRank: {
    ...typography.captionStrong,
    color: "#1f7a5a",
    width: 18
  },
  rankingRowLabelWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  rankingRowLabel: {
    ...typography.body,
    color: "#18201c",
    flexShrink: 1
  },
  rankingRowCount: {
    ...typography.captionStrong,
    color: "#68716b",
  },
  rankingCartButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#edf7f2",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  },
  // coupang.png는 그 자체로 이미 빨간 원 배지라, 옅은 민트 배경 위에 작게 얹으면
  // 원 안에 원이 붕 뜬 것처럼 보인다(2026-08-15 피드백). 흰 배경으로 바꾼다.
  rankingCartButtonCoupang: {
    backgroundColor: "#fff",
    // 흰 배경만으로는 랭킹 카드 배경과 구분이 잘 안 된다는 피드백(2026-08-15)으로
    // 테두리를 추가했는데, 검정 테두리는 너무 튄다는 재피드백으로 회색 계열로 바꿨다.
    borderWidth: 1,
    borderColor: "#c7ccc8"
  },
  rankingCartIcon: {
    width: 15,
    height: 15,
    tintColor: "#1f7a5a"
  },
  // coupang.png는 색을 가진 브랜드 배지라 tintColor를 주지 않는다. 컨테이너(26px 원)
  // 테두리에 거의 닿도록 크게 키운다.
  rankingCartIconCoupang: {
    width: 26,
    height: 26
  },
  rankingEmpty: {
    paddingVertical: 20
  },
  rankingEmptyText: {
    ...typography.body,
    color: "#68716b",
    textAlign: "center"
  },
  rankingCloseButton: {
    marginTop: 6,
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 16
  },
  rankingCloseButtonText: {
    ...typography.captionStrong,
    color: "#68716b",
  },
  // 각 섹션의 제목 줄입니다. 제목과 "더보기 >"를 좌우로 배치합니다.
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 22,
    marginBottom: 10
  },
  // 섹션 제목입니다. 예: "보관 위치", "오늘 먹기로 한 것".
  // 앱 헤더("오늘까지야, 놓치기 전에")가 20px/800이라 예전 18px/800으로는 같은
  // 급으로 읽혔다. 크기를 낮춰 계층을 만들고, 대신 왼쪽 초록바로 섹션 시작을
  // 표시한다 — 글자만 줄이면 구분이 약해지기 때문이다(2026-08-24).
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 23,
    color: "#2f3a34",
    borderLeftWidth: 6,
    borderLeftColor: "#1f7a5a",
    paddingLeft: 10
  },
  // 오른쪽 "더보기 >" 텍스트입니다.
  moreText: {
    ...typography.bodyStrong,
    color: "#68716b",
  },
  // "이번 주 먼저 먹을 것" 카드 3개를 가로로 배치하는 줄입니다.
  priorityRow: {
    gap: 10
  },
  repurchasePanel: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e6e4df",
    backgroundColor: "#fff",
    padding: 14,
    marginTop: 12
  },
  repurchasePanelHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  repurchasePanelTitle: {
    ...typography.cardTitle,
    color: "#18201c",
  },
  repurchasePanelText: {
    ...typography.caption,
    color: "#68716b",
    marginTop: 5
  },
  repurchaseList: {
    gap: 10,
    marginTop: 12
  },
  repurchaseItem: {
    flexDirection: "row",
    gap: 11,
    borderRadius: 13,
    backgroundColor: "#f8fbf9",
    padding: 10
  },
  repurchaseItemImage: {
    width: 58,
    height: 58,
    borderRadius: 12,
    backgroundColor: "#edf7f2",
    overflow: "hidden"
  },
  repurchaseItemBody: {
    flex: 1
  },
  repurchaseItemTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  repurchaseItemName: {
    ...typography.bodyStrong,
    flex: 1,
    color: "#18201c",
  },
  repurchaseDday: {
    ...typography.captionStrong,
    color: "#ef8b1f",
  },
  repurchaseMeta: {
    ...typography.caption,
    color: "#68716b",
    marginTop: 4
  },
  purchaseButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 999,
    backgroundColor: "#1f7a5a",
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 9
  },
  // 초록 배경 위에 색 있는 coupang2.png 로고를 얹으니 시각적으로 부딪힌다는
  // 피드백(2026-08-15)으로 쿠팡일 때만 배경을 흰색으로 바꾼다. 카드 배경(#f8fbf9)과
  // 거의 안 구분돼서 옅은 테두리를 같이 준다.
  purchaseButtonCoupang: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e6e4df"
  },
  purchaseButtonMuted: {
    backgroundColor: "#eef4f1"
  },
  purchaseCartIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.24)",
    alignItems: "center",
    justifyContent: "center"
  },
  purchaseCartIconWrapMuted: {
    backgroundColor: "transparent"
  },
  purchaseCartIcon: {
    width: 15,
    height: 15,
    tintColor: "#fff"
  },
  purchaseCartIconMuted: {
    tintColor: "#68716b",
    opacity: 0.6
  },
  // coupang2.png(가로 워드마크)를 원형 버튼 없이 텍스트 옆에 자연스럽게 붙인다.
  // 565×131 원본 비율(약 4.3:1)을 유지.
  purchaseCoupangLogo: {
    width: 60,
    height: 14
  },
  purchaseButtonText: {
    ...typography.captionStrong,
    color: "#fff",
  },
  purchaseButtonTextMuted: {
    color: "#68716b"
  },
  // 배경이 흰색으로 바뀌었으니 흰 글자(#fff)는 안 보인다 — 어두운 텍스트로 바꾼다.
  purchaseButtonTextCoupang: {
    color: "#18201c"
  },
  // 쿠팡 파트너스 대가성 문구. 골드박스/인기상품처럼 파트너스 링크가 보이는
  // 섹션 최상단에 눈에 띄게 노출해야 한다(문서: docs/tunable-options.md 참고).
  affiliateDisclosureBanner: {
    borderRadius: 10,
    backgroundColor: "#fff0e7",
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 10
  },
  affiliateDisclosureText: {
    ...typography.bodyStrong,
    color: "#d95f3d"
  },
  suggestedProductsBlock: {
    marginTop: 16
  },
  suggestedProductsTitle: {
    ...typography.bodyStrong,
    color: "#18201c",
  },
  suggestedProductsRow: {
    gap: 10,
    marginTop: 10,
    paddingRight: 4
  },
  coupangProductCard: {
    width: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e6e4df",
    backgroundColor: "#fff",
    padding: 8
  },
  coupangProductImage: {
    width: "100%",
    height: 100,
    borderRadius: 8,
    backgroundColor: "#f4f1eb"
  },
  coupangProductName: {
    ...typography.caption,
    color: "#18201c",
    marginTop: 6,
    minHeight: 32
  },
  coupangProductPrice: {
    ...typography.captionStrong,
    color: "#1f7a5a",
    marginTop: 4
  },
  // 이번 주 카드 한 장입니다. 카드 높이, 테두리, 내부 여백을 담당합니다.
  priorityCard: {
    minHeight: 138,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e6e4df",
    backgroundColor: "#fff",
    padding: 12
  },
  priorityCardPressed: {
    opacity: 0.72
  },
  // 이번 주 카드 상단 줄입니다. 이미지와 보관 상태 배지를 배치합니다.
  priorityTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 6
  },
  // 상품 이미지 공통 스타일입니다. 이번 주 카드 안의 사진에 사용됩니다.
  itemImage: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#edf7f2",
    overflow: "hidden"
  },
  // 이번 주 카드의 상품명입니다.
  priorityName: {
    ...typography.bodyStrong,
    color: "#18201c",
    marginTop: 12,
    minHeight: 38
  },
  // D-day와 보관 위치 태그를 카드 하단의 한 줄에 배치합니다.
  priorityDdayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    columnGap: 6,
    rowGap: 4
  },
  // D-day 텍스트입니다. 기본은 주황색이고, 만료/당일은 아래 dDayDanger가 덮어씁니다.
  dDay: {
    ...typography.label,
    color: "#ef8b1f",
    marginTop: 5,
    flexShrink: 0
  },
  // 위험 상태 D-day 색상입니다. 예: 오늘, D+1.
  dDayDanger: {
    color: "#e54135"
  },
  // 냉장/냉동/실온 같은 보관 위치 배지입니다.
  storagePill: {
    ...typography.badge,
    alignSelf: "flex-start",
    flexShrink: 0,
    color: "#1f7a5a",
    backgroundColor: "#edf7f2",
    borderRadius: 6,
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  // "오늘 먹기로 한 것" 목록을 감싸는 흰색 리스트 카드입니다.
  recentList: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e6e4df",
    backgroundColor: "#fff",
    overflow: "hidden"
  },
  // 목록 한 줄입니다("오늘 먹기로 한 것"이 씁니다).
  recentItem: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeea"
  },
  // 최근 목록의 상품 이미지입니다.
  recentImage: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: "#f3f6f4",
    overflow: "hidden"
  },
  // 최근 목록에서 상품명/메타 텍스트가 들어가는 가운데 영역입니다.
  recentBody: {
    flex: 1
  },
  // 최근 목록 상품명입니다.
  recentName: {
    ...typography.cardTitle,
    color: "#18201c",
  },
  // 최근 목록의 보관 위치와 등록일 텍스트입니다.
  recentMeta: {
    ...typography.caption,
    color: "#68716b",
    marginTop: 4
  },
  // 지난 일정 줄의 강조색. 소비기한 임박과 같은 계열로 맞춘다.
  planMetaOverdue: {
    color: "#c2553c",
  },
  // 오늘 일정 줄 오른쪽 "먹었어요" 버튼입니다.
  planCompleteButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#eef5f1",
    alignItems: "center",
    justifyContent: "center"
  },
  planCompleteIcon: {
    width: 30,
    height: 30
  },
  emptyCard: {
    flex: 1,
    minHeight: 116,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e6e4df",
    backgroundColor: "#fff",
    justifyContent: "center",
    padding: 16
  },
  // 빈 카드의 제목입니다.
  emptyTitle: {
    ...typography.cardTitle,
    color: "#18201c",
  },
  // 빈 카드의 설명 문구입니다.
  emptyText: {
    ...typography.body,
    color: "#68716b",
    marginTop: 6
  }
});
