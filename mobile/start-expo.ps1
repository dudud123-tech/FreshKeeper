param(
  [switch]$Background,
  [switch]$DevClient
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$outLog = Join-Path $root "expo.out.log"
$errLog = Join-Path $root "expo.err.log"
$expoArgs = @("expo", "start", "--lan")

if ($DevClient) {
  $expoArgs += "--dev-client"
}

if ($Background) {
  Start-Process -FilePath "npx.cmd" `
    -ArgumentList $expoArgs `
    -WorkingDirectory $root `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog `
    -WindowStyle Hidden
  Write-Host "Expo is starting in the background."
  Write-Host "Logs: $outLog"
  Write-Host "Metro: http://localhost:8081/"
  return
}

& npx.cmd @expoArgs
