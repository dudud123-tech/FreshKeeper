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

## 먹는 일정 (스케줄링)

| 옵션 | 위치 | 기본값 | 설명 |
| --- | --- | --- | --- |
| 일정 화면 조회 기간 | `SCHEDULE_LOOKAHEAD_DAYS` in `mobile/src/utils/mealPlan.js` | `30` | 일정 탭이 보여주는 날짜 수. 일정이 잡힌 날만 그리므로 늘려도 빈 줄이 생기지 않는다 |
| 일정 알림 예약 범위 | `PLAN_NOTIFICATION_LOOKAHEAD_DAYS` in `mobile/src/utils/mealPlan.js` | `7` | 알림을 미리 예약해 두는 일수. ⚠️ 화면 조회 기간과 일부러 분리했다 — 매일 반복 상품이 있으면 예약 건수가 날짜 수만큼 불어나 아래 `MAX_PLAN_NOTIFICATIONS` 상한을 금방 채우고 뒤쪽 상품이 알림을 못 받는다. 앱을 열 때마다 다시 예약하므로 7일이면 충분하다 |
| 끼니 슬롯 목록·기본 시간 | `MEAL_SLOTS` in `mobile/src/utils/mealPlan.js` | 아침 08:00 · 점심 12:00 · 저녁 18:00 | 여기에 추가하면 일정 화면·보관함 편집·알림 문구에 자동 반영된다. `defaultTime`은 끼니를 고를 때 알림 시각을 자동으로 채워주는 값 |
| 반복 주기 목록 | `PLAN_REPEATS` in `mobile/src/utils/mealPlan.js` | 안 함 · 매일 · 매주 | 비타민·약처럼 계속 챙겨 먹는 상품용. 반복이 걸린 상품은 "완료"가 아니라 다음 회차로 넘어간다(`completePlanOccurrence`) — 완료 처리하면 보관함에서 사라지기 때문 |
| 상품별 알림 시각 우선순위 | `planTimeFor()` in `mobile/src/utils/mealPlan.js` | 상품 지정 → 끼니 기본값 → `DEFAULT_PLAN_TIME` | 알림 시각은 상품마다 `plannedTime`으로 따로 저장된다. 일정을 잡는 순간 화면에 보이던 시각이 그대로 확정 저장되므로(`resolvedPlanTime` in `InventoryList.js`, `assignItem` in `SchedulePage.js`) 보통 여기서 끝난다. 뒤의 두 단계는 시각이 저장되기 전에 만들어진 예전 데이터용 안전망 |
| 새 일정의 기본 알림 시각 | `DEFAULT_PLAN_TIME` in `mobile/src/utils/mealPlan.js` | `18:00` | 먹을 날을 새로 잡을 때 알림 시각 칸에 처음 채워지는 값. ⚠️ 예전에는 설정 > 알림에서 사용자가 정하게 했지만, 일정 알림은 **상품마다 시각을 따로 갖는** 구조라 "모든 상품 공통 시각"이라는 설정이 모델과 어긋나 없앴다. 저녁 끼니(`MEAL_SLOTS`)와 같은 시각으로 맞춰 둔다 |
| 일정 알림 on/off | (없음) | 항상 켜짐 | ⚠️ 소비기한 알림과 달리 토글이 없다. 소비기한 알림은 상품만 등록하면 저절로 오지만 일정 알림은 사용자가 먹을 날을 직접 잡은 상품만 대상이라, 일정을 안 잡은 상태가 곧 꺼둔 상태다. 알림 자체를 끄고 싶으면 안드로이드 알림 설정에서 `PLAN_NOTIFICATION_CHANNEL_ID` 채널만 끄면 된다 |
| 일정 알림 예약 상한 | `MAX_PLAN_NOTIFICATIONS` in `mobile/src/services/notificationScheduler.js` | `60` | 상품마다 시각이 다르면 예약 건수가 상품 수만큼 늘어나므로 안드로이드 예약 한도를 넘지 않게 막는 상한. 같은 날 같은 시각인 상품은 한 건으로 묶인다 |
| 일정 알림 안드로이드 채널 | `PLAN_NOTIFICATION_CHANNEL_ID` in `mobile/src/services/notificationScheduler.js` | `freshkeeper-plan-alerts-v2` | ⚠️ 안드로이드 채널은 한 번 만들어지면 앱이 중요도·소리·진동을 못 바꾼다. 알림 세기를 조정하려면 **반드시 ID 버전을 같이 올려야** 새 설정이 적용된다 |
| 알림에 싣는 메모 최대 건수 | `MAX_MEMO_LINES` in `mobile/src/services/notificationScheduler.js` | `3` | 한 알림에 여러 상품이 묶일 때 메모 줄이 무한정 늘어나지 않게 하는 상한. 소비기한 알림·일정 알림 양쪽에 같이 적용된다 |
| 알림 메모 한 줄 길이 | `MEMO_LINE_MAX_LENGTH` in `mobile/src/services/notificationScheduler.js` | `40` | 이 길이를 넘는 메모는 뒤를 잘라내고 `…`을 붙인다. 안드로이드 알림이 접힌 상태에서 읽히는 길이에 맞춘 값 |

