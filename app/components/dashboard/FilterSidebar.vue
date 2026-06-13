<script setup lang="ts">
import type { DbSeverity, InfraType, TrustTier } from '~/utils/severity'
import { SEVERITY_COLORS, SEVERITY_FILTER_ORDER, INFRA_TYPES, TRUST_COLORS } from '~/utils/severity'
import type { Filters } from '~/composables/useCrisisReports'
import { ALL_CRISES } from '~/composables/useCrisisReports'

const props = defineProps<{
  crises: { id: string; name: string; crisis_type: string }[]
  filters: Filters
  severityCounts: Record<DbSeverity, number>
}>()
const crisisId = defineModel<string>('crisisId', { required: true })

const { t } = useI18n()
const { dbSev, infra, hazard, trust } = useLabels()
const { busy: exportBusy, error: exportError, download: downloadExport } = useExport(crisisId)

// Global "All active crises" option first, then the individual crises.
const crisisOptions = computed(() => [
  { id: ALL_CRISES, name: t('dashAllCrises') },
  ...props.crises,
])

// Hazard chip only makes sense for a single crisis; hidden in the global view.
const activeHazardType = computed(() =>
  crisisId.value === ALL_CRISES ? undefined : props.crises.find(c => c.id === crisisId.value)?.crisis_type)

const EXPORT_FORMATS = ['GeoJSON', 'CSV', 'GPKG', 'Shapefile']
// Labels/descriptions carry i18n keys (translated in template); colour is sourced from the
// shared TRUST_COLORS map (severity.ts) so the legend and the modal badge never diverge.
const TRUST_LEGEND: { tier: TrustTier; descKey: string }[] = [
  { tier: 'unverified',   descKey: 'trustUnverifiedDesc' },
  { tier: 'contributing', descKey: 'trustContributingDesc' },
  { tier: 'trusted',      descKey: 'trustTrustedDesc' },
]

function toggleSev(s: DbSeverity) {
  const i = props.filters.sev.indexOf(s)
  if (i === -1) props.filters.sev.push(s)
  else props.filters.sev.splice(i, 1)
}
function toggleInfra(t: InfraType) {
  const i = props.filters.infra.indexOf(t)
  if (i === -1) props.filters.infra.push(t)
  else props.filters.infra.splice(i, 1)
}

// Discrete windows: operational views (24h/72h) through recovery-scale (30d) plus
// All — recovery operations run for months, so a hard cap would hide real data.
const TIME_CHIPS: { hours: number | null, label: string | null }[] = [
  { hours: 24, label: '24h' }, { hours: 72, label: '72h' },
  { hours: 168, label: '7d' }, { hours: 720, label: '30d' },
  { hours: null, label: null }, // null label → $t('filterAllTime')
]
</script>

