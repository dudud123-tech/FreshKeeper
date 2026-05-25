# 유통기한 매니저 Expo 앱

웹 프로토타입을 Expo 기반 모바일 앱으로 옮긴 첫 버전입니다.

## 현재 포함된 기능

- 상품 수동 등록
- 카테고리 자동 추천
- 유통기한/소비기한 선택
- 영수증 이미지 선택
- OCR 결과 후보 목록 생성
- 상품 목록 로컬 저장

## 실행

PC에 Node.js와 npm이 설치되어 있어야 합니다.

```powershell
cd "C:\Users\dudu1\OneDrive\Documents\유통기한매니져\mobile"
npm install
npm start
```

휴대폰에는 Expo Go 앱을 설치하고, 터미널에 표시되는 QR 코드를 스캔하면 됩니다.

이 프로젝트는 Play Store/App Store의 Expo Go와 맞추기 위해 Expo SDK 54를 사용합니다. SDK 55는 전환 기간 동안 스토어의 Expo Go와 맞지 않을 수 있습니다.

## OCR 메모

현재 `src/ocr.js`는 Expo Go에서 바로 테스트할 수 있도록 샘플 OCR 결과를 반환합니다.

실제 온디바이스 OCR은 Expo Go가 아니라 개발 빌드에서 붙이는 것이 좋습니다. 다음 단계 후보:

- `@react-native-ml-kit/text-recognition`
- Expo development build
- Android/iOS 네이티브 권한 설정