## 가족 공유 동기화 (Cloudflare Worker + 앱)

| 옵션 | 위치 | 설명 |
| --- | --- | --- |
| 가족 동기화 대상 필드 | `mobile/src/services/familyApi.js`(`cleanItemForFamilySync`), `cloudflare/worker/src/index.js`(`normalizeFamilyItems`, `handleGetFamilyItems`, `handlePutFamilyItems`), `cloudflare/worker/migrations/0016_family_group_items_purchase_url.sql` | ⚠️ **가족 공유 스키마에 없는 필드는 앱 재시작마다 조용히 사라진다.** 가족 공유가 켜져 있으면 앱을 켤 때마다 서버 데이터로 로컬 상품 목록을 통째로 덮어쓰는데(`useFamilySync.js`의 마운트 시 자동 `pullFamilyItems`, `addLocal` 없이 호출됨 — 병합이 아니라 전체 교체), `cleanItemForFamilySync`에 없는 필드는 서버에 애초에 저장이 안 되니 다음 pull에서 지워진다. 구매 링크(`purchaseUrl`)가 이 이유로 사라지는 버그가 있었다(2026-08-07 수정, `family_group_items` 테이블에 `purchase_url` 컬럼 추가). **새 상품 필드를 추가할 때마다 이 동기화 화이트리스트에도 넣어야 한다는 걸 잊지 말 것.** |
| 잔여 위험(수정 안 됨) | `useFamilySync.js`의 마운트 시 자동 pull | 스키마에 필드를 넣어도, 로컬 저장 직후 push가 서버에 반영되기 전에 다음 pull이 먼저 오면 그 사이 값은 여전히 덮어써질 수 있다(전체 교체 방식이라 병합이 아님). 지금은 필드 누락만 고쳤고, pull-vs-push 경합 자체는 별도 개선 과제로 남겨둠. |

## 개인 랭킹 (홈 화면 냉장고 관리단계 카드)

| 옵션 | 위치 | 기본값 | 설명 |
| --- | --- | --- | --- |
| 랭킹 표시 최소 표본 수 | `MIN_RANKING_SAMPLE_SIZE` in `mobile/src/utils/personalRankings.js` | `5` | 등록한 상품이 이 개수 미만이면 랭킹 대신 "아직 데이터가 부족해요" 빈 상태를 보여줌 |

전부 로컬 `items` 배열로 클라이언트에서 계산한다(서버 호출 없음) — 로그인 여부와 무관하게 항상 동작. "가장 많이 등록한 상품"/"소비기한을 놓친 상품"은 `normalizeProductName`으로 표기 차이를 묶어서 센다. 이 두 섹션은 같은 그룹 안에서 구매 링크가 있는 항목을 찾아 카트 아이콘으로 노출한다(쿠팡 파트너스 링크 클릭 유도) — 링크가 하나라도 있으면 대가성 문구 배너도 같이 뜬다. "가장 많이 다룬 카테고리"는 구매 개념이 없어서 링크 없음. (2026-08-07)

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

