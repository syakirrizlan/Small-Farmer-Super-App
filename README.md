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
| 🌐 Languages | English and Bahasa Melayu; switch any time with the EN / BM toggle or in Settings |
| 📶 Offline | App shell cached by a service worker; data lives in IndexedDB |

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run preview    # serve the production build (service worker active)
```

Deploy `dist/` to any static host with HTTPS (required for PWAs and Web Crypto).

## Languages

The app speaks **English** and **Bahasa Melayu**. It starts in Bahasa Melayu when the device language is Malay, and the choice is remembered on the device. The AI assistant answers in the chosen language.

- Strings live in `src/i18n/en.ts` (source) and `src/i18n/ms.ts`. TypeScript fails the build if a Malay string is missing.
- Dropdown choices (e.g. crop status) are **saved in English** and only displayed translated, so records stay valid when the language changes, and search works with either language.
- To add a language: copy `ms.ts`, translate it, and register it in `LANGUAGES` / `DICTS` in `src/i18n/index.ts`.

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

**By default (no passphrase):** the farmer pastes a key once and the assistant just works.
1. All provider keys are encrypted together with **AES-GCM 256** using a random key the browser generates as **non-extractable** and keeps in IndexedDB.
2. Only the ciphertext, IV and the last 4 characters of each key (for display) are stored. Keys are never shown in the app and never included in backups.
3. Honest limit: this does **not** protect against someone using the same device or browser profile. They can use the assistant, and a technical person with the profile could recover the keys.

**Optional passphrase lock (Settings → Security)** for shared devices:
1. Keys are re-encrypted with a key derived from the passphrase (PBKDF2-SHA256, 600k iterations, random salt). The passphrase itself is never stored.
2. Keys are decrypted into memory only after unlocking, and lock again after 15 min idle or when the app closes.
3. The lock can be turned off again after unlocking. A forgotten passphrase can't be recovered: the farmer deletes the keys and adds them again. Farm records are not affected.

In both modes:
- Requests go **directly from the device to the chosen provider**; there is no backend that sees the keys.
- A strict Content-Security-Policy blocks inline and third-party scripts, so injected code can't run to read keys. Network calls are allowed to any https server (so any AI provider works) and to http servers on this computer.
- Saves are checked against the stored vault, so a second open window can't overwrite newer keys or silently turn the lock off; other windows refresh automatically.
- The farm snapshot and questions go to whichever provider is selected, so the farmer should check that provider's data policy.

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
- Optional cloud sync and multi-device / multi-worker accounts
- AI tools: let the assistant create tasks or log entries directly
