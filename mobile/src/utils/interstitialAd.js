import { AdEventType, InterstitialAd, TestIds } from "react-native-google-mobile-ads";

// 실제 AdMob 전면 광고 단위 ID가 생기면 EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID로 교체한다.
const interstitialAdUnitId = process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID || TestIds.INTERSTITIAL;
// 저장할 때마다 매번 뜨면 거슬리므로, 이 횟수마다 한 번만 노출한다.
const SHOW_EVERY_N_TRIGGERS = 1;
let triggerCount = 0;

// 전면 광고는 미리 로드해둬야 show() 시점에 바로 뜬다. 한 번 보여주면 재사용이 안 되므로
// 닫힐 때마다 다음 노출을 위해 새로 로드한다.
const interstitial = InterstitialAd.createForAdRequest(interstitialAdUnitId);
let isLoaded = false;

interstitial.addAdEventListener(AdEventType.LOADED, () => {
  isLoaded = true;
});
interstitial.addAdEventListener(AdEventType.CLOSED, () => {
  isLoaded = false;
  interstitial.load();
});
interstitial.addAdEventListener(AdEventType.ERROR, () => {
  isLoaded = false;
});

interstitial.load();

export function showInterstitialAd() {
  triggerCount += 1;
  if (triggerCount % SHOW_EVERY_N_TRIGGERS !== 0) return;
  if (isLoaded) interstitial.show();
}
