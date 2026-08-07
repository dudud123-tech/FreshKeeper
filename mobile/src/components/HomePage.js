import { useEffect, useMemo, useState } from "react";
import { Alert, Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import BannerAdSlot from "./BannerAdSlot";
import { typography } from "../theme/typography";
import { daysUntil, itemCreatedDate } from "../utils/date";
import { getFoodImageSource } from "../utils/foodImages";
import { fetchBestCategoryProducts } from "../services/coupangApi";
import { computePersonalRankings } from "../utils/personalRankings";

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

  return <Animated.View pointerEvents="none" style={[styles.growthRankingBadgeShine, shimmerStyle]} />;
}

const shoppingCartIcon = require("../../assets/actions/shopping_cart_80dp.png");
const expiredDashboardIcon = require("../../assets/home/priority_high_80dp.png");
const urgentDashboardIcon = require("../../assets/home/schedule_80dp.png");
const weekDashboardIcon = require("../../assets/home/calendar_month.png");
const storedDashboardIcon = require("../../assets/home/snowflake_80dp.png");
const levelImages = [
  require("../../assets/Level/season1/1.png"),
  require("../../assets/Level/season1/2.png"),
  require("../../assets/Level/season1/3.png"),
  require("../../assets/Level/season1/4.png"),
  require("../../assets/Level/season1/5.png"),
  require("../../assets/Level/season1/6.png"),
  require("../../assets/Level/season1/7.png"),
  require("../../assets/Level/season1/8.png"),
  require("../../assets/Level/season1/9.png"),
  require("../../assets/Level/season1/10.png")
];
const levelNames = [
  { name: "씨앗", meaning: "관리의 시작" },
  { name: "새싹", meaning: "첫 성장이 시작됨" },
  { name: "어린잎", meaning: "관리 습관이 자리 잡기 시작" },
  { name: "푸른잎", meaning: "꾸준히 성장 중" },
  { name: "무럭무럭", meaning: "눈에 띄게 잘 자라는 단계" },
  { name: "어린나무", meaning: "안정적인 관리 습관 형성" },
  { name: "열매 맺는 나무", meaning: "관리 성과가 나타나기 시작" },
  { name: "풍성한 나무", meaning: "꾸준한 관리가 쌓인 상태" },
  { name: "꽃피는 나무", meaning: "좋은 관리 습관이 완성 단계에 가까움" },
  { name: "황금 열매", meaning: "최고의 관리 상태" }
];
const LEVEL_XP_THRESHOLDS = [0, 30, 80, 150, 250, 380, 540, 730, 950, 1200];
const REGISTER_XP_PER_ITEM = 5;
const COMPLETE_XP_PER_ITEM = 10;
const URGENT_COMPLETE_XP_PER_ITEM = 15;
const EXPIRED_ITEM_PENALTY_XP = 8;

