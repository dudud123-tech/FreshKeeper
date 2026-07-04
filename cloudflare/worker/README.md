# FreshKeeper OCR Feedback Worker

Cloudflare Workers + D1 API for collecting beta OCR selection feedback.

The app should send OCR text lines, bounding boxes, and whether each line was accepted as a product. Do not upload receipt images.

## API

### `GET /api/health`

Returns a simple health check.

### `POST /api/ocr-feedback`

Example body:

```json
{
  "appVersion": "dev 2026-05-28.4",
  "parserVersion": "rules-v1",
  "deviceLocale": "ko-KR",
  "storeHint": "emart",
  "ocrLines": [
    {
      "text": "프링글스 양파맛 110g",
      "selected": true,
      "box": { "x": 120, "y": 840, "width": 320, "height": 42 }
    },
    {
      "text": "8886467100024",
      "selected": false,
      "box": { "x": 132, "y": 892, "width": 260, "height": 34 }
    }
  ]
}
```

Sensitive numeric patterns are masked again on the server before storage.

### `POST /api/product-classifications/resolve`

Resolves OCR product names using this priority:

1. the current device's previous choice
2. community consensus (at least 3 devices and 60% category agreement)
3. the FoodSafetyKorea product catalog stored in D1
4. a neutral `기타 / 냉장 / 7일` default

```json
{
  "clientId": "device_example_123456",
  "names": ["동물복지 대란 30구", "가농 DHA 계란과자"]
}
```

### `POST /api/product-classifications/feedback`

Stores one latest preference per device and normalized product name. Repeated
registrations from one device therefore count as one community vote.

```json
{
  "clientId": "device_example_123456",
  "items": [
    {
      "name": "동물복지 대란 30구",
      "predictedCategory": "기타",
      "predictedStorage": "냉장",
      "predictedExpiryDays": 7,
      "predictedSource": "default",
      "finalCategory": "신선식품",
      "finalStorage": "냉장",
      "finalExpiryDays": 21
    }
  ]
}
```

### `POST /api/product-exclusions/resolve`

Returns product names excluded by the current anonymous device so subsequent
OCR scans can suppress them before displaying candidates.

### `POST /api/product-exclusions`

Adds or removes device-specific exclusions immediately.

```json
{
  "clientId": "device_example_123456",
  "exclude": ["요거트 프로즌IRC"],
  "include": []
}
```

## Optional social accounts

Anonymous use remains supported. With a valid Bearer session, classification
preferences and exclusions use an account identity instead of an installation
identity.

- `POST /api/auth/google`: verifies a Google ID token and migrates the current
  installation's preferences to the account.
- `POST /api/auth/kakao`: verifies a Kakao OpenID Connect ID token and migrates
  the current installation's preferences to the account.
- `POST /api/auth/naver`: verifies a Naver access token through Naver's profile
  API and migrates the current installation's preferences to the account.
- `GET /api/auth/session`: returns the account for a valid Bearer session.
- `POST /api/auth/logout`: revokes the supplied Bearer session.

The Worker verifies each provider token's signature, issuer, and audience and
uses its `sub` claim as the provider identity. Session tokens are opaque random
values; only their SHA-256 hashes are stored in D1.

Set the provider audiences before enabling mobile login:

```powershell
npx.cmd wrangler secret put GOOGLE_WEB_CLIENT_ID
npx.cmd wrangler secret put KAKAO_NATIVE_APP_KEY
```

Multiple accepted audiences can be supplied as a comma-separated value.
Naver does not require an additional Worker secret because the Worker validates
the supplied access token directly against Naver's profile API.

## Beta feedback queries

Recent OCR feedback receipts:

```powershell
npx.cmd wrangler d1 execute freshkeeper-ocr-feedback --remote --command "SELECT id, ai_request_id, created_at, app_version, line_count, selected_count, rejected_count FROM receipt_feedback ORDER BY created_at DESC LIMIT 20;"
```

OCR lines and selected flags for one receipt:

```powershell
npx.cmd wrangler d1 execute freshkeeper-ocr-feedback --remote --command "SELECT line_index, selected, text_masked, x, y, width, height FROM ocr_feedback_lines WHERE receipt_id = 'RECEIPT_ID' ORDER BY line_index;"
```

Final products registered by the user for one receipt:

```powershell
npx.cmd wrangler d1 execute freshkeeper-ocr-feedback --remote --command "SELECT item_index, name_masked FROM receipt_feedback_selected_items WHERE receipt_id = 'RECEIPT_ID' ORDER BY item_index;"
```

Compare AI output with final user-selected products:

```powershell
npx.cmd wrangler d1 execute freshkeeper-ocr-feedback --remote --command "SELECT r.id AS receipt_id, r.ai_request_id, r.created_at, a.name AS ai_name, s.name_masked AS final_name FROM receipt_feedback r LEFT JOIN ai_receipt_ai_candidates a ON a.request_id = r.ai_request_id LEFT JOIN receipt_feedback_selected_items s ON s.receipt_id = r.id ORDER BY r.created_at DESC LIMIT 50;"
```

## Local Setup

```powershell
cd "C:\Workspace\FreshKeeper\cloudflare\worker"
npm install
npm run db:migrate:local
npm run db:seed:classifications:local
npm run dev
```

## Cloudflare Setup

Create the D1 database:

```powershell
npm run db:create
```

Copy the returned `database_id` into `wrangler.toml`, then apply migrations and deploy:

```powershell
npm run db:migrate:remote
npm run db:seed:classifications:remote
npm run deploy
```

Apply the migration before importing the classification catalog. The seed file
is generated from `mobile/src/data/productClassifier.json` into the ignored
`.generated` directory.
