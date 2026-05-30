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

  // Smallest containing bbox wins when crises overlap (most specific zone).
  function resolveCrisis(lat: number, lng: number): CrisisRow | null {
    let best: CrisisRow | null = null
    let bestArea = Infinity
    for (const c of crises.value) {
      if (!c.bbox) continue
      const [w, s, e, n] = c.bbox
      if (lng < w || lng > e || lat < s || lat > n) continue
      const area = (e - w) * (n - s)
      if (area < bestArea) { best = c; bestArea = area }
    }
    return best
  }

  return { crises, loaded, load, resolveCrisis }
}
