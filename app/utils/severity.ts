export type UiSeverity = 'minimal' | 'partial' | 'complete'
// Full 4-tier internal model + 'unknown'. PWA reporters only produce the first three;
// 'destroyed' and 'unknown' come from the AI classifier (Phase 4) and WhatsApp staff path.
export type DbSeverity = 'negligible' | 'moderate' | 'severe' | 'destroyed' | 'unknown'

// Shared infrastructure type for both PWA + WhatsApp report channels.
// Mirrored in the valibot picklist at server/api/reports.post.ts:9.
export type InfraType = 'building' | 'road' | 'bridge' | 'hospital' | 'school' | 'utility' | 'other'

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
