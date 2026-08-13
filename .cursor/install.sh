#!/usr/bin/env bash
# Idempotent Cloud Agent bootstrap for the peaksees Next.js app.
# Runs after the repository is checked out. Must terminate and be safe to re-run.
set -euo pipefail

cd "$(dirname "$0")/.."

# Install exact dependencies from the lockfile (better-sqlite3 uses a prebuilt binary).
npm ci

# Seed a local dev env file only if one is not already present. The app also has
# safe dev fallbacks, so this is purely for a clean localhost experience.
if [ ! -f .env.local ]; then
  cat > .env.local <<'EOF'
NEXT_PUBLIC_APP_URL=http://localhost:3000
AUTH_SECRET=peaksees-cloud-agent-dev-secret-not-for-production
EOF
fi
