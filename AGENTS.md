# FreshKeeper Codex Notes

## Rule Capture Policy

When work is blocked and a reliable workaround or successful method is found, update this file so future turns can start from that method.

Capture rules when all of these are true:

- The problem is likely to happen again on this Windows/Expo/Android project.
- The successful method is concrete enough to repeat.
- The rule reduces trial-and-error, encoding mistakes, build failures, or tool confusion.

Keep each rule short and operational:

- what failed or is risky
- the command or method that worked
- when to use it next time

Do not add speculative ideas here. Add only methods that were actually verified in this project.

## Windows Python Runtime

On this machine, `python` and `py` may not be available on `PATH`.
When a Python one-off script is needed, use the Codex bundled Python:

```powershell
@'
print("hello")
'@ | & "C:\Users\dudu1\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" -
```

This form is known to work in PowerShell and is useful for image processing tasks such as editing PNG alpha channels with Pillow.

Avoid these forms in PowerShell here:

```powershell
python -
py -
py - <<'PY'
```

They may fail because `python`/`py` are unavailable or because PowerShell does not support Unix heredoc syntax.

## Korean Text / UTF-8 Checks

Many project files contain Korean UI strings. PowerShell `Get-Content` output can display mojibake depending on the console encoding, even when the file itself is valid UTF-8.

When reading or verifying files that contain Korean text, prefer one of these UTF-8-safe checks from the start:

```powershell
Get-Content -Path "C:\path\to\file.js" -Encoding UTF8
```

or, for precise inspection:

```powershell
@'
from pathlib import Path
path = Path(r"C:\path\to\file.js")
print(path.read_text(encoding="utf-8"))
'@ | & "C:\Users\dudu1\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" -
```

Do not assume Korean text is corrupted just because plain PowerShell output looks broken. Confirm with UTF-8 reading before editing or reverting text.

When inserting or replacing Korean UI text from a PowerShell one-off script, do not paste raw Korean into a Node/PowerShell here-string unless it has been verified to round-trip as UTF-8. This can silently write literal `?` characters into source files.

For repeatable script-based edits, prefer one of these safer methods:

- Use `apply_patch` for normal edits containing Korean text.
- If a script is necessary, store Korean literals as Unicode escapes such as `"\uC0C1\uD488\uBA85"`.
- Immediately verify the actual file contents with Node or UTF-8 Python, not plain console rendering:

```powershell
@'
const fs = require('fs');
const s = fs.readFileSync('C:/path/to/file.js', 'utf8');
console.log(JSON.stringify(s.match(/label="([^"]+)"/)?.[1]));
console.log('literal question labels', [...s.matchAll(/label="\?+/g)].length);
'@ | node -
```

If the verification shows literal `?` in Korean UI labels or messages, treat it as file corruption and fix it before running builds.

When inserting or replacing Korean UI text from a PowerShell one-off script, do not paste raw Korean into a Node/PowerShell here-string unless it has been verified to round-trip as UTF-8. This can silently write literal `?` characters into source files.

For repeatable script-based edits, prefer one of these safer methods:

- Use `apply_patch` for normal edits containing Korean text.
- If a script is necessary, store Korean literals as Unicode escapes such as `"\uC0C1\uD488\uBA85"`.
- Immediately verify the actual file contents with Node or UTF-8 Python, not plain console rendering:

```powershell
@'
const fs = require('fs');
const s = fs.readFileSync('C:/path/to/file.js', 'utf8');
console.log(JSON.stringify(s.match(/label="([^"]+)"/)?.[1]));
console.log('literal question labels', [...s.matchAll(/label="\?+/g)].length);
'@ | node -
```

If the verification shows literal `?` in Korean UI labels or messages, treat it as file corruption and fix it before running builds.

## Windows Node / npm Commands

PowerShell may block `npm.ps1` because script execution is disabled.

When npm is needed in this project, prefer the `.cmd` shim:

```powershell
npm.cmd install --package-lock-only --ignore-scripts
npx.cmd eas --version
npx.cmd eas build:list --platform android --limit 1
```

