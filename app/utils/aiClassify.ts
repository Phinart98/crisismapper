import type { DbSeverity } from './severity'

export type AiProvider = 'groq' | 'gemini' | 'degraded'
export type PhotoQuality = 'good' | 'acceptable' | 'poor'

export interface ClassifyResult {
  severity: DbSeverity
  confidence: number
  damage_percentage: number
  reasoning: string
  damage_indicators: string[]
  infrastructure_visible: boolean
  photo_quality: PhotoQuality
  recommendation: string
  // Provenance for the audit trail in ai_raw_response. Surfaced to the client
  // too so the UI can detect the degraded path without inspecting magic values.
  _meta: {
    provider: AiProvider
    model: string
    duration_ms: number
    fallback_used: boolean
  }
}

export function isAiUsable(r: ClassifyResult | null): r is ClassifyResult {
  return r !== null && r._meta.provider !== 'degraded'
}
