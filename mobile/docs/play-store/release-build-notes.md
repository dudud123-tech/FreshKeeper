# 오늘까지야 출시 빌드 메모

마지막 업데이트: 2026-06-21

## 현재 빌드 결과

| 항목 | 값 |
|---|---|
| 앱 버전명 | `1.0.0` |
| Android versionCode | `1` |
| AAB 생성 결과 | 성공 |
| AAB 경로 | `android/app/build/outputs/bundle/release/app-release.aab` |
| AAB 크기 | 약 152.4 MB |

## EAS Play 업로드용 빌드

| 항목 | 값 |
|---|---|
| EAS 빌드 ID | `dd000328-c073-4a4a-9640-501cbb8c14bb` |
| 상태 | `in progress` |
| 프로필 | `production` |
| 배포 방식 | `store` |
| 버전 | `1.0.0` |
| 버전 코드 | `1` |
| 로그 | https://expo.dev/accounts/wooyoung43/projects/fresh-keeper-mobile/builds/dd000328-c073-4a4a-9640-501cbb8c14bb |

## 이번에 정리한 것

- `app.json`, `package.json`, `package-lock.json` 버전을 `1.0.0`으로 정리했습니다.
- Android `versionCode`는 `1`로 설정했습니다.
- 아직 구현하지 않은 음성 등록 기능 때문에 남아 있던 `RECORD_AUDIO` 권한을 제거했습니다.
- 로컬에서 `gradlew bundleRelease`로 AAB 생성이 되는지 확인했습니다.

## 주의할 점

현재 생성된 AAB는 로컬 빌드 테스트용입니다. `android/app/build.gradle`의 release 빌드가 아직 `debug.keystore`로 서명되고 있어서, 이 파일을 그대로 Play Console 최종 업로드용으로 쓰면 안 됩니다.

Play Console 업로드용 최종 AAB를 만들려면 다음 중 하나를 선택해야 합니다.

## 선택지 A: EAS Build 사용

Expo/EAS가 Android 업로드 키를 관리하게 하는 방식입니다. 키 관리 실수를 줄일 수 있어서 현재 프로젝트에는 이 방식이 가장 편합니다.

```powershell
cd "C:\Workspace\FreshKeeper\mobile"
eas build -p android --profile production
```

2026-06-21 기준으로 위 방식의 production 빌드를 서버에 등록했습니다. 완료 후 `Application Archive URL`에 AAB 다운로드 링크가 표시됩니다.

## 선택지 B: 로컬 업로드 키 생성

로컬에서 keystore를 만들고 `gradle.properties` 또는 환경변수로 서명 정보를 넣는 방식입니다. 키 파일을 잃어버리면 업데이트가 어려워질 수 있으므로 반드시 백업이 필요합니다.

```powershell
keytool -genkeypair -v -storetype JKS -keyalg RSA -keysize 2048 -validity 10000 -keystore upload-keystore.jks -alias upload
```

그 다음 `android/app/build.gradle`의 release signingConfig를 upload key 기준으로 바꿔야 합니다. 키 비밀번호는 절대 Git에 올리면 안 됩니다.
