import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export default function WhatsNewModal({ visible, content, onClose }) {
  if (!content) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable style={styles.card} onPress={() => {}}>
            <Text style={styles.eyebrow}>업데이트 완료 🎉</Text>
            <Text style={styles.title}>{content.title || "새로워진 점"}</Text>
            <View style={styles.list}>
              {(content.items || []).map((item, index) => (
                <View key={index} style={styles.itemRow}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.itemText}>{item}</Text>
                </View>
              ))}
            </View>
            <Pressable style={styles.confirmButton} onPress={onClose}>
              <Text style={styles.confirmButtonText}>확인</Text>
            </Pressable>
          </Pressable>
        </ScrollView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.48)",
    justifyContent: "center"
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 12
  },
  card: {
    marginHorizontal: 16,
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
    marginBottom: 14
  },
  list: {
    gap: 10,
    marginBottom: 18
  },
  itemRow: {
    flexDirection: "row",
    gap: 8
  },
  bullet: {
    fontSize: 14,
    color: "#1f7a5a"
  },
  itemText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    color: "#18201c"
  },
  confirmButton: {
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: "#1f7a5a",
    alignItems: "center",
    justifyContent: "center"
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff"
  }
});
