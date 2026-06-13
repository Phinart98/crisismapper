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

export interface Stats {
  total: number
  duplicate_count: number
  coverage_pct: number
  hourly: number[]
}

export interface Filters {
  sev: DbSeverity[]      // empty = all
  infra: InfraType[]     // empty = all
  hours: number | null   // time window; null = all time (default — recovery runs for months)
}

type ConnectionMode = 'connecting' | 'realtime' | 'polling'

const FEED_LIMIT = 30

export type FeedItem = ReportProps & { lng: number; lat: number }

const empty = (): ReportCollection => ({ type: 'FeatureCollection', features: [] })
const toFeedItem = (f: ReportFeature): FeedItem =>
  ({ ...f.properties, lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] })

// Sentinel for the global "all active crises" dashboard view: endpoints aggregate
// when crisis_id is omitted, and there's no single broadcast channel to subscribe to,
// so global mode polls for updates instead of using realtime.
export const ALL_CRISES = 'all'

export function useCrisisReports(initialCrisisId: string) {
  let activeId = initialCrisisId
  // crisis_id query param: omitted in global mode so the endpoints aggregate.
  const qId = () => (activeId === ALL_CRISES ? undefined : activeId)
  const geojson = ref<ReportCollection>(empty())
  const stats = ref<Stats>({ total: 0, duplicate_count: 0, coverage_pct: 0, hourly: [] })
  const feed = ref<FeedItem[]>([])
  const filters = reactive<Filters>({ sev: [], infra: [], hours: null })
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

  // Rebuild geojson from a fresh server payload (initial load or viewport refetch):
  // reset the dedup set and re-track each feature.
  function rebuild(fc: ReportCollection): ReportCollection {
    const fresh = empty()
    seenIds.clear()
    for (const f of fc.features) if (track(f)) fresh.features.push(f)
    return fresh
  }

  function addFeature(f: ReportFeature, prependFeed = true): boolean {
    if (!track(f)) return false
    geojson.value.features.push(f)
    if (prependFeed) {
      feed.value = [toFeedItem(f), ...feed.value].slice(0, FEED_LIMIT)
      stats.value = { ...stats.value, total: stats.value.total + 1 }
    } else {
      feed.value.push(toFeedItem(f))
    }
    return true
  }

  // Filtered set drives both the map (setData → clusters + points honor filters,
  // which per-layer filter expressions can't do for clustered sources) and the
  // "showing X of Y" indicator.
  const cutoff = computed(() => filters.hours === null ? null : Date.now() - filters.hours * 3600_000)
  const filteredFeatures = computed(() =>
    geojson.value.features.filter((f) => {
      const p = f.properties
      if (filters.sev.length && !filters.sev.includes(p.severity)) return false
      if (filters.infra.length && (!p.infrastructure_type || !filters.infra.includes(p.infrastructure_type))) return false
      if (cutoff.value !== null && new Date(p.submitted_at).getTime() < cutoff.value) return false
      return true
    }),
  )
  const filteredGeojson = computed<ReportCollection>(() => ({
    type: 'FeatureCollection',
    features: filteredFeatures.value,
  }))
  const filteredCount = computed(() => filteredFeatures.value.length)
  const totalCount = computed(() => geojson.value.features.length)

  // Per-severity tally of the loaded set (drives the sidebar counts). Kept here so
  // the raw `geojson` stays encapsulated in the composable.
  const severityCounts = computed(() => {
    const counts: Record<DbSeverity, number> = { negligible: 0, moderate: 0, severe: 0, destroyed: 0, unknown: 0 }
    for (const f of geojson.value.features) counts[f.properties.severity]++
    return counts
  })

  let currentBbox: string | undefined

  async function loadInitial() {
    const [fc, s] = await Promise.all([
      $fetch<ReportCollection>('/api/map/reports', { query: { crisis_id: qId() } }),
      $fetch<Stats>('/api/map/stats', { query: { crisis_id: qId() } }),
    ])
    const fresh = rebuild(fc)
    // Newest first for the feed, capped.
    feed.value = [...fresh.features]
      .sort((a, b) => (a.properties.submitted_at < b.properties.submitted_at ? 1 : -1))
      .slice(0, FEED_LIMIT)
      .map(toFeedItem)
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
      const fc = await $fetch<ReportCollection>('/api/map/reports', { query: { crisis_id: qId(), bbox } })
      if (token !== viewportToken) return // a newer pan superseded this fetch
      geojson.value = rebuild(fc)
    } finally {
      if (token === viewportToken) viewportLoading.value = false
    }
  }

  // Fetch reports newer than the last one we've seen and append them. Shared by the
  // realtime path (broadcast = "go fetch") and the polling fallback. Privacy split
  // (Phase 11): the broadcast payload now carries SNAPPED coordinates for everyone, so
  // we ignore its geometry and pull the delta instead — /api/map/reports returns exact
  // coords to a staff session and aggregated coords to anon, so each viewer's markers
  // land at the precision they're entitled to. Returns whether anything was added.
  async function fetchDelta(): Promise<boolean> {
    if (!lastTs) return false
    const fc = await $fetch<ReportCollection>('/api/map/reports', {
      query: { crisis_id: qId(), since: lastTs },
    })
    let added = false
    for (const f of fc.features) if (addFeature(f)) added = true
    if (added) geojson.value = { ...geojson.value }
    return added
  }

  // Coalesce a burst of broadcasts into a single delta fetch.
  let deltaTimer: ReturnType<typeof setTimeout> | null = null
  function scheduleDelta() {
    if (deltaTimer) return
    deltaTimer = setTimeout(() => {
      deltaTimer = null
      fetchDelta().catch(() => { /* transient — next broadcast/poll retries */ })
    }, 500)
  }

  // ── Polling fallback ──────────────────────────────────────────────────────
  function startPolling() {
    if (pollTimer) return
    connectionMode.value = 'polling'
    pollTimer = setInterval(() => {
      fetchDelta().catch(() => { /* transient — try again next tick */ })
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
      .on('broadcast', { event: 'reports' }, () => {
        scheduleDelta() // payload is snapped for all; pull the session-correct delta
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
    // Global mode has no single crisis channel — poll for the live feel instead.
    if (activeId === ALL_CRISES) startPolling()
    else subscribeRealtime()
  }

  function dispose() {
    channel?.unsubscribe()
    channel = null
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = null
    if (deltaTimer) clearTimeout(deltaTimer)
    deltaTimer = null
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
    stats.value = { total: 0, duplicate_count: 0, coverage_pct: 0, hourly: [] }
    await init()
  }

  return {
    stats, feed, filters, connectionMode, viewportLoading,
    filteredGeojson, filteredCount, totalCount, severityCounts,
    init, dispose, loadViewport, switchCrisis,
  }
}
