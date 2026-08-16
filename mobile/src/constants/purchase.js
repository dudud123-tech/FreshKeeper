export const DEFAULT_PURCHASE_URL = "https://www.coupang.com/np/categories/393760";
// 로그인 안 된 상태로 열면 login.pang이 이 주소를 rtnUrl로 받아 로그인 후 그대로
// 되돌려준다(2026-08-13 확인) — 쿠팡 개인 구매자용 주문내역 페이지의 실제 경로다.
// 앱이 설치돼 있으면 안드로이드 App Links가 가로채 쿠팡 앱 주문내역 화면으로 바로 연결된다.
export const COUPANG_ORDER_HISTORY_URL = "https://mc.coupang.com/ssr/mobile/order/list";
