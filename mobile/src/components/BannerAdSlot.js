import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";
import { StyleSheet, View } from "react-native";

// 실제 AdMob 광고 단위 ID가 생기면 EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID로 교체한다.
// 그전까지는 구글 공식 테스트 배너 ID를 사용한다(심사 없이 바로 동작 확인 가능).
// 테스트 광고에 붙는 굵은 "테스트 광고" 표시줄은 구글이 테스트 단위에만 자동으로
// 붙이는 워터마크로, 실제 광고 단위 ID로 바꾸면 사라진다 — 우리가 스타일링할 수 없는 부분이다.
// 배너(네이티브 아닌) 광고는 애드몹 정책상 퍼블리셔가 별도로 "광고" 표시를 붙일 의무가 없다.
const bannerAdUnitId = process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID || TestIds.BANNER;

export default function BannerAdSlot() {
  return (
    <View style={styles.strip}>
      <BannerAd unitId={bannerAdUnitId} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    marginTop: 16,
    alignItems: "center"
  }
});
