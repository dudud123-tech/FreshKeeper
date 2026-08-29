import { useState } from "react";
import { Alert, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { isCoupangUrl } from "../services/coupangApi";
import { typography } from "../theme/typography";
import { statusFor } from "../utils/date";
import { getFoodImageSource } from "../utils/foodImages";
import { completionTimingLabel, createdDateLabel } from "../utils/itemLabels";
import { planBadgeLabel } from "../utils/mealPlan";

// ⚠️ 단색 글리프다(31,31,31 한 색 + 투명). 그래서 tintColor로 흰색을 입힌다 —
//    색이 들어간 일러스트가 아니므로 뭉개질 게 없다.
const cameraIcon = require("../../assets/actions/photo_camera.png");
// ⚠️ 셋 다 이미 색이 입혀진 완성형 이미지다 — tintColor를 걸면 안 된다.
//    (bookmark_on은 금색, coupang.png는 브랜드 배지)
const bookmarkOffIcon = require("../../assets/actions/bookmark_off.png");
const bookmarkOnIcon = require("../../assets/actions/bookmark_on.png");
const coupangWordmarkIcon = require("../../assets/actions/coupang2.png");
const shoppingCartIcon = require("../../assets/actions/shopping_cart_80dp.png");

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
  editLabel = "수정하기",
  // 같은 카드를 보관함과 일정 화면이 같이 쓰는데 완료의 뜻이 다르다. 보관함에서는
  // "다 먹었어요"(상품이 끝남), 홈·일정에서는 "오늘 먹었어요"(오늘 몫만 끝남).
  // 어느 쪽인지는 App.js가 정해서 문구와 동작을 같이 넘긴다(2026-08-29).
  completeLabel = "먹었어요",
  onClose,
  onEdit,
  onChangeImage,
  onToggleFavorite,
  onComplete,
  // 오늘 몫을 먹었는지는 버튼이 아니라 체크박스로 받는다. 버튼 라벨은 "누르면
  // 무슨 일이 일어나는가"를 말해야 하는데 여기 담을 건 "오늘 먹었는가"라는
  // 상태여서, 무슨 문구를 넣어도 사실 서술인지 지시인지 모호했다(2026-08-29).
  planDone = false,
  onTogglePlanDone,
  onDelete
}) {
  // 촬영/갤러리를 고르는 시트를 여기서 직접 그린다. Alert.alert로 띄우면 안드로이드
  // 네이티브 AlertDialog가 본문 영역을 비워 둔 채 자리만 차지해 위아래 여백이 크게
  // 남는데, 그 패딩은 RN에서 손댈 수 없다(2026-08-27).
  //
  // 새 Modal을 겹치지 않고 이 Modal 안에 절대배치로 얹는다 — 안드로이드에서
  // Modal 중첩은 깜빡임·닫힘 순서 문제가 잦다.
  const [sourceSheetVisible, setSourceSheetVisible] = useState(false);

  if (!item) return null;

  function chooseSource(source) {
    setSourceSheetVisible(false);
    onChangeImage?.(source);
  }

  // 목록 카드에 있던 것을 그대로 옮겨 왔다. 화면마다 openPurchaseUrl을 따로 들고
  // 있어서 프롭으로 받으면 세 화면에 다 배선해야 하는데, 하는 일이 링크 열기뿐이라
  // 여기서 직접 연다.
  async function openPurchaseUrl() {
    const rawUrl = String(item.purchaseUrl || "").trim();
    if (!rawUrl) return;
    const nextUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    try {
      // canOpenURL은 Android 11+ 패키지 가시성 정책 때문에 실제로 열리는 링크도
      // false를 반환하는 경우가 흔해서(false negative), 사전 체크 없이 바로 열고
      // 실패하면 그때 안내한다.
      await Linking.openURL(nextUrl);
    } catch {
      Alert.alert("링크 열기 실패", "이 링크를 열 수 없습니다.");
    }
  }

  const hasPurchaseUrl = Boolean(String(item.purchaseUrl || "").trim());
  const favorite = Boolean(item.favorite);

  // 완료 여부는 상품 자신이 들고 있다. 예전에는 화면이 "지금 완료 탭인가"를
  // 넘겨줬는데, 화면마다 따로 넘기다 보니 값이 어긋나기 쉬웠다.
  const completedScope = item.status === "completed";
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
          {/* 하단 줄은 값을 바꾸는 두 동작(먹었어요·수정하기)에 내주고, 닫기는
              모서리로 뺐다. 뒤로가기와 배경 탭으로도 닫히지만 제스처 내비게이션
              기기에서는 그게 눈에 보이지 않아 탈출구는 하나 남겨 둔다. */}
          <Pressable
            style={styles.closeButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="닫기"
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </Pressable>
          {/* 평소에는 내용이 카드 한 장에 다 들어와 스크롤이 생기지 않는다.
              다만 시스템 글꼴을 크게 쓰는 사용자(이 팝업이 겨냥하는 바로 그
              사용자다)나 메모가 긴 경우까지 잘리면 안 되므로 ScrollView로
              감싸 둔다. 버튼은 바깥에 있어 항상 닿는다. */}
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} bounces={false}>
            {/* 사진 소스가 전부 정사각형이라(카테고리 기본 256x256, 사용자 사진도
                itemImagePicker의 aspect [1,1]) 박스도 정사각으로 둔다. 가로로 긴
                박스에 cover를 걸면 위아래가 잘린다. contain은 혹시 비정사각
                사진이 들어와도 잘리지 않게 하는 보험이다. */}
            {onChangeImage ? (
              // 사진을 크게 확인한 자리에서 바로 바꿀 수 있게 한다. 예전에는 목록의
              // 작은 썸네일을 눌러야 했는데, 아무 표시가 없어 누를 수 있다는 걸 알
              // 방법이 없었고 사진을 크게 보려던 사람에게 갤러리가 열려 버렸다.
              //
              // 배지를 사진 아래가 아니라 사진 위 왼쪽 아래에 겹치는 이유: 아래에 한
              // 줄을 더 두면 카드가 길어져 "스크롤 없이 한 장"이 깨진다. 44x44라
              // 손가락에 충분하고, 카메라 그림이 "여기서 사진을 바꾼다"를 말해 준다.
              <View style={styles.imageBox}>
                <Image source={getFoodImageSource(item)} resizeMode="contain" style={styles.image} />
                <Pressable
                  style={styles.imageEditBadge}
                  onPress={() => setSourceSheetVisible(true)}
                  accessibilityRole="button"
                  accessibilityLabel="상품 사진 바꾸기"
                >
                  <Image source={cameraIcon} resizeMode="contain" style={styles.imageEditIcon} />
                </Pressable>
              </View>
            ) : (
              <Image source={getFoodImageSource(item)} resizeMode="contain" style={styles.image} />
            )}
            <View style={styles.nameRow}>
              {onToggleFavorite ? (
                <Pressable
                  style={styles.favoriteButton}
                  onPress={onToggleFavorite}
                  accessibilityRole="button"
                  accessibilityLabel={favorite ? "즐겨찾기 해제" : "즐겨찾기 등록"}
                >
                  <Image
                    source={favorite ? bookmarkOnIcon : bookmarkOffIcon}
                    resizeMode="contain"
                    style={styles.favoriteIcon}
                  />
                </Pressable>
              ) : null}
              <Text style={[styles.name, nameChanged && styles.changed]} numberOfLines={2}>
                {String(item.name || "")}
              </Text>
            </View>
            {rows.map((row) => (
              <View key={row.key} style={styles.row}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={[styles.rowValue, changedValue(row.key, row.value) && styles.changed]}>
                  {row.value}
                </Text>
              </View>
            ))}
            {/* 구매처는 표의 마지막 줄로. 상품명 아래 독립된 줄로 두면 그 줄만 왼쪽
                정렬이라 표의 좌우 정렬 리듬이 끊긴다. 링크가 없으면 줄을 그리지 않는다. */}
            {hasPurchaseUrl ? (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>구매처</Text>
                <Pressable
                  style={styles.purchaseLink}
                  onPress={openPurchaseUrl}
                  accessibilityRole="link"
                  accessibilityLabel="이 상품 구매하러 가기"
                >
                  {isCoupangUrl(item.purchaseUrl) ? (
                    <Image source={coupangWordmarkIcon} resizeMode="contain" style={styles.purchaseLinkLogo} />
                  ) : (
                    <Image source={shoppingCartIcon} resizeMode="contain" style={styles.purchaseLinkCart} />
                  )}
                  <Text style={styles.purchaseLinkText}>구매하러 가기</Text>
                </Pressable>
              </View>
            ) : null}
            {item.memo?.trim() ? (
              <View style={styles.memoBox}>
                <Text style={styles.rowLabel}>메모</Text>
                <Text style={[styles.memoText, memoChanged && styles.changed]} numberOfLines={3}>{item.memo.trim()}</Text>
              </View>
            ) : null}
            {onTogglePlanDone ? (
              <Pressable
                style={styles.planDoneRow}
                onPress={onTogglePlanDone}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: planDone }}
                accessibilityLabel="오늘 먹었어요"
              >
                <View style={[styles.planDoneBox, planDone && styles.planDoneBoxOn]}>
                  {planDone ? <Text style={styles.planDoneMark}>✓</Text> : null}
                </View>
                <Text style={[styles.planDoneLabel, planDone && styles.planDoneLabelOn]}>오늘 먹었어요</Text>
              </Pressable>
            ) : null}
            {/* 삭제는 카드 안에 그대로 둔다 — 수정 시트로 옮겨봤더니 단계를 너무
                숨긴다는 피드백이었다(2026-08-29). 대신 스크롤 영역 맨 끝, 초록
                요소들에서 가장 먼 자리에 글자로만 둔다. */}
            {onDelete ? (
              <Pressable
                style={styles.deleteLink}
                onPress={onDelete}
                accessibilityRole="button"
                accessibilityLabel="이 상품 삭제하기"
              >
                <Text style={styles.deleteLinkText}>삭제하기</Text>
              </Pressable>
            ) : null}
          </ScrollView>
          <View style={styles.actions}>
            {onComplete ? (
              <Pressable
                style={[styles.button, styles.buttonComplete]}
                onPress={onComplete}
                accessibilityRole="button"
              >
                <Text style={styles.buttonCompleteText}>
                  {completeLabel}
                </Text>
              </Pressable>
            ) : null}
            <Pressable style={[styles.button, styles.buttonPrimary]} onPress={onEdit} accessibilityRole="button">
              <Text style={styles.buttonPrimaryText}>{editLabel}</Text>
            </Pressable>
          </View>
        </View>
        {sourceSheetVisible ? (
          <View style={styles.sheetLayer}>
            <Pressable style={styles.backdropFill} onPress={() => setSourceSheetVisible(false)} />
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>사진 바꾸기</Text>
              <Pressable style={styles.sheetRow} onPress={() => chooseSource("camera")} accessibilityRole="button">
                <Text style={styles.sheetRowText}>촬영하기</Text>
              </Pressable>
              <View style={styles.sheetLine} />
              <Pressable style={styles.sheetRow} onPress={() => chooseSource("library")} accessibilityRole="button">
                <Text style={styles.sheetRowText}>갤러리에서 선택</Text>
              </Pressable>
              <Pressable
                style={styles.sheetCancel}
                onPress={() => setSourceSheetVisible(false)}
                accessibilityRole="button"
              >
                <Text style={styles.sheetCancelText}>취소</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
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
  // 상세 카드 위에 얹는 선택 시트. 네이티브 다이얼로그와 달리 빈 본문 영역이
  // 없어서 제목과 버튼이 붙어 나온다.
  sheetLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: "rgba(24, 32, 28, 0.4)"
  },
  sheet: {
    width: "100%",
    maxWidth: 300,
    borderRadius: 18,
    backgroundColor: "#fff",
    paddingVertical: 8,
    overflow: "hidden"
  },
  sheetTitle: {
    ...typography.label,
    color: "#77807a",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8
  },
  sheetRow: {
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: 20
  },
  sheetRowText: {
    ...typography.body,
    color: "#18201c"
  },
  sheetLine: {
    height: 1,
    marginHorizontal: 20,
    backgroundColor: "#eeeeea"
  },
  sheetCancel: {
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#eeeeea"
  },
  sheetCancelText: {
    ...typography.label,
    color: "#77807a"
  },
  card: {
    width: "100%",
    maxHeight: "92%",
    borderRadius: 22,
    backgroundColor: "#fff",
    overflow: "hidden"
  },
  // 사진은 가운데 200px이라 카드 오른쪽 위는 빈 자리다. 겹칠 게 없다.
  closeButton: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2
  },
  closeButtonText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#77807a",
    lineHeight: 24
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 4
  },
  // 정사각형입니다. 카테고리 기본 이미지가 256px뿐이라 이보다 크게 잡으면 뭉갭니다.
  imageBox: {
    alignSelf: "center",
    width: 200,
    height: 200
  },
  // 사진 왼쪽 아래에 겹치는 카메라 배지. 어두운 원판을 깔아 밝은 사진 위에서도
  // 흰 아이콘이 보이게 한다.
  imageEditBadge: {
    position: "absolute",
    left: 8,
    bottom: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(24, 32, 28, 0.66)"
  },
  imageEditIcon: {
    width: 24,
    height: 24,
    tintColor: "#ffffff"
  },
  // 즐겨찾기는 상품명 왼쪽. 흰 카드 위라 원판 없이 아이콘만 둔다.
  // marginLeft를 음수로 당겨 아이콘 글리프가 아래 표의 왼쪽 끝과 맞게 한다.
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    marginBottom: 4
  },
  // 터치 영역은 36x36으로 두되, 아이콘(24)과 상자 사이 6px 여백을 좌우 음수
  // 마진으로 상쇄한다 — 별과 상품명이 바로 붙고 왼쪽 끝도 표와 맞는다.
  favoriteButton: {
    width: 36,
    height: 36,
    marginLeft: -6,
    marginRight: -6,
    alignItems: "center",
    justifyContent: "center"
  },
  // ⚠️ bookmark_on은 금색, bookmark_off는 검정으로 이미 색이 정해진 이미지다 —
  //    tintColor를 걸면 켜짐/꺼짐 구분이 사라진다.
  favoriteIcon: {
    width: 24,
    height: 24
  },
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
    flexShrink: 1
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
  // 체크박스 줄. 라벨은 늘 "오늘 먹었어요"로 고정이고 네모만 상태를 말한다.
  planDoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    marginTop: 6
  },
  planDoneBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#c3cbc6",
    alignItems: "center",
    justifyContent: "center"
  },
  planDoneBoxOn: {
    borderColor: "#1f7a5a",
    backgroundColor: "#1f7a5a"
  },
  planDoneMark: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "800",
    color: "#ffffff"
  },
  planDoneLabel: {
    ...typography.body,
    color: "#18201c"
  },
  planDoneLabelOn: {
    ...typography.bodyStrong,
    color: "#1f7a5a"
  },
  // 글자만 두어 시각적 무게를 가장 낮게 가져간다. 채운 버튼으로 만들면 하단의
  // 초록 버튼들과 같은 급으로 보인다.
  deleteLink: {
    alignSelf: "center",
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 16,
    marginTop: 4
  },
  deleteLinkText: {
    ...typography.label,
    color: "#c0392b"
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
  // 표의 값 자리에 들어가는 링크. 줄 전체가 아니라 로고+글자 폭만 눌린다.
  purchaseLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 36
  },
  // ⚠️ coupang2.png는 색이 입혀진 가로 워드마크다(565x131) — tintColor 금지.
  //    비율(4.31:1)을 지켜 글자 크기에 맞춰 키웠다.
  purchaseLinkLogo: {
    width: 69,
    height: 16
  },
  purchaseLinkCart: {
    width: 18,
    height: 18,
    tintColor: "#1f7a5a"
  },
  // 표에서 유일하게 누를 수 있는 값이라 다른 값(14)보다 한 단계 키운다. 밑줄은
  // 빼고 초록색으로만 링크임을 알린다 — 밑줄이 있으면 표 안에서 지저분해진다.
  purchaseLinkText: {
    ...typography.cardTitle,
    color: "#1f7a5a"
  },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  // 수정하기(초록 채움)와 닫기(테두리) 사이 무게. 초록 테두리로만 구분한다.
  buttonComplete: {
    borderWidth: 1,
    borderColor: "#1f7a5a",
    backgroundColor: "#ffffff"
  },
  buttonCompleteText: {
    ...typography.label,
    color: "#1f7a5a"
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
