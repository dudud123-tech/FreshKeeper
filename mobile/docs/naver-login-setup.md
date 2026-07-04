# 네이버 로그인 설정

오늘까지야의 네이버 로그인은 네이버 Android SDK에서 액세스 토큰을 발급받고,
Cloudflare Worker가 네이버 프로필 API에 토큰을 보내 검증한 뒤 FreshKeeper
세션을 발급하는 구조입니다.

## NAVER Developers 설정

Android 앱 정보:

```text
패키지명: com.palchonajae.freshkeeper
다운로드 예정 URL:
https://play.google.com/store/apps/details?id=com.palchonajae.freshkeeper
```

네이버 로그인 제공 정보는 앱에서 실제 표시할 정보만 선택합니다.

- 별명
- 프로필 사진

이메일을 사용하지 않는다면 제공 정보에서 제외합니다.

개발 중에는 `네이버 로그인 검수요청`을 하지 않아도 됩니다. 실제 로그인 구현,
이용약관, 개인정보처리방침, 접근 가능한 스토어 URL과 검수용 앱이 준비된 뒤
요청합니다.

## 앱 빌드 환경변수

NAVER Developers의 애플리케이션 정보에서 Client ID와 Client Secret을 확인합니다.
Client Secret은 채팅이나 저장소에 올리지 않습니다.

네이버 네이티브 SDK는 앱에서 Client ID와 Client Secret으로 초기화되므로 빌드할
PowerShell 창에 다음 환경변수를 설정합니다.

```powershell
cd "C:\Workspace\FreshKeeper\mobile"

$env:EXPO_PUBLIC_NAVER_CLIENT_ID="NAVER Developers의 Client ID"
$env:EXPO_PUBLIC_NAVER_CLIENT_SECRET="NAVER Developers의 Client Secret"
```

네이버 SDK를 처음 추가한 이후에는 네이티브 모듈이 포함된 새 개발 빌드가
필요합니다. 기존 앱에서 Metro만 다시 시작해서는 네이버 네이티브 모듈이
추가되지 않습니다.

기존 Google과 카카오 환경변수도 같은 PowerShell 창에서 함께 설정한 뒤 빌드합니다.

```powershell
$env:EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID="기존 Google Web Client ID"
$env:EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY="기존 카카오 네이티브 앱 키"

npx.cmd expo run:android
```

## Worker 배포

네이버 로그인은 Worker에 별도의 Client Secret을 저장하지 않습니다. 앱에서 받은
액세스 토큰을 다음 네이버 공식 프로필 API에 보내 유효성과 회원 정보를 확인합니다.

```text
https://openapi.naver.com/v1/nid/me
```

네이버 인증 코드가 추가된 Worker만 다시 배포합니다.

```powershell
cd "C:\Workspace\FreshKeeper\cloudflare\worker"
npx.cmd wrangler deploy --keep-vars
```

`--keep-vars`를 사용해 기존 Google 및 카카오 비밀값을 유지합니다.

## 구현 위치

- Expo 설정: `mobile/app.config.js`
- 모바일 인증 API: `mobile/src/services/authApi.js`
- 인증 상태 Hook: `mobile/src/hooks/useAuth.js`
- 로그인 버튼: `mobile/src/components/SettingsPanel.js`
- Worker 토큰 검증: `cloudflare/worker/src/index.js`

## 테스트 항목

- `네이버로 계속` 버튼 활성화
- 최초 동의 화면에서 별명과 프로필 사진 확인
- 로그인 후 계정 화면의 별명과 프로필 사진 확인
- 네이버 로그인 중 다른 제공자 버튼의 문구가 바뀌지 않는지 확인
- 로그인 취소 시 취소 안내 확인
- 로그아웃 후 재로그인
- 앱 재시작 후 FreshKeeper 로그인 세션 복구
- Google 또는 카카오 계정과 네이버 계정이 자동 병합되지 않는지 확인

네이버와 다른 로그인 제공자의 계정은 서로 다른 FreshKeeper 계정으로 취급합니다.
이메일이 같다는 이유로 계정을 자동 병합하지 않습니다.
