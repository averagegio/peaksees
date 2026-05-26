# Run in PowerShell AS ADMINISTRATOR — fixes Android Termius -> WSL SSH
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\fix-wsl-termius-ssh.ps1

$ErrorActionPreference = "Stop"

function Require-Admin {
  $id = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
  if (-not $id.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: Run PowerShell as Administrator (right-click -> Run as administrator)" -ForegroundColor Red
    exit 1
  }
}

Require-Admin

$wslIp = (wsl -e bash -lc "hostname -I").Trim().Split(" ")[0]
if (-not $wslIp) {
  Write-Host "ERROR: Could not get WSL IP. Is Ubuntu running? (wsl -e bash -lc 'hostname -I')" -ForegroundColor Red
  exit 1
}

Write-Host "WSL IP: $wslIp" -ForegroundColor Cyan

# Refresh port forward (WSL IP changes after reboot)
netsh interface portproxy delete v4tov4 listenport=2222 listenaddress=0.0.0.0 2>$null | Out-Null
netsh interface portproxy add v4tov4 listenport=2222 listenaddress=0.0.0.0 connectport=22 connectaddress=$wslIp | Out-Null

# code-server (VS Code in browser) — optional; start code-server in WSL first
netsh interface portproxy delete v4tov4 listenport=8443 listenaddress=0.0.0.0 2>$null | Out-Null
netsh interface portproxy add v4tov4 listenport=8443 listenaddress=0.0.0.0 connectport=8443 connectaddress=$wslIp | Out-Null

Get-NetFirewallRule -DisplayName "WSL SSH 2222" -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName "WSL SSH 2222" -Direction Inbound -Protocol TCP -LocalPort 2222 -Action Allow -Profile Domain,Private,Public | Out-Null

Get-NetFirewallRule -DisplayName "WSL code-server 8443" -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName "WSL code-server 8443" -Direction Inbound -Protocol TCP -LocalPort 8443 -Action Allow -Profile Domain,Private,Public | Out-Null

wsl -e bash -lc "sudo service ssh start >/dev/null 2>&1 || true"

$lanIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
  $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" -and $_.IPAddress -notlike "172.17.*"
} | Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "=== Port proxy ===" -ForegroundColor Green
netsh interface portproxy show v4tov4

Write-Host ""
Write-Host "=== Termius (Android) ===" -ForegroundColor Green
Write-Host "  Host:     $lanIp"
Write-Host "  Port:     2222"
Write-Host "  User:     owner"
Write-Host "  Key:      your Termius-generated key"
Write-Host "  Snippet:  (leave EMPTY — recommended) or only:  cd /mnt/c/Users/Owner/peaksees"
Write-Host "  After connect:  tm peaksees"
Write-Host ""
Write-Host "=== Phone browser (same Wi-Fi) ===" -ForegroundColor Green
Write-Host "  Local app:  http://${lanIp}:3000   (run: npm run dev:lan on Windows)"
Write-Host "  Editor:     https://${lanIp}:8443  (code-server in WSL; see docs/TERMUS-PHONE-WORKFLOW.md)"
Write-Host ""
Write-Host "If it still fails: Windows Settings -> Network -> Wi-Fi -> your network -> set to PRIVATE (not Public)." -ForegroundColor Yellow
