<script setup lang="ts">
import type { Map as MaplibreMap, StyleSpecification, ExpressionSpecification, GeoJSONSource } from 'maplibre-gl'
import { SEVERITY_COLORS } from '~/utils/severity'
import type { ReportCollection } from '~/composables/useCrisisReports'

const props = defineProps<{
  geojson: ReportCollection          // already filtered upstream
  buildingsUrl: string
  bbox: [number, number, number, number]   // crisis extent [w,s,e,n] — drives initial fit + recenters on switch
  heatmap: boolean
  regionLabel: string
}>()
const emit = defineEmits<{ select: [id: string]; boundschange: [bbox: string] }>()

let boundsTimer: ReturnType<typeof setTimeout> | null = null
function emitBounds(m: MaplibreMap) {
  if (boundsTimer) clearTimeout(boundsTimer)
  boundsTimer = setTimeout(() => {
    const b = m.getBounds()
    emit('boundschange', `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`)
  }, 400)
}

const container = ref<HTMLElement>()
const webglUnsupported = ref(false)
const tileError = ref(false)        // basemap tiles failed → parchment + buildings still render
let map: MaplibreMap | null = null
let loaded = false
let resizeObs: ResizeObserver | null = null

const CROSSHAIRS = [
  { key: 'tl', top: true, left: true },
  { key: 'tr', top: true, left: false },
  { key: 'bl', top: false, left: true },
  { key: 'br', top: false, left: false },
]

const REPORTS_SRC = 'damage-reports'   // clustered → cluster bubbles + individual markers
const HEAT_SRC = 'damage-heat-src'     // same data, UNclustered → true density surface
const BUILDINGS_SRC = 'buildings'
const MARKER_LAYERS = ['clusters', 'cluster-count', 'unclustered-point']

// 4-tier severity → marker color (mirrors @theme sev tokens + sage/grey data hues).
const sevColor: ExpressionSpecification = [
  'match', ['get', 'severity'],
  'destroyed', SEVERITY_COLORS.destroyed,
  'severe', SEVERITY_COLORS.severe,
  'moderate', SEVERITY_COLORS.moderate,
  'negligible', SEVERITY_COLORS.negligible,
  SEVERITY_COLORS.unknown,
]

// Custom parchment basemap: solid parchment background (always renders, even
// fully offline) + muted OpenFreeMap vector context (water/parks/roads). Building
// footprints from PostGIS are added as the signature overlay after load.
function buildStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#F5EFE4' } },
      { id: 'park', type: 'fill', source: 'openmaptiles', 'source-layer': 'park', paint: { 'fill-color': '#E3E2CC', 'fill-opacity': 0.5 } },
      { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water', paint: { 'fill-color': '#D3DAD6' } },
      {
        id: 'roads', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
        paint: {
          'line-color': '#E0D5C4',
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.4, 14, 1.6, 18, 5],
        },
      },
    ],
  }
}

