#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Missing .env" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

if [[ -z "${CLOUD_DATABASE_URL:-}" ]]; then
  echo "CLOUD_DATABASE_URL is not set. Cloud schema was not changed."
  exit 0
fi

export DATABASE_URL="$CLOUD_DATABASE_URL"
npx prisma migrate deploy
