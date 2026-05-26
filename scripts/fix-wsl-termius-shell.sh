#!/usr/bin/env bash
# Fix Termius "echo ok" with no output: disable auto-tmux on SSH login.
# Run in Ubuntu WSL on the PC:
#   bash /mnt/c/Users/Owner/peaksees/scripts/fix-wsl-termius-shell.sh

set -euo pipefail

BASHRC="${HOME}/.bashrc"
MARKER="# peaksees-termius-tm"

if [[ ! -f "$BASHRC" ]]; then
  echo "No ~/.bashrc found."
  exit 1
fi

cp "$BASHRC" "${BASHRC}.bak.$(date +%Y%m%d-%H%M%S)"

python3 - <<'PY'
from pathlib import Path
import re

bashrc = Path.home() / ".bashrc"
text = bashrc.read_text(encoding="utf-8", errors="replace")

# Comment out the block that auto-runs tm() on every interactive login.
old = """if command -v tmux >/dev/null 2>&1 && [ -z "$TMUX" ] && [[ $- == *i* ]]; then
  tm
fi"""
new = """# Disabled: auto-tmux broke Termius (no shell output). Run: tm peaksees
# if command -v tmux >/dev/null 2>&1 && [ -z "$TMUX" ] && [[ $- == *i* ]]; then
#   tm
# fi"""

if old in text:
    text = text.replace(old, new, 1)
    bashrc.write_text(text, encoding="utf-8")
    print("OK: Disabled auto-tmux on login in ~/.bashrc")
elif "# Disabled: auto-tmux broke Termius" in text:
    print("OK: Already disabled")
else:
    print("WARN: auto-tmux block not found — edit ~/.bashrc manually if needed")
PY

echo ""
echo "Next:"
echo "  1. Termius → clear Startup Snippet (empty) for this host"
echo "  2. Disconnect and reconnect"
echo "  3. Run:  echo ok"
echo "  4. Then:  cd /mnt/c/Users/Owner/peaksees && tm peaksees"
