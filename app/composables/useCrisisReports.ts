import type { RealtimeChannel } from '@supabase/supabase-js'
import { useSupabaseClient } from '~/composables/useSupabaseClient'
import type { DbSeverity, InfraType } from '~/utils/severity'

export interface ReportProps {
  id: string
  severity: DbSeverity
  infrastructure_type: InfraType | null
  submitted_at: string
}
export interface ReportFeature {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: ReportProps
}
export interface ReportCollection {
  type: 'FeatureCollection'
  features: ReportFeature[]
}

// Broadcast payload emitted by the notify_new_report() DB trigger.
interface BroadcastReport {
  id: string
  severity: DbSeverity
  lat: number
  lng: number
  infrastructure_type: InfraType | null
  crisis_id: string
  submitted_at: string
}

export interface Stats {
  total: number
  coverage_pct: number
  hourly: number[]
}

export interface Filters {
  sev: DbSeverity[]      // empty = all
  infra: InfraType[]     // empty = all
  hours: number          // time window
}

type ConnectionMode = 'connecting' | 'realtime' | 'polling'

const empty = (): ReportCollection => ({ type: 'FeatureCollection', features: [] })

export function useCrisisReports(initialCrisisId: string) {
  let activeId = initialCrisisId
  const geojson = ref<ReportCollection>(empty())
  const stats = ref<Stats>({ total: 0, coverage_pct: 0, hourly: [] })
  const feed = ref<Array<ReportProps & { lng: number; lat: number }>>([])
  const filters = reactive<Filters>({ sev: [], infra: [], hours: 72 })
  const connectionMode = ref<ConnectionMode>('connecting')
  const viewportLoading = ref(false)

  const seenIds = new Set<string>()
  let lastTs: string | null = null
  let channel: RealtimeChannel | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null
  const dropTimes: number[] = []

  function track(f: ReportFeature) {
    if (seenIds.has(f.properties.id)) return false
    seenIds.add(f.properties.id)
    if (!lastTs || f.properties.submitted_at > lastTs) lastTs = f.properties.submitted_at
    return true
  }

  function addFeature(f: ReportFeature, prependFeed = true) {
    if (!track(f)) return
    geojson.value.features.push(f)
    const item = { ...f.properties, lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }
    if (prependFeed) {
      feed.value = [item, ...feed.value].slice(0, 30)
      stats.value = { ...stats.value, total: stats.value.total + 1 }
    } else {
      feed.value.push(item)
    }
  }

  // Filtered set drives both the map (setData → clusters + points honor filters,
  // which per-layer filter expressions can't do for clustered sources) and the
  // "showing X of Y" indicator.
  const cutoff = computed(() => Date.now() - filters.hours * 3600_000)
  const filteredFeatures = computed(() =>
    geojson.value.features.filter((f) => {
      const p = f.properties
      if (filters.sev.length && !filters.sev.includes(p.severity)) return false
      if (filters.infra.length && (!p.infrastructure_type || !filters.infra.includes(p.infrastructure_type))) return false
      if (new Date(p.submitted_at).getTime() < cutoff.value) return false
      return true
    }),
  )
  const filteredGeojson = computed<ReportCollection>(() => ({
    type: 'FeatureCollection',
    features: filteredFeatures.value,
  }))
  const filteredCount = computed(() => filteredFeatures.value.length)
  const totalCount = computed(() => geojson.value.features.length)

  let currentBbox: string | undefined

  async function loadInitial() {
    const [fc, s] = await Promise.all([
      $fetch<ReportCollection>('/api/map/reports', { query: { crisis_id: activeId } }),
      $fetch<Stats>('/api/map/stats', { query: { crisis_id: activeId } }),
    ])
    const fresh = empty()
    seenIds.clear()
    for (const f of fc.features) {
      if (track(f)) fresh.features.push(f)
    }
    // Newest first for the feed, capped.
    feed.value = [...fresh.features]
      .sort((a, b) => (a.properties.submitted_at < b.properties.submitted_at ? 1 : -1))
      .slice(0, 30)
      .map(f => ({ ...f.properties, lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }))
    geojson.value = fresh
    stats.value = s
  }

  // Refetch the map dataset scoped to the current viewport (bounds). Keeps payload
  // and query time bounded as the user pans/zoms across a large crisis. The feed
  // and header stats are independent (latest-N + real count), so they aren't
  // disturbed by viewport changes.
  let viewportToken = 0
  async function loadViewport(bbox: string) {
    if (bbox === currentBbox) return
    currentBbox = bbox
    const token = ++viewportToken
    viewportLoading.value = true
    try {
      const fc = await $fetch<ReportCollection>('/api/map/reports', { query: { crisis_id: activeId, bbox } })
      if (token !== viewportToken) return // a newer pan superseded this fetch
      const fresh = empty()
      seenIds.clear()
      for (const f of fc.features) if (track(f)) fresh.features.push(f)
      geojson.value = fresh
    } finally {
      if (token === viewportToken) viewportLoading.value = false
    }
  }

  function broadcastToFeature(p: BroadcastReport): ReportFeature {
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: {
        id: p.id,
        severity: p.severity,
        infrastructure_type: p.infrastructure_type,
        submitted_at: p.submitted_at,
      },
    }
  }

  // ── Polling fallback ──────────────────────────────────────────────────────
  function startPolling() {
    if (pollTimer) return
    connectionMode.value = 'polling'
    pollTimer = setInterval(async () => {
      if (!lastTs) return
      try {
        const fc = await $fetch<ReportCollection>('/api/map/reports', {
          query: { crisis_id: activeId, since: lastTs },
        })
        let added = false
        for (const f of fc.features) {
          const before = geojson.value.features.length
          addFeature(f)
          if (geojson.value.features.length > before) added = true
        }
        if (added) geojson.value = { ...geojson.value }
      } catch { /* transient — try again next tick */ }
    }, 10_000)
  }

  // 3 disconnects within 60s → give up on the WebSocket and poll instead.
  function registerDrop() {
    const now = Date.now()
    dropTimes.push(now)
    while (dropTimes.length && now - dropTimes[0]! > 60_000) dropTimes.shift()
    if (dropTimes.length >= 3) {
      channel?.unsubscribe()
      channel = null
      startPolling()
    }
  }

  function subscribeRealtime() {
    const supabase = useSupabaseClient()
    channel = supabase
      .channel(`crisis:${activeId}`)
      .on('broadcast', { event: 'reports' }, ({ payload }) => {
        addFeature(broadcastToFeature(payload as BroadcastReport))
        geojson.value = { ...geojson.value } // trigger map setData
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          connectionMode.value = 'realtime'
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (connectionMode.value !== 'polling') registerDrop()
        }
      })
  }

  async function init() {
    await loadInitial()
    subscribeRealtime()
  }

  function dispose() {
    channel?.unsubscribe()
    channel = null
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = null
  }

  // Switch the active crisis: tear down the current subscription/poll, reset all
  // per-crisis state, then re-init (reload + resubscribe crisis:<newId>).
  async function switchCrisis(id: string) {
    if (id === activeId) return
    dispose()
    activeId = id
    seenIds.clear()
    lastTs = null
    currentBbox = undefined
    // Invalidate any in-flight loadViewport from the previous crisis: bumping the
    // token makes its post-await `token !== viewportToken` guard fail, so a stale
    // old-crisis fetch can't overwrite the new crisis's data.
    viewportToken++
    viewportLoading.value = false
    dropTimes.length = 0
    connectionMode.value = 'connecting'
    geojson.value = empty()
    feed.value = []
    stats.value = { total: 0, coverage_pct: 0, hourly: [] }
    await init()
  }

  return {
    geojson, stats, feed, filters, connectionMode, viewportLoading,
    filteredGeojson, filteredCount, totalCount,
    init, dispose, loadViewport, switchCrisis,
  }
}
