# Responsive Design System — CrisisMapper

**Date:** 2026-05-07  
**Status:** Approved  
**Scope:** All phases — baked into every surface from Phase 2 onward

---

## Problem

Phase 2 shipped `/report` as a 480px centered column with no desktop treatment. On a 1440px monitor, the form sits in a strip of parchment with ~480px of blank space on each side. It looks broken.

The root cause: no project-wide responsive strategy was defined before Phase 1. This doc defines one to prevent recurrence.

---

## Breakpoints

Mobile-first. Tailwind v4 scale (no `tailwind.config.ts` needed — these are built in):

| Token | Width | Role |
|---|---|---|
| `sm` | 640px | Minor refinements (font size, tap targets) |
| `md` | 768px | Two-pane layouts activate; primary desktop breakpoint |
| `lg` | 1024px | Full sidebar expansion; data-dense pages |
| `xl` | 1280px | Max-width cap on widest layouts |

---

## Surface Patterns

### Form surfaces — `/report`, `/me`, `/leaderboard`

**Philosophy:** These are task-focused, sequential UIs designed for phone use in crisis conditions. The form itself stays narrow (480px max). On desktop, a decorative **mission brief sidebar** fills the left pane.

**Layout at `md+`:**
```
┌──────────────────────────┬──────────────────────┐
│  LEFT: Mission Sidebar   │  RIGHT: Form (480px) │
│  (flex-1, min-w-[280px]) │  (flex-shrink-0)     │
│                          │                      │
│  Logo + crosshair mark   │  [TopBar]            │
│  Crisis name + type      │  [StepProgress]      │
│  ──────────────────       │  [Step cards]        │
│  Photo tips               │  [SubmitFooter]      │
│  Severity legend          │                      │
│  Phase badge / version    │                      │
└──────────────────────────┴──────────────────────┘
```

**Layout below `md`:** sidebar hidden, form takes full width.

**Implementation pattern (each form page):**
```vue
<template>
  <div class="md:flex md:min-h-screen">
    <ReportDesktopSidebar class="hidden md:flex md:flex-1" />
    <div class="flex flex-col md:w-[480px] md:flex-shrink-0 md:border-s border-parchment-deep">
      <!-- form content -->
    </div>
  </div>
</template>
```

### Data surfaces — `/dashboard` (Phase 7+)

**Philosophy:** Coordinator-facing. Full viewport use. Three-pane at `lg+`, two-pane at `md`, stacked at mobile.

```
lg+:  [FilterSidebar 300px] [MapPane flex-1] [ReportList 360px]
md:   [MapPane flex-1] [ReportList 360px]  (FilterSidebar = slide-over)
sm:   [Stacked: map → list → detail]
```

CSS tokens already in `main.css`: `--sidebar-left: 300px`, `--sidebar-right: 360px`.

### Marketing surface — `/` (Phase 11+)

Implement the `index.html` handoff verbatim:
- 2-column hero grid collapses to 1-col at `768px`
- Features grid: 4-col → 2-col → 1-col
- Nav links hide to hamburger at `sm`

---

## Universal Container Rules

These apply to **every component, every phase**, no exceptions:

1. **Padding:** always `px-4 md:px-6 lg:px-8` — never hardcoded `style="padding: 16px"`
2. **Centering:** `mx-auto` + explicit `max-w-*` — never just `margin: 0 auto`
3. **Overflow:** `overflow-x-hidden` on `<body>` (already in base styles via `box-sizing: border-box`)
4. **No fixed pixel widths** outside a known fixed container (e.g., sidebar, avatar, icon)
5. **Logical properties:** `ps-` / `pe-` / `ms-` / `me-` everywhere — RTL works automatically
6. **Images:** always `max-w-full h-auto` or `object-cover` with explicit aspect ratio

---

## Phase Checklist

Every phase that builds a new page must answer these before implementation:

- [ ] Mobile layout defined (base styles)?
- [ ] Tablet layout defined (`md:` variants)?
- [ ] Desktop layout defined (`lg:` variants)?
- [ ] Which surface pattern applies (form / data / marketing)?
- [ ] Are all paddings using responsive scale (not fixed px)?
- [ ] Are all widths using logical properties?

---

## Phase 2 Fix — `/report`

**What to build:** `ReportDesktopSidebar.vue` + update `report.vue`.

**Sidebar content:**
- CrisisMapper logo + crosshair mark
- Crisis name ("Myanmar Earthquake 2026") from `demoCrisisId` runtime config
- 3 photo tips (same as the PhotoStep tips)
- Severity legend (3 chips: Minimal / Partial / Complete)
- Footer: "Phase 2 · UNDP Crisis Mapping Challenge"

**Right pane:** existing `<ReportPage>` unchanged, gets a left border (`border-s`) at `md+` to visually separate panes.

**report.vue wrapper:**
```html
<!-- Sidebar takes flex-1 (fills remaining space). Form is fixed 480px, shrink-0. -->
<div class="md:flex md:min-h-screen" style="background: var(--color-parchment)">
  <ReportDesktopSidebar class="hidden md:flex md:flex-1" />
  <div class="flex flex-col md:w-[480px] md:flex-shrink-0 md:border-s border-parchment-deep min-h-screen">
    <ReportPage />
  </div>
</div>
```
