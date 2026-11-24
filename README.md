# 🌾 Small Farmer Super App

An installable, offline-first **PWA** that helps small-scale farmers track everything on their farm — with a built-in **AI assistant** that works with **whichever AI provider the farmer chooses**, using their own API key. No lock-in to one ecosystem.

> Status: **v0.1 skeleton**. The structure is in place; each section is ready to be deepened.

## Features (skeleton)

| Area | What it does |
|---|---|
| 🏡 Dashboard | Crops growing, animals, open tasks, net money this month, overdue tasks & low-stock alerts |
| 🗺️ Plots · 🌱 Crops · 🐄 Livestock · ✅ Tasks · 📦 Inventory · 💰 Money · 📓 Journal | Add / edit / search / delete records — all stored on the device |
| 🤖 Assistant | Chat about your farm with the AI provider you picked; it sees a snapshot of your records |
| ⚙️ Settings | Pick AI provider + model, manage API keys, export / import JSON backups |
| 📶 Offline | App shell cached by a service worker; data lives in IndexedDB |

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run preview    # serve the production build (service worker active)
```

Deploy `dist/` to any static host with HTTPS (required for PWAs and Web Crypto).

## AI providers

| Provider | How it connects | Key needed |
|---|---|---|
| Anthropic (Claude) | Official Anthropic SDK | Yes |
| DeepSeek | OpenAI-compatible API | Yes |
| OpenAI | OpenAI-compatible API | Yes |
| Google Gemini | Gemini's OpenAI-compatible endpoint | Yes |
| OpenRouter | One key for hundreds of models | Yes |
| Groq | OpenAI-compatible API | Yes |
| Mistral | OpenAI-compatible API | Yes |
| Ollama | Local models on the farmer's own computer (`localhost:11434`) | No |
| Other | Any OpenAI-compatible server (https, or http on this computer) | Optional |

Every provider was checked to accept requests straight from a browser. The OpenAI-compatible path uses plain `fetch` with only `Authorization` and `Content-Type` headers, because some providers (e.g. Mistral) reject the extra headers SDKs add.

The model for each provider is editable; **Load available models** asks the provider which models the key can use. To add a built-in provider, add an entry to `src/lib/providers.ts`.

For Ollama, start it with `OLLAMA_ORIGINS` set to the app's address so the browser is allowed to call it.

## How the API keys are protected

1. The farmer picks **one passphrase** that protects the keys for every provider.
2. A key is derived from the passphrase (PBKDF2-SHA256, 600k iterations, random salt) and used to encrypt all API keys together with **AES-GCM 256**.
3. Only the ciphertext + salt + IV (and the last 4 characters of each key, for display) are stored in IndexedDB. The passphrase is never stored.
4. Unlocking decrypts the keys **into memory only**; they auto-lock after 15 min idle or when the tab closes.
5. A strict Content-Security-Policy blocks inline and third-party scripts, so injected code can't run to read keys. Network calls are allowed to any https server (so any AI provider works) and to http servers on this computer.
6. Requests go **directly from the device to the chosen provider** — there is no backend that sees the keys. Backups never include keys.
7. Forgot the passphrase? The keys can't be recovered; the farmer can delete them and start again. Farm records are not affected.

Honest limits: while unlocked, code running on the page could read the keys, so keep dependencies minimal and the CSP strict. The farm snapshot and questions go to whichever provider is selected, so the farmer should check that provider's data policy. A future backend proxy option could remove keys from the device entirely.

## Project layout

```
src/
  db/modules.ts      ← module registry: add a new tracked area here
  db/db.ts           ← IndexedDB (Dexie) tables, backup export/import
  lib/providers.ts   ← AI provider registry: add a provider here
  lib/vault.ts       ← encrypted multi-provider API-key storage
  lib/ai.ts          ← routes a chat to the chosen provider
  lib/llm/           ← anthropic.ts (SDK), openaiCompat.ts (fetch + streaming), shared prompt
  pages/             ← Dashboard, Track, Module list, Assistant, Settings
  components/        ← RecordForm, AiSetup (provider picker + key vault), OnlineBadge
```

### Adding a new tracking section

Add an entry to `MODULES` in `src/db/modules.ts` and bump the version in `src/db/db.ts` (`this.version(2)`). The list page, form, search, AI snapshot and backups pick it up automatically.

## Roadmap ideas

- Photos per record (crop disease, animals), harvest yield charts, weather
- Reminders / push notifications for tasks
- Multi-language (e.g. Bahasa Melayu)
- Optional cloud sync and multi-device / multi-worker accounts
- AI tools: let the assistant create tasks or log entries directly
