Cloudflare D1 콘솔에서 바로 쓸 SQL만 정리할게요.

**최근 피드백**
```sql
SELECT
  id,
  created_at,
  app_version,
  ai_request_id,
  line_count,
  selected_count,
  rejected_count
FROM receipt_feedback
ORDER BY created_at DESC
LIMIT 20;
```

**특정 피드백의 최종 등록 상품**
```sql
SELECT
  item_index,
  name_masked
FROM receipt_feedback_selected_items
WHERE receipt_id = '피드백_ID'
ORDER BY item_index;
```

**특정 피드백의 선택 OCR 줄**
```sql
SELECT
  line_index,
  text_masked
FROM ocr_feedback_lines
WHERE receipt_id = '피드백_ID'
  AND selected = 1
ORDER BY line_index;
```

**특정 피드백의 제외 OCR 줄**
```sql
SELECT
  line_index,
  text_masked
FROM ocr_feedback_lines
WHERE receipt_id = '피드백_ID'
  AND selected = 0
ORDER BY line_index;
```

**최근 AI 요청**
```sql
SELECT
  id,
  created_at,
  provider,
  model,
  fallback_from,
  ok,
  error,
  line_count,
  local_candidate_count,
  ai_candidate_count
FROM ai_receipt_requests
ORDER BY created_at DESC
LIMIT 20;
```

**특정 AI 요청의 AI 후보**
```sql
SELECT
  candidate_index,
  name,
  confidence,
  reason
FROM ai_receipt_ai_candidates
WHERE request_id = 'AI_REQUEST_ID'
ORDER BY candidate_index;
```

**AI가 추천했지만 최종 등록 안 된 후보**
```sql
SELECT
  a.candidate_index,
  a.name,
  a.confidence,
  a.reason
FROM ai_receipt_ai_candidates a
WHERE a.request_id = 'AI_REQUEST_ID'
  AND NOT EXISTS (
    SELECT 1
    FROM receipt_feedback_selected_items f
    WHERE f.receipt_id = '피드백_ID'
      AND REPLACE(REPLACE(f.name_masked, ' ', ''), '*', '')
        = REPLACE(REPLACE(a.name, ' ', ''), '*', '')
  )
ORDER BY a.candidate_index;
```

**AI 후보에는 없었지만 사용자가 최종 등록한 상품**
```sql
SELECT
  f.item_index,
  f.name_masked
FROM receipt_feedback_selected_items f
WHERE f.receipt_id = '피드백_ID'
  AND NOT EXISTS (
    SELECT 1
    FROM ai_receipt_ai_candidates a
    WHERE a.request_id = 'AI_REQUEST_ID'
      AND REPLACE(REPLACE(a.name, ' ', ''), '*', '')
        = REPLACE(REPLACE(f.name_masked, ' ', ''), '*', '')
  )
ORDER BY f.item_index;
```

방금 테스트 기준으로는:
- `피드백_ID`: `c9cb3088-45a7-4f3c-878f-a93313bf815c`
- `AI_REQUEST_ID`: `e1822eba-0283-4369-89f6-e5d34cf8d447`


이건 **등록된 게 맞습니다.** 헷갈린 이유는 `created_at`이 **UTC 시간**으로 저장돼서 그래요.

한국 시간(KST)은 UTC보다 **+9시간**입니다.

```text
2026-06-07T02:38:18.080Z
+ 9시간
= 2026-06-07 오전 11:38:18
```

그러니까 네가 말한 **오전 11시 42분쯤 테스트한 것**과 거의 같은 건입니다.

최신 피드백:
```text
c9cb3088-45a7-4f3c-878f-a93313bf815c
UTC 2026-06-07 02:38
KST 2026-06-07 11:38
```

AI 요청은 그보다 조금 앞:
```text
e1822eba-0283-4369-89f6-e5d34cf8d447
UTC 2026-06-07 02:36
KST 2026-06-07 11:36
```

즉 흐름은:

```text
11:36 AI 분석 요청
11:38 최종 등록/피드백 저장
```

Cloudflare D1에서 한국 시간으로 보고 싶으면 이렇게 조회하면 됩니다.

```sql
SELECT
  id,
  datetime(created_at, '+9 hours') AS created_at_kst,
  app_version,
  ai_request_id,
  line_count,
  selected_count,
  rejected_count
FROM receipt_feedback
ORDER BY created_at DESC
LIMIT 20;
```