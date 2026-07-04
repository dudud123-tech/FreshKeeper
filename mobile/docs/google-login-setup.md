# Google 로그인 설정

오늘까지야의 Google 로그인은 선택 기능입니다. 로그인하지 않아도 기존처럼
기기별 익명 식별자로 상품 분류와 제외 설정을 사용할 수 있습니다.

로그인하면 기기에서 쌓인 분류·제외 설정을 계정으로 옮기고, 이후 같은 계정의
다른 기기에서도 이어서 사용합니다.

## Google Cloud에서 준비할 값

Android 패키지 이름:

```text
com.palchonajae.freshkeeper
```

현재 Google Cloud 프로젝트에서 다음 항목까지 준비했습니다.

- Android OAuth Client
  - 패키지: `com.palchonajae.freshkeeper`
  - 현재 개발용 인증서 SHA-1 등록 완료
  - 확인된 SHA-1: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`
- 웹 애플리케이션 OAuth Client
  - Client ID:

```text
611436823733-7ldq3bsc3cdlq8nuso0op3o56j9j1cmi.apps.googleusercontent.com
```

웹 Client ID는 모바일이 Google ID 토큰을 요청할 때 사용하고, Worker도 같은
값으로 토큰의 `aud`를 검증합니다.

실제로 동작한 조합은 아래와 같습니다.

- 앱의 `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`: `611436823733-7ldq3bsc3cdlq8nuso0op3o56j9j1cmi.apps.googleusercontent.com`
- Worker의 `GOOGLE_WEB_CLIENT_ID`: `611436823733-7ldq3bsc3cdlq8nuso0op3o56j9j1cmi.apps.googleusercontent.com`
- Android OAuth Client: 패키지 `com.palchonajae.freshkeeper`, SHA-1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`

Client ID는 공개 식별자이지만 Client Secret은 모바일 앱이나 저장소에 넣지
않습니다. Google Cloud에서 내려받은 `client_secret_*.json`도 프로젝트 폴더에
복사하거나 Git에 올리지 않습니다. 오늘까지야 로그인 구현에는 그 파일과 Client
Secret이 필요하지 않습니다.

출시할 때 업로드 키와 Play 앱 서명 키의 SHA-1이 현재 개발용 키와 다르면, 같은
패키지명으로 각각 별도의 Android OAuth Client를 추가합니다.

## 모바일 환경 변수

Metro를 시작하기 전에 웹 Client ID를 지정합니다.

```powershell
cd "C:\Workspace\FreshKeeper\mobile"
$env:EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID="611436823733-7ldq3bsc3cdlq8nuso0op3o56j9j1cmi.apps.googleusercontent.com"
npx.cmd expo start --dev-client
```

`react-native-nitro-google-signin`과 `expo-secure-store`는 네이티브 모듈이므로
최초 적용 후에는 개발 빌드를 한 번 새로 만들어야 합니다. 현재 소스 수정
과정에서는 APK를 자동으로 만들지 않습니다.

현재 프로젝트는 Android 우선으로 구성되어 있어 Nitro 패키지는 Android
autolinking으로 연결합니다. iOS도 지원할 때는 실제 `REVERSED_CLIENT_ID`를
준비한 뒤 `react-native-nitro-google-signin` Expo 플러그인에
`iosUrlScheme` 옵션을 추가해야 합니다. 실제 값 없이 플러그인만 추가하면
Expo 설정과 Metro 번들이 중단됩니다.

## Worker 설정

Worker에는 같은 웹 Client ID를 `GOOGLE_WEB_CLIENT_ID`로 설정합니다.

```powershell
cd "C:\Workspace\FreshKeeper\cloudflare\worker"
npx.cmd wrangler secret put GOOGLE_WEB_CLIENT_ID
npx.cmd wrangler deploy --keep-vars
```

`wrangler secret put`가 값을 물으면 다음 Client ID만 붙여 넣습니다.

```text
611436823733-7ldq3bsc3cdlq8nuso0op3o56j9j1cmi.apps.googleusercontent.com
```

여러 ID를 허용해야 하면 쉼표로 구분할 수 있습니다. Google Client Secret은
필요하지 않습니다. Worker는 Google 공개 JWKS로 ID 토큰 서명을 확인하고,
발급자와 대상 Client ID를 함께 검증합니다. 계정 식별에는 이메일 대신
Google의 안정적인 `sub` 값을 사용합니다.

## 남은 작업

- Worker에 `GOOGLE_WEB_CLIENT_ID` 등록
- 위 환경 변수를 지정한 상태로 Metro 실행
- Google 네이티브 모듈이 포함된 Android 개발 빌드 1회 생성
- Google 인증 플랫폼이 테스트 모드라면 사용할 Google 계정을 테스트 사용자로 등록
- Play 출시 후 Play 앱 서명 SHA-1용 Android OAuth Client 추가

## 적용 확인

1. 설정 → 계정에서 `Google로 로그인`을 누릅니다.
2. 표시 이름과 이메일이 나타나는지 확인합니다.
3. 상품 후보 하나를 제외하거나 분류를 수정해 등록합니다.
4. 같은 계정으로 다시 로그인했을 때 계정별 설정이 유지되는지 확인합니다.

Client ID가 없으면 버튼은 `Google 로그인 설정 필요` 상태로 비활성화됩니다.

### `[28444] Developer console is not set up correctly`

Android OAuth Client를 막 만든 직후에는 Google Play Services에 설정이 전파되기
전까지 이 오류가 날 수 있습니다. 현재 개발 APK의 확인된 값은 다음과 같습니다.

```text
패키지: com.palchonajae.freshkeeper
SHA-1: 5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
웹 Client ID: 611436823733-7ldq3bsc3cdlq8nuso0op3o56j9j1cmi.apps.googleusercontent.com
```

Google Cloud의 Android OAuth Client 값이 위와 같다면 5~10분 뒤 다시 시도합니다.
계속 실패하면 Android OAuth Client가 웹 Client와 같은 Google Cloud 프로젝트
`611436823733`에 생성됐는지 확인하고, 잘못된 Android Client를 삭제한 뒤 같은
패키지/SHA-1로 다시 생성합니다.
