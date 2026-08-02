# 조정 가능한 옵션 모음

코드를 안 봐도 값만 바꿔서 동작을 조절할 수 있는 설정들을 모아둔 문서. 새로운
튜닝 가능한 상수(빈도, 임계값, ID 등)를 추가할 때는 이 파일에도 같이 기록한다.

## 광고 (AdMob)

| 옵션 | 위치 | 기본값 | 설명 |
| --- | --- | --- | --- |
| Android 앱 ID | `mobile/.env` → `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID` | 구글 테스트 앱 ID | 네이티브 매니페스트에 들어가므로 바꾸면 **재빌드 필요**(`expo run:android`) |
| 배너 광고 단위 ID | `EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID` (env) | 구글 테스트 배너 ID(`TestIds.BANNER`) | `mobile/src/components/BannerAdSlot.js`. JS만 바뀌므로 재빌드 불필요 |
| 전면 광고 단위 ID | `EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID` (env) | 구글 테스트 전면 ID(`TestIds.INTERSTITIAL`) | `mobile/src/utils/interstitialAd.js`. JS만 바뀌므로 재빌드 불필요 |
| 전면 광고 노출 빈도 | `SHOW_EVERY_N_TRIGGERS` in `mobile/src/utils/interstitialAd.js` | `3` | "보관함 저장" 버튼을 이 횟수만큼 누를 때마다 한 번 노출. 앱 재시작 시 카운트 초기화(세션 한정, 영구 저장 아님) |
| 보관함 리스트 배너 간격 | `index % 10 === 8` in `mobile/src/components/InventoryList.js` | 10개마다 | 상품 10개마다 배너 하나씩 리스트 중간에 삽입 |
| 보관함 리스트 하단 배너 노출 조건 | `visibleItems.length < 10` in `mobile/src/components/InventoryList.js` | 10개 미만일 때만 | 상품이 10개 이상이면 중간 삽입 배너만 쓰고 맨 아래 배너는 생략(중복 노출 방지) |

`mobile/.env`(git에는 안 올라감)에 실제 앱 ID·광고 단위 ID가 이미 설정되어 있다 — 위 표의 "기본값"은 env가 비어있을 때 코드가 쓰는 폴백값이다.

## 영수증 인식

| 옵션 | 위치 | 기본값 | 설명 |
| --- | --- | --- | --- |
| 박스 모드 vs 색칠 모드 전환 임계값 | `COORDINATE_CONFIDENCE_THRESHOLD` in `mobile/src/hooks/useReceiptFlow.js` | `0.5` | 실물 영수증 OCR 좌표 신뢰도가 이 값 미만이면 자동으로 색칠(드래그) 모드로 전환 |

## 릴리즈 빌드

| 옵션 | 위치 | 설명 |
| --- | --- | --- |
| Android versionCode | `mobile/app.json`(`android.versionCode`) **그리고** `mobile/android/app/build.gradle`(`defaultConfig.versionCode`) | ⚠️ 이 프로젝트는 `android` 폴더를 직접 관리해서 `expo prebuild`를 안 돌리므로, `app.json`을 바꿔도 `eas build`가 실제로 쓰는 값은 `build.gradle`에 하드코딩된 값이다. **Play Console 업로드 전엔 두 파일 다 같은 값으로 올려야 한다.** (2026-08-02, versionCode 8→9 올릴 때 이걸 놓쳐서 업로드 거부당함) |

## 상품 인식 학습 (Cloudflare Worker)

| 옵션 | 위치 | 기본값 | 설명 |
| --- | --- | --- | --- |
| 전역 제외 학습 최소 투표 수 | `MIN_GLOBAL_EXCLUSION_VOTERS` in `cloudflare/worker/src/index.js` | `3` | 서로 다른 사용자 몇 명이 같은 상품명을 제외해야 전역으로 제외 처리할지 |