## 전체 랭킹 웹페이지 (Cloudflare Worker)

| 옵션 | 위치 | 기본값 | 설명 |
| --- | --- | --- | --- |
| 표시 순위 개수 | `RANKINGS_DISPLAY_LIMIT` in `cloudflare/worker/src/index.js` | `30` | `GET /rankings`에서 상위 몇 개 상품까지 보여줄지. SQL `LIMIT`과 화면 표시 개수가 같은 값을 공유함 |
| 집계 제외 subject_key | `RANKINGS_EXCLUDED_SUBJECT_KEYS` in `cloudflare/worker/src/index.js` | 개발자 본인 계정 2개 | 아래 참고 |

`GET /rankings`는 "상품별로 몇 명이 등록해봤는지" 순위를 공개 HTML로 보여준다. 새 추적 없이 기존 `product_classification_preferences` 테이블(`subject_key`, `normalized_name`이 PK)을 `GROUP BY normalized_name`으로 집계만 한다 — 로그인 계정과 기기(`account:`/`device:` subject_key)를 구분 없이 "참여자 수"로 합산. 이름 표시는 `normalized_name`을 그대로 쓴다(같은 그룹 안에서 `original_name`은 여러 값이 섞여 있어 대표값이 불안정하므로). `htmlPage()`/`publicPage()` 헬퍼를 그대로 재사용하는 `/privacy`, `/account-deletion`과 같은 패턴. 앱에는 아직 링크 연결 안 함(홈 화면에 나중에 추가 예정), 쿠팡 파트너스 구매 링크도 이번엔 뺐다 — 참여자가 적어 적극 홍보 전이라 심플하게 순위만. workers.dev 기본 URL로 서빙 중이며, 나중에 개인 도메인(`lotto-studio.net`)의 서브도메인으로 연결할 계획. (2026-08-08)

⚠️ **개발자 본인의 릴리즈 테스트가 실제 참여자로 집계된다.** `mobile/src/services/clientIdentity.js`의 `client_id`는 AsyncStorage에만 저장되고 재설치·앱 데이터 삭제·새 에뮬레이터마다 랜덤으로 새로 생성되는데, 로그인 없이 테스트하면 서버 입장에선 실제 신규 사용자의 최초 설치와 **완전히 구분이 안 된다**(디버그 플래그·앱 버전 등 판별 필드가 애초에 없음). 실제로 1위 "국내산백오이2개입1개"(테스트용으로 반복 등록하던 상품)의 등록 10건 중 8건이 로그인 없는 익명 `device:` 기록이었고 날짜가 릴리즈 버그 수정 이력(위 "릴리즈 빌드" 절의 08-02/08-04/08-06/08-07)과 겹쳤다. 로그인 계정으로 확인 가능했던 2건(`dndud123@gmail.com` Google 계정, "팔촌아재" Naver 계정 — 둘 다 개발자 본인)만 `RANKINGS_EXCLUDED_SUBJECT_KEYS`로 집계에서 제외했고, 이걸로 총계가 23명/132개 → 21명/129개로 줄어 애초에 알고 있던 기준치와 일치했다. **익명 `device:` 기록은 실제 1회성 이탈 사용자와 데이터 패턴(한 세션에 몇 개 등록하고 다시 안 옴)이 똑같아 구분할 근거가 없어 그대로 뒀다** — 완전한 해결은 아니고, 로그인 안 한 테스트 노이즈는 여전히 섞여 있을 수 있다는 걸 감안해서 볼 것. (2026-08-08)

