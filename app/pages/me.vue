<script setup lang="ts">
import ProfileReporterAvatar from '~/components/profile/ReporterAvatar.vue'
import ProfileTrustBar from '~/components/profile/TrustBar.vue'
import ProfileBadgeGrid from '~/components/profile/BadgeGrid.vue'
import ProfileBadgeDetailSheet from '~/components/profile/BadgeDetailSheet.vue'
import type { BadgeMeta } from '~/utils/badges'
import { BADGE_COUNT } from '~/utils/badges'
import { SEVERITY_COLORS, type DbSeverity, type UiSeverity } from '~/utils/severity'

const { t } = useI18n()
const { uiSev, infra } = useLabels()
const { relativeTime, km2: fmtKm2 } = useFormatters()
const { profile, loading, error, load } = useReporterProfile()

useHead({ title: () => `${t('meTitle')} — CrisisMapper` })

onMounted(load)

const selected = ref<{ badge: BadgeMeta; earned: boolean } | null>(null)
const earned = computed(() => profile.value?.badges ?? [])
const earnedCount = computed(() => earned.value.length)

// Coverage Hero progress: 5 distinct ~100m zones. Ring fills toward that goal.
const COVERAGE_GOAL = 5
const zones = computed(() => profile.value?.zones ?? 0)
const ringFraction = computed(() => Math.min(zones.value / COVERAGE_GOAL, 1))
const RING_R = 18
const CIRC = 2 * Math.PI * RING_R
const remainingZones = computed(() => Math.max(COVERAGE_GOAL - zones.value, 0))
</script>

