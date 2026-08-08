import { Linking, Modal, Pressable, Text, View, StyleSheet } from "react-native";

// 강제 업데이트(ForceUpdateScreen)와 다르게, 새 버전이 있다는 걸 알려주기만 하고
// "나중에"를 누르면 그냥 앱을 계속 쓸 수 있다. 매 실행마다 다시 물어본다(2026-08-08,
// 사용자 요청 — Play 스토어 자동 업데이트가 항상 되는 게 아니라서 앱 쪽에서도 권유).
export default function SoftUpdatePrompt({ visible, playStoreUrl, onLater }) {
  function openStore() {
    const url = String(playStoreUrl || "").trim();
    if (url) Linking.openURL(url).catch(() => {});
    onLater?.();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onLater}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>새 버전이 있어요 ✨</Text>
          <Text style={styles.title}>더 나아진 오늘까지야를 만나보세요</Text>
          <Text style={styles.body}>
            지금 업데이트하지 않아도 앱은 계속 쓸 수 있어요. 준비되면 언제든 업데이트해 주세요.
          </Text>
          <View style={styles.buttonRow}>
            <Pressable style={styles.laterButton} onPress={onLater}>
              <Text style={styles.laterButtonText}>나중에</Text>
            </Pressable>
            <Pressable style={styles.updateButton} onPress={openStore}>
              <Text style={styles.updateButtonText}>지금 업데이트</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.48)",
    justifyContent: "center",
    paddingHorizontal: 16
  },
  card: {
    borderRadius: 22,
    backgroundColor: "#fff",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 }
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1f7a5a",
    marginBottom: 4
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#18201c",
    marginBottom: 8
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: "#68716b",
    marginBottom: 18
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10
  },
  laterButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#c7d4cd",
    alignItems: "center",
    justifyContent: "center"
  },
  laterButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#4c574f"
  },
  updateButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: "#1f7a5a",
    alignItems: "center",
    justifyContent: "center"
  },
  updateButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff"
  }
});
