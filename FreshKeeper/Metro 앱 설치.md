OpenCV 네이티브 모듈이 추가돼서 이번에는 **Metro만 재시작으로는 안 되고**, 앱을 한 번 다시 설치해야 해.

PowerShell에서 이렇게 하면 돼.

```powershell
cd "C:\Users\dudu1\OneDrive\Documents\freshkeeper\mobile"
npx.cmd expo run:android
```

설치가 끝나고 앱이 실행되면 Metro도 같이 뜰 거야.

만약 Metro만 따로 켜고 싶으면:

```powershell
cd "C:\Users\dudu1\OneDrive\Documents\freshkeeper\mobile"
.\start-expo.bat --dev-client
```

정리하면:

```text
네이티브 코드 변경 있음 → npx.cmd expo run:android
JS/UI만 변경 → Metro reload
```

이번 OpenCV는 네이티브 변경이라 `npx.cmd expo run:android`가 맞아.