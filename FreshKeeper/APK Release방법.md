# APK 빌드 완료 보고 및 수동 빌드 가이드

로컬 환경에서 단독 실행 가능한 Android APK 빌드를 성공적으로 완료하였습니다.

## 1. 생성된 APK 파일 정보

* **파일명**: `app-release.apk`
* **파일 위치**: [app-release.apk](file:///c:/Users/dudu1/OneDrive/Documents/freshkeeper/mobile/android/app/build/outputs/apk/release/app-release.apk)
* **파일 크기**: 약 265MB (OpenCV 및 각 아키텍처용 네이티브 라이브러리가 포함되어 있어 파일이 다소 큽니다)

이 APK 파일은 임시 디버그 키(`debug.keystore`)로 서명된 릴리스 버전입니다. Expo Metro 서버 없이 모바일 기기(실기기)에 직접 복사해서 설치하면 단독 실행이 가능합니다.

---

## 2. 사용자가 수동으로 직접 빌드하는 방법

앞으로 PC에서 직접 단독 실행형 APK를 빌드하고 싶으실 때는 PowerShell 또는 터미널을 열고 아래 순서대로 실행하시면 됩니다.

### [사전 준비]
* PC에 **Java JDK 17**과 **Android SDK**(안드로이드 스튜디오 설치 시 기본 설치됨)가 설정되어 있어야 합니다. (현재 사용자의 PC에는 이미 모두 구성되어 작동함을 확인했습니다)

### [수동 빌드 명령]

1. **PowerShell을 실행하고 모바일 안드로이드 폴더로 이동합니다.**
   ```powershell
   cd "c:\Users\dudu1\OneDrive\Documents\freshkeeper\mobile\android"
   ```

2. **Gradle 래퍼를 사용해 릴리스 APK를 빌드합니다.**
   ```powershell
   .\gradlew.bat assembleRelease
   ```
   * *참고*: 만약 이전에 빌드했던 캐시를 지우고 깨끗하게 다시 빌드하고 싶다면 아래와 같이 `clean`을 함께 수행합니다.
     ```powershell
     .\gradlew.bat clean assembleRelease
     ```

3. **빌드 완료 후 파일 위치 확인**
   빌드가 완료되면 아래 경로에서 생성된 APK를 확인하실 수 있습니다.
   * `c:\Users\dudu1\OneDrive\Documents\freshkeeper\mobile\android\app\build\outputs\apk\release\app-release.apk`

---

## 3. 안드로이드 스튜디오 (GUI)에서 빌드하는 방법

터미널 명령어가 아닌 **안드로이드 스튜디오 인터페이스**를 사용해 빌드하고 싶으시다면 다음 순서를 따르시면 됩니다.

### [프로젝트 열기 및 동기화]
1. **안드로이드 스튜디오**를 실행합니다.
2. 메인 화면에서 **Open**을 클릭하거나, 메뉴에서 `File -> Open...`을 누릅니다.
3. 다음 경로를 찾아 선택하고 확인을 누릅니다:
   * **선택할 폴더**: `c:\Users\dudu1\OneDrive\Documents\freshkeeper\mobile\android` (⚠️ 반드시 `mobile` 내부의 `android` 폴더를 선택하셔야 합니다)
4. 프로젝트가 열린 후, 우측 하단에서 진행되는 **Gradle Sync**(프로젝트 구성 분석)가 끝날 때까지 1~2분 정도 대기합니다.

### [빌드 옵션 설정 및 빌드]
5. 안드로이드 스튜디오 왼쪽 하단 모서리(또는 `View -> Tool Windows -> Build Variants`)에 있는 **Build Variants** 탭을 클릭하여 엽니다.
6. `app` 모듈의 **Active Build Variant** 열을 찾아서 기존 `debug`를 클릭한 뒤 **`release`**로 변경해 줍니다.
   * *참고*: 변경한 뒤 다시 한 번 동기화 작업이 일어날 수 있으니 완료될 때까지 기다려 줍니다.
7. 상단 메뉴 바에서 **Build -> Build Bundle(s) / APK(s) -> Build APK(s)**를 클릭합니다.
8. 빌드가 시작되고 완료될 때까지 기다립니다.

### [빌드 완료 확인]
9. 빌드가 성공하면 화면 오른쪽 하단에 **"Generate APK(s): APK(s) generated successfully..."** 알림 팝업이 나타납니다.
10. 알림 팝업 내의 **`locate`** 링크를 클릭하면 탐색기 창이 열리고 빌드된 `app-release.apk`를 바로 확인하실 수 있습니다.

---

## 4. 기기 설치 방법
1. 생성된 `app-release.apk` 파일을 스마트폰으로 전송합니다. (이메일, USB 케이블, Google 드라이브 등 활용)
2. 스마트폰의 파일 관리자 앱에서 해당 APK 파일을 실행하여 설치합니다.
   * 설치 시 *'알 수 없는 앱 설치 권한 허용'* 메시지가 표시되면 권한을 허용해 주셔야 합니다.
