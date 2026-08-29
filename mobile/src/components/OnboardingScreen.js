import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useRef, useState } from "react";
import { Dimensions, FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 정적 require이어야 Metro가 번들에 포함시키므로 배열로 하드코딩한다.
const pages = [
  { key: "1", type: "video", source: require("../../assets/tutorial/1.mp4") },
  { key: "2", type: "video", source: require("../../assets/tutorial/2.mp4") },
  { key: "3", type: "video", source: require("../../assets/tutorial/3.mp4") },
  { key: "4", type: "video", source: require("../../assets/tutorial/4.mp4") },
  { key: "5", type: "video", source: require("../../assets/tutorial/5.mp4") },
  { key: "6", type: "image", source: require("../../assets/tutorial/6.png") }
];

const { width: screenWidth } = Dimensions.get("window");

function OnboardingVideoPage({ source, active }) {
  const player = useVideoPlayer(source, (instance) => {
    instance.loop = true;
    instance.muted = true;
  });

  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);

  return (
    <VideoView
      style={styles.media}
      player={player}
      contentFit="contain"
      nativeControls={false}
      pointerEvents="none"
    />
  );
}

export default function OnboardingScreen({ onDone }) {
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef(null);

  function handleMomentumEnd(event) {
    const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
    setActiveIndex(index);
  }

  function goToPage(index) {
    listRef.current?.scrollToIndex({ index, animated: true });
    setActiveIndex(index);
  }

  const isLastPage = activeIndex === pages.length - 1;

  return (
    <View style={styles.container}>
      <View style={styles.mediaArea}>
        <FlatList
          ref={listRef}
          data={pages}
          keyExtractor={(item) => item.key}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleMomentumEnd}
          getItemLayout={(_, index) => ({ length: screenWidth, offset: screenWidth * index, index })}
          renderItem={({ item, index }) =>
            item.type === "video" ? (
              <View style={styles.page}>
                <OnboardingVideoPage source={item.source} active={index === activeIndex} />
              </View>
            ) : (
              <View style={styles.page}>
                <Image source={item.source} style={styles.media} resizeMode="contain" />
              </View>
            )
          }
        />
      </View>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 14 }]}>
        <View style={styles.dots}>
          {pages.map((item, index) => (
            <View key={item.key} style={[styles.dot, index === activeIndex ? styles.dotActive : null]} />
          ))}
        </View>

        <View style={styles.buttonRow}>
          <Pressable style={styles.skipButton} onPress={onDone} accessibilityLabel={"건너뛰기"}>
            <Text style={styles.skipButtonText}>{"건너뛰기"}</Text>
          </Pressable>

          {isLastPage ? (
            <Pressable style={styles.startButton} onPress={onDone}>
              <Text style={styles.startButtonText}>{"시작하기"}</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.nextButton} onPress={() => goToPage(activeIndex + 1)}>
              <Text style={styles.nextButtonText}>{"다음"}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 25,
    elevation: 25,
    backgroundColor: "#fbfcfb"
  },
  mediaArea: {
    flex: 1
  },
  page: {
    width: screenWidth,
    height: "100%"
  },
  media: {
    width: "100%",
    height: "100%"
  },
  bottomBar: {
    paddingTop: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 14,
    backgroundColor: "#fbfcfb"
  },
  dots: {
    flexDirection: "row",
    gap: 7
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: "#d9e9e2"
  },
  dotActive: {
    backgroundColor: "#1f7a5a",
    width: 18
  },
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    gap: 12
  },
  skipButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#c7d4cd",
    alignItems: "center",
    justifyContent: "center"
  },
  skipButtonText: {
    color: "#4c574f",
    fontSize: 15,
    fontWeight: "700"
  },
  nextButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: "#1f7a5a",
    alignItems: "center",
    justifyContent: "center"
  },
  nextButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700"
  },
  startButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: "#1f7a5a",
    alignItems: "center",
    justifyContent: "center"
  },
  startButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700"
  }
});
