export type UiSeverity = 'minimal' | 'partial' | 'complete'
// Full 4-tier internal model + 'unknown'. Reporters only produce the first three;
// 'destroyed' and 'unknown' come from the AI classifier (Phase 4).
export type DbSeverity = 'negligible' | 'moderate' | 'severe' | 'destroyed' | 'unknown'

// Infrastructure type for damage reports.
// Mirrored in the valibot picklist at server/api/reports.post.ts:9.
export type InfraType = 'building' | 'road' | 'bridge' | 'hospital' | 'school' | 'utility' | 'other'

// Crisis hazard vocabulary (Q25 context-agnostic set). `crisis_type` is a free TEXT
// column with no DB enum, so this array is the single source of truth keeping created
// crises validatable + labelable: the admin valibot picklists, the /admin/crises form
// <select>, and useLabels' HAZARD_KEY all derive from it. Add a hazard here once and the
// Record<HazardType,…> in useLabels turns a missing label into a compile error.
export type HazardType = 'earthquake' | 'flood' | 'conflict' | 'cyclone' | 'hurricane' | 'other'
export const HAZARD_TYPES: readonly HazardType[] = ['earthquake', 'flood', 'conflict', 'cyclone', 'hurricane', 'other']

// Reporter behavioral trust tier (Phase 9). Mirrors the reporters.trust_tier generated
// column (score < 0.3 / < 0.7 / else). Dot colors mirror FilterSidebar's TRUST_LEGEND;
// CSS vars are fine here (DOM, not WebGL paint).
export type TrustTier = 'unverified' | 'contributing' | 'trusted'
export const TRUST_COLORS: Record<TrustTier, string> = {
  unverified: 'var(--c-ink-ghost)',
  contributing: 'var(--c-sev-minimal)',
  trusted: 'var(--c-sev-partial)',
}

export const uiToDb: Record<UiSeverity, DbSeverity> = {
  minimal: 'negligible',
  partial: 'moderate',
  complete: 'severe',
}

// Inverse map for pre-selecting the UI tier from AI-supplied db severity.
// 'destroyed' collapses to the same 3-tier export bucket as 'severe' ('complete').
// 'unknown' returns null so the form falls back to its default ('partial').
export function dbToUi(s: DbSeverity): UiSeverity | null {
  if (s === 'negligible') return 'minimal'
  if (s === 'moderate') return 'partial'
  if (s === 'severe' || s === 'destroyed') return 'complete'
  return null
}

// ─── Dashboard data-layer display (Phase 7) ───
// 4-tier marker/dot colors. WebGL paint expressions can't read CSS vars, so these
// mirror the @theme --color-sev-* tokens, plus a sage green for negligible and grey
// for unknown (which have no @theme equivalent — they're data-viz hues, not brand).
export const SEVERITY_COLORS: Record<DbSeverity, string> = {
  destroyed:  '#8B2E2A', // --color-sev-complete (red)
  severe:     '#C9722C', // --color-sev-partial  (orange)
  moderate:   '#D4A574', // --color-sev-minimal  (yellow/ochre)
  negligible: '#6E8B6A', // sage green
  unknown:    '#A8A08E', // --color-ink-ghost
}

// Display labels (Negligible/Minimal/…) now live in useLabels() so they go through i18n —
// the raw English constants were removed. This file keeps only color/order/enum data.

// Severity filter order in the left sidebar (worst → least).
export const SEVERITY_FILTER_ORDER: DbSeverity[] = ['destroyed', 'severe', 'moderate', 'negligible']

export const INFRA_TYPES: InfraType[] = ['building', 'road', 'bridge', 'hospital', 'school', 'utility', 'other']
