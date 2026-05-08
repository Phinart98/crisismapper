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
  api/                # H3 server routes (health, reports, ai, exports, whatsapp)
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

## WABA credentials (WhatsApp Business API)

Stored in memory only (MEMORY.md). Never check into the repo. Phase 5 wires the webhook.

## What's out of scope until each phase

| Phase | Feature |
|---|---|
| 2 | Reporter form `/report` (no MapLibre) |
| 3 | PWA service worker + Dexie offline queue |
| 4 | AI classification (Groq Llama 4 Scout) + Sharp EXIF strip |
| 5–6 | WhatsApp bot webhook + state machine |
| 7 | MapLibre dashboard + Supabase Realtime Broadcast |
| 8 | @nuxtjs/i18n v10 + 6 UN languages + RTL |
| 9 | Export (GeoJSON / CSV / GPKG / Shapefile) + trust scoring + dedup |
| 10 | Gamification + privacy aggregation + performance |
| 11–12 | Proposal + demo video |