<template>
  <div class="flex flex-col">
    <!-- Crisis selector -->
    <section class="px-5 pb-5 border-b border-parchment-deep">
      <div class="label mb-2">{{ $t('filterActiveCrisis') }}</div>
      <select
        v-model="crisisId"
        class="focus-ring w-full px-3 py-2.5 min-h-[44px] bg-white border border-parchment-deep rounded-sm font-sans text-[13px] text-ink cursor-pointer appearance-none bg-no-repeat"
        style="background-image:url(&quot;data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236B6B6B' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E&quot;);background-position:right 12px center"
      >
        <option v-for="c in crisisOptions" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>

      <!-- Localized hazard-type chip — surfaces the crisis's hazard category (the part we
           own + can translate; the name stays as proper-noun data). -->
      <span
        v-if="activeHazardType"
        class="mt-2.5 inline-flex items-center gap-1.5 px-2 py-1 rounded-sm bg-parchment-mid border border-parchment-deep font-mono text-[10px] tracking-[0.08em] uppercase text-ink-mid"
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2" class="shrink-0">
          <path d="M6 1.2 11 10.5H1L6 1.2Z" stroke-linejoin="round" /><path d="M6 5v2.4" stroke-linecap="round" /><circle cx="6" cy="9" r="0.5" fill="currentColor" stroke="none" />
        </svg>
        {{ hazard(activeHazardType) }}
      </span>
    </section>

    <!-- Severity -->
    <section class="px-5 py-4 border-b border-parchment-deep">
      <div class="label mb-2.5">{{ $t('filterSeverity') }}</div>
      <div class="flex flex-col gap-1.5">
        <button
          v-for="s in SEVERITY_FILTER_ORDER"
          :key="s"
          type="button"
          class="focus-ring flex items-center gap-2.5 px-2.5 min-h-[44px] rounded-sm border-[1.5px] cursor-pointer transition-colors"
          :class="filters.sev.includes(s) ? 'bg-parchment' : 'bg-parchment-mid border-transparent'"
          :style="filters.sev.includes(s) ? { borderColor: SEVERITY_COLORS[s] } : {}"
          :aria-pressed="filters.sev.includes(s)"
          @click="toggleSev(s)"
        >
          <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: SEVERITY_COLORS[s] }" />
          <span class="font-mono text-[10px] tracking-[0.08em] uppercase" :style="{ color: SEVERITY_COLORS[s] }">{{ dbSev(s) }}</span>
          <span class="ms-auto font-mono text-[10px] text-ink-ghost tabular-nums">{{ (severityCounts[s] ?? 0).toLocaleString() }}</span>
        </button>
      </div>
    </section>

    <!-- Infrastructure -->
    <section class="px-5 py-4 border-b border-parchment-deep">
      <div class="label mb-2.5">{{ $t('filterInfrastructure') }}</div>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="t in INFRA_TYPES"
          :key="t"
          type="button"
          class="focus-ring px-2.5 min-h-[36px] rounded-full border-[1.5px] font-sans text-[11px] font-medium capitalize cursor-pointer transition-colors"
          :class="filters.infra.includes(t)
            ? 'bg-ink text-parchment border-ink'
            : 'bg-white text-ink-mid border-parchment-deep'"
          :aria-pressed="filters.infra.includes(t)"
          @click="toggleInfra(t)"
        >
          {{ infra(t) }}
        </button>
      </div>
    </section>

    <!-- Time range -->
    <section class="px-5 py-4 border-b border-parchment-deep">
      <div class="label mb-2.5">{{ $t('filterTimeRange') }}</div>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="w in TIME_CHIPS"
          :key="w.label ?? 'all'"
          type="button"
          class="focus-ring px-2.5 min-h-[36px] rounded-full border-[1.5px] font-mono text-[10px] tracking-[0.06em] uppercase cursor-pointer transition-colors"
          :class="filters.hours === w.hours
            ? 'bg-ink text-parchment border-ink'
            : 'bg-white text-ink-mid border-parchment-deep'"
          :aria-pressed="filters.hours === w.hours"
          @click="filters.hours = w.hours"
        >{{ w.label ?? $t('filterAllTime') }}</button>
      </div>
    </section>

    <!-- Export — GIS-interoperable damage dataset (Q&A #14) -->
    <section class="px-5 py-4 border-b border-parchment-deep">
      <div class="label mb-2.5">{{ $t('filterExportData') }}</div>
      <div class="grid grid-cols-2 gap-1.5">
        <button
          v-for="fmt in EXPORT_FORMATS"
          :key="fmt"
          type="button"
          :disabled="!!exportBusy"
          :title="$t('filterExportTitle', { fmt })"
          class="focus-ring py-2 min-h-[36px] rounded-sm border-[1.5px] border-parchment-deep bg-white text-ink-mid font-mono text-[10px] tracking-[0.06em] cursor-pointer transition-colors hover:bg-parchment-mid disabled:cursor-not-allowed disabled:opacity-50"
          @click="downloadExport(fmt)"
        >
          {{ exportBusy === fmt ? $t('exportDownloading') : fmt }}
        </button>
      </div>
      <!-- Exact coordinates are staff data (Q&A #18); /api/export is gated by the Supabase
           staff session now (Phase 10) — same-origin cookie, no key entry here. -->
      <p v-if="exportError" class="mt-1.5 font-mono text-[10px] text-accent">{{ $t('exportFailed') }}</p>
    </section>

    <!-- Trust legend -->
    <section class="px-5 py-4">
      <div class="label mb-2.5">{{ $t('filterTrustLegend') }}</div>
      <div v-for="t in TRUST_LEGEND" :key="t.tier" class="flex items-start gap-2 mb-2">
        <span class="w-2 h-2 rounded-full shrink-0 mt-1" :style="{ background: TRUST_COLORS[t.tier] }" />
        <div>
          <div class="font-mono text-[10px] tracking-[0.06em] text-ink uppercase">{{ trust(t.tier) }}</div>
          <div class="text-[11px] text-ink-ghost">{{ $t(t.descKey) }}</div>
        </div>
      </div>
    </section>
  </div>
</template>
