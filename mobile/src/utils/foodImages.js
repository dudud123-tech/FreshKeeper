const categoryImageSources = {
  "유제품": require("../../assets/foods/category-dairy.png"),
  "육류/생선": require("../../assets/foods/category-meat-fish.png"),
  "채소/과일": require("../../assets/foods/category-produce.png"),
  "냉동식품": require("../../assets/foods/category-frozen.png"),
  "가공식품": require("../../assets/foods/category-processed.png"),
  "음료": require("../../assets/foods/category-beverage.png"),
  "간식": require("../../assets/foods/category-snack.png"),
  "약": require("../../assets/foods/category-medicine.png"),
  "기타": require("../../assets/foods/category-etc.png")
};

export function getFoodImageSource(item) {
  if (item?.imageUri) {
    const source = { uri: item.imageUri };
    if (/\/api\/family-groups\/.+\/image$/i.test(item.imageUri)) {
      source.headers = getCachedAuthHeaders();
    }
    return source;
  }
  return categoryImageSources[item?.category] || categoryImageSources["기타"];
}
import { getCachedAuthHeaders } from "../services/authApi";
