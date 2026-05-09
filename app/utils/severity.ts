export type UiSeverity = 'minimal' | 'partial' | 'complete'
// Full 4-tier internal model + 'unknown'. PWA reporters only produce the first three;
// 'destroyed' and 'unknown' come from the AI classifier (Phase 4) and WhatsApp staff path.
export type DbSeverity = 'negligible' | 'moderate' | 'severe' | 'destroyed' | 'unknown'

export const uiToDb: Record<UiSeverity, DbSeverity> = {
  minimal: 'negligible',
  partial: 'moderate',
  complete: 'severe',
}