`/rankings`는 Cloudflare 커스텀 도메인 `ranking.lotto-studio.net`에도 연결되어 있다(`cloudflare/worker/wrangler.toml`의 `[[routes]]`, `pattern = "ranking.lotto-studio.net"`, `custom_domain = true` — DNS 레코드도 `wrangler deploy`가 자동 생성). 워커 전체가 이 커스텀 도메인에서도 그대로 서빙되므로 `/api/health` 등 다른 경로도 이 도메인으로 접근 가능하지만, 실제 사용 목적은 랭킹 페이지뿐이다. ⚠️ **`[[routes]]`를 추가하면 Wrangler가 `workers_dev`를 기본값 `false`로 취급해서 기존 `*.workers.dev` URL을 배포 시 자동으로 꺼버린다.** 앱의 모든 백엔드 호출(`mobile/src/services/*Api.js`)이 `freshkeeper-ocr-feedback.dndud123.workers.dev`를 하드코딩해서 쓰고 있어서, 이걸 놓치면 커스텀 도메인 연결 배포 한 번으로 앱 전체가 즉시 먹통이 된다(실제로 겪음 — 첫 배포 직후 `/api/health`가 404). `wrangler.toml`에 `workers_dev = true`를 명시로 넣어야 커스텀 라우트를 추가하면서도 기존 workers.dev URL이 계속 살아있다. 배포 직후 전 세계 엣지에 반영되는 데 수십 초 정도 걸려 그 사이엔 두 URL 다 간헐적으로 404가 날 수 있다(정상, 전파 지연일 뿐). (2026-08-08)

## 강제/선택 업데이트 (Cloudflare Worker + 앱)

| 옵션 | 위치 | 기본값 | 설명 |
| --- | --- | --- | --- |
| 최소 지원 Android versionCode | `MIN_SUPPORTED_ANDROID_VERSION_CODE` in `cloudflare/worker/src/index.js` | `20`(v19 이주용, 아래 설명 참고) | 이 값보다 낮은 `versionCode`로 실행 중인 앱은 `ForceUpdateScreen`으로 전체 화면을 막고 Play 스토어로 유도한다(업데이트 전엔 앱 사용 불가). **⚠️ Play 스토어에 이미 올라가 있는 versionCode만 넣을 것** — 아직 배포 안 한 번호를 넣으면 전 사용자가 차단 화면에 갇힌 채 스토어엔 업데이트가 없어서 앱을 영영 못 쓴다. **평상시엔 `1`로 두고 건드리지 말 것**, 새 기능이 나왔다는 이유로 올리면 안 된다(아래 "최신 versionCode"가 그 용도). 올릴 땐 이 숫자만 바꾸고 `wrangler deploy`하면 끝 — 앱 재빌드/재배포 불필요 |
| 최신 Android versionCode | `LATEST_ANDROID_VERSION_CODE` in `cloudflare/worker/src/index.js` | `20` | Play 스토어에 지금 올라가 있는 최신 버전. 이 값보다 낮은 사용자에게는 `SoftUpdatePrompt`로 "업데이트할지 그냥 쓸지" 물어보되, **"나중에"를 눌러도 앱은 정상적으로 계속 쓸 수 있다**(강제 아님). Play 스토어 자동 업데이트가 항상 도는 게 아니라서 앱에서도 권유하자는 목적(2026-08-08). "나중에"를 눌러도 별도로 기억 안 하고 **다음 실행 때 다시 물어본다** — 새 버전을 Play 콘솔에 올릴 때마다 이 값을 그 versionCode로 갱신하고 `wrangler deploy`할 것 |
| Play 스토어 URL | `ANDROID_PLAY_STORE_URL` in `cloudflare/worker/src/index.js` | `https://play.google.com/store/apps/details?id=com.palchonajae.freshkeeper` | 강제/선택 업데이트 화면·팝업의 버튼이 여는 주소 |
| 업데이트 후 "새로워진 점" 안내 | `ANDROID_WHATS_NEW` in `cloudflare/worker/src/index.js` | v19 문구(v20으로 갱신 필요) | 업데이트 직후 첫 실행에서 한 번 뜨는 안내 팝업(`WhatsNewModal`) 내용. `versionCode`가 앱의 실제 `Constants.expoConfig.android.versionCode`와 **정확히 일치할 때만** 뜬다 — **새 버전 낼 때마다 이 값의 `versionCode`를 그 버전으로, `items`를 그 버전에서 바뀐 내용으로 갱신하고 `wrangler deploy`할 것.** 안 바꾸면 새소식이 아예 안 뜨거나(버전 불일치) 예전 문구가 뜬다. 처음 설치한 사용자에게는 안 뜬다(`mobile/App.js`가 `AsyncStorage`에 "마지막으로 본 versionCode"가 없으면 그냥 기록만 하고 넘어감). |

