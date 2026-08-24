import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { typography } from "../theme/typography";
import { statusFor } from "../utils/date";
import { getFoodImageSource } from "../utils/foodImages";
import { completionTimingLabel, createdDateLabel } from "../utils/itemLabels";
import { planBadgeLabel } from "../utils/mealPlan";

// 상품명을 누르면 뜨는 큰 카드 팝업. 보관함과 먹는 일정 두 화면이 같이 쓴다.
// 시력이 좋지 않은 사용자를 염두에 두고 사진을 크게 보여주는 게 목적이라,
// 목록에서는 62px로만 보이던 사진을 여기서 제대로 보여준다.
//
// onEdit은 화면마다 다르다 — 보관함에서는 상품 수정 시트를, 일정 화면에서는
// 일정 바꾸기를 연다. 그래서 버튼 문구도 editLabel로 받는다.
export default function ItemDetailModal({
  item,
  baseline = null,
  expiryType = "소비기한",
  completedScope = false,
  editLabel = "수정하기",
  onClose,
  onEdit
}) {
  if (!item) return null;

  const rows = buildRows(item, expiryType, completedScope);
  // baseline은 수정 시트를 열기 직전의 값이다. 방금 무엇을 고쳤는지 빨간색으로
  // 짚어주면 저장이 제대로 됐는지 눈으로 바로 확인할 수 있다(2026-08-24).
  const baseRows = baseline ? buildRows(baseline, expiryType, completedScope) : null;
  const changedValue = (key, value) => {
    if (!baseRows) return false;
    const prev = baseRows.find((row) => row.key === key);
    return prev ? prev.value !== value : false;
  };
  const nameChanged = Boolean(baseline) && String(baseline.name || "") !== String(item.name || "");
  const memoChanged = Boolean(baseline) && String(baseline.memo || "").trim() !== String(item.memo || "").trim();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropFill} onPress={onClose} />
        <View style={styles.card}>
          {/* 평소에는 내용이 카드 한 장에 다 들어와 스크롤이 생기지 않는다.
              다만 시스템 글꼴을 크게 쓰는 사용자(이 팝업이 겨냥하는 바로 그
              사용자다)나 메모가 긴 경우까지 잘리면 안 되므로 ScrollView로
              감싸 둔다. 버튼은 바깥에 있어 항상 닿는다. */}
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} bounces={false}>
            {/* 사진 소스가 전부 정사각형이라(카테고리 기본 256x256, 사용자 사진도
                itemImagePicker의 aspect [1,1]) 박스도 정사각으로 둔다. 가로로 긴
                박스에 cover를 걸면 위아래가 잘린다. contain은 혹시 비정사각
                사진이 들어와도 잘리지 않게 하는 보험이다. */}
            <Image source={getFoodImageSource(item)} resizeMode="contain" style={styles.image} />
            <Text style={[styles.name, nameChanged && styles.changed]} numberOfLines={2}>
              {String(item.name || "")}
            </Text>
            {rows.map((row) => (
              <View key={row.key} style={styles.row}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={[styles.rowValue, changedValue(row.key, row.value) && styles.changed]}>
                  {row.value}
                </Text>
              </View>
            ))}
            {item.memo?.trim() ? (
              <View style={styles.memoBox}>
                <Text style={styles.rowLabel}>메모</Text>
                <Text style={[styles.memoText, memoChanged && styles.changed]} numberOfLines={3}>{item.memo.trim()}</Text>
              </View>
            ) : null}
          </ScrollView>
          <View style={styles.actions}>
            <Pressable style={[styles.button, styles.buttonGhost]} onPress={onClose} accessibilityRole="button">
              <Text style={styles.buttonGhostText}>닫기</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.buttonPrimary]} onPress={onEdit} accessibilityRole="button">
              <Text style={styles.buttonPrimaryText}>{editLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// 표시할 줄을 만든다. 바뀐 값을 찾으려면 지금 값과 예전 값을 같은 방식으로
// 만들어 비교해야 해서 함수로 뺐다.
function buildRows(item, expiryType, completedScope) {
  const status = statusFor(item);
  const planLabel = planBadgeLabel(item);
  const expiryValue = item.expiry || "-";
  const rows = [
    // D-day는 소비기한 옆 괄호에 붙인다. 따로 뱃지로 두면 같은 정보가 화면에
    // 두 번 나온다(2026-08-24).
    { key: "expiry", label: expiryType, value: item.expiry ? `${expiryValue} (${status.label})` : expiryValue },
    { key: "storage", label: "보관", value: item.storage || "-" },
    { key: "category", label: "카테고리", value: item.category || "-" },
    { key: "createdAt", label: "등록일", value: createdDateLabel(item) }
  ];
  if (planLabel) rows.push({ key: "plan", label: "먹을 날", value: planLabel });
  if (completedScope) rows.push({ key: "completed", label: "완료", value: completionTimingLabel(item) });
  return rows;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
    backgroundColor: "rgba(24, 32, 28, 0.55)"
  },
  backdropFill: {
    ...StyleSheet.absoluteFillObject
  },
  card: {
    width: "100%",
    maxHeight: "92%",
    borderRadius: 22,
    backgroundColor: "#fff",
    overflow: "hidden"
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 4
  },
  // 정사각형입니다. 카테고리 기본 이미지가 256px뿐이라 이보다 크게 잡으면 뭉갭니다.
  image: {
    alignSelf: "center",
    width: 200,
    height: 200,
    borderRadius: 16,
    backgroundColor: "#f3f6f4"
  },
  name: {
    ...typography.screenTitle,
    color: "#18201c",
    marginTop: 14,
    marginBottom: 4
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f2f0"
  },
  rowLabel: {
    ...typography.body,
    color: "#77807a"
  },
  rowValue: {
    ...typography.label,
    color: "#18201c",
    flexShrink: 1,
    textAlign: "right"
  },
  memoBox: {
    marginTop: 12,
    gap: 4
  },
  memoText: {
    ...typography.body,
    color: "#2f3a34"
  },
  // 방금 수정한 값입니다. 저장이 제대로 됐는지 눈으로 바로 확인하라고 짚어줍니다.
  changed: {
    color: "#c0392b"
  },
  // 버튼은 손가락으로 누르기 쉽게 높이를 넉넉히 잡습니다.
  actions: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#eef1ef"
  },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  buttonGhost: {
    borderWidth: 1,
    borderColor: "#d7ddd9",
    backgroundColor: "#fff"
  },
  buttonGhostText: {
    ...typography.label,
    fontSize: 16,
    color: "#46514a"
  },
  buttonPrimary: {
    backgroundColor: "#1f7a5a"
  },
  buttonPrimaryText: {
    ...typography.label,
    fontSize: 16,
    color: "#fff"
  }
});
