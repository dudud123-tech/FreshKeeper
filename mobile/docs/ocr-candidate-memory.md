# OCR 상품 후보 기억 및 중복 제거

이 문서는 영수증 OCR에서 사용자가 제외한 상품을 다음 인식부터 표시하지 않고,
할인 행 때문에 같은 상품이 두 번 생성되는 문제를 방지하는 구조를 설명합니다.

## 전체 흐름

```text
영수증 이미지
→ 모바일 OCR
→ 상품 후보 추출
→ 할인 행 정리 및 유사 후보 중복 제거
→ 기기별 제외 목록을 서버에서 조회
→ 제외되지 않은 상품만 화면에 표시
→ 사용자가 상품 선택 또는 제외
→ 제외 결과를 로컬 캐시와 서버 DB에 즉시 저장
→ 선택 상품 등록
```

동일한 영수증인지 판별해 처리를 생략하는 구조는 아닙니다. 같은 영수증을 다시
인식해도 OCR과 서버 조회를 다시 수행합니다.

## 관련 파일

### 모바일

- OCR 상품 후보 추출: `mobile/src/receiptParser.js`
- OCR 등록 흐름: `mobile/src/hooks/useReceiptFlow.js`
- 제외 목록 및 분류 API: `mobile/src/services/productClassificationApi.js`
- AI 후보 병합: `mobile/src/services/receiptAiApi.js`

### 서버

- Worker API: `cloudflare/worker/src/index.js`
- 제외 목록 마이그레이션:
  `cloudflare/worker/migrations/0009_product_candidate_exclusions.sql`
- D1 테이블: `product_candidate_exclusions`

## 기기별 제외 상품 기억

앱 설치 시 익명 `clientId`를 만들고 `AsyncStorage`에 저장합니다. 로그인 전에는
이 값을 기준으로 사용자별 제외 목록을 구분합니다.

사용자가 후보를 제외하는 경로는 두 가지이며, 둘 다 같은 저장 함수를 호출해야
합니다.

1. OCR 이미지 선택 화면에서 상품 줄 선택 해제
2. 최종 상품 후보 카드에서 체크 해제

제외 시 다음 작업을 즉시 수행합니다.

```text
상품명 정규화
→ 로컬 제외 캐시에 먼저 저장
→ POST /api/product-exclusions
→ D1 product_candidate_exclusions에 UPSERT
```

로컬 캐시를 먼저 갱신하므로 서버 연결에 실패해도 현재 기기에서는 다음 OCR부터
제외할 수 있습니다.

다음 영수증 인식에서는 후보를 화면에 표시하기 전에 아래 API를 호출합니다.

```text
POST /api/product-exclusions/resolve
```

서버 응답에 포함된 상품과 로컬 캐시의 제외 상품을 제거한 뒤 남은 후보만
사용자에게 보여줍니다.

사용자가 제외를 취소하고 다시 선택하면 서버 행과 로컬 캐시에서 제외값을
삭제합니다.

## 상품명 정규화

공백, 괄호, 특수문자 차이 때문에 같은 상품이 달라지지 않도록 다음과 같이
정규화합니다.

```text
요거트 프로즌
요거트(프로즌)
요거트  프로즌
→ 요거트프로즌
```

처리 규칙:

- Unicode `NFKC` 정규화
- 영문 소문자 변환
- 문자와 숫자를 제외한 공백·특수문자 제거
- 할인 보조행 끝의 `IRC`, `RC` 제거

상품 분류에서는 용량과 개수를 유지합니다. 서로 다른 용량의 제품까지 하나로
합치지 않기 위해서입니다.

## 할인 행 중복 제거

일부 영수증은 정상 상품 행 바로 아래에 할인 행을 출력합니다.

```text
요거트 프로즌 3,000원
요거트 프로즌IRC -500원
```

기존에는 `IRC`가 상품명의 일부로 남아 서로 다른 두 상품으로 처리됐습니다.
현재는 다음 순서로 하나만 남깁니다.

1. 뒤쪽 할인 금액 제거
2. 상품명 끝의 `IRC` 또는 `RC` 제거
3. 공백과 용량 표현을 제외한 비교 키 생성
4. 앞뒤 후보가 동일하거나 한쪽이 다른 쪽을 충분히 포함하면 중복 처리
5. 영수증에서 먼저 나온 정상 상품 행 유지

이 규칙은 로컬 영수증 파서와 서버 AI 후보 정리, 모바일 후보 병합에 동일하게
적용합니다.

## 공용 제외 목록으로 만들지 않는 이유

한 사용자가 제외한 상품이 다른 사용자에게는 실제 보관 상품일 수 있습니다.
따라서 제외 목록은 전체 사용자가 공유하지 않고 기기별로 저장합니다.

로그인을 도입하면 다음 우선순위로 확장합니다.

```text
로그인 계정 제외 목록
→ 현재 기기 제외 목록
→ 제외 없음
```

클라이언트가 전달한 계정 ID를 그대로 신뢰하면 안 됩니다. 서버가 인증 토큰을
검증한 뒤 얻은 계정 ID만 사용해야 합니다.

## 운영 DB 확인

최근 기기별 제외 항목을 확인합니다.

```powershell
cd "C:\Workspace\FreshKeeper\cloudflare\worker"

npx.cmd wrangler d1 execute freshkeeper-ocr-feedback --remote --command `
  "SELECT original_name, normalized_name, substr(client_id,1,24) AS client_id, created_at, updated_at
   FROM product_candidate_exclusions
   ORDER BY updated_at DESC
   LIMIT 20;"
```

같은 영수증이 실제로 두 번 처리됐는지 확인합니다.

```powershell
npx.cmd wrangler d1 execute freshkeeper-ocr-feedback --remote --command `
  "SELECT id, created_at, line_count, selected_count, rejected_count
   FROM receipt_feedback
   ORDER BY created_at DESC
   LIMIT 10;"
```

`receipt_feedback`에 두 기록이 있으면 중복 영수증으로 처리를 건너뛴 것이
아닙니다. 제외 테이블이 비어 있다면 모바일의 제외 동작이 제외 API를 호출하지
않았거나, 수정된 Metro 번들이 앱에 반영되지 않은 상태인지 확인합니다.

## 수정 후 검증 절차

1. Metro에서 `r`을 눌러 최신 JavaScript를 반영합니다.
2. 영수증을 인식합니다.
3. OCR 선택 화면이나 후보 카드에서 상품 하나를 제외합니다.
4. 나머지 상품을 등록합니다.
5. D1의 `product_candidate_exclusions`에서 제외 행을 확인합니다.
6. 동일한 영수증을 다시 인식합니다.
7. 제외한 상품이 후보에 나타나지 않는지 확인합니다.
8. `상품명`과 `상품명IRC -할인금액`이 하나만 표시되는지 확인합니다.

JavaScript와 Worker 변경만 있는 경우 APK를 만들 필요가 없습니다. Worker 변경은
마이그레이션과 배포가 필요하고, 모바일 변경은 Metro 재실행으로 확인합니다.
