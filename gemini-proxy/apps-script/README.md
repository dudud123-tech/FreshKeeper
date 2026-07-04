# Google Apps Script Gemini Proxy

Cloud Run 결제 설정 없이 Gemini 프록시를 만들기 위한 대안입니다.

## 1. Apps Script 프로젝트 만들기

1. https://script.google.com 에 접속합니다.
2. 새 프로젝트를 만듭니다.
3. 기본 `Code.gs` 내용을 이 폴더의 `Code.gs` 내용으로 교체합니다.

## 2. Script Properties 설정

Apps Script 편집기 왼쪽 `Project Settings`에서 `Script properties`를 추가합니다.

```text
GEMINI_API_KEY=Gemini API 키
GEMINI_PROXY_TOKEN=Cloudflare Worker와 공유할 임의의 비밀 토큰
GEMINI_MODEL=gemini-2.5-flash
```

## 3. 웹앱 배포

1. `Deploy` -> `New deployment`
2. 유형: `Web app`
3. Execute as: `Me`
4. Who has access: `Anyone`
5. Deploy 후 Web app URL을 복사합니다.

## 4. Cloudflare Worker 연결

```powershell
cd "C:\Workspace\FreshKeeper\cloudflare\worker"
npx.cmd wrangler secret put GEMINI_PROXY_URL
npx.cmd wrangler secret put GEMINI_PROXY_TOKEN
npx.cmd wrangler deploy
```

`GEMINI_PROXY_URL`에는 Apps Script Web app URL을 넣습니다.

## 주의

- Web app URL은 `/exec`로 끝나는 배포 URL을 사용해야 합니다.
- Apps Script는 응답 상태 코드를 세밀하게 제어하지 못하지만, 본문 JSON에 `ok`, `error`를 담아 Worker가 판단할 수 있습니다.
