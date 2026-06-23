import { useState } from "react";
import { Alert, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { daysUntil, itemCreatedDate } from "../utils/date";
import { getFoodImageSource } from "../utils/foodImages";
import AdSlot from "./AdSlot";

const homeHeroIcon = require("../../assets/home-app-symbol.png");

export default function HomePage({
  width,
  items,
  summary,
  reminderDays,
  onOpenInventory,
  onOpenAdd,
  onChangeItemImage
}) {
  const [repurchasePanelVisible, setRepurchasePanelVisible] = useState(false);
  const urgentItems = [...items]
    .sort((a, b) => daysUntil(a.expiry) - daysUntil(b.expiry))
    .slice(0, 3);
  const recentItems = [...items]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 4);
  const heroStatus = getHeroStatus(summary);

  return (
    <ScrollView style={{ width }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <Pressable style={styles.heroPrimary} onPress={() => onOpenInventory("all")}>
            <Text style={styles.heroLabel}>보관 중인 상품</Text>
            <Text style={styles.heroValue}>{summary.total}</Text>
          </Pressable>
          <View style={styles.fridgeTile}>
            <Image source={homeHeroIcon} resizeMode="contain" style={styles.fridgeImage} />
            <View style={[styles.heroStatusBadge, styles[heroStatus.style]]}>
              <Text style={styles.heroStatusText}>{heroStatus.text}</Text>
            </View>
          </View>
        </View>
        <View style={styles.heroStats}>
          <Pressable style={[styles.heroStat, styles.heroStatDivider]} onPress={() => onOpenInventory("urgent")}>
            <View style={styles.heroStatLabelRow}>
              <Text style={styles.heroStatIcon}>!</Text>
              <Text style={styles.heroStatLabel}>임박</Text>
            </View>
            <Text style={styles.heroStatValue}>{summary.urgent}</Text>
          </Pressable>
          <Pressable style={[styles.heroStat, styles.heroStatDivider]} onPress={() => onOpenInventory("expired")}>
            <View style={styles.heroStatLabelRow}>
              <Text style={[styles.heroStatIcon, styles.heroStatIconDanger]}>x</Text>
              <Text style={styles.heroStatLabel}>만료</Text>
            </View>
            <Text style={styles.heroStatValue}>{summary.expired}</Text>
          </Pressable>
          <Pressable style={styles.heroStat} onPress={() => onOpenInventory("today")}>
            <View style={styles.heroStatLabelRow}>
              <Text style={[styles.heroStatIcon, styles.heroStatIconCalendar]}>▦</Text>
              <Text style={styles.heroStatLabel}>오늘 만료</Text>
            </View>
            <Text style={styles.heroStatValue}>{summary.today}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>이번 주 먼저 먹을 것</Text>
        <Pressable onPress={() => setRepurchasePanelVisible((current) => !current)}>
          <Text style={styles.moreText}>{repurchasePanelVisible ? "접기" : "다시 구매 >"}</Text>
        </Pressable>
      </View>
      <View style={styles.priorityRow}>
        {urgentItems.length ? (
          urgentItems.map((item) => (
            <PriorityCard key={item.id} item={item} onChangeItemImage={onChangeItemImage} />
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>급한 상품이 없습니다</Text>
            <Text style={styles.emptyText}>소비기한이 임박하면 여기에 먼저 보여드릴게요.</Text>
          </View>
        )}
      </View>

      {repurchasePanelVisible ? (
        <RepurchasePanel items={urgentItems} onOpenInventory={() => onOpenInventory("urgent")} />
      ) : null}

      <AdSlot variant="home" style={styles.homeAdSlot} />

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
    </ScrollView>
  );
}

function RepurchasePanel({ items, onOpenInventory }) {
  if (!items.length) {
    return (
      <View style={styles.repurchasePanel}>
        <Text style={styles.repurchasePanelTitle}>다시 살 상품이 아직 없습니다</Text>
        <Text style={styles.repurchasePanelText}>임박 상품이 생기면 구매 링크를 바로 열 수 있어요.</Text>
      </View>
    );
  }

  return (
    <View style={styles.repurchasePanel}>
      <View style={styles.repurchasePanelHeader}>
        <View>
          <Text style={styles.repurchasePanelTitle}>임박 상품 다시 구매</Text>
          <Text style={styles.repurchasePanelText}>구매 링크가 있는 상품은 바로 열 수 있어요. 가격 추세는 플레이스토어 등록 후 준비할게요.</Text>
        </View>
        <Pressable onPress={onOpenInventory}>
          <Text style={styles.repurchasePanelMore}>보관함</Text>
        </Pressable>
      </View>
      <View style={styles.repurchaseList}>
        {items.map((item) => (
          <RepurchaseItem key={item.id} item={item} />
        ))}
      </View>
    </View>
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
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert("링크 열기 실패", "이 링크를 열 수 없습니다.");
      return;
    }
    Linking.openURL(url);
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
        <Pressable style={[styles.purchaseButton, !item.purchaseUrl && styles.purchaseButtonMuted]} onPress={openPurchaseUrl}>
          <Text style={[styles.purchaseButtonText, !item.purchaseUrl && styles.purchaseButtonTextMuted]}>
            {item.purchaseUrl ? "구매 링크 열기" : "구매 링크 등록 필요"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function PriorityCard({ item, onChangeItemImage }) {
  const days = daysUntil(item.expiry);
  return (
    <View style={styles.priorityCard}>
      <View style={styles.priorityTopRow}>
        <Pressable onLongPress={() => onChangeItemImage?.(item.id)} delayLongPress={350}>
          <Image source={getFoodImageSource(item)} resizeMode="cover" style={styles.itemImage} />
        </Pressable>
        <Text style={styles.storagePill}>{item.storage}</Text>
      </View>
      <Text style={styles.priorityName} numberOfLines={2}>{item.name}</Text>
      <Text style={[styles.dDay, days <= 1 && styles.dDayDanger]}>{labelForDays(days)}</Text>
    </View>
  );
}

function RecentItem({ item, onChangeItemImage }) {
  const days = daysUntil(item.expiry);
  return (
    <View style={styles.recentItem}>
      <Pressable onLongPress={() => onChangeItemImage?.(item.id)} delayLongPress={350}>
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

function getHeroStatus(summary) {
  if (summary.expired > 0) {
    return { text: "정리가 필요해요", style: "heroStatusExpired" };
  }
  if (summary.today > 0) {
    return { text: "오늘 확인해요", style: "heroStatusToday" };
  }
  if (summary.urgent > 0) {
    return { text: "먼저 먹을 게 있어요", style: "heroStatusUrgent" };
  }
  return { text: "괜찮아요", style: "heroStatusSafe" };
}

const styles = StyleSheet.create({
  // 홈 화면 전체 여백입니다. 배너/목록의 좌우 여백과 하단 탭에 가리지 않는 아래 여백을 조정합니다.
  page: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === "android" ? 126 : 104
  },
  // 초록색 상단 배너 카드입니다. 배너 높이, 둥근 모서리, 그림자, 내부 여백을 담당합니다.
  heroCard: {
    position: "relative",
    minHeight: 168,
    borderRadius: 16,
    backgroundColor: "#237b58",
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    marginTop: 0,
    overflow: "hidden",
    shadowColor: "#0d3f2e",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 4
  },
  // 배너 위쪽 영역입니다. 왼쪽 숫자 영역과 오른쪽 냉장고 이미지를 한 줄에 배치합니다.
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    minHeight: 82
  },
  // 배너 왼쪽의 "보관 중인 상품"과 전체 개수 영역입니다. 클릭하면 보관함 전체로 이동합니다.
  heroPrimary: {
    minHeight: 76,
    justifyContent: "flex-start"
  },
  // 배너의 작은 설명 텍스트입니다. 예: "보관 중인 상품".
  heroLabel: {
    color: "#d8f0e7",
    fontSize: 13,
    fontWeight: "800"
  },
  // 배너의 큰 숫자입니다. 보관 중인 상품 개수를 표시합니다.
  heroValue: {
    color: "#fff",
    fontSize: 46,
    fontWeight: "900",
    marginTop: 4,
    marginLeft: 20
  },
  heroStatusBadge: {
    alignSelf: "center",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginTop: -8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    backgroundColor: "rgba(255,255,255,0.14)"
  },
  heroStatusText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "900"
  },
  heroStatusSafe: {
    backgroundColor: "rgba(255,255,255,0.15)"
  },
  heroStatusUrgent: {
    backgroundColor: "rgba(239,179,60,0.22)"
  },
  heroStatusToday: {
    backgroundColor: "rgba(109,144,242,0.24)"
  },
  heroStatusExpired: {
    backgroundColor: "rgba(236,91,84,0.24)"
  },
  // 배너 하단의 임박/만료/오늘 만료 통계 줄입니다.
  heroStats: {
    flexDirection: "row",
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.18)",
    paddingTop: 8
  },
  // 배너 하단 통계 한 칸입니다. 세 칸이 같은 너비로 나뉩니다.
  heroStat: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  // 통계 칸 사이의 세로 구분선입니다.
  heroStatDivider: {
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,0.13)"
  },
  // 통계 이름 텍스트입니다. 예: 임박, 만료, 오늘 만료.
  heroStatLabel: {
    color: "#d8f0e7",
    fontSize: 12,
    fontWeight: "800"
  },
  // 통계 아이콘과 텍스트를 가로로 붙이는 줄입니다.
  heroStatLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  // 통계 앞의 작은 원형 아이콘 기본 스타일입니다. 임박 아이콘에 사용됩니다.
  heroStatIcon: {
    width: 15,
    height: 15,
    borderRadius: 8,
    overflow: "hidden",
    textAlign: "center",
    textAlignVertical: "center",
    color: "#fff",
    backgroundColor: "#efb33c",
    fontSize: 9,
    fontWeight: "900"
  },
  // 만료 통계 아이콘 색상입니다.
  heroStatIconDanger: {
    backgroundColor: "#ec5b54"
  },
  // 오늘 만료 통계 아이콘 색상입니다.
  heroStatIconCalendar: {
    backgroundColor: "#6d90f2",
    fontSize: 9
  },
  // 통계 숫자입니다. 임박/만료/오늘 만료 개수를 표시합니다.
  heroStatValue: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 3
  },
  // 배너 오른쪽 상태 캐릭터 영역입니다. 위치를 바꾸려면 right/top을 조정합니다.
  fridgeTile: {
    position: "absolute",
    right: 5,
    top: -10,
    width: 112,
    height: 106,
    alignItems: "center",
    justifyContent: "flex-start"
  },
  // 상태 캐릭터 이미지 크기입니다.
  fridgeImage: {
    width: 75,
    height: 75,
    opacity: 0.92
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
    color: "#18201c",
    fontSize: 18,
    fontWeight: "900"
  },
  // 오른쪽 "더보기 >" 텍스트입니다.
  moreText: {
    color: "#68716b",
    fontSize: 13,
    fontWeight: "900"
  },
  // "이번 주 먼저 먹을 것" 카드 3개를 가로로 배치하는 줄입니다.
  priorityRow: {
    flexDirection: "row",
    gap: 10
  },
  homeAdSlot: {
    marginTop: 18
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
    color: "#18201c",
    fontSize: 15,
    fontWeight: "900"
  },
  repurchasePanelText: {
    color: "#68716b",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5
  },
  repurchasePanelMore: {
    color: "#1f7a5a",
    fontSize: 12,
    fontWeight: "900",
    paddingTop: 2
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
    flex: 1,
    color: "#18201c",
    fontSize: 14,
    fontWeight: "900"
  },
  repurchaseDday: {
    color: "#ef8b1f",
    fontSize: 13,
    fontWeight: "900"
  },
  repurchaseMeta: {
    color: "#68716b",
    fontSize: 12,
    marginTop: 4
  },
  purchaseButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#1f7a5a",
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 9
  },
  purchaseButtonMuted: {
    backgroundColor: "#eef4f1"
  },
  purchaseButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900"
  },
  purchaseButtonTextMuted: {
    color: "#68716b"
  },
  // 이번 주 카드 한 장입니다. 카드 높이, 테두리, 내부 여백을 담당합니다.
  priorityCard: {
    flex: 1,
    minHeight: 138,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e6e4df",
    backgroundColor: "#fff",
    padding: 12
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
    color: "#18201c",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 12,
    minHeight: 38
  },
  // D-day 텍스트입니다. 기본은 주황색이고, 만료/당일은 아래 dDayDanger가 덮어씁니다.
  dDay: {
    color: "#ef8b1f",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 5
  },
  // 위험 상태 D-day 색상입니다. 예: 오늘, D+1.
  dDayDanger: {
    color: "#e54135"
  },
  // 냉장/냉동/실온 같은 보관 위치 배지입니다.
  storagePill: {
    alignSelf: "flex-start",
    color: "#1f7a5a",
    backgroundColor: "#edf7f2",
    borderRadius: 6,
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 3,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 2
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
    color: "#18201c",
    fontSize: 15,
    fontWeight: "900"
  },
  // 최근 목록의 보관 위치와 등록일 텍스트입니다.
  recentMeta: {
    color: "#68716b",
    fontSize: 12,
    marginTop: 4
  },
  // 최근 목록 오른쪽 D-day 텍스트입니다.
  recentDay: {
    color: "#ef8b1f",
    fontSize: 14,
    fontWeight: "900"
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
    color: "#18201c",
    fontSize: 15,
    fontWeight: "900"
  },
  // 빈 카드의 설명 문구입니다.
  emptyText: {
    color: "#68716b",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6
  }
});
