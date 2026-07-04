# 카카오 로그인 설정

오늘까지야의 카카오 로그인은 카카오 네이티브 SDK에서 ID 토큰을 발급받고,
Cloudflare Worker가 토큰을 검증한 뒤 FreshKeeper 세션을 발급하는 구조입니다.

## Kakao Developers 설정

Android 앱 정보:

```text
패키지명: com.palchonajae.freshkeeper
개발용 키 해시: Xo8WBi6jzSxKDVR4drqm84yr9iU=
```

Kakao Developers에서 다음 항목을 설정합니다.

- `카카오 로그인 > 일반 > 사용 설정`: `ON`
- OpenID Connect: `ON`
- 닉네임: 선택 동의
  - 동의 목적: `앱 내 사용자 이름 표시 및 계정 식별`
- 프로필 사진: 선택 동의
  - 동의 목적: `앱 내 사용자 프로필 이미지 표시`

`간편가입`과 `고급`은 현재 로그인 기능에 필요하지 않습니다.

## 앱 빌드 환경변수

네이티브 앱 키는 Android 앱 식별에 필요한 공개 키입니다. 앱 소스에 직접
작성하지 않고 빌드할 PowerShell 창에서 환경변수로 설정합니다.

```powershell
cd "C:\Workspace\FreshKeeper\mobile"

$env:EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID="기존 Google Web Client ID"
$env:EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY="Kakao Developers의 네이티브 앱 키"

npx.cmd expo run:android
```

카카오 SDK를 처음 추가한 이후에는 네이티브 모듈이 포함된 새 개발 빌드가
필요합니다. 기존 앱에서 Metro만 다시 시작해서는 카카오 네이티브 모듈이
추가되지 않습니다.

## Worker 설정

Worker는 같은 네이티브 앱 키를 사용해 카카오 ID 토큰의 `aud`를 검증합니다.

```powershell
cd "C:\Workspace\FreshKeeper\cloudflare\worker"
npx.cmd wrangler secret put KAKAO_NATIVE_APP_KEY
```

입력 요청이 나오면 Kakao Developers의 네이티브 앱 키 값만 입력합니다.
비밀값 이름이 아니라 값 입력란에 키를 넣어야 합니다.

등록 후 배포합니다.

```powershell
npx.cmd wrangler deploy --keep-vars
```

다음과 같이 앱 키를 `deploy` 명령 뒤에 붙이지 않습니다.

```powershell
# 잘못된 예
npx.cmd wrangler deploy --keep-vars 네이티브앱키
```

## 구현 위치

- Expo 설정: `mobile/app.config.js`, `mobile/app.json`
- Android 설정: `mobile/android/build.gradle`
- Android 리디렉션: `mobile/android/app/src/main/AndroidManifest.xml`
- 모바일 인증 API: `mobile/src/services/authApi.js`
- 인증 상태 Hook: `mobile/src/hooks/useAuth.js`
- 로그인 버튼: `mobile/src/components/SettingsPanel.js`
- Worker 토큰 검증: `cloudflare/worker/src/index.js`

## 테스트 항목

- 카카오톡이 설치된 기기에서 `카카오로 계속`
- 최초 동의 화면에서 닉네임과 프로필 사진 선택
- 로그인 후 계정 화면의 닉네임과 프로필 사진
- 로그아웃 후 재로그인
- 로그인 화면에서 취소했을 때 오류 대신 취소 안내
- 카카오톡이 없는 기기에서 카카오계정 로그인

Play 스토어 출시용 서명 인증서가 개발용 인증서와 다르면 출시용 키 해시를
Kakao Developers에 추가해야 합니다.
