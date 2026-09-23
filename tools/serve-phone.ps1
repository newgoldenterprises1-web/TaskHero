$ErrorActionPreference = "Stop"

Write-Host "Near Family Customer App - phone server" -ForegroundColor Cyan
Write-Host ""

$ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object {
    $_.IPAddress -notlike "127.*" -and
    $_.PrefixOrigin -ne "WellKnown"
  } |
  Sort-Object InterfaceIndex |
  Select-Object -First 1 -ExpandProperty IPAddress

if (-not $ip) {
  Write-Host "Could not detect the PC LAN IPv4 address." -ForegroundColor Red
  Write-Host "Run: ipconfig" -ForegroundColor Yellow
  exit 1
}

Write-Host ("Phone URL: http://{0}:8080/" -f $ip) -ForegroundColor Green
Write-Host "Keep the phone and PC on the same Wi-Fi." -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop the server." -ForegroundColor Gray
Write-Host ""

py -m http.server 8080 --bind 0.0.0.0
