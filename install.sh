#!/usr/bin/env bash
# Statsus install / management script
# Usage:
#   ./install.sh              — fresh install
#   ./install.sh update       — pull latest image and restart
#   ./install.sh backup       — dump database to ./backups/statsus-<date>.sql.gz
#   ./install.sh restore <f>  — restore database from a backup file
#   ./install.sh logs         — tail container logs
#   ./install.sh status       — show container status
set -euo pipefail

COMMAND="${1:-install}"

# ─── helpers ──────────────────────────────────────────────────────────────────

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "❌  $1 is required but not found. $2"; exit 1; }
}

require_env() {
  [[ -f .env ]] || { echo "❌  .env not found. Run ./install.sh first."; exit 1; }
  # shellcheck source=/dev/null
  source .env
}

wait_healthy() {
  echo "⏳ Waiting for Statsus to be ready…"
  local attempts=0
  until docker compose exec -T webmail wget -qO- http://localhost:3000/health >/dev/null 2>&1; do
    sleep 3
    attempts=$((attempts + 1))
    [[ $attempts -gt 40 ]] && { echo "❌  Timed out waiting for health check."; exit 1; }
  done
  echo "✅ Statsus is healthy."
}

# ─── install ──────────────────────────────────────────────────────────────────

cmd_install() {
  echo ""
  echo "  ███████╗████████╗ █████╗ ████████╗███████╗██╗   ██╗███████╗"
  echo "  ██╔════╝╚══██╔══╝██╔══██╗╚══██╔══╝██╔════╝██║   ██║██╔════╝"
  echo "  ███████╗   ██║   ███████║   ██║   ███████╗██║   ██║███████╗"
  echo "  ╚════██║   ██║   ██╔══██║   ██║   ╚════██║██║   ██║╚════██║"
  echo "  ███████║   ██║   ██║  ██║   ██║   ███████║╚██████╔╝███████║"
  echo "  ╚══════╝   ╚═╝   ╚═╝  ╚═╝   ╚═╝   ╚══════╝ ╚═════╝ ╚══════╝"
  echo ""
  echo "  Self-hosted webmail  ·  v1.0.0"
  echo ""

  require_cmd docker  "Install from https://docs.docker.com/get-docker/"
  docker compose version >/dev/null 2>&1 || { echo "❌ Docker Compose v2 required."; exit 1; }
  require_cmd openssl "Install openssl (brew install openssl / apt install openssl)"

  read -rp "🌐 Domain (e.g. mail.example.com): " DOMAIN
  read -rsp "🔑 Admin password: " ADMIN_PASS; echo

  local pg_pass jwt_secret enc_key
  pg_pass=$(openssl rand -base64 32 | tr -d '=+/' | cut -c1-32)
  jwt_secret=$(openssl rand -base64 48)
  enc_key=$(openssl rand -hex 32)

  echo "🔑 Generating secrets…"
  cat > .env <<ENVEOF
DOMAIN=${DOMAIN}
POSTGRES_USER=statsus
POSTGRES_PASSWORD=${pg_pass}
POSTGRES_DB=statsus
DATABASE_URL=postgresql://statsus:${pg_pass}@db:5432/statsus
JWT_SECRET=${jwt_secret}
CREDENTIAL_ENCRYPTION_KEY=${enc_key}
ADMIN_PASSWORD=${ADMIN_PASS}
NODE_ENV=production
PORT=3000
LOG_LEVEL=warn
ENVEOF

  cat > Caddyfile <<CADDYEOF
${DOMAIN} {
  encode zstd gzip
  reverse_proxy webmail:3000
  header {
    -Server
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    X-Frame-Options SAMEORIGIN
    X-Content-Type-Options nosniff
    Referrer-Policy strict-origin-when-cross-origin
  }
}
CADDYEOF

  echo "🐳 Building and starting containers…"
  docker compose up -d --build

  wait_healthy

  echo ""
  echo "┌─────────────────────────────────────────┐"
  echo "│  ✅  Statsus is ready!                  │"
  echo "│                                         │"
  echo "│  URL:  https://${DOMAIN}"
  echo "│                                         │"
  echo "│  Useful commands:                       │"
  echo "│    ./install.sh update   — update       │"
  echo "│    ./install.sh backup   — backup DB    │"
  echo "│    ./install.sh logs     — view logs    │"
  echo "└─────────────────────────────────────────┘"
  echo ""
}

# ─── update ───────────────────────────────────────────────────────────────────

cmd_update() {
  require_env
  echo "🔄 Updating Statsus…"
  docker compose pull 2>/dev/null || true
  docker compose up -d --build
  wait_healthy
  echo "✅ Update complete."
}

# ─── backup ───────────────────────────────────────────────────────────────────

cmd_backup() {
  require_env
  mkdir -p backups
  local filename="backups/statsus-$(date +%Y%m%d-%H%M%S).sql.gz"
  echo "💾 Backing up database to ${filename}…"
  docker compose exec -T db pg_dump \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB}" \
    --no-owner \
    --no-acl \
    | gzip > "${filename}"
  echo "✅ Backup saved: ${filename} ($(du -sh "${filename}" | cut -f1))"
}

# ─── restore ──────────────────────────────────────────────────────────────────

cmd_restore() {
  local file="${2:-}"
  [[ -n "$file" ]] || { echo "Usage: ./install.sh restore <backup-file.sql.gz>"; exit 1; }
  [[ -f "$file" ]] || { echo "❌ File not found: ${file}"; exit 1; }
  require_env

  echo "⚠️  This will overwrite the current database. Press Ctrl+C to cancel."
  sleep 3

  echo "♻️  Restoring database from ${file}…"
  gunzip -c "${file}" | docker compose exec -T db psql \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB}" \
    -q

  echo "✅ Restore complete. Restarting app…"
  docker compose restart webmail
  wait_healthy
}

# ─── logs ─────────────────────────────────────────────────────────────────────

cmd_logs() {
  docker compose logs -f --tail=100
}

# ─── status ───────────────────────────────────────────────────────────────────

cmd_status() {
  docker compose ps
}

# ─── dispatch ─────────────────────────────────────────────────────────────────

case "$COMMAND" in
  install)        cmd_install "$@" ;;
  update)         cmd_update  "$@" ;;
  backup)         cmd_backup  "$@" ;;
  restore)        cmd_restore "$@" ;;
  logs)           cmd_logs    "$@" ;;
  status)         cmd_status  "$@" ;;
  *)
    echo "Unknown command: ${COMMAND}"
    echo "Usage: ./install.sh [install|update|backup|restore|logs|status]"
    exit 1
    ;;
esac
