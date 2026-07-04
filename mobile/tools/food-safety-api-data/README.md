# 식품안전나라 상품 데이터 수집 방법

이 폴더에는 식품안전나라 `I1250 식품(첨가물)품목제조보고` API에서 상품명을
검색해 수집한 원본 데이터와 누적 데이터가 저장됩니다.

앱에서 API를 실시간 호출하기 위한 데이터가 아닙니다. 요청 횟수 제한과 인증키
노출을 피하기 위해 개발 중에만 데이터를 수집하고, 결과를 로컬 분류기 JSON으로
변환해 앱에 포함합니다.

## 관련 파일

- 수집 스크립트: `mobile/tools/collect-food-safety-data.js`
- API 인증키: `mobile/tools/인증키.txt`
- 누적 원본: `food-safety-i1250-master.json`
- 최근 수집 결과: `food-safety-i1250-latest.json`
- 분류기 생성 스크립트: `mobile/tools/build-product-classifier.js`
- 앱에서 사용하는 결과: `mobile/src/data/productClassifier.json`
- 수동 우선 분류 규칙: `mobile/src/data/foodRules.json`

`인증키.txt`에는 식품안전나라 OpenAPI 인증키만 한 줄로 저장합니다. 인증키를
소스나 문서에 직접 기록하거나 Git에 커밋하지 않습니다.

## 특정 키워드 수집

PowerShell에서 `mobile` 폴더로 이동한 후 실행합니다.

```powershell
cd "C:\Workspace\FreshKeeper\mobile"

node tools/collect-food-safety-data.js `
  --keywords "계란,달걀,유정란,반숙란" `
  --limit 1000 `
  --max-keywords 4 `
  --delay-ms 100
```

주요 옵션:

- `--keywords`: 쉼표로 구분한 검색어
- `--limit`: 키워드별 한 페이지 조회 건수, 최대 1000
- `--page`: 조회할 페이지 번호
- `--max-keywords`: 이번 실행에서 처리할 최대 키워드 수
- `--delay-ms`: 키워드 사이의 대기 시간

키워드 결과가 1000건이면 다음 페이지도 확인합니다.

```powershell
node tools/collect-food-safety-data.js `
  --keywords "계란" `
  --limit 1000 `
  --page 2 `
  --max-keywords 1 `
  --delay-ms 100
```

결과가 0건인 페이지부터는 더 조회하지 않습니다. 2026-06-28 확인 당시 `계란`은
1페이지 1000건, 2페이지 767건, 3페이지 0건이었습니다.

대량 키워드를 한 번에 조회하면 API 응답이 오래 걸릴 수 있습니다. 이 경우
키워드를 몇 개씩 나눠 실행합니다.

## 누적 데이터 다시 만들기

날짜별 JSON 파일을 합치고 중복 상품을 제거해 `master` 파일을 다시 생성합니다.

```powershell
node tools/collect-food-safety-data.js --merge-only
```

중복 기준은 품목보고번호, 상품명, 업체명의 조합입니다. 같은 상품이 여러
검색어에서 발견되면 검색어 정보는 합쳐집니다.

## 앱 분류기 갱신

수집 또는 병합이 끝나면 반드시 분류기를 다시 생성합니다.

```powershell
npm.cmd run build:classifier
```

생성 결과는 `mobile/src/data/productClassifier.json`에 저장됩니다.

전체 순서는 다음과 같습니다.

```text
식품안전나라 API 수집
→ 날짜별 JSON/CSV 저장
→ master 파일 병합 및 중복 제거
→ productClassifier.json 생성
→ Metro에서 분류 결과 확인
```

JavaScript와 JSON만 변경되므로 이 작업만으로는 APK를 빌드하지 않습니다.

## 분류 규칙 주의사항

상품을 더 수집해도 잘못된 규칙이 자동으로 고쳐지지는 않습니다.

예를 들어 `동물복지란`은 API에서 정확한 검색 결과가 없었고, 기존 규칙에서는
계란류가 `육류/생선`으로 분류됐습니다. 이런 경우에는
`mobile/src/data/foodRules.json`의 우선 키워드와
`mobile/tools/build-product-classifier.js`의 분류 규칙도 함께 보완해야 합니다.

구체적인 상품명이 분류기에 있으면 그 결과를 사용하므로 `계란과자` 같은 상품은
`간식`으로 유지할 수 있습니다. 원물 계란 표현은 `신선식품` 우선 규칙으로
처리합니다.
