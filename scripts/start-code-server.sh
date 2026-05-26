#!/usr/bin/env bash
# Start VS Code in the browser for peaksees (WSL).
# Run: bash /mnt/c/Users/Owner/peaksees/scripts/start-code-server.sh

set -euo pipefail
REPO="/mnt/c/Users/Owner/peaksees"

if ! command -v code-server >/dev/null 2>&1; then
  echo "code-server not installed. Run:"
  echo "  bash $REPO/scripts/setup-code-server-wsl.sh"
  exit 1
fi

if [ ! -f ~/.config/code-server/config.yaml ]; then
  echo "No config. Run:"
  echo "  bash $REPO/scripts/setup-code-server-wsl.sh"
  exit 1
fi

if ss -ltnp 2>/dev/null | grep -q ':8443'; then
  echo "code-server already running on port 8443."
  exit 0
fi

echo "Starting code-server (repo: $REPO)..."
echo "Keep this terminal open, or run inside tmux: tmux new -s editor"
echo ""
exec code-server "$REPO"