앱은 시작 시 `GET /api/app-version`을 한 번 호출해서(`mobile/src/services/appVersionApi.js`) 현재 설치된 `versionCode`(`expo-constants`의 `Constants.expoConfig.android.versionCode`)와 비교한다. **네트워크 실패/서버 오류/버전 정보를 못 읽는 경우엔 그냥 통과시킨다(fail open)** — 서버 장애로 앱 전체가 막히면 안 되기 때문. `Constants.expoConfig`는 빌드 시점에 `app.json`에서 값을 읽어 번들에 박아 넣으므로, 이 체크가 정확하려면 **`app.json`의 `android.versionCode`와 `build.gradle`의 `versionCode`를 계속 동기화해야 한다**(위 "Android versionCode" 항목과 동일한 습관).

세 화면/팝업은 우선순위가 있다: ① `updateRequired`(강제, `MIN_SUPPORTED_ANDROID_VERSION_CODE` 미달) → 전체 차단, 다른 건 아무것도 안 뜬다. ② 강제 대상이 아니면서 `LATEST_ANDROID_VERSION_CODE`보다 낮음 → `SoftUpdatePrompt`(선택). ③ 방금 업데이트해서 버전이 올라갔고 `ANDROID_WHATS_NEW.versionCode`가 지금 버전과 일치 → `WhatsNewModal`. ②③은 서로 배타적으로 설계됐다(최신 버전에 막 도착했을 때만 whatsNew가 뜨고, 그땐 이미 최신이라 softUpdate 조건을 만족 안 함) — 두 값을 따로 관리하다 어긋나면(예: `ANDROID_WHATS_NEW.versionCode`를 최신으로 안 올림) 동시에 뜰 수 있으니 새 버전 배포 때 두 값을 같이 갱신할 것.

**업데이트 알림의 구조적 제약**: "새 버전이 나왔다"는 알림은 **알림을 받을 구버전 앱 안에 그 코드가 이미 들어있어야** 동작한다. `SoftUpdatePrompt`/`latestVersionCode` 처리는 v20에서 처음 들어갔기 때문에, v19 앱은 서버가 `latestVersionCode`를 내려줘도 그 필드를 읽는 코드가 없어 무시한다 — 서버만 고쳐서는 v19 사용자에게 아무것도 띄울 수 없다. 그래서 v19 → v20 이주만 예외적으로 `MIN_SUPPORTED_ANDROID_VERSION_CODE = 20`(강제 차단)으로 처리했다. **이건 일회성 조치이고, v20부터는 다시 `1`로 되돌린 뒤 `LATEST_ANDROID_VERSION_CODE`만 매 릴리스 올리는 게 정상 운영 방식이다.** (2026-08-08)

## 성장(경험치) 곡선

| 옵션 | 위치 | 기본값 | 설명 |
| --- | --- | --- | --- |
| 등록 XP | `REGISTER_XP_PER_ITEM` | `1` | 상품 하나를 등록할 때. ⚠️ 영수증·쿠팡 캡처 한 번에 10개가 한꺼번에 등록되므로 여기에 무게를 실으면 관리를 안 해도 레벨이 뛴다(5XP였을 때는 6개만 등록해도 레벨 2였다). 서버가 `xpDelta` 0을 버리므로 **1 미만으로는 못 내린다** |
| 완료 XP | `COMPLETE_XP_PER_ITEM` | `6` | 소비기한 안에 먹었을 때. 성장의 주 동력이라 등록보다 훨씬 높게 둔다 |
| 임박 완료 XP | `URGENT_COMPLETE_XP_PER_ITEM` | `9` | 임박 알림 기준(`reminderDays`) 안에 들어온 상품을 먹었을 때. 놓치기 쉬운 걸 챙긴 보상이라 일반 완료보다 높다 |
| 만료 페널티 XP | `EXPIRED_ITEM_PENALTY_XP` | `5` | 기한이 지나도록 안 먹고 남아 있는 상품 하나당 차감 |
| 레벨 임계값 | `GROWTH_LEVEL_XP_THRESHOLDS` in `cloudflare/worker/src/index.js` | `[0, 30, 80, 150, 250, 380, 540, 730, 950, 1200]` | 레벨 1~10 기준선 |

