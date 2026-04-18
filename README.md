# Statsus

Self-hosted webmail. Mail, calendar, contacts, and a todo overlay — in one container, on your own server.

---

## Features

**Mail**
- IMAP sync with multi-folder support
- Thread grouping and conversation view
- Labels, archiving, and trash
- Multi-account support (unlimited accounts per user)
- Send Later — schedule emails for future delivery
- Snippets — reusable text templates with variable expansion (`{{date}}`, `{{time}}`)
- AI Assist — compose, improve, shorten, or formalize emails (OpenAI / OpenRouter / Ollama)
- Filter engine — rule-based automation (labels, archive, delete, mark read, stop processing)

**Calendar**
- CalDAV sync — reads from any CalDAV server (iCloud, Google, Fastmail, Nextcloud)
- Monthly view with event creation and deletion
- Multi-account event overlay

**Contacts**
- CardDAV sync — reads from any CardDAV server
- Full-text search across names, emails, and organizations

**Productivity**
- Todo overlay — floating panel with priority levels and linked-message navigation (`t` shortcut)
- Keyboard shortcut system — fully configurable; two-key sequences (`g m`, `g c`, etc.)
- Command palette — fuzzy search across messages, contacts, and events (`⌘K`)

**PWA**
- Installable on desktop and mobile ("Add to Home Screen")
- Offline reading — service worker caches recent emails, calendar events, contacts, and todos
- Offline mutation queue — write operations queued locally and replayed on reconnect

---

## Quick Install (self-hosted)

**Requirements:** Docker + Docker Compose v2, a domain with DNS pointing to your server.

```bash
curl -fsSL https://raw.githubusercontent.com/your-org/statsus/main/install.sh | bash
```

Or clone and run directly:

```bash
git clone https://github.com/your-org/statsus
cd statsus
./install.sh
```

The script:
1. Generates all secrets (DB password, JWT secret, encryption key)
2. Writes a `.env` file and `Caddyfile`
3. Builds and starts Docker containers (app + PostgreSQL + Caddy)
4. Obtains a Let's Encrypt TLS certificate automatically via Caddy
5. Waits for a healthy response before exiting

See [docs/self-hosting.md](docs/self-hosting.md) for the full installation guide, configuration reference, and troubleshooting.

---

## Management

```bash
./install.sh update          # Pull latest, rebuild, restart
./install.sh backup          # Dump database to ./backups/
./install.sh restore <file>  # Restore from a backup file
./install.sh logs            # Tail container logs
./install.sh status          # Show container health
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, Zustand |
| Backend | Fastify, TypeScript, Drizzle ORM |
| Database | PostgreSQL 16 |
| Mail sync | IMAPFlow |
| Calendar/Contacts | tsdav (CalDAV/CardDAV) |
| Auth | JWT (httpOnly cookie), bcrypt |
| AI | OpenAI-compatible API (OpenAI, OpenRouter, Ollama) |
| PWA | Vite Plugin PWA, Workbox |
| Reverse proxy | Caddy (auto TLS) |
| Container | Docker + Docker Compose |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Browser (React SPA + Service Worker)           │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │   Mail   │ │ Calendar │ │ Contacts/Filters  │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
└────────────────────────┬────────────────────────┘
                         │  HTTP / JSON API
┌────────────────────────┴────────────────────────┐
│  Fastify API (Node.js)                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │  Routes  │ │ Workers  │ │ Filter Engine    │ │
│  │  /api/*  │ │ IMAP/DAV │ │ Snippets / AI    │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
└────────────────────────┬────────────────────────┘
                         │
┌────────────────────────┴────────────────────────┐
│  PostgreSQL 16                                   │
│  users · mail_accounts · messages · threads      │
│  calendar_events · contacts · filters · snippets │
│  todos · scheduled_emails · ai_configs           │
└─────────────────────────────────────────────────┘
```

---

## Development

See [docs/development.md](docs/development.md) for local setup, architecture details, and contribution guidelines.

---

## License

MIT
