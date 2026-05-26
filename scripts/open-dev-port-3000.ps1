# Run PowerShell AS ADMINISTRATOR — allows phone to reach npm run dev:lan on port 3000
# Usage: powershell -ExecutionPolicy Bypass -File scripts\open-dev-port-3000.ps1

$ErrorActionPreference = "Stop"
$id = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $id.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host "Run as Administrator (right-click PowerShell -> Run as administrator)" -ForegroundColor Red
  exit 1
}

Get-NetFirewallRule -DisplayName "Peaksees Next dev 3000" -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName "Peaksees Next dev 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Domain,Private,Public | Out-Null

$lanIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
  $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" -and $_.IPAddress -notlike "172.17.*"
} | Select-Object -First 1).IPAddress

Write-Host "Firewall: inbound TCP 3000 allowed (all profiles)." -ForegroundColor Green
Write-Host ""
Write-Host "On your phone (same Wi-Fi), open:" -ForegroundColor Cyan
Write-Host "  http://${lanIp}:3000"
Write-Host ""
Write-Host "On PC, dev server must be running:" -ForegroundColor Yellow
Write-Host "  cd C:\Users\Owner\peaksees"
Write-Host "  npm run dev:lan"
Write-Host ""
Write-Host "If it still times out: disable guest Wi-Fi / VPN on phone, or try phone hotspot with PC connected to it."
