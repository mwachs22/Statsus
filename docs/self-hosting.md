# Self-Hosting Guide

## Requirements

| Requirement | Notes |
|---|---|
| Docker Engine 24+ | `docker --version` |
| Docker Compose v2 | `docker compose version` |
| Domain name | DNS A record pointing to your server |
| Ports 80 + 443 | Must be open; Caddy handles TLS automatically |
| 1 GB RAM minimum | 2 GB recommended for comfortable operation |

---

## Quick Install

```bash
git clone https://github.com/your-org/statsus
cd statsus
chmod +x install.sh
./install.sh
```

You will be prompted for:
- **Domain** — the hostname Statsus should be reachable at (e.g. `mail.example.com`)
- **Admin password** — initial password for the admin account

The script generates all cryptographic secrets, writes `.env` and `Caddyfile`, builds the Docker image, and starts three containers:

| Container | Role |
|-----------|------|
| `webmail` | Node.js app (API + static files) |
| `db` | PostgreSQL 16 |
| `caddy` | Reverse proxy with automatic HTTPS |

---

## Configuration Reference

All configuration lives in `.env` at the project root. **Never commit this file.**

| Variable | Description | Default |
|----------|-------------|---------|
| `DOMAIN` | Public hostname | set during install |
| `POSTGRES_USER` | DB username | `statsus` |
| `POSTGRES_PASSWORD` | DB password | generated |
| `POSTGRES_DB` | DB name | `statsus` |
| `DATABASE_URL` | Full connection string | derived |
| `JWT_SECRET` | Signs auth tokens | generated (48 bytes) |
| `CREDENTIAL_ENCRYPTION_KEY` | AES-256-GCM key for IMAP/SMTP credentials and AI API keys — **64 hex chars** | generated |
| `NODE_ENV` | `production` or `development` | `production` |
| `PORT` | Internal app port | `3000` |
| `LOG_LEVEL` | Pino log level: `trace`, `debug`, `info`, `warn`, `error` | `warn` |
| `REGISTRATION_DISABLED` | Set to `true` to block new user registrations | unset (open) |

### Rotating secrets

If you need to rotate `CREDENTIAL_ENCRYPTION_KEY`, you must re-enter all mail account passwords in the UI after the rotation — the stored credentials will no longer decrypt.

If you rotate `JWT_SECRET`, all active sessions are immediately invalidated.

---

## Adding a Mail Account

1. Log in at `https://your-domain`
2. Click the avatar button in the left nav rail
3. Click **Add account**
4. Fill in IMAP/SMTP host, port, username, and password
5. Statsus will attempt an IMAP connection and begin syncing

### Common IMAP/SMTP settings

| Provider | IMAP host | IMAP port | SMTP host | SMTP port |
|----------|-----------|-----------|-----------|-----------|
| Gmail | `imap.gmail.com` | 993 | `smtp.gmail.com` | 587 |
| Fastmail | `imap.fastmail.com` | 993 | `smtp.fastmail.com` | 587 |
| iCloud Mail | `imap.mail.me.com` | 993 | `smtp.mail.me.com` | 587 |
| Outlook/Hotmail | `outlook.office365.com` | 993 | `smtp.office365.com` | 587 |

> **Gmail**: Enable "App passwords" under Google Account → Security. Use the app password, not your Google password.

---

## AI Assistant (optional)

AI features (compose, improve, summarize) require an AI provider. Configure in **Settings → AI Assistant**.

### OpenRouter (recommended for cloud)
1. Sign up at openrouter.ai
2. Create an API key
3. Set provider to `OpenRouter`, enter your key, choose a model (e.g. `qwen/qwen-2.5-7b`)

### Ollama (local, private)
1. Run Ollama on the same host or a reachable host
2. Pull a model: `ollama pull qwen2.5:7b`
3. Set provider to `Ollama`, endpoint to `http://host.docker.internal:11434` (or your Ollama host)
4. Leave API key blank

### OpenAI
1. Create an API key at platform.openai.com
2. Set provider to `OpenAI`, enter your key, choose a model (e.g. `gpt-4o`)

---

## Updates

```bash
./install.sh update
```

This pulls the latest image, rebuilds, and restarts with zero configuration changes. Your database and `.env` are preserved.

To pin a specific version, edit `docker-compose.yml` and set the image tag before running update.

---

## Backup & Restore

### Create a backup

```bash
./install.sh backup
```

Creates a compressed SQL dump in `./backups/statsus-YYYYMMDD-HHMMSS.sql.gz`.

### Automate backups (cron example)

```bash
# Back up daily at 2am, keep 30 days
0 2 * * * cd /opt/statsus && ./install.sh backup && find backups/ -name "*.sql.gz" -mtime +30 -delete
```

### Restore from backup

```bash
./install.sh restore backups/statsus-20260101-020000.sql.gz
```

> This **overwrites** the current database. You will be prompted with a 3-second cancel window.

---

## Moving to a New Server

1. On the old server: `./install.sh backup`
2. Transfer `.env`, `Caddyfile`, `docker-compose.yml`, and the backup file to the new server
3. On the new server: clone the repo, copy those files in, then:
   ```bash
   docker compose up -d db
   sleep 5
   ./install.sh restore backups/<your-backup>.sql.gz
   docker compose up -d
   ```

---

## Troubleshooting

### Containers won't start

```bash
./install.sh logs
# or
docker compose ps
docker compose logs webmail
docker compose logs db
```

### IMAP sync failing

Check the webmail logs:
```bash
docker compose logs -f webmail | grep -i imap
```

Common causes:
- Wrong host/port
- App password not set up (Gmail)
- Firewall blocking outbound port 993 from the container

### TLS certificate not issuing

Caddy obtains certificates automatically. If it fails:
- Verify your DNS A record resolves to the server's IP: `dig +short your-domain`
- Ensure ports 80 and 443 are reachable from the internet
- Check Caddy logs: `docker compose logs caddy`

### Database connection errors

If you see `ECONNREFUSED` or `FATAL: database does not exist`:
```bash
docker compose down
docker compose up -d db
sleep 5
docker compose up -d webmail caddy
```

### Resetting to a clean state

```bash
# WARNING: destroys all data
docker compose down -v
docker compose up -d --build
```

---

## Security Notes

- All IMAP/SMTP credentials and AI API keys are stored **encrypted at rest** using AES-256-GCM
- JWT tokens are stored in httpOnly cookies (not accessible to JavaScript), expire after 24 hours, and are renewed automatically on each app load
- Caddy enforces HTTPS and sets strict security headers (HSTS, X-Frame-Options, X-Content-Type-Options)
- After creating your account, set `REGISTRATION_DISABLED=true` in `.env` and restart the `webmail` container to prevent unauthorized registrations: `docker compose restart webmail`
- Login and registration are rate-limited to 10 requests per minute per IP to prevent brute-force attacks
- The database is not exposed outside the Docker network
- There is no default admin account — the first registered user owns the instance
