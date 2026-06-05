import type { DbSeverity, UiSeverity, InfraType, TrustTier, HazardType } from '~/utils/severity'

// Severity/infra enums live in utils/severity.ts (source of truth for color/order);
// this composable owns their *translated display* so the i18n seam is in one place.
const DB_SEV_KEY: Record<DbSeverity, string> = {
  negligible: 'sevNegligible',
  moderate: 'sevModerate',
  severe: 'sevSevere',
  destroyed: 'sevDestroyed',
  unknown: 'sevUnknown',
}
const UI_SEV_KEY: Record<UiSeverity, string> = {
  minimal: 'sevMinimal',
  partial: 'sevPartial',
  complete: 'sevComplete',
}
// Typed Record<InfraType,…> so adding an InfraType to the enum is a compile error here
// until its label key is added (same drift-guard the severity maps get from their types).
const INFRA_KEY: Record<InfraType, string> = {
  building: 'infraBuilding',
  road: 'infraRoad',
  bridge: 'infraBridge',
  hospital: 'infraHospital',
  school: 'infraSchool',
  utility: 'infraUtility',
  other: 'infraOther',
}
// crisis_type is a free TEXT column (unknown values fall back to hazardOther), but the
// known set is typed Record<HazardType,…> so adding a hazard to HAZARD_TYPES without a
// label here is a compile error (same drift-guard as INFRA_KEY).
const HAZARD_KEY: Record<HazardType, string> = {
  earthquake: 'hazardEarthquake',
  flood: 'hazardFlood',
  conflict: 'hazardConflict',
  cyclone: 'hazardCyclone',
  hurricane: 'hazardHurricane',
  other: 'hazardOther',
}
const TRUST_KEY: Record<TrustTier, string> = {
  unverified: 'trustUnverified',
  contributing: 'trustContributing',
  trusted: 'trustTrusted',
}

export function useLabels() {
  const { t } = useI18n()
  return {
    dbSev: (s: DbSeverity) => t(DB_SEV_KEY[s]),
    uiSev: (u: UiSeverity) => t(UI_SEV_KEY[u]),
    infra: (type?: string | null) => {
      const key = type ? INFRA_KEY[type as InfraType] : undefined
      return key ? t(key) : t('modalUnspecified')
    },
    hazard: (type?: string | null) => {
      const key = type ? HAZARD_KEY[type as HazardType] : undefined
      return t(key ?? 'hazardOther')
    },
    // null for anonymous reports (no reporter row) → caller hides the badge.
    trust: (tier?: string | null) => (tier && TRUST_KEY[tier as TrustTier] ? t(TRUST_KEY[tier as TrustTier]) : null),
  }
}
