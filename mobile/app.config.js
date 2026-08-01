const kakaoNativeAppKey = process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY || "";
// 구글 공식 테스트용 AdMod 앱 ID. 실제 AdMob 계정이 생기면
// EXPO_PUBLIC_ADMOB_ANDROID_APP_ID로 교체한다.
const admobAndroidAppId = process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID || "ca-app-pub-3940256099942544~3347511713";

module.exports = ({ config }) => {
  const plugins = [
    ...(config.plugins || []),
    "expo-video",
    [
      "react-native-google-mobile-ads",
      {
        androidAppId: admobAndroidAppId
      }
    ],
    [
      "@react-native-seoul/naver-login",
      {
        urlScheme: "freshkeeper-naver"
      }
    ]
  ];

  if (kakaoNativeAppKey) {
    plugins.push([
      "@react-native-kakao/core",
      {
        nativeAppKey: kakaoNativeAppKey,
        android: {
          authCodeHandlerActivity: true
        }
      }
    ]);
  }

  return {
    ...config,
    plugins
  };
};
