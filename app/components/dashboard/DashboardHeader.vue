<script setup lang="ts">
import type { Stats } from '~/composables/useCrisisReports'

const props = defineProps<{ stats: Stats }>()
const heatmap = defineModel<boolean>('heatmap', { required: true })
const feedOpen = defineModel<boolean>('feedOpen', { required: true })

const { t } = useI18n()
// Locale-formatted once, reused for both the visible text and its tooltip.
const duplicatesLabel = computed(() =>
  t('dashDuplicates', { n: props.stats.duplicate_count.toLocaleString() }))
</script>

<template>
  <header
    class="flex items-center gap-3 sm:gap-6 lg:gap-8 px-4 sm:px-6 h-[60px] shrink-0 z-10
           border-b border-parchment-deep bg-parchment overflow-hidden"
  >
    <!-- Logo -->
    <NuxtLink to="/" class="flex items-center gap-2 shrink-0 text-ink no-underline">
      <span class="relative block w-[22px] h-[22px] rounded-full border-2 border-accent shrink-0">
        <span class="absolute top-1/2 inset-x-0 h-[1.5px] -translate-y-1/2 bg-accent" />
        <span class="absolute start-1/2 inset-y-0 w-[1.5px] -translate-x-1/2 bg-accent" />
      </span>
      <span class="font-serif font-semibold text-base hidden sm:inline">CrisisMapper</span>
    </NuxtLink>

    <span class="w-px h-6 bg-parchment-deep shrink-0 hidden sm:block" />

    <!-- Total reports (+ probable-duplicate count when any are flagged) -->
    <div class="flex items-baseline gap-1.5 min-w-0">
      <span class="font-serif font-bold text-2xl sm:text-[28px] leading-none tabular-nums">{{ stats.total.toLocaleString() }}</span>
      <span class="label truncate"><span class="hidden sm:inline">{{ $t('dashReports') }}</span><span class="sm:hidden">{{ $t('dashReportsShort') }}</span></span>
      <span
        v-if="stats.duplicate_count > 0"
        class="hidden md:inline label text-ink-ghost truncate"
        :title="duplicatesLabel"
      >· {{ duplicatesLabel }}</span>
    </div>

    <span class="w-px h-6 bg-parchment-deep shrink-0 hidden md:block" />

    <!-- Coverage -->
    <div class="hidden md:flex items-baseline gap-1.5 shrink-0">
      <span class="font-serif font-bold text-2xl sm:text-[28px] leading-none tabular-nums">
        {{ stats.coverage_pct }}<span class="text-base">%</span>
      </span>
      <span class="label">{{ $t('dashCoverage') }}</span>
    </div>

    <!-- Sparkline -->
    <div class="hidden lg:flex flex-col gap-0.5 justify-center shrink-0">
      <span class="label">{{ $t('dashReportRate') }}</span>
      <DashboardSparkline :data="stats.hourly" />
    </div>

    <!-- Right cluster -->
    <div class="ms-auto flex items-center gap-2 sm:gap-3 shrink-0">
      <LanguageSwitcher />

      <button
        type="button"
        class="focus-ring flex items-center gap-1.5 px-3 min-h-[44px] rounded-sm border-[1.5px] font-mono text-[10px] tracking-[0.08em] cursor-pointer transition-colors"
        :class="heatmap
          ? 'border-accent text-accent bg-[color-mix(in_srgb,var(--c-accent)_10%,var(--c-parchment))]'
          : 'border-parchment-deep text-ink-light bg-transparent'"
        :aria-pressed="heatmap"
        :aria-label="$t('dashHeatmap')"
        @click="heatmap = !heatmap"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <circle cx="6" cy="6" r="4" opacity="0.4" /><circle cx="6" cy="6" r="2" opacity="0.7" /><circle cx="6" cy="6" r="1" />
        </svg>
        <span class="hidden sm:inline">{{ $t('dashHeatmap') }}</span>
      </button>

      <NuxtLink
        to="/report"
        class="flex items-center gap-1.5 px-3 sm:px-3.5 min-h-[44px] bg-accent text-white rounded-sm no-underline text-[13px] font-medium hover:bg-accent-hover transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" class="shrink-0"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5" /><circle cx="8" cy="8" r="3" fill="currentColor" /></svg>
        {{ $t('dashReportCta') }}
      </NuxtLink>

      <button
        type="button"
        class="focus-ring px-2.5 min-h-[44px] rounded-sm border-[1.5px] border-parchment-deep bg-transparent text-ink-light font-mono text-[10px] tracking-[0.06em] cursor-pointer hidden lg:block"
        @click="feedOpen = !feedOpen"
      >
        {{ feedOpen ? $t('dashHideFeed') : $t('dashShowFeed') }}
      </button>
    </div>
  </header>
</template>
