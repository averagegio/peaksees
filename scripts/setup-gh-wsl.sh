#!/usr/bin/env bash
# Install GitHub CLI to ~/.local/bin (no sudo) and log in using Windows gh token when available.
# Run in Ubuntu WSL:
#   bash /mnt/c/Users/Owner/peaksees/scripts/setup-gh-wsl.sh

set -euo pipefail

GH_VER="${GH_VER:-2.63.2}"
BIN_DIR="${HOME}/.local/bin"
ARCH="linux_amd64"
TARBALL="gh_${GH_VER}_${ARCH}.tar.gz"
URL="https://github.com/cli/cli/releases/download/v${GH_VER}/${TARBALL}"

mkdir -p "$BIN_DIR"
curl -fsSL "$URL" -o "/tmp/${TARBALL}"
tar -xzf "/tmp/${TARBALL}" -C /tmp
install -m 755 "/tmp/gh_${GH_VER}_${ARCH}/bin/gh" "${BIN_DIR}/gh"
rm -rf "/tmp/${TARBALL}" "/tmp/gh_${GH_VER}_${ARCH}"

grep -q '.local/bin' "${HOME}/.bashrc" 2>/dev/null || \
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> "${HOME}/.bashrc"

export PATH="${BIN_DIR}:${PATH}"
"${BIN_DIR}/gh" --version

if command -v powershell.exe >/dev/null 2>&1; then
  token="$(powershell.exe -NoProfile -Command 'gh auth token' 2>/dev/null | tr -d '\r' || true)"
  if [[ -n "${token}" ]]; then
    printf '%s' "$token" | "${BIN_DIR}/gh" auth login --with-token
    echo "Logged in via Windows gh token."
  else
    echo "Run: gh auth login"
  fi
else
  echo "Run: gh auth login"
fi

echo ""
echo "Example:"
echo "  cd /mnt/c/Users/Owner/peaksees"
echo "  git push -u origin my-branch"
echo "  gh pr create --base main --head my-branch --fill-first"