export default function HomePage({
  items,
  summary,
  reminderDays,
  growthProfile,
  growthDashboardReport,
  onOpenInventory,
  onOpenAdd,
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
  const recentItems = [...activeItems]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 4);
  const growthReport = normalizeGrowthProfile(growthProfile) || getGrowthReport(items, reminderDays);
  const growthLevel = levelNames[growthReport.level - 1] || levelNames[0];
  const dashboardReport = normalizeDashboardReport(growthDashboardReport) || getDashboardReport({
    activeItems,
    completedItems,
    summary,
    reminderDays
  });
  const dashboardStats = [
    {
      label: "만료",
      value: summary.expired,
      icon: expiredDashboardIcon,
      tone: "expired",
      filter: "expired"
    },
    {
      label: "임박",
      value: summary.urgent,
      icon: urgentDashboardIcon,
      tone: "urgent",
      filter: "urgent"
    },
    {
      label: "이번 주",
      value: summary.week || 0,
      icon: weekDashboardIcon,
      tone: "week",
      filter: "week"
    },
    {
      label: "보관 중",
      value: summary.total,
      icon: storedDashboardIcon,
      tone: "stored",
      filter: "all"
    }
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
      <Pressable style={styles.growthCard} onPress={() => onOpenInventory("completed")}>
        <Image
          source={levelImages[growthReport.level - 1] || levelImages[0]}
          resizeMode="contain"
          style={styles.growthLevelImage}
        />
        <View style={styles.growthHeader}>
          <View>
            <View style={styles.growthEyebrowRow}>
              <View style={styles.growthEyebrowPill}>
                <Text style={styles.growthEyebrowLeaf}>❤</Text>
                <Text style={styles.growthEyebrow}>냉장고 관리단계</Text>
              </View>
              <Pressable
                style={styles.growthRankingBadge}
                onPress={() => setRankingModalVisible(true)}
              >
                <ShimmerHighlight />
                <Text style={styles.growthRankingBadgeIcon}>🏆</Text>
                <Text style={styles.growthRankingBadgeText}>나의 랭킹</Text>
              </Pressable>
            </View>
            <Text style={styles.growthTitle}>
              <Text>{growthLevel.name}</Text>
              <Text style={styles.growthTitleMeaning}> - {growthLevel.meaning}</Text>
            </Text>
          </View>
        </View>
        <Text style={styles.growthMessage}>{dashboardReport.title}</Text>
        <Text style={styles.growthText}>{dashboardReport.body}</Text>
        <View style={styles.growthProgressTrack}>
          <View style={[styles.growthProgressFill, { width: `${growthReport.percent}%` }]} />
        </View>
        <View style={styles.growthFooter}>
          <Text style={styles.growthFooterText}>다음 단계까지 {growthReport.remainingXp} XP</Text>
          <Text style={styles.growthFooterText}>누적 {growthReport.xp} XP</Text>
        </View>
      </Pressable>

      <PersonalRankingModal
        visible={rankingModalVisible}
        onClose={() => setRankingModalVisible(false)}
        rankings={personalRankings}
      />

      <View style={styles.dashboardStatsCard}>
        {dashboardStats.map((stat, index) => (
          <Pressable
            key={stat.label}
            style={[styles.dashboardStat, index < dashboardStats.length - 1 && styles.dashboardStatDivider]}
            onPress={() => onOpenInventory(stat.filter)}
          >
            <View style={styles.dashboardStatLabelRow}>
              <View style={[styles.dashboardStatIconWrap, styles[`dashboardStatIconWrap_${stat.tone}`]]}>
                <Image source={stat.icon} resizeMode="contain" style={styles.dashboardStatIcon} />
              </View>
              <Text style={styles.dashboardStatLabel}>{stat.label}</Text>
            </View>
            <View style={styles.dashboardStatValueRow}>
              <Text style={[styles.dashboardStatValue, styles[`dashboardStatValue_${stat.tone}`]]}>{stat.value}</Text>
              <Text style={styles.dashboardStatUnit}>개</Text>
            </View>
          </Pressable>
        ))}
      </View>

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

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>최근 추가한 상품</Text>
        <Pressable onPress={() => onOpenInventory("all")}>
          <Text style={styles.moreText}>더보기 &gt;</Text>
        </Pressable>
      </View>
      <View style={styles.recentList}>
        {recentItems.length ? (
          recentItems.map((item) => <RecentItem key={item.id} item={item} onChangeItemImage={onChangeItemImage} />)
        ) : (
          <Pressable style={styles.emptyWideCard} onPress={onOpenAdd}>
            <Text style={styles.emptyTitle}>아직 등록한 상품이 없습니다</Text>
            <Text style={styles.emptyText}>영수증이나 직접 입력으로 첫 상품을 추가해보세요.</Text>
          </Pressable>
        )}
      </View>

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
                style={styles.rankingCartButton}
                onPress={() => openExternalUrl(entry.purchaseUrl)}
                accessibilityRole="button"
                accessibilityLabel="구매 링크 열기"
              >
                <Image source={shoppingCartIcon} resizeMode="contain" style={styles.rankingCartIcon} />
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
          style={[styles.purchaseButton, !item.purchaseUrl && styles.purchaseButtonMuted]}
          onPress={openPurchaseUrl}
          accessibilityRole="button"
          accessibilityLabel={item.purchaseUrl ? "구매 링크 열기" : "구매 링크 없음"}
        >
          <View style={[styles.purchaseCartIconWrap, !item.purchaseUrl && styles.purchaseCartIconWrapMuted]}>
            <Image
              source={shoppingCartIcon}
              resizeMode="contain"
              style={[styles.purchaseCartIcon, !item.purchaseUrl && styles.purchaseCartIconMuted]}
            />
          </View>
          <Text style={[styles.purchaseButtonText, !item.purchaseUrl && styles.purchaseButtonTextMuted]}>
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

function RecentItem({ item, onChangeItemImage }) {
  const days = daysUntil(item.expiry);
  return (
    <View style={styles.recentItem}>
      <Pressable onPress={() => onChangeItemImage?.(item.id)}>
        <Image source={getFoodImageSource(item)} resizeMode="cover" style={styles.recentImage} />
      </Pressable>
      <View style={styles.recentBody}>
        <Text style={styles.recentName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.recentMeta}>{item.storage} · 등록 {itemCreatedDate(item)}</Text>
      </View>
      <Text style={[styles.recentDay, days <= 1 && styles.dDayDanger]}>{labelForDays(days)}</Text>
    </View>
  );
}

function labelForDays(days) {
  if (days < 0) return `D+${Math.abs(days)}`;
  if (days === 0) return "D-day";
  return `D-${days}`;
}

function getDashboardReport({ activeItems, completedItems, summary }) {
  const now = new Date();
  const weekStart = startOfDay(addDays(now, -6));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekCompleted = completedItems.filter((item) => isDateSince(item.completedAt, weekStart)).length;
  const monthCompleted = completedItems.filter((item) => isDateSince(item.completedAt, monthStart)).length;
  const weekRegistered = [...activeItems, ...completedItems].filter((item) => {
    return isDateSince(item.createdAt, weekStart);
  }).length;

  if (weekCompleted > 0) {
    return {
      title: "이번 주 리포트",
      body: `${weekCompleted}개를 버리기 전에 챙겼어요.`
    };
  }

  if (monthCompleted > 0) {
    return {
      title: "이번 달 리포트",
      body: `${monthCompleted}개를 잘 관리했어요.`
    };
  }

  if (summary.expired > 0) {
    return {
      title: "정리가 필요해요",
      body: `만료된 상품 ${summary.expired}개를 확인해 주세요.`
    };
  }

  if (summary.urgent > 0) {
    return {
      title: "놓치기 전에 확인해요",
      body: `${summary.urgent}개를 먼저 챙기면 좋아요.`
    };
  }

  if (weekRegistered > 0) {
    return {
      title: "관리 리듬 좋아요",
      body: "새로 등록한 상품을 차근차근 챙겨요."
    };
  }

  return {
    title: "관리 리듬 좋아요",
    body: "지금 급한 상품이 없어요."
  };
}

function normalizeDashboardReport(report) {
  if (!report || typeof report !== "object") return null;
  const title = String(report.title || "").trim();
  const body = String(report.body || "").trim();
  if (!title || !body) return null;
  return { title, body };
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function isDateSince(value, since) {
  const date = new Date(value || 0);
  return !Number.isNaN(date.getTime()) && date >= since;
}

function getGrowthReport(items, reminderDays) {
  const activeItems = items.filter((item) => item.status !== "completed");
  const completedItems = items.filter((item) => item.status === "completed");
  const registeredXp = items.length * REGISTER_XP_PER_ITEM;
  let completionXp = 0;
  let completedBeforeExpiry = 0;

  completedItems.forEach((item) => {
    const completedAt = new Date(item.completedAt || 0);
    const expiryAt = new Date(`${item.expiry}T23:59:59`);
    if (Number.isNaN(completedAt.getTime()) || Number.isNaN(expiryAt.getTime())) return;
    if (completedAt <= expiryAt) {
      completedBeforeExpiry += 1;
      const daysLeftWhenCompleted = Math.ceil((expiryAt.getTime() - completedAt.getTime()) / 86400000);
      completionXp += daysLeftWhenCompleted <= reminderDays
        ? URGENT_COMPLETE_XP_PER_ITEM
        : COMPLETE_XP_PER_ITEM;
    }
  });

  const expiredPenalty = activeItems.filter((item) => daysUntil(item.expiry) < 0).length * EXPIRED_ITEM_PENALTY_XP;
  const xp = Math.max(0, registeredXp + completionXp - expiredPenalty);
  const levelIndex = LEVEL_XP_THRESHOLDS.reduce((currentLevel, threshold, index) => {
    return xp >= threshold ? index : currentLevel;
  }, 0);
  const level = Math.min(10, levelIndex + 1);
  const currentThreshold = LEVEL_XP_THRESHOLDS[level - 1] || 0;
  const nextThreshold = LEVEL_XP_THRESHOLDS[level] || currentThreshold;
  const range = Math.max(1, nextThreshold - currentThreshold);
  const progressXp = Math.max(0, xp - currentThreshold);
  const percent = level >= 10 ? 100 : Math.min(95, Math.max(8, Math.round((progressXp / range) * 100)));
  const remainingXp = level >= 10 ? 0 : Math.max(0, nextThreshold - xp);

  return {
    level,
    xp,
    completedBeforeExpiry,
    percent,
    remainingXp
  };
}

function normalizeGrowthProfile(profile) {
  if (!profile || typeof profile !== "object") return null;
  const level = Number(profile.level);
  const xp = Number(profile.xp);
  if (!Number.isFinite(level) || !Number.isFinite(xp)) return null;
  return {
    level: Math.min(10, Math.max(1, Math.round(level))),
    xp: Math.max(0, Math.round(xp)),
    completedBeforeExpiry: Math.max(0, Math.round(Number(profile.completedBeforeExpiry || 0))),
    percent: Math.min(100, Math.max(0, Math.round(Number(profile.percent || 0)))),
    remainingXp: Math.max(0, Math.round(Number(profile.remainingXp || 0)))
  };
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
  dashboardStatsCard: {
    flexDirection: "row",
    minHeight: 74,
    borderRadius: 18,
    backgroundColor: "#fff",
    marginTop: 14,
    paddingVertical: 10,
    shadowColor: "#0d3f2e",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2
  },
  dashboardStat: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4
  },
  dashboardStatDivider: {
    borderRightWidth: 1,
    borderRightColor: "#efe9df"
  },
  dashboardStatLabelRow: {
    minHeight: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4
  },
  dashboardStatIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center"
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
  dashboardStatIcon: {
    width: 14,
    height: 14,
    tintColor: "#fff"
  },
  dashboardStatLabel: {
    ...typography.captionStrong,
    color: "#617068",
  },
  dashboardStatValueRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    marginTop: 6
  },
  dashboardStatValue: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "900"
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
  dashboardStatUnit: {
    ...typography.captionStrong,
    color: "#68716b",
    marginLeft: 2,
    marginBottom: 2
  },
  growthCard: {
    borderRadius: 18,
    backgroundColor: "#fff",
    marginTop: 0,
    padding: 16,
    position: "relative",
    shadowColor: "#0d3f2e",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 1
  },
  growthHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingRight: 112
  },
  growthEyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 7
  },
  growthEyebrowPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#e8f7ef",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginLeft: -4
  },
  growthEyebrow: {
    ...typography.captionStrong,
    color: "#1f7a5a",
    fontSize: 11
  },
  growthEyebrowLeaf: {
    ...typography.captionStrong,
    color: "#9bd9b4",
    fontSize: 10
  },
  growthTitle: {
    ...typography.cardTitle,
    color: "#18201c",
  },
  growthTitleMeaning: {
    ...typography.bodyStrong,
    color: "#68716b"
  },
  growthLevelImage: {
    position: "absolute",
    top: 5,
    right: 10,
    width: 140,
    height: 140
  },
  growthMessage: {
    ...typography.bodyStrong,
    color: "#14583f",
    marginTop: 14
  },
  growthText: {
    ...typography.caption,
    color: "#68716b",
    marginTop: 4
  },
  growthProgressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#edf0ec",
    overflow: "hidden",
    marginTop: 14
  },
  growthProgressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#1f7a5a"
  },
  growthFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8
  },
  growthFooterText: {
    ...typography.captionStrong,
    color: "#68716b",
  },
  growthRankingBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#e8f7ef",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    overflow: "hidden"
  },
  growthRankingBadgeShine: {
    position: "absolute",
    top: -8,
    bottom: -8,
    left: 0,
    width: 10,
    backgroundColor: "rgba(255,255,255,0.65)"
  },
  growthRankingBadgeIcon: {
    fontSize: 11
  },
  growthRankingBadgeText: {
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
  rankingCartIcon: {
    width: 15,
    height: 15,
    tintColor: "#1f7a5a"
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
  // 섹션 제목입니다. 예: "이번 주 먼저 먹을 것", "최근 추가한 상품".
  sectionTitle: {
    ...typography.sectionTitle,
    color: "#18201c",
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
  purchaseButtonText: {
    ...typography.captionStrong,
    color: "#fff",
  },
  purchaseButtonTextMuted: {
    color: "#68716b"
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
  // 최근 추가한 상품 목록을 감싸는 흰색 리스트 카드입니다.
  recentList: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e6e4df",
    backgroundColor: "#fff",
    overflow: "hidden"
  },
  // 최근 추가한 상품 한 줄입니다.
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
  // 최근 목록 오른쪽 D-day 텍스트입니다.
  recentDay: {
    ...typography.label,
    color: "#ef8b1f",
  },
  // 상품이 없을 때 보여주는 빈 카드입니다.
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
  // 가로 전체를 쓰는 빈 카드입니다. 최근 목록이 비었을 때 사용됩니다.
  emptyWideCard: {
    minHeight: 96,
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
