#!/usr/bin/env bash
# One-time: install code-server in WSL and write a simple config.
# Run in Ubuntu:  bash /mnt/c/Users/Owner/peaksees/scripts/setup-code-server-wsl.sh
# You will be asked to choose a password for the browser login.

set -euo pipefail
REPO="/mnt/c/Users/Owner/peaksees"
PASS="${1:-}"

if ! command -v code-server >/dev/null 2>&1; then
  echo "Installing code-server..."
  curl -fsSL https://code-server.dev/install.sh | sh
fi

mkdir -p ~/.config/code-server
if [ -z "$PASS" ]; then
  read -r -s -p "Password for browser login (code-server): " PASS
  echo
fi

cat >~/.config/code-server/config.yaml <<EOF
bind-addr: 0.0.0.0:8443
auth: password
password: "$PASS"
cert: false
EOF
chmod 600 ~/.config/code-server/config.yaml

echo ""
echo "Done. Start the editor with:"
echo "  code-server $REPO"
echo ""
echo "Keep that running (use tmux). On your phone browser open:"
echo "  https://YOUR-PC-WIFI-IP:8443"
echo ""
echo "On Windows (Admin PowerShell), run:"
echo "  cd C:\\Users\\Owner\\peaksees"
echo "  powershell -ExecutionPolicy Bypass -File .\\scripts\\fix-wsl-termius-ssh.ps1"
