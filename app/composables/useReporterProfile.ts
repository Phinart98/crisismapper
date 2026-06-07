import { useDeviceId } from '~/composables/useDeviceId'
import type { TrustTier } from '~/utils/severity'

export interface RecentReport {
  id: string
  severity: string
  damage_classification: string | null
  infrastructure_type: string | null
  submitted_at: string
  is_verified: boolean
}

export interface ReporterProfile {
  found: boolean
  nickname?: string
  trust_tier?: TrustTier
  badges?: string[]
  total?: number
  verified?: number
  zones?: number
  impact_km2?: number
  crisis_name?: string | null
  recent?: RecentReport[]
}

// Loads the current device's own reporter profile (POST keeps the device id out of URLs).
// Client-only: the device id lives in localStorage, so this runs after mount.
export function useReporterProfile() {
  const profile = ref<ReporterProfile | null>(null)
  const loading = ref(true)
  const error = ref(false)

  async function load() {
    loading.value = true
    error.value = false
    const deviceId = useDeviceId()
    if (!deviceId) {
      profile.value = { found: false }
      loading.value = false
      return
    }
    try {
      profile.value = await $fetch<ReporterProfile>('/api/me', {
        method: 'POST',
        body: { device_id: deviceId },
      })
    } catch {
      error.value = true
    } finally {
      loading.value = false
    }
  }

  return { profile, loading, error, load }
}
