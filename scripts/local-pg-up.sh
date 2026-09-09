#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA="$ROOT/.local-pg"
PG="/usr/lib/postgresql/16/bin"
PORT="${ALIQUOT_PG_PORT:-5433}"

if [[ ! -x "$PG/pg_ctl" ]]; then
  echo "PostgreSQL 16 binaries were not found at $PG." >&2
  exit 1
fi

if [[ ! -f "$DATA/PG_VERSION" ]]; then
  mkdir -p "$DATA"
  "$PG/initdb" -D "$DATA" --auth-local=trust --auth-host=trust -U "$USER" -E UTF8 --locale=C
  {
    echo "port = ${PORT}"
    echo "listen_addresses = 'localhost'"
    echo "unix_socket_directories = '${DATA}'"
  } >> "$DATA/postgresql.conf"
fi

if ! "$PG/pg_ctl" -D "$DATA" status >/dev/null 2>&1; then
  "$PG/pg_ctl" -D "$DATA" -w start -l "$DATA/pg.log"
fi

if ! "$PG/psql" -h localhost -p "$PORT" -d postgres -Atqc "SELECT 1 FROM pg_database WHERE datname = 'pathlab'" | grep -q 1; then
  "$PG/createdb" -h localhost -p "$PORT" pathlab
fi