Avoid plain `npm` in PowerShell when it fails with `PSSecurityException`.

## Cloudflare Worker Fetch Redirects

Cloudflare Workers `fetch()` does not support `redirect: "error"`. It throws
before sending the request. Use `redirect: "manual"` when redirects must not be
followed. This was verified with the Naver profile API: the unsupported value
caused `naver_profile_unavailable`, while `"manual"` returned the expected API
response.

## Play Store AAB Builds

Do not build or install an APK during ordinary code changes unless the user explicitly asks for it. For JavaScript-only UI changes, rely on Metro; for native changes, leave the source ready for the user's next native build.

On Windows, Release CMake output can exceed the 260-character path limit under the OneDrive workspace. A `subst` drive is not sufficient because CMake canonicalizes dependency paths back to `C:\Users\...`. The verified workaround is to copy `mobile` to a genuinely short physical path such as `C:\fk`, remove copied `node_modules\**\android\build` caches plus `android\app\.cxx`, `android\app\build`, and Gradle caches, then build from `C:\fk\android`. Preserve package runtime `build` folders such as `expo-modules-autolinking\build`. If long generated caches resist deletion, use the verified extended form `\\?\C:\fk\...` with `[System.IO.Directory]::Delete(path, $true)`.

For local AAB generation checks:

```powershell
cd "C:\Workspace\FreshKeeper\mobile\android"
.\gradlew.bat bundleRelease
```

The local output is:

```text
C:\Workspace\FreshKeeper\mobile\android\app\build\outputs\bundle\release\app-release.aab
```

Important: the current local Android release build may still be debug-keystore signed. Treat local `bundleRelease` as a build sanity check, not necessarily a Play upload final.

For Play-upload-oriented builds, prefer EAS production:

```powershell
cd "C:\Workspace\FreshKeeper\mobile"
npx.cmd eas build -p android --profile production
```

Because this project has a checked-in `mobile/android` directory, EAS Build ignores
`expo.android.versionCode` from `mobile/app.json` and uses the native Gradle value
instead. Before every Play upload build, update and verify both files:

```text
mobile/app.json
mobile/android/app/build.gradle
```

The authoritative Play upload value is:

```gradle
// mobile/android/app/build.gradle
defaultConfig {
    versionCode 2
}
```

If only `app.json` is changed, Play Console will still reject the new AAB with
`version code has already been used`.

If the command times out locally, check server-side build state instead of rerunning immediately:

```powershell
npx.cmd eas build:list --platform android --limit 1
```

## Android Display Size Changes

Samsung의 화면 크게/작게 변경은 `density` configuration change를 발생시킵니다. React Native 0.81/Fabric에서는 DisplayMetrics만 갱신하면 텍스트 측정과 터치 좌표가 이전 density에 남을 수 있습니다.

- `MainActivity`의 `android:configChanges`에 `density|fontScale|fontWeightAdjustment`를 포함합니다.
- `onConfigurationChanged()`에서 `DisplayMetricsHolder.initDisplayMetrics(this)`를 먼저 호출하고 루트 레이아웃을 요청합니다.
- `useWindowDimensions()`의 width/height/scale을 key로 사용해 `App` 아래 View 트리만 다시 생성합니다. 앱 상태와 JS 런타임은 유지하면서 Text/Gesture/SafeArea 네이티브 캐시를 교체합니다.

SM-S948N에서 위 방식 적용 후 화면 크게/작게 1~5단계의 텍스트와 터치가 모두 정상 동작하는 것을 검증했습니다.

설정처럼 세로 `ScrollView` 안에 가로 탭 `ScrollView`가 있고 활성 내용의 높이가 짧으면 가로 영역이 세로로 늘어날 수 있습니다. 탭 스크롤에 명시적인 `height`와 `flexGrow: 0`, `flexShrink: 0`을 지정합니다. SM-S948N에서 가족/인식 제목의 시작 bounds가 동일해지는 것으로 검증했습니다.
