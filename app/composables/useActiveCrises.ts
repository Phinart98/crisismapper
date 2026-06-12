// Active-crises list for the reporter flow: used to resolve which crisis a report
// belongs to from the reporter's GPS, entirely client-side (point-in-bbox), so it
// works offline. The list is cached in localStorage so a reporter who loaded the PWA
// while online can still resolve a crisis after going offline.

export interface CrisisRow {
  id: string
  name: string
  crisis_type: string
  bbox: [number, number, number, number] | null // [w, s, e, n]
}

const CACHE_KEY = 'crisismapper.active_crises.v1'

export function useActiveCrises() {
  const crises = ref<CrisisRow[]>([])
  const loaded = ref(false)

  function readCache(): CrisisRow[] {
    if (!import.meta.client) return []
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      return raw ? JSON.parse(raw) as CrisisRow[] : []
    } catch { return [] }
  }

  async function load() {
    // Seed from cache first (instant + offline), then refresh from the network.
    const cached = readCache()
    if (cached.length) crises.value = cached
    try {
      const fresh = await $fetch<CrisisRow[]>('/api/crises')
      crises.value = fresh
      if (import.meta.client) localStorage.setItem(CACHE_KEY, JSON.stringify(fresh))
    } catch {
      // Offline / fetch failed — keep the cached list (may be empty on a cold device).
    } finally {
      loaded.value = true
    }
  }

  // All crises whose bbox contains the point, smallest (most specific) first — the
  // global Demo Sandbox envelope always sorts last, so real zones shadow it.
  function containingCrises(lat: number, lng: number): CrisisRow[] {
    return crises.value
      .filter((c) => {
        if (!c.bbox) return false
        const [w, s, e, n] = c.bbox
        return lng >= w && lng <= e && lat >= s && lat <= n
      })
      .sort((a, b) =>
        (a.bbox![2] - a.bbox![0]) * (a.bbox![3] - a.bbox![1])
        - (b.bbox![2] - b.bbox![0]) * (b.bbox![3] - b.bbox![1]))
  }

  function resolveCrisis(lat: number, lng: number): CrisisRow | null {
    return containingCrises(lat, lng)[0] ?? null
  }

  return { crises, loaded, load, resolveCrisis, containingCrises }
}