⚠️ **2026-08-24부터 앱에는 성장을 보여주는 화면이 없다.** 홈의 성장 카드를 뺐고(눈길이 가지 않는다는 판단), 그때 앱 쪽 레벨 계산기(`getGrowthReport`)·레벨 이름·임계값 사본도 함께 지웠다. 지금 XP 상수가 있는 곳은 **`mobile/src/hooks/useGrowthSync.js` 한 곳뿐**이고, 레벨 환산은 워커에만 있다.

적립 자체는 계속 돌고 있다 — `useGrowthSync`가 서버로 이벤트를 계속 보내 D1 `growth_events`에 쌓인다. 나중에 성장을 되살릴 때 그 공백 기간 이력이 비지 않게 하려고 일부러 남겨 둔 것이다. 되살리려면 화면만 다시 만들고 `/api/growth/profile`을 읽으면 된다.

레벨 이미지(`mobile/assets/Level/season1/1~10.png`)도 참조하는 코드는 없지만 지우지 않고 남겨 뒀다.

⚠️ **XP 값을 바꿔도 소급되지 않는다.** 적립된 XP는 D1 `growth_events` 테이블에 `xp_delta`로 행마다 박혀 있고, `event_key` 기준 `INSERT OR IGNORE`라 같은 이벤트를 다시 보내도 갱신되지 않는다. 그래서 **XP 값을 낮춰도 기존 사용자 레벨은 내려가지 않고** 앞으로 쌓일 XP만 준다. 반대로 **임계값을 올리면 이미 쌓인 XP는 그대로인데 기준만 높아져 기존 사용자 레벨이 즉시 내려간다** — 이쪽이 훨씬 위험하다.

현재 곡선 기준 대략적인 속도(2026-08-23 조정):

| 사용 패턴 | 월 XP | 도달 |
| --- | --- | --- |
| 등록만 하고 안 먹음 | 등록 개수 × 1 | 레벨 2에 30개, 레벨 3에 80개 |
| 열심히(월 20개 등록 + 12개 기한 내 완료) | 110 | 1개월 Lv3 · 6개월 Lv7 · 약 11개월 만렙 |
| 가볍게(월 8개 등록 + 4개 완료) | 32 | 6개월 Lv4 |

## 바코드 스캔 (직접등록, Cloudflare Worker + 앱)

| 옵션 | 위치 | 기본값 | 설명 |
| --- | --- | --- | --- |
| 스캔 인식 바코드 타입 | `SCANNED_BARCODE_TYPES` in `mobile/src/components/BarcodeScannerModal.js` | `ean13, ean8, upc_a, upc_e, code128, code39, itf14, qr` | 국내 유통 상품 위주. 늘리려면 `expo-camera`의 `BarcodeType` 목록에서 추가 |
| 스캔 확정에 필요한 연속 일치 횟수 | `REQUIRED_MATCHING_SCANS` in `mobile/src/components/BarcodeScannerModal.js` | `4` | 프레임 하나만 보고 확정하면(1-shot) 바코드가 막 들어온 순간의 흐릿한 프레임을 잘못 읽는다. 같은 값이 이만큼 연속으로 읽혀야 확정. 다른 값이 끼어들면 처음부터 다시 센다. 인식이 너무 느리면 줄이고, 오인식이 잦으면 늘린다 |
| 스캔 확정 최소 대기 시간 | `MIN_SCAN_DURATION_MS` in `mobile/src/components/BarcodeScannerModal.js` | `400`(ms) | 위 연속 일치 횟수를 채웠어도 처음 잡힌 뒤 이 시간이 지나야 확정한다(고속 프레임에서 순식간에 4번이 채워지는 걸 방지) |
| 바코드 문자열 검증 정규식 | `normalizeBarcode()` in `cloudflare/worker/src/index.js` | `^[A-Za-z0-9]{4,64}$` | 이 형식을 벗어난 스캔 결과는 조회/등록 모두 거부(`invalid_barcode`) |

