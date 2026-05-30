<script setup lang="ts">
import type { DbSeverity, InfraType } from '~/utils/severity'
import { SEVERITY_COLORS, SEVERITY_LABELS, SEVERITY_FILTER_ORDER, INFRA_TYPES } from '~/utils/severity'
import type { Filters } from '~/composables/useCrisisReports'

const props = defineProps<{
  crises: { id: string; name: string }[]
  filters: Filters
  severityCounts: Record<DbSeverity, number>
}>()
const crisisId = defineModel<string>('crisisId', { required: true })

const EXPORT_FORMATS = ['GeoJSON', 'CSV', 'GPKG', 'Shapefile']
const TRUST_LEGEND = [
  { tier: 'Unverified',   col: 'var(--c-ink-ghost)',    desc: 'New reporter, no history' },
  { tier: 'Contributing', col: 'var(--c-sev-minimal)',  desc: '5+ accepted reports' },
  { tier: 'Trusted',      col: 'var(--c-sev-partial)',  desc: 'Verified ID + 20+ reports' },
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

const HOURS_MIN = 6
const HOURS_MAX = 168
const HOURS_STEP = 6
function stepHours(delta: number) {
  props.filters.hours = Math.min(HOURS_MAX, Math.max(HOURS_MIN, props.filters.hours + delta))
}
// 72 → "72h", 168 → "7d" (whole days read cleaner than "168h").
const hoursLabel = computed(() =>
  props.filters.hours % 24 === 0 ? `${props.filters.hours / 24}d` : `${props.filters.hours}h`,
)
</script>

<template>
  <div class="flex flex-col">
    <!-- Crisis selector -->
    <section class="px-5 pb-5 border-b border-parchment-deep">
      <div class="label mb-2">Active crisis</div>
      <select
        v-model="crisisId"
        class="focus-ring w-full px-3 py-2.5 min-h-[44px] bg-white border border-parchment-deep rounded-sm font-sans text-[13px] text-ink cursor-pointer appearance-none bg-no-repeat"
        style="background-image:url(&quot;data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236B6B6B' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E&quot;);background-position:right 12px center"
      >
        <option v-for="c in crises" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
    </section>

    <!-- Severity -->
    <section class="px-5 py-4 border-b border-parchment-deep">
      <div class="label mb-2.5">Severity</div>
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
          <span class="font-mono text-[10px] tracking-[0.08em] uppercase" :style="{ color: SEVERITY_COLORS[s] }">{{ SEVERITY_LABELS[s] }}</span>
          <span class="ms-auto font-mono text-[10px] text-ink-ghost tabular-nums">{{ (severityCounts[s] ?? 0).toLocaleString() }}</span>
        </button>
      </div>
    </section>

    <!-- Infrastructure -->
    <section class="px-5 py-4 border-b border-parchment-deep">
      <div class="label mb-2.5">Infrastructure</div>
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
          {{ t }}
        </button>
      </div>
    </section>

    <!-- Time range -->
    <section class="px-5 py-4 border-b border-parchment-deep">
      <div class="flex justify-between items-center mb-2.5">
        <div class="label">Time range</div>
        <div class="font-mono text-[10px] text-accent">Last {{ hoursLabel }}</div>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="focus-ring shrink-0 w-8 h-8 rounded-sm border border-parchment-deep bg-white text-ink-mid text-lg leading-none flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-parchment-mid"
          :disabled="filters.hours <= HOURS_MIN"
          aria-label="Decrease time range"
          @click="stepHours(-HOURS_STEP)"
        >−</button>
        <input
          v-model.number="filters.hours"
          type="range" :min="HOURS_MIN" :max="HOURS_MAX" :step="HOURS_STEP"
          class="flex-1 min-w-0"
          aria-label="Time range in hours"
        >
        <button
          type="button"
          class="focus-ring shrink-0 w-8 h-8 rounded-sm border border-parchment-deep bg-white text-ink-mid text-lg leading-none flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-parchment-mid"
          :disabled="filters.hours >= HOURS_MAX"
          aria-label="Increase time range"
          @click="stepHours(HOURS_STEP)"
        >+</button>
      </div>
      <div class="flex justify-between mt-1">
        <span class="font-mono text-[9px] text-ink-ghost">6h</span>
        <span class="font-mono text-[9px] text-ink-ghost">7d</span>
      </div>
    </section>

    <!-- Export (Phase 9) -->
    <section class="px-5 py-4 border-b border-parchment-deep">
      <div class="flex items-center justify-between mb-2.5">
        <div class="label">Export data</div>
        <span class="font-mono text-[9px] text-ink-ghost tracking-[0.06em]">PHASE 9</span>
      </div>
      <div class="grid grid-cols-2 gap-1.5">
        <button
          v-for="fmt in EXPORT_FORMATS"
          :key="fmt"
          type="button"
          disabled
          :title="`${fmt} export — available in Phase 9`"
          class="py-2 min-h-[36px] rounded-sm border-[1.5px] border-parchment-deep bg-white text-ink-ghost font-mono text-[10px] tracking-[0.06em] cursor-not-allowed opacity-60"
        >
          {{ fmt }}
        </button>
      </div>
    </section>

    <!-- Trust legend -->
    <section class="px-5 py-4">
      <div class="label mb-2.5">Trust score legend</div>
      <div v-for="t in TRUST_LEGEND" :key="t.tier" class="flex items-start gap-2 mb-2">
        <span class="w-2 h-2 rounded-full shrink-0 mt-1" :style="{ background: t.col }" />
        <div>
          <div class="font-mono text-[10px] tracking-[0.06em] text-ink uppercase">{{ t.tier }}</div>
          <div class="text-[11px] text-ink-ghost">{{ t.desc }}</div>
        </div>
      </div>
    </section>
  </div>
</template>
