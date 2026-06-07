<script setup lang="ts">
import type { DbSeverity } from '~/utils/severity'
import { dbToUi, SEVERITY_COLORS } from '~/utils/severity'

const { t } = useI18n()
const { uiSev, infra } = useLabels()
const { relativeTime } = useFormatters()

interface FeedItem {
  id: string
  severity: DbSeverity
  infrastructure_type: string | null
  submitted_at: string
  lng: number
  lat: number
}
defineProps<{
  feed: FeedItem[]
  connectionMode: 'connecting' | 'realtime' | 'polling'
  selectedId: string | null
  hourly?: number[]
}>()
const emit = defineEmits<{ select: [id: string] }>()

const sevClass = (s: DbSeverity) => dbToUi(s) ?? 'partial'
const sevLabel = (s: DbSeverity) => { const u = dbToUi(s); return u ? uiSev(u) : t('sevUnknown') }

const statusColor = { connecting: 'var(--c-ink-ghost)', realtime: 'var(--c-accent)', polling: 'var(--c-sev-partial)' }
const STATUS_KEY = { connecting: 'feedConnecting', realtime: 'feedLive', polling: 'feedPolling' } as const
</script>

<template>
  <aside class="w-full sm:w-[320px] shrink-0 border-s border-parchment-deep bg-parchment flex flex-col overflow-hidden">
    <div class="px-[18px] py-3.5 border-b border-parchment-deep flex items-center gap-2">
      <span
        class="w-[7px] h-[7px] rounded-full"
        :class="connectionMode === 'realtime' ? 'animate-pulse' : ''"
        :style="{ background: statusColor[connectionMode] }"
      />
      <span class="label">{{ $t(STATUS_KEY[connectionMode]) }}</span>
    </div>

    <!-- 24h reports-over-time trend (chart.js, dashboard-only client bundle) -->
    <DashboardTrendChart v-if="hourly?.length" :hourly="hourly" />

    <div class="flex-1 overflow-auto">
      <p v-if="!feed.length" class="px-[18px] py-8 text-[12px] text-ink-ghost text-center">
        {{ $t('feedEmpty') }}
      </p>

      <button
        v-for="r in feed"
        :key="r.id"
        type="button"
        class="w-full text-start px-[18px] py-3 border-b border-parchment-deep cursor-pointer transition-colors"
        :class="selectedId === r.id ? 'bg-parchment-mid' : 'hover:bg-parchment-mid/50'"
        @click="emit('select', r.id)"
      >
        <div class="flex items-start gap-2.5 mb-1.5">
          <!-- Thumbnail placeholder (severity-tinted; real photo loads in the detail modal) -->
          <span
            class="w-10 h-10 rounded-sm shrink-0 flex items-center justify-center"
            :style="{ background: `linear-gradient(135deg, ${SEVERITY_COLORS[r.severity]} 0%, color-mix(in srgb, ${SEVERITY_COLORS[r.severity]} 55%, #2A1A0A) 100%)` }"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="white" stroke-width="1.2" opacity="0.5">
              <rect x="1" y="3" width="12" height="9" rx="1" /><circle cx="7" cy="7.5" r="2.5" />
            </svg>
          </span>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between mb-0.5">
              <span class="sev-chip" :class="sevClass(r.severity)">{{ sevLabel(r.severity) }}</span>
              <span class="font-mono text-[9px] text-ink-ghost shrink-0 ms-2">{{ relativeTime(r.submitted_at) }}</span>
            </div>
            <div class="text-[12px] font-medium leading-snug text-ink capitalize truncate">{{ infra(r.infrastructure_type) }}</div>
            <div class="font-mono text-[9px] text-ink-ghost mt-0.5 tabular-nums">{{ r.lat.toFixed(4) }}, {{ r.lng.toFixed(4) }}</div>
          </div>
        </div>
        <div class="font-mono text-[9px] text-accent">{{ $t('feedViewOnMap') }} <span class="rtl-flip">→</span></div>
      </button>
    </div>
  </aside>
</template>