바코드→상품 매핑은 `barcode_products` D1 테이블(`cloudflare/worker/migrations/0017_barcode_products.sql`)에 **전체 사용자가 공유**하는 형태로 저장된다 — `product_classification_catalog`와 같은 설계. 처음 보는 바코드를 스캔하면 상품명(필수)/사진(선택, 로컬 전용)/카테고리/소비기한을 직접 입력해서 저장하고, 저장 성공 시 `POST /api/barcode-products`로 서버에 등록된다(`mobile/src/hooks/useInventory.js`의 `submitManual`). 이미 등록된 바코드를 스캔하면 `GET /api/barcode-products`로 조회해서 상품명/카테고리/보관방식을 자동으로 채우고 소비기한만 사용자가 확인·조정하면 된다. **상품 사진은 서버에 저장하지 않는다** — 개인정보/용량 문제로 기기 로컬에만 남긴다(`barcode_products` 테이블에 이미지 컬럼 자체가 없음). 로컬 저장은 `mobile/src/services/barcodeImageCache.js`가 담당 — `AsyncStorage` 키 `fresh-keeper-barcode-images-v1`에 `{바코드: imageUri}` 맵으로 저장하고, 새 바코드 등록 시 사진을 넣으면 여기 저장되며(`useInventory.js`의 `submitManual`), 같은 기기에서 같은 바코드를 다시 스캔하면 여기서 읽어와 자동으로 채운다(`App.js`의 `handleBarcodeScanned`). **다른 기기/사용자와는 공유되지 않는다** — 처음 등록한 기기에서만 사진이 자동으로 채워지고, 다른 사용자는 이름/카테고리/보관방식/소비기한만 받는다. 동시에 같은 바코드가 두 번 등록되면 먼저 등록된 정보가 우선한다(`ON CONFLICT(barcode) DO NOTHING`, 선착순). 카메라 라이브 프리뷰가 필요해서 이 기능을 위해 `expo-camera`를 새 네이티브 의존성으로 추가했다(기존 `expo-image-picker`는 정적 사진 촬영만 가능, 실시간 스캔 불가).

바코드로 등록한 상품은 `item.barcode` 필드로 원본 바코드를 계속 들고 있는다(`useInventory.js`의 `addItem` 호출부). 사진은 처음 등록할 때만 저장되는 게 아니라, 보관함에서 나중에 사진을 바꿔도(`App.js`의 `applyItemImage`) `item.barcode`가 있으면 그 바코드의 로컬 사진 캐시를 같이 갱신한다.

스캔했을 때 채울 사진은 `App.js`의 `resolveBarcodeImageUri`가 **3단계로** 찾는다: ① 로컬 사진 캐시 → ② 보관함에서 `item.barcode`가 같은 상품 → ③ 보관함에서 `normalizeProductName`이 같은 상품. ②③ 폴백이 있는 이유는, 캐시 기능이 생기기 전에 등록해 둔 상품이나 `barcode` 필드 없이 저장된 예전 상품은 ①만으로는 영영 사진이 안 붙기 때문(2026-08-08 버그).

`lookupBarcodeProduct`는 `{ ok, product }`를 돌려준다 — `ok:false`(조회 실패)와 `product:null`(확실히 미등록)을 **반드시 구분해야 한다**. 예전엔 둘 다 `null`이라, 이미 등록해 둔 바코드인데 네트워크가 잠깐 끊기면 "처음 보는 바코드"로 안내해서 같은 상품을 다시 등록하게 만드는 버그가 있었다(2026-08-08). 조회 실패 시엔 아무것도 채우지 않고 재시도를 안내한다. (2026-08-08)
