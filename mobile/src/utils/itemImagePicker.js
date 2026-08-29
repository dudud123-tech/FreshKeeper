import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

const ITEM_IMAGE_PICKER_OPTIONS = {
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.85
};

export async function pickItemImageFromLibrary({
  onSelected,
  permissionMessage = "상품 이미지를 선택하려면 사진 접근 권한이 필요합니다."
}) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("권한 필요", permissionMessage);
    return "";
  }

  const result = await ImagePicker.launchImageLibraryAsync(ITEM_IMAGE_PICKER_OPTIONS);
  if (result.canceled || !result.assets?.[0]?.uri) return "";

  const imageUri = result.assets[0].uri;
  onSelected?.(imageUri);
  return imageUri;
}

export async function takeItemImagePhoto({
  onSelected,
  permissionMessage = "상품 사진을 촬영하려면 카메라 권한이 필요합니다."
}) {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("권한 필요", permissionMessage);
    return "";
  }

  const result = await ImagePicker.launchCameraAsync(ITEM_IMAGE_PICKER_OPTIONS);
  if (result.canceled || !result.assets?.[0]?.uri) return "";

  const imageUri = result.assets[0].uri;
  onSelected?.(imageUri);
  return imageUri;
}

// 등록·영수증 흐름은 화면에 시트를 그릴 자리가 없어 네이티브 다이얼로그를 쓴다.
// 본문을 비우면 안드로이드가 빈 영역만큼 여백을 남기므로 짧은 한 줄을 채운다
// (상세 카드는 대신 자체 시트를 그린다).
export function chooseItemImage({
  title = "사진 바꾸기",
  message = "어떻게 가져올까요?",
  onSelected,
  libraryPermissionMessage,
  cameraPermissionMessage
}) {
  Alert.alert(title, message || undefined, [
    {
      text: "촬영하기",
      onPress: () => takeItemImagePhoto({ onSelected, permissionMessage: cameraPermissionMessage })
    },
    {
      text: "갤러리",
      onPress: () => pickItemImageFromLibrary({ onSelected, permissionMessage: libraryPermissionMessage })
    },
    { text: "취소", style: "cancel" }
  ]);
}
