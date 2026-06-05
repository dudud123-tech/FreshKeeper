# FreshKeeper Gemini Proxy

Gemini API key를 앱이나 Cloudflare Worker에 직접 넣지 않기 위한 작은 프록시 서버입니다.

## 역할

- Cloudflare Worker가 `/api/gemini-candidates`로 요청합니다.
- 이 서버가 Gemini API를 호출합니다.
- 결과는 `{ "candidates": [...] }` JSON 형태로 돌려줍니다.

## 로컬 실행

```powershell
cd "C:\Users\dudu1\OneDrive\Documents\freshkeeper\gemini-proxy"
$env:GEMINI_API_KEY="Gemini API 키"
$env:GEMINI_PROXY_TOKEN="Worker와 공유할 임의의 비밀 토큰"
npm start
```

다른 PowerShell 창에서 테스트:

```powershell
cd "C:\Users\dudu1\OneDrive\Documents\freshkeeper\gemini-proxy"
.\test-local.ps1 -Token "Worker와 공유할 임의의 비밀 토큰"
```

## Google Cloud Run 배포

Google Cloud SDK가 설치되어 있어야 합니다.
또한 Google Cloud 프로젝트에 결제 계정이 연결되어 있어야 Cloud Run / Cloud Build API를 켤 수 있습니다.

```powershell
cd "C:\Users\dudu1\OneDrive\Documents\freshkeeper\gemini-proxy"
.\deploy-cloud-run.ps1
```

추천 리전:

```text
asia-northeast3
```

서울 리전입니다. Gemini API 지역 제한이 Cloudflare Worker보다 덜 걸릴 가능성이 높습니다.

## 결제 없이 가벼운 대안: Apps Script

Google Cloud Run 결제 설정이 부담스럽다면 `apps-script` 폴더의 Google Apps Script 웹앱 프록시를 사용하세요.
수동 배포가 필요하지만, 구조가 가장 단순하고 Gemini API 키를 앱에 넣지 않아도 됩니다.

## Worker에 연결

프록시를 배포한 뒤 Cloudflare Worker에 아래 secret을 넣습니다.

```powershell
cd "C:\Users\dudu1\OneDrive\Documents\freshkeeper\cloudflare\worker"
npx.cmd wrangler secret put GEMINI_PROXY_URL
npx.cmd wrangler secret put GEMINI_PROXY_TOKEN
npx.cmd wrangler deploy
```

`GEMINI_PROXY_URL` 값 예:

```text
https://your-gemini-proxy.example.com/api/gemini-candidates
```

## 배포 후보

- Google Cloud Run: Gemini 지역 제한 우회 가능성이 가장 높습니다.
- Render/Railway/Fly.io: 설정은 쉽지만 outbound 지역에 따라 Gemini 제한이 다시 걸릴 수 있습니다.