function addDataLayers(m: MaplibreMap) {
  // Building footprints (PostGIS / Overture) — the signature geographic overlay.
  m.addSource(BUILDINGS_SRC, { type: 'geojson', data: props.buildingsUrl })
  m.addLayer({ id: 'buildings-fill', type: 'fill', source: BUILDINGS_SRC, paint: { 'fill-color': '#CDBFA8', 'fill-opacity': 0.55 } })
  m.addLayer({ id: 'buildings-line', type: 'line', source: BUILDINGS_SRC, paint: { 'line-color': '#A8A08E', 'line-width': 0.5 } })

  // Damage reports — CLUSTERED (non-negotiable at 500K). Drives cluster bubbles + markers.
  m.addSource(REPORTS_SRC, {
    type: 'geojson',
    data: props.geojson,
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 50,
  })

  // Same reports, UN-clustered — the heatmap must see the real point distribution
  // (a clustered source collapses points to a handful of centroids, which renders
  // as blobs/halos around clusters instead of a density field).
  m.addSource(HEAT_SRC, { type: 'geojson', data: props.geojson })

  // Heatmap density surface, weighted by severity so destroyed/severe damage burns
  // hotter. Hidden until toggled; when on, the marker layers hide (real mode switch).
  m.addLayer({
    id: 'damage-heat',
    type: 'heatmap',
    source: HEAT_SRC,
    layout: { visibility: props.heatmap ? 'visible' : 'none' },
    paint: {
      'heatmap-weight': ['match', ['get', 'severity'],
        'destroyed', 1, 'severe', 0.75, 'moderate', 0.5, 'negligible', 0.25, 0.4],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 6, 1, 16, 3],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 6, 18, 11, 30, 16, 50],
      'heatmap-opacity': 0.85,
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0, 'rgba(245,239,228,0)',
        0.2, 'rgba(212,165,116,0.45)',
        0.5, 'rgba(201,114,44,0.7)',
        0.8, 'rgba(139,46,42,0.85)',
        1, 'rgba(90,20,18,0.92)',
      ],
    },
  })

  // Cluster bubbles (count-stepped radius + on-brand ochre→orange→red ramp).
  m.addLayer({
    id: 'clusters',
    type: 'circle',
    source: REPORTS_SRC,
    filter: ['has', 'point_count'],
    paint: {
      'circle-radius': ['step', ['get', 'point_count'], 15, 10, 20, 50, 28, 200, 36],
      'circle-color': ['step', ['get', 'point_count'], '#D4A574', 10, '#C9722C', 50, '#8B2E2A'],
      'circle-opacity': 0.9,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#F5EFE4',
    },
  })
  m.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: REPORTS_SRC,
    filter: ['has', 'point_count'],
    layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Regular'], 'text-size': 11 },
    paint: { 'text-color': '#F5EFE4' },
  })

  // Individual markers (colored by 4-tier severity).
  m.addLayer({
    id: 'unclustered-point',
    type: 'circle',
    source: REPORTS_SRC,
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-radius': 6,
      'circle-color': sevColor,
      'circle-opacity': 0.92,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#ffffff',
    },
  })

  // Interactions.
  m.on('click', 'unclustered-point', (e) => {
    const id = e.features?.[0]?.properties?.id
    if (id) emit('select', String(id))
  })
  m.on('click', 'clusters', async (e) => {
    const f = e.features?.[0]
    const clusterId = f?.properties?.cluster_id
    if (clusterId == null) return
    const src = m.getSource(REPORTS_SRC) as GeoJSONSource
    try {
      const z = await src.getClusterExpansionZoom(clusterId)
      const [lng, lat] = (f!.geometry as GeoJSON.Point).coordinates as [number, number]
      m.easeTo({ center: [lng, lat], zoom: z })
    } catch { /* noop */ }
  })
  for (const layer of ['unclustered-point', 'clusters']) {
    m.on('mouseenter', layer, () => { m.getCanvas().style.cursor = 'pointer' })
    m.on('mouseleave', layer, () => { m.getCanvas().style.cursor = '' })
  }

  applyHeatmapMode(m, props.heatmap)
}

// Heatmap is a mode switch: density surface OR markers/clusters, not both at once.
function applyHeatmapMode(m: MaplibreMap, on: boolean) {
  m.setLayoutProperty('damage-heat', 'visibility', on ? 'visible' : 'none')
  for (const id of MARKER_LAYERS) m.setLayoutProperty(id, 'visibility', on ? 'none' : 'visible')
}

