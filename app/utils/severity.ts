export type UiSeverity = 'minimal' | 'partial' | 'complete'
export type DbSeverity = 'negligible' | 'moderate' | 'severe'

export const uiToDb: Record<UiSeverity, DbSeverity> = {
  minimal: 'negligible',
  partial: 'moderate',
  complete: 'severe',
}
