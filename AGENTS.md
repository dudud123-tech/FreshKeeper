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

## Windows Node / npm Commands

PowerShell may block `npm.ps1` because script execution is disabled.

When npm is needed in this project, prefer the `.cmd` shim:

```powershell
npm.cmd install --package-lock-only --ignore-scripts
npx.cmd eas --version
npx.cmd eas build:list --platform android --limit 1
```

Avoid plain `npm` in PowerShell when it fails with `PSSecurityException`.

## Play Store AAB Builds

For local AAB generation checks:

```powershell
cd "C:\Users\dudu1\OneDrive\Documents\freshkeeper\mobile\android"
.\gradlew.bat bundleRelease
```

The local output is:

```text
C:\Users\dudu1\OneDrive\Documents\freshkeeper\mobile\android\app\build\outputs\bundle\release\app-release.aab
```

Important: the current local Android release build may still be debug-keystore signed. Treat local `bundleRelease` as a build sanity check, not necessarily a Play upload final.

For Play-upload-oriented builds, prefer EAS production:

```powershell
cd "C:\Users\dudu1\OneDrive\Documents\freshkeeper\mobile"
npx.cmd eas build -p android --profile production
```

If the command times out locally, check server-side build state instead of rerunning immediately:

```powershell
npx.cmd eas build:list --platform android --limit 1
```
