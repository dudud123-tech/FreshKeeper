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
cd "C:\Users\dudu1\OneDrive\Documents\freshkeeper\cloudflare\worker"
npm install
npm run db:migrate:local
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
npm run deploy
```