onMounted(async () => {
  // MapLibre v5 requires WebGL2.
  if (!document.createElement('canvas').getContext('webgl2')) {
    webglUnsupported.value = true
    return
  }

  await import('maplibre-gl/dist/maplibre-gl.css')
  const maplibregl = (await import('maplibre-gl')).default
  // Register the PMTiles protocol so the offline crisis-zone basemap (master plan)
  // is a drop-in style swap later — no functional cost now.
  const { Protocol } = await import('pmtiles')
  maplibregl.addProtocol('pmtiles', new Protocol().tile)

  map = new maplibregl.Map({
    container: container.value!,
    style: buildStyle(),
    bounds: [[props.bbox[0], props.bbox[1]], [props.bbox[2], props.bbox[3]]],
    fitBoundsOptions: { padding: 48 },
    attributionControl: { compact: true },
  })
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')

  // MapLibre forces `.maplibregl-map { position: relative }` on the container, so it
  // sizes to whatever the element resolves to. A drawer/feed toggle (or a layout that
  // settles after init) can change that size; keep the canvas in sync.
  resizeObs = new ResizeObserver(() => map?.resize())
  resizeObs.observe(container.value!)

  // If the vector tiles can't be reached (offline / blocked), keep the parchment
  // base + buildings + markers; just note it.
  map.on('error', (e) => {
    if (String(e?.error?.message ?? '').includes('openfreemap') || String(e?.error ?? '').includes('tiles.openfreemap')) {
      tileError.value = true
    }
  })

  map.on('load', () => {
    loaded = true
    addDataLayers(map!)
    emitBounds(map!)               // initial viewport fetch
  })
  map.on('moveend', () => emitBounds(map!))
})

onUnmounted(() => {
  if (boundsTimer) clearTimeout(boundsTimer)
  resizeObs?.disconnect()
  map?.remove()
  map = null
})

// Recenter when the active crisis changes.
watch(() => props.bbox, (b) => {
  if (!loaded || !map) return
  map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 48 })
})

watch(() => props.geojson, (g) => {
  if (!loaded || !map) return
  ;(map.getSource(REPORTS_SRC) as GeoJSONSource | undefined)?.setData(g)
  // The heat source renders only in heatmap mode; skip pushing the full collection
  // into it while markers are showing. The heatmap watch refreshes it on toggle-on.
  if (props.heatmap) (map.getSource(HEAT_SRC) as GeoJSONSource | undefined)?.setData(g)
}, { deep: false })

watch(() => props.heatmap, (on) => {
  if (!loaded || !map) return
  if (on) (map.getSource(HEAT_SRC) as GeoJSONSource | undefined)?.setData(props.geojson) // catch up while it was off
  applyHeatmapMode(map, on)
})

watch(() => props.buildingsUrl, (url) => {
  if (!loaded || !map) return
  ;(map.getSource(BUILDINGS_SRC) as GeoJSONSource | undefined)?.setData(url)
})
</script>

<template>
  <div class="relative w-full h-full overflow-hidden">
    <!-- WebGL2 fallback -->
    <div v-if="webglUnsupported" class="absolute inset-0 flex items-center justify-center p-8 bg-parchment-mid">
      <div class="max-w-sm text-center">
        <div class="label mb-3">Map unavailable</div>
        <p class="text-sm text-ink-mid leading-relaxed">
          Your browser doesn’t support WebGL2, which this map requires. Please update to a recent
          version of Chrome, Safari, Firefox, or Edge.
        </p>
      </div>
    </div>

    <template v-else>
      <!-- MapLibre adds `.maplibregl-map { position: relative }` here, which cancels any
           `absolute inset-0` (that's what collapsed the map to 0 height). Use explicit
           w-full/h-full so height resolves against the definite-height parent. -->
      <div ref="container" class="w-full h-full" />

      <!-- Crosshair registration marks (signature element) -->
      <div
        v-for="pos in CROSSHAIRS"
        :key="pos.key"
        class="absolute w-[18px] h-[18px] opacity-20 pointer-events-none"
        :class="[pos.top ? 'top-4' : 'bottom-4', pos.left ? 'start-4' : 'end-4']"
      >
        <span class="absolute top-1/2 inset-x-0 h-px -translate-y-1/2 bg-ink" />
        <span class="absolute start-1/2 inset-y-0 w-px -translate-x-1/2 bg-ink" />
      </div>

      <!-- Region label -->
      <div class="absolute top-4 start-1/2 -translate-x-1/2 font-mono text-[9px] tracking-[0.12em] uppercase text-ink-light pointer-events-none">
        {{ regionLabel }}
      </div>

      <div v-if="tileError" class="absolute bottom-4 start-4 font-mono text-[9px] text-ink-ghost pointer-events-none">
        Offline basemap · footprints only
      </div>
    </template>
  </div>
</template>
