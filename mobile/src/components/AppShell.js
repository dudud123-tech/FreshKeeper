import { StatusBar } from "expo-status-bar";
import { Children } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { typography } from "../theme/typography";

// 하단 탭 메뉴 정의입니다. page 번호는 ScrollView의 페이지 순서와 맞아야 합니다.
const bottomNavItems = [
  { page: 0, icon: require("../../assets/tabs/home_80dp.png"), label: "홈", title: "" },
  { page: 1, icon: require("../../assets/tabs/add_80dp.png"), label: "등록", title: "상품 등록" },
  { page: 2, icon: require("../../assets/tabs/kitchen.png"), label: "보관함", title: "보관함" },
  { page: 3, icon: require("../../assets/tabs/settings_80d.png"), label: "설정", title: "설정" }
];

// 앱 전체 화면 뼈대입니다. 상단 헤더, 좌우 페이지 전환 영역, 하단 탭을 담당합니다.
export default function AppShell({
  page,
  onPageChange,
  hideBottomNav = false,
  children,
  overlays
}) {
  return (
    <SafeAreaProvider>
      <AppShellLayout
        page={page}
        onPageChange={onPageChange}
        hideBottomNav={hideBottomNav}
        overlays={overlays}
      >
        {children}
      </AppShellLayout>
    </SafeAreaProvider>
  );
}

function AppShellLayout({
  page,
  onPageChange,
  hideBottomNav,
  children,
  overlays
}) {
  const pages = Children.toArray(children);
  const insets = useSafeAreaInsets();

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <View style={styles.safeArea}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboard}>
          <View style={[styles.container, { paddingTop: insets.top }]}>
            {page === 0 ? (
            // 홈 화면 전용 헤더입니다. 홈에서는 뒤로가기 없이 앱 이름만 중앙에 보여줍니다.
            <View style={styles.header}>
              <View style={styles.brandRow}>
                <Text style={styles.title}>오늘까지야, 놓치기 전에</Text>
              </View>
            </View>
            ) : (
              // 홈이 아닌 페이지의 헤더입니다. 왼쪽 뒤로가기, 가운데 페이지 제목, 오른쪽 빈 공간으로 균형을 맞춥니다.
              <View style={styles.pageHeader}>
                <Pressable style={styles.backButton} onPress={() => onPageChange(0)}>
                  <Text style={styles.backIcon}>‹</Text>
                </Pressable>
                <Text maxFontSizeMultiplier={1.5} numberOfLines={1} style={styles.pageTitle}>
                  {bottomNavItems.find((item) => item.page === page)?.title}
                </Text>
                <View style={styles.backButton} />
              </View>
            )}

            <View style={styles.pageSlot}>
              {pages[page]}
            </View>

            {/* 하단 고정 탭 메뉴입니다. 홈/등록/보관함/설정 페이지 이동을 담당합니다. */}
            {!hideBottomNav ? (
              <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 8) }]}>
                {bottomNavItems.map((item) => (
                  <BottomNavItem
                    key={item.page}
                    active={page === item.page}
                    icon={item.icon}
                    label={item.label}
                    onPress={() => onPageChange(item.page)}
                  />
                ))}
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
        {overlays}
      </View>
    </GestureHandlerRootView>
  );
}

// 하단 탭 버튼 한 개입니다. 아이콘과 라벨 색상은 active 상태에 따라 달라집니다.
function BottomNavItem({ active, icon, label, onPress }) {
  return (
    <Pressable
      style={styles.bottomNavItem}
      hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Image source={icon} resizeMode="contain" style={[styles.bottomNavIcon, active && styles.bottomNavIconActive]} />
    </Pressable>
  );
}

// 각 페이지 내부에서 공통으로 사용하는 레이아웃 스타일입니다.
export const appShellStyles = StyleSheet.create({
  screen: {
    flex: 1,
    alignSelf: "stretch"
  },
  // 페이지 공통 좌우 여백과 하단 탭에 가리지 않도록 주는 아래 여백입니다.
  page: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === "android" ? 104 : 88
  },
  // 예전 카드형 섹션 스타일 자리입니다. 현재는 테두리/배경을 없애고 여백만 최소화했습니다.
  section: {
    borderRadius: 8,
    borderWidth: 0,
    borderColor: "transparent",
    backgroundColor: "transparent",
    padding: 0,
    marginTop: 8
  }
});

const styles = StyleSheet.create({
  // 제스처 핸들러가 앱 전체 터치를 안정적으로 처리하도록 감싸는 최상위 영역입니다.
  gestureRoot: {
    flex: 1
  },
  // 앱 전체 배경색입니다. 모든 페이지의 바탕색 기준입니다.
  safeArea: {
    flex: 1,
    backgroundColor: "#fbfcfb"
  },
  // 키보드가 올라올 때 iOS에서 화면이 가려지지 않게 하는 영역입니다.
  keyboard: {
    flex: 1
  },
  // 실제 앱 콘텐츠 컨테이너입니다. Android 상태바 아래 시작 위치를 paddingTop으로 조정합니다.
  container: {
    flex: 1
  },
  // 홈 화면 상단 헤더입니다. 앱 이름 위치, 상단 여백, 배너와의 간격을 조정합니다.
  header: {
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginBottom: 8
  },
  // 등록/보관함/설정 페이지 상단 헤더입니다. 뒤로가기와 제목 위치를 담당합니다.
  pageHeader: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 8
  },
  // 헤더 왼쪽 뒤로가기 버튼 영역입니다. 오른쪽에도 같은 크기의 빈 View를 두어 제목을 중앙 정렬합니다.
  backButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center"
  },
  // 뒤로가기 화살표 글자 스타일입니다.
  backIcon: {
    color: "#18201c",
    fontSize: 32,
    fontWeight: "500",
    lineHeight: 34
  },
  // 등록/보관함/설정 페이지의 가운데 제목입니다.
  pageTitle: {
    ...typography.screenTitle,
    color: "#18201c",
  },
  // 홈 헤더 안에서 앱 이름을 중앙에 배치하는 줄입니다.
  brandRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  // 예전에 사용하던 보조 문구 스타일입니다. 다시 문구를 붙일 때 재사용할 수 있습니다.
  eyebrow: {
    ...typography.captionStrong,
    color: "#14583f",
    marginTop: 0
  },
  // 홈 화면 앱 이름 스타일입니다. "오 늘 까 지 야" 크기와 굵기를 조정합니다.
  title: {
    ...typography.screenTitle,
    color: "#18201c",
    lineHeight: 30,
    textAlignVertical: "center",
  },
  // 현재 선택된 페이지만 그리는 영역입니다. Android 화면 크기 설정에 따른 가로 pager 오차를 피합니다.
  pageSlot: {
    flex: 1
  },
  // 하단 탭 바 전체입니다. 높이, 위아래 여백, 상단 구분선, 배경색을 담당합니다.
  bottomNav: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: "#e7e5df",
    backgroundColor: "#fff"
  },
  // 하단 탭 버튼 한 칸입니다. 아이콘/글자의 중앙 정렬과 위아래 위치를 조정합니다.
  bottomNavItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46
  },
  // 하단 탭 아이콘 기본 크기와 비활성 색상입니다.
  bottomNavIcon: {
    width: 31,
    height: 31,
    tintColor: "#68716b"
  },
  // 현재 선택된 하단 탭 아이콘 색상입니다.
  bottomNavIconActive: {
    tintColor: "#1f7a5a"
  },
});
