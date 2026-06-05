<script setup lang="ts">
import type { Map as MaplibreMap, StyleSpecification, GeoJSONSource, LngLat, MapMouseEvent } from 'maplibre-gl'

// Hand-rolled drag-rectangle bbox picker for the crisis admin console. Drag on the map
// to rubber-band a zone; on release it emits [west, south, east, north] — exactly the
// extent shape /api/crises + the reporter point-in-bbox attribution already consume.
// Mirrors MapCanvas.client.vue's init (dynamic maplibre import, parchment style,
// WebGL2 guard, ResizeObserver, cleanup) rather than pulling a heavy draw dependency.
const model = defineModel<[number, number, number, number] | null>({ default: null })

const container = ref<HTMLElement>()
const webglUnsupported = ref(false)
const drawMode = ref(false)

let map: MaplibreMap | null = null
let loaded = false
let resizeObs: ResizeObserver | null = null
let start: LngLat | null = null
let lastMove: LngLat | null = null

const DRAW_SRC = 'draw-rect'

// Richer than the dashboard's minimal style on purpose: the operator is drawing a precise
// zone, so legibility (place names, buildings, boundaries) beats aesthetic restraint.
// All layers come from the OpenMapTiles `openmaptiles` source (openfreemap planet).
function buildStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: { openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#F5EFE4' } },
      // Surface context — subtle fills so green/urban land reads without shouting.
      { id: 'landcover', type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover', paint: { 'fill-color': '#E3E6D2', 'fill-opacity': 0.45 } },
      {
        id: 'landuse-residential', type: 'fill', source: 'openmaptiles', 'source-layer': 'landuse',
        filter: ['==', ['get', 'class'], 'residential'],
        paint: { 'fill-color': '#ECE4D2', 'fill-opacity': 0.5 },
      },
      { id: 'park', type: 'fill', source: 'openmaptiles', 'source-layer': 'park', paint: { 'fill-color': '#DDE3C6', 'fill-opacity': 0.55 } },
      { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water', paint: { 'fill-color': '#BBD0CE' } },
      // Building footprints — the main "detail when zoomed in" the operator was missing.
      {
        id: 'buildings', type: 'fill', source: 'openmaptiles', 'source-layer': 'building', minzoom: 13,
        paint: {
          'fill-color': '#D8C9AE',
          'fill-outline-color': '#B7A98C',
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 15, 0.7],
        },
      },
      {
        id: 'roads', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
        paint: { 'line-color': '#DAC9B0', 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.4, 14, 1.6, 18, 5] },
      },
      // Admin boundaries (country/state/county) for orientation.
      {
        id: 'boundaries', type: 'line', source: 'openmaptiles', 'source-layer': 'boundary',
        filter: ['all', ['<=', ['get', 'admin_level'], 6], ['!=', ['get', 'maritime'], 1]],
        paint: {
          'line-color': '#B7A98C',
          'line-dasharray': [2, 1.5],
          'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.5, 8, 1, 12, 1.6],
        },
      },
      // Street labels at high zoom — helps pinpoint a neighbourhood-scale zone.
      {
        id: 'street-labels', type: 'symbol', source: 'openmaptiles', 'source-layer': 'transportation_name', minzoom: 13,
        layout: {
          'symbol-placement': 'line',
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
        },
        paint: { 'text-color': '#7A6F5C', 'text-halo-color': '#F5EFE4', 'text-halo-width': 1.2 },
      },
      // Place labels — cities/towns/villages/suburbs, sized by importance for hierarchy.
      {
        id: 'place-labels', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place',
        filter: ['in', ['get', 'class'], ['literal', ['city', 'town', 'village', 'suburb', 'neighbourhood']]],
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': [
            'interpolate', ['linear'], ['zoom'],
            4, ['match', ['get', 'class'], 'city', 13, 10],
            10, ['match', ['get', 'class'], 'city', 18, 'town', 14, 12],
            14, ['match', ['get', 'class'], 'city', 22, 'town', 17, 'suburb', 14, 13],
          ],
          'text-max-width': 8,
        },
        paint: { 'text-color': '#4A4030', 'text-halo-color': '#F5EFE4', 'text-halo-width': 1.6 },
      },
    ],
  }
}

// [w,s,e,n] → closed-ring rectangle polygon for the draw source.
function rectGeojson(w: number, s: number, e: number, n: number): GeoJSON.Feature {
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
    properties: {},
  }
}
function emptyGeojson(): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: [] }
}

function drawFromCorners(a: LngLat, b: LngLat) {
  const w = Math.min(a.lng, b.lng), e = Math.max(a.lng, b.lng)
  const s = Math.min(a.lat, b.lat), n = Math.max(a.lat, b.lat)
  ;(map?.getSource(DRAW_SRC) as GeoJSONSource | undefined)?.setData(rectGeojson(w, s, e, n))
  return [w, s, e, n] as [number, number, number, number]
}

