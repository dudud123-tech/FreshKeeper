# Project

- Product: 오늘까지야(FreshKeeper) — 소비기한 관리 React Native(Expo) 앱
- `mobile/`: Expo/React Native 앱. Android 위주로 배포 중이며 iOS 네이티브 프로젝트는 저장소에 없음
- `cloudflare/worker/src/index.js`: 백엔드 API(Cloudflare Worker + D1) 단일 파일

# Commands

- 개발 실행: `cd mobile && npx expo start` (Metro). OpenCV 등 커스텀 네이티브 모듈이 있어 일반 Expo Go로는 안 열리고, `npx expo run:android`로 만든 dev client가 필요함
- 릴리즈 APK: `cd mobile/android && ./gradlew assembleRelease` — `android/keystore.properties`(gitignored)가 있으면 실제 Play Store 서명, 없으면 debug 서명으로 자동 폴백
- 자동 테스트 없음(`package.json`에 test 스크립트 없음). JS/JSX를 고치면 아래로 문법만이라도 확인할 것:
  `node -e "require('@babel/parser').parse(require('fs').readFileSync('<file>','utf8'), {sourceType:'module', plugins:['jsx']})"`

# Completion

- JS/JSX를 수정하면 위 babel 파서 검증을 실행하고 결과를 보고한다
- `require()`로 참조하는 에셋 파일이 실제로 존재하는지 확인한다 — 파일명 오타·이중 확장자(`.png.png`)로 조용히 깨진 사례가 있었다
- 아이콘 이미지를 바꿀 때는 `tintColor`를 그대로 두지 말고 실제로 색이 이미 입혀진 이미지인지(로고·배지류) 먼저 확인한다 — 색 있는 이미지에 tintColor를 걸면 한 가지 색으로 뭉개진다

# Conventions

- 새 튜닝 상수(빈도·임계값·ID 등)를 추가하면 `docs/tunable-options.md`에도 같이 기록한다
- 원인이 불확실한 버그는 우회책으로 덮지 말고 실제 원인을 찾는다 — 필요하면 의존성 트리·좌표 계산까지 추적한다
