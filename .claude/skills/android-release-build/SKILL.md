---
name: android-release-build
description: >
  안드로이드 프로덕션 AAB/APK를 로컬에서 실제 서명 키로 빌드한다. "릴리즈 빌드
  만들어줘", "AAB 만들어줘", "Play Console에 올릴 빌드", "버전 올려서 빌드" 같은
  요청이나 "로그인이 안 된다"/"로그인 버튼이 비활성화됐다" 같은 배포판 버그를
  진단할 때 사용한다.
---

# Android 릴리즈 빌드 (로컬 서명)

## 왜 이 절차가 필요한가

EAS 클라우드 빌드(`eas build`)는 `eas env:create production ...`으로 등록해둔 로그인
관련 환경변수 4개(Google/Kakao/Naver)를 자동으로 넣어주지만, **로컬 Gradle 빌드는
그 값을 모른다.** 이 4개 없이 만든 AAB/APK는 서명은 정상이어도 소셜 로그인이 조용히
깨진다 — 2026-08-17에 실제로 이렇게 깨진 채로 versionCode 21을 배포한 적 있다.

## 절차

1. **`mobile/android/local-release-build.ps1`로만 빌드한다.**
   `gradlew bundleRelease`/`assembleRelease`를 직접 돌리지 않는다 — 이 스크립트가
   로그인 env 변수 4개(`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`,
   `EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY`, `EXPO_PUBLIC_NAVER_CLIENT_ID`,
   `EXPO_PUBLIC_NAVER_CLIENT_SECRET`)를 설정한 뒤 `bundleRelease`를 실행해준다.
   이 스크립트는 실제 키 값이 들어있어 git엔 없다(gitignore) — 값이 필요하면
   저장소 밖의 `파일/로그인 설정.md` 또는 `eas env:list production`을 참고할 것.

2. **버전을 먼저 올린다** — 세 곳을 같이 맞춘다:
   - `mobile/app.json`: `version`, `android.versionCode`
   - `mobile/android/app/build.gradle`: `versionCode`, `versionName`
   - `mobile/package.json`: `version`
   버그 수정만 있으면 패치(x.x.+1), 사용자 체감 기능이 있으면 마이너(x.+1.0) 버전을
   올린다. Play Console은 같은 versionCode를 재업로드하지 못한다.

3. **⚠️ Gradle 태스크 캐시 함정 (가장 중요)**: 로그인 env 값만 바뀌고 JS/네이티브
   소스 파일은 안 바뀌면, `createBundleReleaseJsAndAssets` 태스크가 "입력이 안
   바뀌었다"고 판단해 JS 번들을 재생성하지 않고 **이전 빌드(다른 env 값으로 만든)
   결과를 그대로 재사용**한다. `%LOCALAPPDATA%\Temp\metro-cache` 같은 Metro 자체
   캐시를 지워도 이 Gradle 태스크 캐시는 안 지워진다(실제로 확인함 — Metro 캐시
   삭제 후 재빌드해도 여전히 스킵됨). 로그인 값이 이전 빌드와 다를 가능성이 있으면
   (env 값을 새로 설정했거나, 이전에 깨진 빌드를 만든 적이 있으면) 반드시 아래처럼
   `--rerun-tasks`를 붙여서 강제로 전부 다시 실행시킨다:
   ```powershell
   # local-release-build.ps1과 같은 env 변수를 먼저 설정한 뒤
   cd mobile/android
   .\gradlew.bat bundleRelease --rerun-tasks
   ```
   `gradlew clean`은 네이티브 C++/CMake 클린이 autolinking codegen 폴더를 지웠다가
   자기 자신이 못 찾아서 자주 실패한다 — 이 실패는 무시해도 된다, JS 번들 캐시
   문제와는 무관한 별개의 흔한 오류다.

4. **빌드 후 반드시 검증한다** — "BUILD SUCCESSFUL" 로그만 믿지 않는다. 완성된
   AAB를 열어서 로그인 키가 실제로 JS 번들 안에 들어있는지 문자열로 확인한다:
   ```powershell
   $aab = "mobile\android\app\build\outputs\bundle\release\app-release.aab"
   $tmp = "$env:TEMP\aab_check"
   Remove-Item -Recurse -Force $tmp, "$tmp.zip" -ErrorAction SilentlyContinue
   Copy-Item $aab "$tmp.zip"
   Expand-Archive "$tmp.zip" -DestinationPath $tmp
   $bundle = (Get-ChildItem $tmp -Recurse -Filter "*.bundle" | Select-Object -First 1).FullName

   # 아래 세 값은 local-release-build.ps1에 실제로 들어있는 값 그대로 채워 넣을 것
   Select-String -Path $bundle -Pattern "<EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID 값>" -SimpleMatch -Quiet
   Select-String -Path $bundle -Pattern "<EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY 값>" -SimpleMatch -Quiet
   Select-String -Path $bundle -Pattern "<EXPO_PUBLIC_NAVER_CLIENT_ID 값>" -SimpleMatch -Quiet
   ```
   세 줄 다 `True`가 나와야 정상이다. 하나라도 `False`면 3번(`--rerun-tasks`)부터
   다시 한다.

5. AAB는 `mobile/android/app/build/outputs/bundle/release/app-release.aab`에
   생긴다. Play Console에 새 버전으로 업로드한다(기존 versionCode 덮어쓰기 불가).

6. Play Console에서 심사 통과 후 실제 배포(사용자가 받을 수 있는 상태)가 **확인된
   뒤에만** `cloudflare/worker/src/index.js`의 `LATEST_ANDROID_VERSION_CODE`와
   `ANDROID_WHATS_NEW.versionCode`를 새 versionCode로 올리고, 워커 디렉터리에서
   `npm run deploy`로 배포한다. **배포 확인 전에 미리 올리지 않는다** — 스토어에
   아직 없는 versionCode를 `LATEST_ANDROID_VERSION_CODE`에 넣으면 기존 사용자에게
   "업데이트하세요" 팝업이 뜨는데 정작 스토어엔 받을 게 없는 상태가 된다.
   `MIN_SUPPORTED_ANDROID_VERSION_CODE`(강제 차단 기준)는 심각한 버그 버전을 죽여야
   할 때만 손댄다 — 일반 릴리즈에서는 건드리지 않는다.
