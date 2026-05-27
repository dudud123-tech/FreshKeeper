# freshkeeper

마트 영수증이나 상품 사진을 바탕으로 식품을 등록하고, 유통기한이 가까운 상품을 확인하는 모바일형 웹앱입니다.

## Expo 앱

모바일 앱 버전은 `mobile` 폴더에 있습니다.

```powershell
cd "C:\Users\dudu1\OneDrive\Documents\freshkeeper\mobile"
npm install
npm start
```

Expo Go로 QR 코드를 스캔해 테스트합니다. 현재 OCR은 Expo Go에서 바로 확인할 수 있도록 샘플 OCR 결과를 적용하는 구조이며, 실제 온디바이스 OCR은 development build에서 ML Kit 모듈을 붙이는 방식으로 이어가면 됩니다.

## 지금 되는 기능

- 상품명, 카테고리, 보관 위치, 유통기한/소비기한 수동 등록
- 상품명 키워드 기반 카테고리 자동 추천
- 영수증 OCR 텍스트 붙여넣기 후 상품 목록 분리
- `ocr_test.jpg` 모바일 영수증 샘플 이미지 불러오기
- 샘플 OCR 결과 적용 후 상품 후보 생성
- 인터넷 연결 시 Tesseract.js 기반 이미지 OCR 실행
- 상품 사진 첨부 등록
- 선택한 기한 날짜 기준으로 가까운 순 정렬
- 임박, 전체, 오늘 만료 개수 표시
- 냉장, 냉동, 실온, 임박, 만료 필터
- 브라우저 로컬 저장소에 데이터 저장
- 브라우저 알림 권한이 켜진 상태에서 앱이 열려 있을 때 임박 알림 표시

## 실행 방법

`index.html` 파일을 브라우저로 열면 바로 사용할 수 있습니다.

OCR은 브라우저가 외부 OCR 파일을 불러오므로 `file://`로 직접 열면 실패할 수 있습니다. 이 경우 PowerShell에서 아래 명령을 실행한 뒤 `http://localhost:4173/`으로 접속하세요.

```powershell
.\start-server.ps1
```

Codex 안에서 실행할 때는 서버가 터미널을 계속 점유하지 않도록 백그라운드 옵션을 쓰세요.

```powershell
.\start-server.ps1 -Background
```

모바일 Expo 앱도 PowerShell 실행 정책에 걸리지 않도록 `npm` 대신 `npx.cmd`를 쓰는 실행 스크립트를 추가했습니다.

```powershell
cd "C:\Users\dudu1\OneDrive\Documents\freshkeeper\mobile"
.\start-expo.ps1
```

PowerShell 실행 정책 때문에 `.ps1` 실행이 막히면 배치 파일을 사용하세요.

```powershell
cd "C:\Users\dudu1\OneDrive\Documents\freshkeeper\mobile"
.\start-expo.bat
```

Codex에서 Expo를 켜 둘 때는 아래처럼 실행하면 명령이 바로 돌아옵니다.

```powershell
.\start-expo.ps1 -Background
```

## OCR 방향

영수증 인식은 비용이 발생하는 클라우드 OCR 대신 온디바이스 ML Kit OCR을 기본으로 사용합니다. OCR 텍스트는 매장별 규칙을 계속 추가하는 방식이 아니라, 가격 패턴, 수량 단위, 식품 키워드, 제외어, 숫자 비율을 종합해 상품 후보 점수를 매기는 공통 파서로 걸러냅니다.

이 방식은 API 비용이 없고 영수증 이미지가 외부 서버로 전송되지 않습니다. 인식 결과는 자동 등록하지 않고 후보 목록으로 보여 준 뒤 사용자가 확인해서 추가하는 흐름을 유지합니다.

휴대폰에서 카메라와 알림을 더 안정적으로 테스트하려면 이 폴더를 로컬 서버로 열고, 휴대폰과 PC가 같은 와이파이에 연결된 상태에서 접속하는 방식이 좋습니다.

## 다음 개발 순서

1. OCR 결과 정확도 개선: 후보 점수 기준 튜닝, 식품 키워드 보강, 실제 영수증 샘플 테스트
2. 바코드 스캔 추가
3. 앱이 닫혀 있어도 울리는 네이티브 푸시 알림
4. React Native 또는 Flutter 앱으로 전환
5. 가족 공유, 냉장고별 목록, 소비 기록 통계 추가