<template>
  <main class="bg-parchment min-h-screen max-w-[480px] mx-auto pb-8">
    <!-- TOP NAV -->
    <div class="flex items-center gap-3 px-4 h-[52px] border-b border-parchment-deep bg-parchment sticky top-0 z-50">
      <NuxtLink to="/report" class="font-mono text-xs text-ink-light tracking-[0.06em] no-underline min-h-[44px] flex items-center">
        <span class="rtl-flip">←</span>&nbsp;{{ $t('meBack') }}
      </NuxtLink>
      <div class="flex-1 text-center font-serif font-semibold text-[15px]">{{ $t('meTitle') }}</div>
      <NuxtLink to="/leaderboard" class="font-mono text-xs text-ink-light tracking-[0.06em] no-underline min-h-[44px] flex items-center">
        {{ $t('meBoard') }}&nbsp;<span class="rtl-flip">→</span>
      </NuxtLink>
    </div>

    <!-- LOADING -->
    <div v-if="loading" class="p-10 text-center font-mono text-[11px] text-ink-light">{{ $t('modalLoading') }}</div>

    <!-- ERROR -->
    <div v-else-if="error" class="p-10 text-center font-mono text-[11px] text-accent">{{ $t('modalError') }}</div>

    <!-- EMPTY (device has not reported yet) -->
    <div v-else-if="!profile?.found" class="px-6 py-16 text-center">
      <div class="flex justify-center mb-6">
        <div class="relative" style="--size: 48px"><div class="crosshair" /><div class="crosshair-ring" /></div>
      </div>
      <h2 class="font-serif text-xl font-semibold mb-2">{{ $t('meEmptyTitle') }}</h2>
      <p class="text-sm text-ink-light leading-relaxed mb-6 max-w-xs mx-auto">{{ $t('meEmptyBody') }}</p>
      <NuxtLink to="/report" class="btn btn-primary min-h-[48px] text-base">{{ $t('meEmptyCta') }}</NuxtLink>
    </div>

    <!-- PROFILE -->
    <template v-else>
      <!-- HEADER -->
      <div class="px-5 pt-7 pb-5 border-b border-parchment-deep text-center">
        <div class="flex justify-center">
          <ProfileReporterAvatar :seed="profile.nickname!" :size="72" />
        </div>
        <div class="mt-3 font-serif text-xl font-semibold">{{ profile.nickname }}</div>
        <div class="font-mono text-[10px] text-ink-ghost tracking-[0.08em] uppercase mt-1 mb-3">
          {{ $t('meRole') }}<template v-if="profile.crisis_name"> · {{ profile.crisis_name }}</template>
        </div>
        <div class="flex justify-center">
          <ProfileTrustBar v-if="profile.trust_tier" :tier="profile.trust_tier" />
        </div>
      </div>

      <!-- STATS -->
      <div class="grid grid-cols-3 border-b border-parchment-deep">
        <div class="py-[18px] px-3 text-center border-e border-parchment-deep">
          <div class="font-serif text-[28px] font-bold leading-none">{{ profile.total }}</div>
          <div class="label mt-1">{{ $t('meStatsTotal') }}</div>
        </div>
        <div class="py-[18px] px-3 text-center border-e border-parchment-deep">
          <div class="font-serif text-[28px] font-bold leading-none">{{ profile.verified }}</div>
          <div class="label mt-1">{{ $t('meStatsVerified') }}</div>
        </div>
        <div class="py-[18px] px-3 text-center">
          <div class="font-serif text-[28px] font-bold leading-none">{{ earnedCount }}</div>
          <div class="label mt-1">{{ $t('meStatsBadges') }}</div>
        </div>
      </div>

      <!-- IMPACT -->
      <div class="px-5 py-4 border-b border-parchment-deep flex items-center gap-3">
        <div class="relative w-10 h-10 shrink-0">
          <svg width="40" height="40" viewBox="0 0 40 40">
            <circle cx="20" cy="20" :r="RING_R" fill="none" stroke="var(--c-parchment-deep)" stroke-width="2" />
            <circle
              cx="20" cy="20" :r="RING_R" fill="none" stroke="var(--c-sev-minimal)" stroke-width="2"
              :stroke-dasharray="`${ringFraction * CIRC} ${CIRC}`" stroke-linecap="round"
              transform="rotate(-90 20 20)"
            />
          </svg>
          <div class="absolute inset-0 flex items-center justify-center font-mono text-[8px] text-ink-light">{{ fmtKm2(profile.impact_km2 ?? 0) }}</div>
        </div>
        <div>
          <div class="label mb-1">{{ $t('meImpactLabel') }}</div>
          <div class="text-[13px] leading-relaxed text-ink">
            {{ $t('meImpactBody', { km2: fmtKm2(profile.impact_km2 ?? 0), zones }) }}
            <template v-if="remainingZones > 0"> {{ $t('meImpactGoal', { n: remainingZones }) }}</template>
          </div>
        </div>
      </div>

      <!-- BADGES -->
      <div class="px-5 pt-5 pb-4">
        <div class="flex justify-between items-center mb-3.5">
          <div class="label">{{ $t('meBadges') }}</div>
          <div class="font-mono text-[9px] text-ink-ghost">{{ $t('meEarnedCount', { earned: earnedCount, total: BADGE_COUNT }) }}</div>
        </div>
        <ProfileBadgeGrid :earned="earned" @select="(badge, e) => (selected = { badge, earned: e })" />
      </div>

      <!-- RECENT -->
      <div v-if="profile.recent?.length" class="px-5 border-t border-parchment-deep">
        <div class="label mb-3.5 mt-5">{{ $t('meRecent') }}</div>
        <div
          v-for="r in profile.recent"
          :key="r.id"
          class="flex items-center gap-3 py-2.5 border-b border-parchment-deep"
        >
          <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: SEVERITY_COLORS[r.severity as DbSeverity] }" />
          <div class="flex-1 min-w-0">
            <div class="text-[13px] font-medium truncate capitalize">{{ infra(r.infrastructure_type) }}</div>
            <div class="font-mono text-[10px] text-ink-ghost mt-0.5">{{ relativeTime(r.submitted_at) }}</div>
          </div>
          <div class="flex flex-col items-end gap-1 shrink-0">
            <span v-if="r.damage_classification" class="sev-chip" :class="r.damage_classification">{{ uiSev(r.damage_classification as UiSeverity) }}</span>
            <span v-if="r.is_verified" class="font-mono text-[9px] text-sev-minimal tracking-[0.06em]">✓ {{ $t('meVerifiedMark') }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- BADGE DETAIL SHEET -->
    <ProfileBadgeDetailSheet
      v-if="selected"
      :badge="selected.badge"
      :earned="selected.earned"
      @close="selected = null"
    />
  </main>
</template>
