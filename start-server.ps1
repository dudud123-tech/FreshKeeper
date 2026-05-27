param(
  [switch]$Background
)

$port = 4173
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

if ($Background) {
  $outLog = Join-Path $root "server.out.log"
  $errLog = Join-Path $root "server.err.log"
  Start-Process -FilePath "powershell.exe" `
    -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $PSCommandPath) `
    -WorkingDirectory $root `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog `
    -WindowStyle Hidden
  Write-Host "Server is starting in the background."
  Write-Host "Open http://localhost:$port/"
  Write-Host "Logs: $outLog"
  return
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
try {
  $listener.Start()
}
catch {
  Write-Host "Port $port is already in use. Try opening http://localhost:$port/ first."
  throw
}

Write-Host "Serving $root"
Write-Host "Open http://localhost:$port/"
Write-Host "Press Ctrl+C to stop."

function Get-ContentType($path) {
  $extension = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
  switch ($extension) {
    ".html" { "text/html; charset=utf-8" }
    ".css" { "text/css; charset=utf-8" }
    ".js" { "text/javascript; charset=utf-8" }
    ".json" { "application/json; charset=utf-8" }
    ".webmanifest" { "application/manifest+json; charset=utf-8" }
    ".jpg" { "image/jpeg" }
    ".jpeg" { "image/jpeg" }
    ".png" { "image/png" }
    default { "application/octet-stream" }
  }
}

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    $stream = $client.GetStream()
    $stream.ReadTimeout = 2000
    $stream.WriteTimeout = 2000
    $reader = [System.IO.StreamReader]::new($stream)

    $requestLine = $reader.ReadLine()
    do {
      $headerLine = $reader.ReadLine()
    } while ($null -ne $headerLine -and $headerLine.Length -gt 0)

    $requestPath = "index.html"
    if ($requestLine -match "GET\s+([^\s]+)\s+HTTP") {
      $requestPath = [System.Uri]::UnescapeDataString($matches[1].TrimStart("/"))
      if ([string]::IsNullOrWhiteSpace($requestPath)) {
        $requestPath = "index.html"
      }
    }

    $target = Join-Path $root $requestPath
    $resolvedRoot = [System.IO.Path]::GetFullPath($root)
    $resolvedTarget = [System.IO.Path]::GetFullPath($target)

    if (-not $resolvedTarget.StartsWith($resolvedRoot) -or -not [System.IO.File]::Exists($resolvedTarget)) {
      $body = [System.Text.Encoding]::UTF8.GetBytes("Not found")
      $header = "HTTP/1.1 404 Not Found`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
      $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
      $stream.Write($headerBytes, 0, $headerBytes.Length)
      $stream.Write($body, 0, $body.Length)
      $client.Close()
      continue
    }

    $bytes = [System.IO.File]::ReadAllBytes($resolvedTarget)
    $contentType = Get-ContentType $resolvedTarget
    $headers = "HTTP/1.1 200 OK`r`nContent-Type: $contentType`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`n`r`n"
    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
    $stream.Write($headerBytes, 0, $headerBytes.Length)
    $stream.Write($bytes, 0, $bytes.Length)
    $client.Close()
  }
}
finally {
  $listener.Stop()
}
