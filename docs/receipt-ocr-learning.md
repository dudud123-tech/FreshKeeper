# 영수증 OCR → 상품 후보 인식/학습 로직

영수증(또는 주문내역 캡처)을 촬영하면 OCR로 텍스트를 읽고, 상품일 것 같은 줄만
골라 자동으로 "선택된" 상태로 보여준다. 이 문서는 그 과정에서 동작하는
서로 다른 3가지 기억/학습 메커니즘을 정리한다. 이름이 비슷해서 헷갈리기 쉽지만
**저장되는 테이블도, 목적도, 적용 시점도 전부 다르다.**

## 전체 흐름

```
사진 촬영
  │
  ▼
① OCR 텍스트 추출 (기기 내)
  │
  ▼
② 규칙 기반 파싱 — 상품 후보 줄 추출
   mobile/src/receiptParser.js: parseReceiptLines()
  │
  ▼
③ 과거에 "비식품"으로 제외됐던 이름 사전 필터링 (서버 조회)
   filterExcludedProductNames()
  │
  ▼
④ 화면에 후보 카드 표시 — 기본값은 전체 선택(✓)
   AddItemPage.js
  │
  ├─ 사용자가 체크 해제(제외) ──▶ setProductExclusion(name, true)
  │                              → "이건 식품 후보가 아니다" 학습
  │
  └─ 사용자가 등록(추가) ────────▶ addDraft() / addAllDrafts()
                                   → 인벤토리에 저장
                                   → sendProductClassificationFeedback()
                                     "이 상품은 이 카테고리/보관방법/유통기한이다" 학습
                                   → uploadCurrentOcrFeedback()
                                     "이 줄을 실제로 선택했다" 원시 학습 데이터 업로드
```

## ① OCR 텍스트 추출

- `mobile/src/ocr.js`의 `recognizeReceiptImage()`가 기기에서 OCR을 수행해
  텍스트 전체와 줄 단위 좌표(`lines`)를 반환한다. 네트워크 호출 없음.

## ② 규칙 기반 파싱 (식품 후보 추출)

- `mobile/src/receiptParser.js`의 `parseReceiptLines(text)`가 핵심.
- 각 줄에 `scoreLine()`으로 점수를 매겨 `MIN_SCORE = 3` 이상만 후보로 채택한다.
  - 가격 패턴(+4), 수량 패턴(+1), 한글 포함(+2), 적당한 길이(+2) 등
    "영수증 상품 줄처럼 생겼는가"를 채점한다.
  - `foodHints` 배열에 있는 단어를 포함하면 가산점(+3)을 준다. 다만 이건
    **필수 조건이 아니라 보너스**라서, 비식품이어도 가격+한글+길이만으로
    쉽게 통과할 수 있다.
  - `noiseWords`/`noisePatterns`에 걸리면 감점(-8)한다. 세제·배송비·위생용품
    등 자주 나오는 비식품 카테고리를 하드코딩된 키워드 목록으로 걸러낸다.
- **완전히 기기 안에서만 동작**하며 서버 호출이 없다. 네트워크가 없어도
  후보 추출 자체는 항상 동작한다.
- 서버 쪽에 Gemini 기반 AI 후보 분류 파이프라인
  (`cloudflare/worker/src/index.js`의 `handleReceiptCandidates`)이 별도로
  존재하지만, 비용 문제로 모바일 앱에서 호출하지 않도록 보류된 상태다.
  실제로 동작하는 것은 이 규칙 기반 파서뿐이다.

## ③ 과거 제외 이력으로 사전 필터링

- `mobile/src/services/productClassificationApi.js`의
  `filterExcludedProductNames(names)`가 파싱 직후 호출된다
  (`mobile/src/hooks/useReceiptFlow.js:239`).
- 서버의 `/api/product-exclusions/resolve`
  (`cloudflare/worker/src/index.js`의 `handleResolveProductExclusions`)에
  후보 이름 목록을 보내면, **이미 "비식품"으로 학습된 이름**을 돌려주고
  그 이름들은 후보 목록에서 아예 빠진다.
