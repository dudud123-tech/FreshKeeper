const kakaoNativeAppKey = process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY || "";

module.exports = ({ config }) => {
  const plugins = [
    ...(config.plugins || []),
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
