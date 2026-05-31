# CrisisMapper — Claude Conventions

**Full plan:** `C:\Users\Philip\.claude\plans\snoopy-dazzling-tide.md`
**Competition:** UNDP $50K "Build the Future of Crisis Mapping" — deadline June 23, 2026, 23:59 ET
**Stack:** Nuxt 4 + Tailwind CSS v4 + Supabase (PostgreSQL + PostGIS) + Vercel

## Project structure

```
app/
  app.vue             # root layout / entry
  assets/css/main.css # @theme design tokens + Google Fonts + base styles + shared utilities
  pages/              # file-based routing
  components/         # Vue components
  composables/        # shared composables
server/
  api/                # H3 server routes (health, reports, ai, exports)
  utils/              # shared server utilities (supabase client, helpers)
supabase/
  migrations/         # SQL migration files — apply via Supabase SQL editor
public/               # static assets
CLAUDE.md             # this file
```

## Design system

Design tokens live in `app/assets/css/main.css` inside the `@theme` block. Do NOT add colours or spacing values anywhere else.

- `bg-parchment` / `text-ink` / `text-accent` — Tailwind utility classes generated from @theme
- `.label` — 10px IBM Plex Mono uppercase tracked — use for "STEP 1 OF 5", section labels
- `.display` — Source Serif 4 700 — use for hero headlines
- `.sev-chip.minimal / .partial / .complete` — severity badges
- `.crosshair` + `.crosshair-ring` — topographic registration marks (signature visual element)
- `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-full` — button primitives
- Use logical utilities (`ms-`, `me-`, `ps-`, `pe-`) everywhere — RTL support is baked in from day 1

**Design handoff:** `C:\My Projects\crisismapper-undp-crisis-mapping-handoff\project\`
Read HTML source directly — do NOT screenshot. Match visual output; recreate in Nuxt/Vue/Tailwind.

## Severity classification — 4-tier internal, 3-tier export

| Internal (`severity`) | Export (`damage_classification`, GENERATED) |
|---|---|
| `negligible` | `minimal` |
| `moderate` | `partial` |
| `severe` | `complete` |
| `destroyed` | `complete` |
| `unknown` | `NULL` — excluded from exports |

The `damage_classification` column is `GENERATED ALWAYS AS ... STORED` — never write to it directly.
Always store the full 4-tier value in `severity`; the DB derives the export column automatically.
Rows where `damage_classification IS NULL` are reports with unknown severity — filter them out in export queries.

## Database connections

- **Server routes:** `useRuntimeConfig().dbUrl` → postgres.js with `prepare: false`
- **Client / Realtime:** `useRuntimeConfig().public.supabaseUrl` + `supabaseAnonKey`
- **Admin operations:** `useRuntimeConfig().supabaseServiceKey`
- **Never** embed credentials in code. Never commit `.env`.
- Supavisor pooler: port **6543**, `?prepareThreshold=0` in URL + `prepare: false` in postgres.js

## Env vars (Vercel + local .env)

Nuxt 4 maps `runtimeConfig` keys to `NUXT_*` env vars automatically (camelCase → SCREAMING_SNAKE_CASE).

| Env var | runtimeConfig key | Purpose |
|---|---|---|
| `NUXT_PUBLIC_SUPABASE_URL` | `public.supabaseUrl` | Supabase project URL |
| `NUXT_PUBLIC_SUPABASE_ANON_KEY` | `public.supabaseAnonKey` | Supabase anon key |
| `NUXT_SUPABASE_SERVICE_KEY` | `supabaseServiceKey` (server only) | Supabase service role key |
| `NUXT_DB_URL` | `dbUrl` (server only) | Supavisor pooler URL |
| `NUXT_LIBRE_TRANSLATE_URL` | `libreTranslateUrl` (server only) | Custom Language Pack MT engine (default `http://localhost:5000`) |
| `NUXT_LIBRE_TRANSLATE_API_KEY` | `libreTranslateApiKey` (server only) | Optional — for hosted/keyed LibreTranslate instances |
| `NUXT_ADMIN_KEY` | `adminKey` (server only) | Shared-secret gate for `/admin/*` + `/api/translate` + `/api/export` (demo-scoped) |
| `NUXT_REPORTER_SALT` | `reporterSalt` (server only) | HMAC salt for pseudonymous reporter ids (Phase 9); dev has a built-in fallback |

**Custom Language Pack (Phase 8):** `/admin/languages` bootstraps a new locale by
machine-translating `i18n/locales/en.json` (the master) via LibreTranslate, then lets an
operator review + download a `<code>.json` to commit. Run the engine locally with
`docker run -ti --rm -p 5000:5000 libretranslate/libretranslate` (Apache-2.0, offline-capable).
Ships 6 UN locales + `sw` (Swahili) as the non-UN extensibility proof.

