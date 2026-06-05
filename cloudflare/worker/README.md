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
