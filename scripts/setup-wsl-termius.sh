#!/usr/bin/env bash
# One-time WSL setup for Termius + tmux (peaksees). Run inside Ubuntu WSL:
#   bash /mnt/c/Users/Owner/peaksees/scripts/setup-wsl-termius.sh

set -euo pipefail

PEAKSEES_DIR="/mnt/c/Users/Owner/peaksees"
MARKER="# peaksees-termius-tm"

echo "==> Installing packages (tmux, openssh-server)..."
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq tmux openssh-server

echo "==> Enabling SSH in WSL..."
sudo service ssh start 2>/dev/null || sudo /etc/init.d/ssh start 2>/dev/null || true

if ! grep -q "$MARKER" ~/.bashrc 2>/dev/null; then
  echo "==> Adding tm() helper to ~/.bashrc..."
  cat >>~/.bashrc <<'EOF'

# peaksees-termius-tm — tmux session per folder (Termius phone ↔ laptop)
tm() {
  command -v tmux >/dev/null 2>&1 || { echo "tmux not installed"; return 1; }
  local name="${1:-$(basename "$PWD")}"
  name="${name//./-}"
  name="${name//:/-}"
  if [ -n "$TMUX" ]; then
    tmux has-session -t "$name" 2>/dev/null || tmux new-session -d -s "$name" -c "$PWD"
    tmux switch-client -t "$name"
  else
    tmux attach -t "$name" 2>/dev/null || tmux new -s "$name" -c "$PWD"
  fi
}

# Do not auto-run tm on SSH login — breaks Termius (no visible shell). Use: tm peaksees
EOF
else
  echo "==> tm() already present in ~/.bashrc"
fi

mkdir -p ~/.ssh && chmod 700 ~/.ssh
touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys

WSL_IP="$(hostname -I | awk '{print $1}')"
WIN_USER="$(cmd.exe /c 'echo %USERNAME%' 2>/dev/null | tr -d '\r')"
WSL_USER="$(whoami)"

echo ""
echo "Done."
echo ""
echo "Project path:  $PEAKSEES_DIR"
echo "WSL user:      $WSL_USER"
echo "WSL IP:        ${WSL_IP:-unknown} (use PC LAN IP in Termius if this fails)"
echo ""
echo "Termius host (Android):"
echo "  Address:     <your PC Wi-Fi IPv4 from ipconfig>"
echo "  Port:        22"
echo "  Username:    $WSL_USER"
echo "  Startup snippet: (leave EMPTY in Termius)"
echo "    Optional: cd $PEAKSEES_DIR"
echo "  After connect: tm peaksees"
echo ""
echo "Optional — Cursor Agent CLI:"
echo "  curl https://cursor.com/install -fsS | bash"
echo "  agent login"
echo ""
echo "Add your SSH public key to: ~/.ssh/authorized_keys"
echo "Then from laptop WSL: cd $PEAKSEES_DIR && tm"
