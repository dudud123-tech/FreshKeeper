# 조정 가능한 옵션 모음

코드를 안 봐도 값만 바꿔서 동작을 조절할 수 있는 설정들을 모아둔 문서. 새로운
튜닝 가능한 상수(빈도, 임계값, ID 등)를 추가할 때는 이 파일에도 같이 기록한다.

## 광고 (AdMob)

| 옵션 | 위치 | 기본값 | 설명 |
| --- | --- | --- | --- |
| Android 앱 ID | `mobile/.env` → `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID` | 구글 테스트 앱 ID | 네이티브 매니페스트에 들어가므로 바꾸면 **재빌드 필요**(`expo run:android`) |
| 배너 광고 단위 ID | `EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID` (env) | 구글 테스트 배너 ID(`TestIds.BANNER`) | `mobile/src/components/BannerAdSlot.js`. JS만 바뀌므로 재빌드 불필요 |
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
| R8 minify (`android.enableMinifyInReleaseBuilds`) | `mobile/android/gradle.properties` | 현재 `true`(켜짐). ⚠️ **`mobile/android/app/proguard-rules.pro`의 Retrofit 규칙을 지우면 네이버 로그인이 release 빌드에서만 100% 실패한다.** 네이버 SDK가 Retrofit 2.9.0 + Kotlin suspend 함수를 쓰는데, Retrofit이 R8 full mode(AGP 8 기본값) 대응 규칙을 자체 포함한 건 2.10.0부터라 `Continuation<...>`의 제네릭 시그니처가 지워지고 `java.lang.Class cannot be cast to java.lang.reflect.ParameterizedType`로 터진다. 앱에는 `no_catagorized_error`라는 무의미한 메시지로만 보여서 원인 추적이 어렵다. (2026-08-04, v14가 이것 때문에 로그인 불가 상태로 배포됨 → v15에서 수정) |
| Gson enum 난독화 (`-keepclassmembers enum *`) | `mobile/android/app/proguard-rules.pro` | ⚠️ **이 규칙과 `-keep class com.kakao.sdk.**`를 지우면 카카오 로그인/로그아웃 시 앱이 강제 종료된다.** Gson의 `EnumTypeAdapter` 생성자는 enum 상수를 이름으로 되찾는데(`classOfT.getField(constant.name())`), `Enum.name()`은 생성자에 박힌 원본 문자열을 그대로 돌려주는 반면 R8은 static 필드명을 난독화해서 `java.lang.NoSuchFieldException: TokenNotFound`(`com.kakao.sdk.common.model.ClientErrorCause`)로 터진다. 이건 OkHttp Dispatcher 백그라운드 스레드의 FATAL이라 **JS try/catch로 못 막고 앱이 그대로 죽는다.** `signOutAccount()`가 provider와 무관하게 항상 카카오 logout을 호출해서, 구글로 로그인해도 로그아웃 때 같이 죽었다. (2026-08-07, minify를 켠 `cc5a039`부터 깨져 있었으나 그동안 카카오를 테스트 안 해서 v17까지 모르고 배포됨 → v18에서 수정) |
| 로컬 release 빌드의 구글 로그인 | (설정 아님, 알아둘 제약) | 로컬 `expo run:android --variant release`는 `debug.keystore`로 서명돼서 **구글 로그인이 항상 "취소됨"으로 실패한다** — 그 서명의 SHA-1이 Google Cloud Console의 Android OAuth 클라이언트에 등록돼 있지 않기 때문. **프로덕션 버그가 아니므로 로컬에서 이 증상이 보여도 무시해도 된다.** 로컬에서도 테스트하려면 debug 키스토어 SHA-1을 콘솔에 추가 등록해야 한다. (카카오는 같은 이유로 막혔다가 debug 키 해시를 카카오 콘솔에 등록해서 로컬 테스트가 가능해진 것) (2026-08-07) |
| 카카오 안드로이드 키 해시 | 카카오 디벨로퍼스 콘솔 (앱 > 플랫폼 > Android) | 네이버와 달리 카카오는 **서명 인증서의 키 해시를 콘솔에 등록해야 로그인이 된다.** 등록 안 하면 `Android keyHash validation failed.`로 실패하고, 로그인 버튼 자체는 (env var만 있으면) 정상적으로 활성화되어 있어서 헷갈리기 쉽다. 로컬 debug/local release 빌드는 둘 다 `debug.keystore`로 서명되어 키 해시가 같지만, **실제 Play Store 프로덕션은 EAS가 관리하는 별도 키스토어라 키 해시가 다르다 — 최소 2개(로컬용, 프로덕션용) 등록해야 함.** `mobile/src/services/authApi.js`의 `signInWithKakao()`가 이 에러를 잡으면 `@react-native-kakao/core`의 `getKeyHashAndroid()`로 실제 값을 자동으로 가져와 에러 메시지에 붙여준다(설정 > 계정 화면에 그대로 표시됨, keytool/openssl 수동 계산 불필요). (2026-08-06) |

## 상품 인식 학습 (Cloudflare Worker)

