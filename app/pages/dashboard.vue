<script setup lang="ts">
import type { DbSeverity } from '~/utils/severity'
import { useCrisisReports } from '~/composables/useCrisisReports'

useHead({ title: 'CrisisMapper — Dashboard' })

const { public: { demoCrisisId } } = useRuntimeConfig()

interface CrisisRow { id: string; name: string; crisis_type: string; bbox: [number, number, number, number] | null }

// Active crises drive the selector + the map extent. SSR-fetched so the first paint
// already has the list; falls back to the demo crisis id if the call fails.
const { data: crisesData } = await useFetch<CrisisRow[]>('/api/crises', { default: () => [] })
const crises = computed(() => crisesData.value ?? [])

const DEFAULT_BBOX: [number, number, number, number] = [95.8, 21.5, 96.5, 22.2] // Mandalay
const initialId = crises.value.find(c => c.id === demoCrisisId)?.id ?? crises.value[0]?.id ?? demoCrisisId
const crisisId = ref(initialId)

const reports = useCrisisReports(initialId)

const heatmap = ref(false)
const feedOpen = ref(true)            // desktop feed column
const filtersOpen = ref(false)        // mobile filters drawer
const mobileFeedOpen = ref(false)     // mobile feed bottom sheet
const selectedId = ref<string | null>(null)

const activeCrisis = computed(() => crises.value.find(c => c.id === crisisId.value) ?? null)
const activeBbox = computed<[number, number, number, number]>(() => activeCrisis.value?.bbox ?? DEFAULT_BBOX)
const regionLabel = computed(() => activeCrisis.value?.name ?? 'Crisis zone')
const buildingsUrl = computed(() => `/api/buildings?crisis_id=${crisisId.value}`)

// Switching the selector tears down + re-subscribes realtime for the new crisis.
watch(crisisId, id => reports.switchCrisis(id))

const severityCounts = computed(() => {
  const counts: Record<DbSeverity, number> = { negligible: 0, moderate: 0, severe: 0, destroyed: 0, unknown: 0 }
  for (const f of reports.geojson.value.features) counts[f.properties.severity]++
  return counts
})

const filtersActive = computed(() => reports.filters.sev.length > 0 || reports.filters.infra.length > 0 || reports.filters.hours < 168)
function clearFilters() {
  reports.filters.sev = []
  reports.filters.infra = []
  reports.filters.hours = 168
}

onMounted(() => reports.init())
onBeforeUnmount(() => reports.dispose())
</script>