**Exports + data integrity (Phase 9):** `/api/export?crisis_id=X&format=geojson|csv|gpkg|shapefile`
emits the mandatory Q&A #14 schema (geocoordinates, timestamp, 3-tier `damage_classification`,
`infrastructure_type`). GeoJSON/CSV stream from a postgres.js cursor (bounded memory at 500K rows);
GPKG/Shapefile build to `os.tmpdir()` then stream out. Excludes duplicates + unknown-severity rows
by default (`?include_duplicates=true` to keep dupes). Admin-key gated (exact data = staff data per
Q&A #18; Phase 10 swaps to staff RLS). Duplicate detection, `quality_score`, and reporter
`trust_score`/`trust_tier` are computed by DB triggers on insert (migration
`20260530000000_phase9_dedup_trust_quality.sql`) — never write those columns from app code.
Reporters are pseudonymous: a client `localStorage` device id, HMAC'd server-side via `resolveReporter`.

## i18n

- `@nuxtjs/i18n` v10.3, `strategy: 'no_prefix'` (cookie-based, PWA-friendly), `lazy: true`.
- `i18n/locales/en.json` is the **master** — every key here must exist in all other locales
  (CI-style parity is verifiable; no English fallthrough). Add new UI strings here first.
- Reuse the shared `<LanguageSwitcher />`; it's driven by `useI18n().locales`, so adding a
  locale to `nuxt.config.ts` is all it takes to surface it.
- Severity/infra display labels go through `useLabels()` (`app/composables/useLabels.ts`),
  not the raw `utils/severity.ts` constants.
- Arabic RTL: `<html dir>` is set by i18n via `useLocaleHead()` in `app.vue`; use logical
  utilities (`ms-/me-/ps-/pe-/start-/end-`) and the `.rtl-flip` class for directional glyphs.
  Noto fonts load per-locale via `html:lang()` rules in `main.css`.

## Coding style

- `<script setup lang="ts">` always — no Options API
- Composition API — no `defineComponent` wrapper
- Minimal code; no over-engineering; no premature abstractions
- TypeScript types where non-obvious; don't annotate what TS infers
- No comments explaining WHAT — only add WHY when non-obvious

## Responsive contract (every component, no exceptions)

Full version in `snoopy-dazzling-tide.md` §8. Quick rules:

- **Typography:** never bare `text-[Npx]` — use Tailwind scale or pair with a breakpoint (`text-sm` not `text-[13px]`; `text-xl sm:text-2xl` for titles). Form `<input>`/`<textarea>` always `text-base` (16px) — anything smaller triggers iOS Safari zoom-on-focus.
- **Touch targets:** every interactive element `min-h-[44px]` (WCAG AA), or `min-h-[36px]` for clearly secondary chips (locale switcher, count badges).
- **Padding:** scale up — `px-4 sm:px-6 lg:px-8`. Never hardcoded `px-8` alone or inline `style="padding: 16px"`.
- **Grids:** stack on mobile — `grid-cols-1 sm:grid-cols-2`, never bare `grid-cols-2`.
- **Media:** aspect ratios — `aspect-[4/3] sm:aspect-[16/10]`, never fixed `h-[Npx]`.
- **Focus:** `focus-ring` utility on interactive elements; global `:focus-visible` already handles inputs.
- **No inline `style=""`** outside `@theme` — Tailwind utilities only (exception: dynamic value binding like `:style="{ background: severityColor }"`).

## Descoped

**WhatsApp ingestion (Phases 5–6) was cut on 2026-05-29** due to a Meta WABA platform lock (error `131031`) plus a Live-publish blocker on the Meta App Dashboard — both outside our control, so the bot could not be demoed even on the test number. The well-built code is preserved in git history at commits `166861f` (Phase 5) and `21bdac5` (Phase 6). Do **not** re-attempt WhatsApp/Meta onboarding for this competition. The sole ingestion channel is the `/report` PWA.

## What's out of scope until each phase

| Phase | Feature |
|---|---|
| 2 | Reporter form `/report` (no MapLibre) |
| 3 | PWA service worker + Dexie offline queue |
| 4 | AI classification (Groq Llama 4 Scout) + Sharp EXIF strip |
| 7 | MapLibre dashboard + Supabase Realtime Broadcast |
| 8 | @nuxtjs/i18n v10 + 6 UN languages + RTL |
| 9 | Export (GeoJSON / CSV / GPKG / Shapefile) + trust scoring + dedup |
| 10 | Staff auth (Supabase magic-link + RLS role) + admin console (crisis CRUD w/ map-drawn bbox, report moderation) |
| 11 | Gamification + privacy aggregation + performance |
| 12 | Proposal |
| 13 | Demo video + submit |
