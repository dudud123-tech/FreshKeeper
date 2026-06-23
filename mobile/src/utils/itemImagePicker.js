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

export function chooseItemImage({
  title = "상품 사진 변경",
  message = "사진을 촬영하거나 갤러리에서 선택할 수 있습니다.",
  onSelected,
  libraryPermissionMessage,
  cameraPermissionMessage
}) {
  Alert.alert(title, message, [
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
