# 🌾 Small Farmer Super App

An installable, offline-first **PWA** that helps small-scale farmers track everything on their farm — with a built-in **AI assistant** powered by the farmer's own Anthropic API key.

> Status: **v0.1 skeleton**. The structure is in place; each section is ready to be deepened.

## Features (skeleton)

| Area | What it does |
|---|---|
| 🏡 Dashboard | Crops growing, animals, open tasks, net money this month, overdue tasks & low-stock alerts |
| 🗺️ Plots · 🌱 Crops · 🐄 Livestock · ✅ Tasks · 📦 Inventory · 💰 Money · 📓 Journal | Add / edit / search / delete records — all stored on the device |
| 🤖 Assistant | Chat with Claude about your farm; it sees a snapshot of your records |
| ⚙️ Settings | Manage the API key, export / import JSON backups |
| 📶 Offline | App shell cached by a service worker; data lives in IndexedDB |

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run preview    # serve the production build (service worker active)
```

Deploy `dist/` to any static host with HTTPS (required for PWAs and Web Crypto).

## How the API key is protected

1. The farmer pastes their key and picks a passphrase.
2. A key is derived from the passphrase (PBKDF2-SHA256, 600k iterations, random salt) and used to encrypt the API key with **AES-GCM 256**.
3. Only the ciphertext + salt + IV are stored (IndexedDB). The passphrase is never stored.
4. Unlocking decrypts the key **into memory only**; it auto-locks after 15 min idle or when the tab closes.
5. A strict Content-Security-Policy allows network calls only to this site and `api.anthropic.com`, and no third-party scripts.
6. Requests go **directly from the device to Anthropic** — there is no backend that sees the key. Backups never include the key.

Honest limits: while unlocked, code running on the page could read the key, so keep dependencies minimal and the CSP strict. A future backend proxy option could remove the key from the device entirely.

## Project layout

```
src/
  db/modules.ts      ← module registry: add a new tracked area here
  db/db.ts           ← IndexedDB (Dexie) tables, backup export/import
  lib/vault.ts       ← encrypted API-key storage
  lib/ai.ts          ← Claude client (streaming, farm snapshot, error handling)
  pages/             ← Dashboard, Track, Module list, Assistant, Settings
  components/        ← RecordForm, VaultPanel, OnlineBadge
```

### Adding a new tracking section

Add an entry to `MODULES` in `src/db/modules.ts` and bump the version in `src/db/db.ts` (`this.version(2)`). The list page, form, search, AI snapshot and backups pick it up automatically.

## Roadmap ideas

- Photos per record (crop disease, animals), harvest yield charts, weather
- Reminders / push notifications for tasks
- Multi-language (e.g. Bahasa Melayu)
- Optional cloud sync and multi-device / multi-worker accounts
- AI tools: let the assistant create tasks or log entries directly
