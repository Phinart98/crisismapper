import { useDeviceId } from '~/composables/useDeviceId'
import type { TrustTier } from '~/utils/severity'

export interface LeaderboardRow {
  rank: number
  nickname: string
  badges: number
  reports: number
  trust_tier: TrustTier
  area: string | null
  multi_crisis: boolean
  isMe: boolean
}

export type LeaderboardScope = 'crisis' | 'all'

// Anonymous reporter rankings. Passes the device id so the server can flag the caller's
// own row ("YOU") without ever returning a reporter id to the client.
export function useLeaderboard(crisisId: string) {
  const rows = ref<LeaderboardRow[]>([])
  const scope = ref<LeaderboardScope>('crisis')
  const loading = ref(true)
  const error = ref(false)

  async function load() {
    loading.value = true
    error.value = false
    try {
      const deviceId = useDeviceId()
      // POST so the device id stays out of URLs / access logs (matches /api/me).
      rows.value = await $fetch<LeaderboardRow[]>('/api/leaderboard', {
        method: 'POST',
        body: {
          scope: scope.value,
          ...(scope.value === 'crisis' ? { crisis_id: crisisId } : {}),
          ...(deviceId ? { device_id: deviceId } : {}),
        },
      })
    } catch {
      error.value = true
    } finally {
      loading.value = false
    }
  }

  watch(scope, load)

  return { rows, scope, loading, error, load }
}
