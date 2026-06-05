param(
  [string]$Token = ""
)

$ErrorActionPreference = "Stop"

$headers = @{
  "Content-Type" = "application/json; charset=utf-8"
}

if ($Token) {
  $headers.Authorization = "Bearer $Token"
}

$body = @{
  model = "gemini-2.5-flash"
  prompt = @"
You are helping a Korean expiry-date inventory app parse noisy receipt OCR text.
Return only valid JSON.
OCR lines:
0: 서울우유 1L 2,800 1 2,800
1: 합계 2,800
"@
  responseSchema = @{
    type = "OBJECT"
    properties = @{
      candidates = @{
        type = "ARRAY"
        items = @{
          type = "OBJECT"
          properties = @{
            name = @{ type = "STRING" }
            confidence = @{ type = "NUMBER" }
            reason = @{ type = "STRING" }
          }
          required = @("name", "confidence")
        }
      }
    }
    required = @("candidates")
  }
} | ConvertTo-Json -Depth 20

Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8789/api/gemini-candidates" `
  -Headers $headers `
  -Body $body
