param(
  [string]$ProjectId = "",
  [string]$Region = "asia-northeast3",
  [string]$ServiceName = "freshkeeper-gemini-proxy"
)

$ErrorActionPreference = "Stop"

$GcloudCommand = Get-Command gcloud -ErrorAction SilentlyContinue
if (-not $GcloudCommand) {
  $LocalGcloud = Join-Path $env:LOCALAPPDATA "Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
  $ProgramGcloud = Join-Path $env:ProgramFiles "Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
  if (Test-Path $LocalGcloud) {
    $GcloudCommand = $LocalGcloud
  } elseif (Test-Path $ProgramGcloud) {
    $GcloudCommand = $ProgramGcloud
  }
}

if (-not $GcloudCommand) {
  Write-Host "Google Cloud SDK(gcloud)가 설치되어 있지 않습니다."
  Write-Host "설치 후 다시 실행하세요: https://cloud.google.com/sdk/docs/install"
  exit 1
}

if (-not $ProjectId) {
  $ProjectId = Read-Host "Google Cloud Project ID"
}

$GeminiApiKey = Read-Host "Gemini API Key"
$ProxyToken = Read-Host "Worker와 공유할 GEMINI_PROXY_TOKEN"

& $GcloudCommand config set project $ProjectId

& $GcloudCommand run deploy $ServiceName `
  --source . `
  --region $Region `
  --allow-unauthenticated `
  --set-env-vars "GEMINI_MODEL=gemini-2.5-flash,GEMINI_API_KEY=$GeminiApiKey,GEMINI_PROXY_TOKEN=$ProxyToken"

$ServiceUrl = & $GcloudCommand run services describe $ServiceName `
  --region $Region `
  --format "value(status.url)"

Write-Host ""
Write-Host "배포 완료:"
Write-Host "$ServiceUrl/api/gemini-candidates"
Write-Host ""
Write-Host "Cloudflare Worker에 아래 값을 secret으로 등록하세요."
Write-Host "GEMINI_PROXY_URL=$ServiceUrl/api/gemini-candidates"
Write-Host "GEMINI_PROXY_TOKEN=<방금 입력한 토큰>"
