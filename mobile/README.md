# freshkeeper Expo 앱

웹 프로토타입을 Expo 기반 모바일 앱으로 옮긴 첫 버전입니다.

## 현재 포함된 기능

- 상품 수동 등록
- 카테고리 자동 추천
- 소비기한 입력
- 영수증 이미지 선택
- 영수증 문자 인식 결과 후보 목록 생성
- 상품 목록 로컬 저장

## 실행

PC에 Node.js와 npm이 설치되어 있어야 합니다.

```powershell
cd "C:\Users\dudu1\OneDrive\Documents\freshkeeper\mobile"
npm install
npm start
```

휴대폰에는 Expo Go 앱을 설치하고, 터미널에 표시되는 QR 코드를 스캔하면 됩니다.

이 프로젝트는 Play Store/App Store의 Expo Go와 맞추기 위해 Expo SDK 54를 사용합니다. SDK 55는 전환 기간 동안 스토어의 Expo Go와 맞지 않을 수 있습니다.

## 영수증 인식 메모

현재 `src/ocr.js`는 개발 빌드에서 `@react-native-ml-kit/text-recognition`을 사용해 실제 영수증 문자를 읽습니다.

Expo Go에는 이 네이티브 인식 모듈이 포함되어 있지 않으므로, Expo Go에서 실행하면 테스트용 샘플 결과가 표시됩니다.

실제 영수증으로 테스트하려면 개발 빌드가 필요합니다.

```powershell
cd "C:\Users\dudu1\OneDrive\Documents\freshkeeper\mobile"
npm install
npx expo prebuild --platform android
npx expo run:android
```

위 명령은 PC에 Android Studio와 Android SDK가 준비되어 있을 때 로컬 APK를 빌드해 연결된 안드로이드 기기에 설치합니다.

Android 로컬 빌드 환경을 아직 준비하지 않았다면 EAS Build로 개발 빌드를 만드는 방식도 사용할 수 있습니다.
