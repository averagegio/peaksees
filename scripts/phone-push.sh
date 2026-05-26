#!/usr/bin/env bash
# Git add + commit + push to main (Vercel deploy). Run from WSL in repo root or anywhere:
#   bash scripts/phone-push.sh "fix: mobile scrub"
#   bash scripts/phone-push.sh   # uses default message

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ -z "$(git status --porcelain 2>/dev/null)" ]; then
  echo "Nothing to commit (working tree clean)."
  exit 0
fi

MSG="${1:-chore: push from phone}"
git add -A
git commit -m "$MSG"

echo "Syncing with origin/main..."
git pull --rebase origin main

git push origin main
echo "Pushed to main — production will update when Vercel finishes."