<template>
  <div class="flex flex-col h-[100dvh] overflow-hidden bg-parchment">
    <DashboardHeader v-model:heatmap="heatmap" v-model:feed-open="feedOpen" :stats="reports.stats.value" />

    <div class="flex flex-1 overflow-hidden relative">
      <!-- Left sidebar (static on lg+) -->
      <aside class="hidden lg:block lg:w-[300px] shrink-0 overflow-auto border-e border-parchment-deep bg-parchment py-5">
        <DashboardFilterSidebar
          v-model:crisis-id="crisisId"
          :crises="crises"
          :filters="reports.filters"
          :severity-counts="severityCounts"
        />
      </aside>

      <!-- Map -->
      <div class="flex-1 relative">
        <ClientOnly>
          <DashboardMapCanvas
            :geojson="reports.filteredGeojson.value"
            :buildings-url="buildingsUrl"
            :bbox="activeBbox"
            :heatmap="heatmap"
            :region-label="regionLabel"
            @select="selectedId = $event"
            @boundschange="reports.loadViewport($event)"
          />
          <template #fallback>
            <div class="absolute inset-0 flex items-center justify-center bg-parchment-mid">
              <span class="label">Loading map…</span>
            </div>
          </template>
        </ClientOnly>

        <!-- Mobile toggles (lg:hidden) — Filters drawer + Feed bottom sheet -->
        <button
          type="button"
          class="focus-ring lg:hidden absolute top-4 start-4 px-3 min-h-[44px] rounded-sm border-[1.5px] border-parchment-deep bg-parchment/90 backdrop-blur text-ink-mid font-mono text-[10px] tracking-[0.06em] cursor-pointer"
          @click="filtersOpen = true"
        >
          FILTERS
        </button>
        <button
          type="button"
          class="focus-ring lg:hidden absolute top-4 end-4 flex items-center gap-1.5 px-3 min-h-[44px] rounded-sm border-[1.5px] border-parchment-deep bg-parchment/90 backdrop-blur text-ink-mid font-mono text-[10px] tracking-[0.06em] cursor-pointer"
          @click="mobileFeedOpen = true"
        >
          <span class="w-[6px] h-[6px] rounded-full" :style="{ background: 'var(--c-accent)' }" />
          FEED
        </button>

        <!-- Showing X of Y -->
        <div
          v-if="filtersActive"
          class="absolute bottom-4 start-4 bg-parchment/90 backdrop-blur border border-parchment-deep rounded-sm px-3 py-2 font-mono text-[10px] tracking-[0.06em] text-ink-mid"
        >
          Showing {{ reports.filteredCount.value.toLocaleString() }} of {{ reports.totalCount.value.toLocaleString() }}
          <button type="button" class="ms-2.5 text-accent cursor-pointer" @click="clearFilters">Clear ×</button>
        </div>

        <!-- Updating pill (viewport refetch in flight) -->
        <div
          v-if="reports.viewportLoading.value"
          class="absolute top-4 start-1/2 -translate-x-1/2 lg:translate-x-0 lg:start-auto lg:end-4 flex items-center gap-1.5 bg-parchment/90 backdrop-blur border border-parchment-deep rounded-full px-3 py-1.5 font-mono text-[10px] tracking-[0.06em] text-ink-light"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" /> Updating…
        </div>

        <!-- Empty state: viewport settled with no reports in view -->
        <div
          v-else-if="reports.totalCount.value === 0"
          class="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div class="bg-parchment/85 backdrop-blur border border-parchment-deep rounded-md px-5 py-4 text-center max-w-xs">
            <div class="label mb-1">No reports in view</div>
            <p class="text-xs text-ink-light leading-relaxed">Pan or zoom out, widen the time range, or clear filters to see more.</p>
          </div>
        </div>
      </div>

      <!-- Right feed — desktop column (≥lg) -->
      <DashboardActivityFeed
        v-if="feedOpen"
        :feed="reports.feed.value"
        :connection-mode="reports.connectionMode.value"
        :selected-id="selectedId"
        class="hidden lg:flex"
        @select="selectedId = $event"
      />
    </div>

    <!-- Mobile feed bottom sheet (<lg) -->
    <Transition name="fade">
      <div v-if="mobileFeedOpen" class="lg:hidden fixed inset-0 z-[150] bg-black/40" @click.self="mobileFeedOpen = false">
        <div class="absolute inset-x-0 bottom-0 h-[75vh] bg-parchment rounded-t-xl overflow-hidden shadow-2xl flex flex-col">
          <div class="relative shrink-0">
            <div class="flex justify-center pt-2 pb-1"><span class="w-10 h-1 rounded-full bg-parchment-deep" /></div>
            <button type="button" class="focus-ring absolute top-1.5 end-2 text-ink-light text-lg w-9 h-9" aria-label="Close" @click="mobileFeedOpen = false">×</button>
          </div>
          <DashboardActivityFeed
            :feed="reports.feed.value"
            :connection-mode="reports.connectionMode.value"
            :selected-id="selectedId"
            class="flex flex-1 min-h-0 !w-full !border-s-0"
            @select="(id) => { selectedId = id; mobileFeedOpen = false }"
          />
        </div>
      </div>
    </Transition>

    <!-- Mobile filters drawer -->
    <Transition name="fade">
      <div v-if="filtersOpen" class="lg:hidden fixed inset-0 z-[150] bg-black/40" @click.self="filtersOpen = false">
        <div class="absolute inset-y-0 start-0 w-[300px] max-w-[85vw] bg-parchment overflow-auto py-5 shadow-2xl">
          <div class="flex justify-between items-center px-5 mb-2">
            <span class="label">Filters</span>
            <button type="button" class="focus-ring text-ink-light text-lg w-9 h-9" aria-label="Close" @click="filtersOpen = false">×</button>
          </div>
          <DashboardFilterSidebar
            v-model:crisis-id="crisisId"
            :crises="crises"
            :filters="reports.filters"
            :severity-counts="severityCounts"
          />
        </div>
      </div>
    </Transition>

    <DashboardReportDetailModal :report-id="selectedId" @close="selectedId = null" />
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
