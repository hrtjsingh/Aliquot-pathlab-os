#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
UNIT="$UNIT_DIR/aliquot-local-pg.service"
PG_CTL="/usr/lib/postgresql/16/bin/pg_ctl"

mkdir -p "$UNIT_DIR"

cat > "$UNIT" <<EOF
[Unit]
Description=Aliquot local PostgreSQL on port 5433
After=default.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=$ROOT/scripts/local-pg-up.sh
ExecStop=-$PG_CTL -D $ROOT/.local-pg -m fast stop
TimeoutStartSec=90

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable aliquot-local-pg.service
systemctl --user start aliquot-local-pg.service

if command -v loginctl >/dev/null 2>&1; then
  loginctl enable-linger "$USER" >/dev/null 2>&1 || true
fi

echo "Aliquot Postgres will start when this computer boots."
echo "Service: aliquot-local-pg.service"
systemctl --user is-enabled aliquot-local-pg.service
systemctl --user --no-pager --full status aliquot-local-pg.service | head -20
