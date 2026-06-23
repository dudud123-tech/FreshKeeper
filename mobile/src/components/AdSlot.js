import { StyleSheet, Text, View } from "react-native";

const adCopy = {
  home: {
    title: "오늘 장보기 전에 확인해보세요",
    body: "나중에는 보관 중인 상품과 어울리는 생활 광고가 표시됩니다."
  },
  inventory: {
    title: "필요한 상품을 놓치지 않게",
    body: "자주 사는 상품과 연결된 추천 광고가 이 자리에 들어갑니다."
  },
  default: {
    title: "추천 영역",
    body: "광고 제거 구독을 켜면 이 영역은 보이지 않습니다."
  }
};

export default function AdSlot({ variant = "default", style }) {
  const content = adCopy[variant] || adCopy.default;

  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <Text style={styles.badge}>광고</Text>
        <Text style={styles.title}>{content.title}</Text>
      </View>
      <Text style={styles.body}>{content.body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e3ebe6",
    backgroundColor: "#f8fbf9",
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  badge: {
    color: "#1f7a5a",
    backgroundColor: "#e8f4ee",
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 10,
    fontWeight: "900"
  },
  title: {
    flex: 1,
    color: "#18201c",
    fontSize: 13,
    fontWeight: "900"
  },
  body: {
    color: "#68716b",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7
  }
});
