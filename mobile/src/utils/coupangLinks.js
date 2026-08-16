import { Alert, Linking } from "react-native";
import { COUPANG_ORDER_HISTORY_URL } from "../constants/purchase";

// canOpenURL은 Android 11+ 패키지 가시성 정책 때문에 실제로 열리는 링크도 false를
// 반환하는 경우가 흔해서(InventoryList.js의 openPurchaseLink와 동일한 이유), 사전
// 체크 없이 바로 열고 실패하면 그때 안내한다. 쿠팡 앱이 깔려 있으면 App Links가
// 가로채 앱의 주문내역 화면으로 바로 연결되고, 없으면 모바일 웹 로그인 화면으로 연결된다.
// AddItemPage(사진등록 진입점)와 HomePage(홈 바로가기 카드)가 같이 쓰므로 공용 유틸로 둔다.
export async function openCoupangOrderHistory() {
  try {
    await Linking.openURL(COUPANG_ORDER_HISTORY_URL);
  } catch {
    Alert.alert("링크 열기 실패", "쿠팡 주문내역 페이지를 열 수 없습니다.");
  }
}