function renderModel() {
  if (!map) return
  const src = map.getSource(DRAW_SRC) as GeoJSONSource | undefined
  if (!src) return
  if (model.value) {
    const [w, s, e, n] = model.value
    src.setData(rectGeojson(w, s, e, n))
    map.fitBounds([[w, s], [e, n]], { padding: 56, duration: 0 })
  } else {
    src.setData(emptyGeojson())
  }
}

function onMouseDown(e: MapMouseEvent) {
  if (!drawMode.value || !map) return
  e.preventDefault()           // suppress the default box-zoom/pan
  map.dragPan.disable()
  start = e.lngLat
  lastMove = e.lngLat
}
function onMouseMove(e: MapMouseEvent) {
  if (!start) return
  lastMove = e.lngLat
  drawFromCorners(start, e.lngLat)
}
function finishDraw() {
  if (!start || !lastMove || !map) return
  const [w, s, e, n] = drawFromCorners(start, lastMove)
  start = null
  lastMove = null
  drawMode.value = false
  map.dragPan.enable()
  map.getCanvas().style.cursor = ''
  // A click (or near-zero drag) yields a zero-area rect the server rejects (w<e && s<n).
  // Discard it and restore the prior outline so the operator just retries the drag,
  // rather than committing a bbox that fails on save with a generic error.
  if (e - w <= 0 || n - s <= 0) {
    renderModel()
    return
  }
  model.value = [w, s, e, n]
}

// MapLibre's mouseup only fires over the canvas; a release outside it would otherwise
// strand the draw in progress. A window-level fallback finalizes from the last point.
function onWindowMouseUp() { if (start) finishDraw() }

watch(drawMode, (on) => {
  if (map) map.getCanvas().style.cursor = on ? 'crosshair' : ''
})
watch(model, () => { if (loaded) renderModel() })

onMounted(async () => {
  if (!document.createElement('canvas').getContext('webgl2')) {
    webglUnsupported.value = true
    return
  }
  await import('maplibre-gl/dist/maplibre-gl.css')
  const maplibregl = (await import('maplibre-gl')).default
  const { Protocol } = await import('pmtiles')
  maplibregl.addProtocol('pmtiles', new Protocol().tile)

  map = new maplibregl.Map({
    container: container.value!,
    style: buildStyle(),
    ...(model.value
      ? { bounds: [[model.value[0], model.value[1]], [model.value[2], model.value[3]]], fitBoundsOptions: { padding: 56 } }
      : { center: [20, 15] as [number, number], zoom: 1.4 }),
    attributionControl: { compact: true },
  })
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')

  resizeObs = new ResizeObserver(() => map?.resize())
  resizeObs.observe(container.value!)

  map.on('load', () => {
    loaded = true
    map!.addSource(DRAW_SRC, { type: 'geojson', data: emptyGeojson() })
    map!.addLayer({ id: 'draw-fill', type: 'fill', source: DRAW_SRC, paint: { 'fill-color': '#C9722C', 'fill-opacity': 0.18 } })
    map!.addLayer({ id: 'draw-line', type: 'line', source: DRAW_SRC, paint: { 'line-color': '#C9722C', 'line-width': 2 } })
    renderModel()
  })
  map.on('mousedown', onMouseDown)
  map.on('mousemove', onMouseMove)
  map.on('mouseup', finishDraw)
  window.addEventListener('mouseup', onWindowMouseUp)
})

onUnmounted(() => {
  window.removeEventListener('mouseup', onWindowMouseUp)
  resizeObs?.disconnect()
  map?.remove()
  map = null
})
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center gap-3">
      <button
        type="button"
        class="btn min-h-[40px] text-[13px]"
        :class="drawMode ? 'btn-primary' : 'btn-ghost'"
        @click="drawMode = !drawMode"
      >
        {{ drawMode ? 'Drawing… drag on the map' : '✏ Draw zone' }}
      </button>
      <button
        v-if="model"
        type="button"
        class="btn btn-ghost min-h-[40px] text-[13px]"
        @click="model = null"
      >
        Clear
      </button>
      <span v-if="model" class="font-mono text-[10px] text-ink-light">
        {{ model.map(n => n.toFixed(3)).join(', ') }}
      </span>
    </div>

    <div class="relative w-full h-[60vh] min-h-[380px] lg:h-[620px] rounded-sm overflow-hidden border border-parchment-deep">
      <div v-if="webglUnsupported" class="absolute inset-0 flex items-center justify-center p-6 bg-parchment-mid text-center">
        <p class="text-sm text-ink-mid leading-relaxed">This browser can’t render the map (WebGL2 required). Enter the bbox manually.</p>
      </div>
      <div v-else ref="container" class="w-full h-full" />
    </div>
  </div>
</template>
