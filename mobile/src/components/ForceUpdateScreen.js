import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";

export default function ForceUpdateScreen({ playStoreUrl }) {
  function openStore() {
    const url = String(playStoreUrl || "").trim();
    if (!url) return;
    Linking.openURL(url).catch(() => {});
  }

  return (
    <View style={styles.screen} pointerEvents="auto">
      <Image source={require("../../assets/splash-icon.png")} resizeMode="contain" style={styles.icon} />
      <Text style={styles.title}>새 버전이 나왔어요</Text>
      <Text style={styles.body}>
        더 안정적으로 이용하실 수 있도록 업데이트가 필요합니다.{"\n"}
        업데이트 후 계속 이용해 주세요.
      </Text>
      <Pressable style={styles.button} onPress={openStore}>
        <Text style={styles.buttonText}>Play 스토어에서 업데이트</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    elevation: 40,
    backgroundColor: "#fbfcfb",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32
  },
  icon: {
    width: 120,
    height: 120,
    marginBottom: 20
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#18201c",
    marginBottom: 10
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: "#68716b",
    textAlign: "center",
    marginBottom: 24
  },
  button: {
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: "#1f7a5a",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff"
  }
});