- 여기서 "학습된 이름"은 두 가지를 합친 것이다 (2026-07 이후):
  1. **본인 기록** — 이 기기/계정이 과거에 직접 체크 해제한 정확히 같은
     이름 (`product_candidate_exclusions` 테이블, `subject_key` 일치).
  2. **크로스 유저 집계** — 서로 다른 사용자 **3명 이상**이 독립적으로
     같은 이름을 제외한 적이 있으면, 이 사용자가 처음 보는 상품이어도
     자동으로 걸러진다 (`MIN_GLOBAL_EXCLUSION_VOTERS = 3`).
     처음 겪는 오탐도 여러 사용자의 누적 데이터로 막아주는 부분이며,
     `cloudflare/worker/migrations/0015_product_candidate_exclusions_global_index.sql`
     에서 이 집계 쿼리를 위한 인덱스를 추가했다.
- 네트워크 실패 시에는 기기에 캐시된 제외 목록(`AsyncStorage`)으로 대체 동작한다.

## ④ 화면 표시 및 사용자 액션

- `AddItemPage.js`가 후보들을 카드로 렌더링한다. `excludedDrafts`가 비어있는
  후보는 기본적으로 체크(✓) 상태 — **아무것도 안 건드리면 전부 등록된다.**
- 사용자가 카드를 눌러 제외하면 `toggleDraftExcluded()` →
  `setProductExclusion(name, true)`가 호출되어 위 ③의 "제외 이력"에 기록된다.
  이게 바로 **"다음엔 이 상품이 검출되지 않게" 하는 저장 지점**이다.
- 사용자가 상품을 등록하면(`addDraft()` 또는 `addAllDrafts()`) 두 가지가
  동시에 일어난다:

  | 액션 | 저장 위치 | 목적 |
  |---|---|---|
  | 인벤토리 등록 | 로컬 상태(`setItems`) | 실제 보관 중인 식품 목록 |
  | 분류 피드백 전송 | `product_classifications` 테이블 (`sendProductClassificationFeedback`) | "이 상품명은 이 카테고리/보관방법/유통기한"이라는 예측 학습 — **식품인지 아닌지가 아니라, 등록된 식품을 어떻게 분류할지**를 학습한다 |
  | OCR 줄 선택 피드백 | `receipt_feedback` 계열 테이블 (`uploadCurrentOcrFeedback`) | 어떤 줄을 실제로 선택/거부했는지 원시 데이터 업로드 — 향후 파서/모델 개선용 학습 데이터이며, **지금 당장 필터링에 반영되지는 않는다** |

## 헷갈리기 쉬운 부분 정리

세 가지 "학습"은 서로 완전히 독립적인 저장소를 쓴다.

1. **상품 등록** → 인벤토리에만 저장. 학습과 무관.
2. **분류 학습(`product_classifications`)** → "이 이름이면 카테고리/보관방법/
   유통기한을 이렇게 추천"하는 데만 쓰인다. 식품 여부 판단과는 무관하다.
3. **제외 학습(`product_candidate_exclusions`)** → "이 이름은 애초에 후보로
   보여주지 마라"는 데만 쓰인다. 카테고리 추천과는 무관하다.

즉 "상품을 등록"해도 그 이름이 앞으로 더 잘 추천되게 도와주는 것뿐이고,
"제외(체크 해제)"해야만 다음부터 그 이름이 후보 목록에서 아예 빠진다.
등록과 제외는 서로 다른 API(`sendProductClassificationFeedback` vs
`setProductExclusion`)를 호출하는 별개의 행위다.

## 관련 파일

- `mobile/src/receiptParser.js` — 규칙 기반 파싱, noiseWords/foodHints
- `mobile/src/hooks/useReceiptFlow.js` — 전체 흐름 오케스트레이션
- `mobile/src/services/productClassificationApi.js` — 분류/제외 API 클라이언트
- `mobile/src/services/ocrFeedbackApi.js` — OCR 줄 선택 원시 피드백 업로드
- `cloudflare/worker/src/index.js` — `/api/product-exclusions/*`,
  `/api/product-classifications/*` 엔드포인트
- `cloudflare/worker/migrations/0009_product_candidate_exclusions.sql`,
  `0015_product_candidate_exclusions_global_index.sql` — 제외 이력 테이블/인덱스