| 옵션 | 위치 | 기본값 | 설명 |
| --- | --- | --- | --- |
| 전역 제외 학습 최소 투표 수 | `MIN_GLOBAL_EXCLUSION_VOTERS` in `cloudflare/worker/src/index.js` | `3` | 서로 다른 사용자 몇 명이 같은 상품명을 제외해야 전역으로 제외 처리할지 |

## 쿠팡 파트너스 딥링크 변환 (Cloudflare Worker)

| 옵션 | 위치 | 기본값 | 설명 |
| --- | --- | --- | --- |
| Access Key / Secret Key | Cloudflare Worker secret(`COUPANG_ACCESS_KEY`, `COUPANG_SECRET_KEY`) | 없음 | `.env`가 아니라 `npx.cmd wrangler secret put COUPANG_ACCESS_KEY`(그리고 `_SECRET_KEY`)로 `cloudflare/worker` 안에서 직접 등록. 클라이언트(앱)에는 절대 노출하지 않는다. `/api/health`에서 등록 여부만 `true`/`false`로 확인 가능 |
| 요청당 최대 URL 개수 | `MAX_COUPANG_URLS_PER_REQUEST` in `cloudflare/worker/src/index.js` | `10` | 한 번의 `/api/coupang/deeplink` 호출에서 변환 요청할 수 있는 URL 개수 상한 |
| 허용 도메인 | `COUPANG_HOSTS` in `cloudflare/worker/src/index.js` | `www.coupang.com`, `coupang.com`, `m.coupang.com`, `link.coupang.com` | 이 목록 밖의 URL은 변환 요청 자체를 안 하고 걸러낸다 |

서명 방식은 쿠팡이 제공한 가이드(`파일/쿠팡/api_guide.md`, 저장소 밖 개인 메모)를 그대로 따른다 — HMAC-SHA256, `Authorization: CEA algorithm=HmacSHA256, access-key=..., signed-date=..., signature=...`, `signed-date`는 GMT 기준 `yyMMdd'T'HHmmss'Z'`. (2026-08-04)

## 쿠팡 파트너스 상품 검색 (Cloudflare Worker)

| 옵션 | 위치 | 기본값 | 설명 |
| --- | --- | --- | --- |
| 검색 결과 개수 상한 | `MAX_COUPANG_SEARCH_LIMIT` in `cloudflare/worker/src/index.js` | `10` | 쿠팡 API 자체 상한이 10개. `/api/coupang/search?limit=`으로 요청 시 이 값으로 clamp됨 |
| 기본 검색 결과 개수 | `handleCoupangSearch`의 `limit` 기본값 | `5` | `limit` 쿼리 파라미터 생략 시 |

⚠️ 쿠팡 측 호출 제한이 **분당 50회**다(계정 전체 공유, 앱 사용자 수와 무관). `productData[0].productUrl`은 검색 결과 자체에 파트너스 링크가 이미 포함돼 있어 `/api/coupang/deeplink`를 따로 호출할 필요가 없다. 상품명으로 검색해서 나온 첫 번째 결과를 그대로 신뢰하지 말 것 — 동명이인 상품이 많아 오검색 가능성이 있으므로 자동 채움 후 사용자가 수정할 수 있는 구조를 유지해야 한다. (2026-08-06)

## 쿠팡 파트너스 인기상품/수익 리포트 (Cloudflare Worker)

| 옵션 | 위치 | 기본값 | 설명 |
| --- | --- | --- | --- |
| 인기상품 기본 카테고리 | `DEFAULT_COUPANG_CATEGORY_ID` / `DEFAULT_FOOD_CATEGORY_ID` (`index.js`/`coupangApi.js`) | `1012`(식품) | 이 앱의 그로서리 카테고리가 전부 쿠팡의 "식품" 대분류에 속해서 고정값으로 씀. 재구매 패널을 열 때만 호출(패널이 계속 열려있어도 한 번만) |
| 수익 리포트 접근 토큰 | Worker secret `COUPANG_REPORT_TOKEN` | 없음 | `npx.cmd wrangler secret put COUPANG_REPORT_TOKEN`으로 등록. `GET /admin/coupang/commission?token=...`로 접근 — 토큰 없거나 틀리면 그냥 404. **앱 UI에는 없음**, 개발자가 브라우저로 직접 확인하는 용도 |
| 수익 리포트 기본 조회 기간 | `handleCoupangCommissionReport` in `cloudflare/worker/src/index.js` | 최근 30일 | `startDate`/`endDate` 쿼리로 override 가능(형식 `yyyyMMdd`, 최대 30일 범위가 쿠팡 API 제약) |

⚠️ `/api/coupang/goldbox`(오늘의 특가) Worker 엔드포인트는 만들어뒀지만 **앱에서 안 씀** — 실제로 호출해보니 카테고리 필터가 안 되고(음료부터 에어컨, 호텔 숙박권까지 뒤섞여 나옴) `categoryName` 필드도 안 내려줘서 클라이언트에서 식품만 걸러낼 수도 없었다. 이 앱 맥락(유통기한 관리)엔 안 맞아서 홈 화면 위젯을 뺐다. 나중에 다른 용도로 쓸 수도 있어 엔드포인트 자체는 남겨둠. (2026-08-06)
