import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

export default function LaunchScreen({ onDone }) {
  const opacity = useSharedValue(1);
  const markOpacity = useSharedValue(0);
  const markScale = useSharedValue(0.86);
  const markY = useSharedValue(18);
  const textOpacity = useSharedValue(0);
  const textY = useSharedValue(12);
  const progress = useSharedValue(0);

  useEffect(() => {
    markOpacity.value = withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) });
    markScale.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.back(1.1)) });
    markY.value = withTiming(0, { duration: 520, easing: Easing.out(Easing.cubic) });
    textOpacity.value = withDelay(260, withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) }));
    textY.value = withDelay(260, withTiming(0, { duration: 360, easing: Easing.out(Easing.cubic) }));
    progress.value = withDelay(280, withTiming(1, { duration: 980, easing: Easing.inOut(Easing.cubic) }));
    opacity.value = withDelay(1420, withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(onDone)();
    }));
  }, [markOpacity, markScale, markY, onDone, opacity, progress, textOpacity, textY]);

  const screenStyle = useAnimatedStyle(() => ({
    opacity: opacity.value
  }));
  const markStyle = useAnimatedStyle(() => ({
    opacity: markOpacity.value,
    transform: [{ translateY: markY.value }, { scale: markScale.value }]
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textY.value }]
  }));
  const progressStyle = useAnimatedStyle(() => ({
    width: 116 * progress.value
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.launchScreen, screenStyle]}>
      <Animated.Image source={require("../../assets/splash-icon.png")} style={[styles.launchIcon, markStyle]} resizeMode="contain" />
      <Animated.View style={[styles.launchCopy, textStyle]}>
        <Text style={styles.launchTitle}>오늘까지야</Text>
        <Text style={styles.launchSubtitle}>소비기한을 놓치지 않게</Text>
      </Animated.View>
      <View style={styles.launchProgressTrack}>
        <Animated.View style={[styles.launchProgressFill, progressStyle]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  launchScreen: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    elevation: 30,
    backgroundColor: "#f5f2eb",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28
  },
  launchIcon: {
    width: 190,
    height: 190,
    marginBottom: 14
  },
  launchCopy: {
    alignItems: "center"
  },
  launchTitle: {
    color: "#18201c",
    fontSize: 31,
    fontWeight: "900"
  },
  launchSubtitle: {
    color: "#14583f",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 6
  },
  launchProgressTrack: {
    width: 116,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#d9e9e2",
    marginTop: 26,
    overflow: "hidden"
  },
  launchProgressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#1f7a5a"
  }
});
