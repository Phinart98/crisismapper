<script setup lang="ts">
import { useDeviceId } from '~/composables/useDeviceId'
import { BADGES } from '~/utils/badges'
import type { ReporterProfile } from '~/composables/useReporterProfile'

const props = defineProps<{
  photoError?: boolean
  queued?: boolean
  crisisId?: string
  crisisName?: string | null
}>()
const emit = defineEmits<{ again: [] }>()

const { km2: fmtKm2 } = useFormatters()

// Real "you are reporter #N" count — fetched from the crisis's live total once the
// report has actually reached the backend (synced, not queued). Falls back to a plain
// headline if the count can't be fetched (e.g. flaky connection).
const rank = ref<number | null>(null)
// Real earned badges + impact for this device (Phase 11) — replaces the old hardcoded
// "First Responder" placeholder. The badge AFTER INSERT trigger has already run by the
// time /api/me is queried, so the freshly-earned badge shows immediately.
const profile = ref<ReporterProfile | null>(null)

onMounted(async () => {
  if (props.queued || !props.crisisId) return
  const deviceId = useDeviceId()
  const [stats, me] = await Promise.allSettled([
    $fetch<{ total: number }>('/api/map/stats', { query: { crisis_id: props.crisisId } }),
    deviceId ? $fetch<ReporterProfile>('/api/me', { method: 'POST', body: { device_id: deviceId } }) : Promise.resolve(null),
  ])
  if (stats.status === 'fulfilled') rank.value = stats.value.total
  if (me.status === 'fulfilled' && me.value) profile.value = me.value
})

const crisisLabel = computed(() => props.crisisName || 'crisis')
const earnedBadges = computed(() => {
  const codes = profile.value?.badges ?? []
  return BADGES.filter(b => codes.includes(b.code))
})
const impactKm2 = computed(() => profile.value?.impact_km2 ?? 0)
</script>

<template>
  <div class="flex-1 flex flex-col items-center justify-center px-5 sm:px-8 py-10 sm:py-12 text-center min-h-screen">
    <!-- Checkmark / queued indicator -->
    <div
      class="w-[72px] h-[72px] rounded-full flex items-center justify-center mb-6 text-3xl border-2"
      :class="queued ? 'border-ink/40 bg-ink/5' : 'border-accent bg-accent/15'"
    >{{ queued ? '⏱' : '✓' }}</div>

    <div class="label mb-2.5" :class="queued ? 'text-ink/60' : 'text-accent'">
      {{ queued ? $t('syncTitle') : $t('confirmLabel') }}
    </div>
    <div class="font-serif text-2xl sm:text-3xl font-bold leading-tight mb-3">
      <template v-if="queued">{{ $t('queuedTitle') }}</template>
      <template v-else-if="rank !== null">{{ $t('confirmTitle', { n: rank }) }}</template>
      <template v-else>{{ $t('confirmLabel') }}</template>
    </div>
    <div class="text-sm text-ink-light mb-7 leading-relaxed max-w-xs">
      {{ queued ? $t('queuedBody') : $t('confirmBody', { crisis: crisisLabel }) }}
    </div>

    <!-- Photo error banner -->
    <div v-if="photoError" class="w-full max-w-xs mb-4 px-3 py-2 bg-sev-partial/10 border border-sev-partial rounded text-sm text-sev-partial text-start leading-snug">
      ⚠ {{ $t('photoFailedNote') }}
    </div>

    <!-- Impact + earned badges — synced reports only (queued haven't reached UNDP yet). -->
    <template v-if="!queued">
      <!-- Impact -->
      <div v-if="profile?.found" class="w-full max-w-xs mb-4 px-4 py-3 bg-parchment-mid border border-parchment-deep rounded-md text-start">
        <div class="label mb-0.5">{{ $t('meImpactLabel') }}</div>
        <div class="text-[13px] text-ink leading-relaxed">{{ $t('confirmImpact', { km2: fmtKm2(impactKm2) }) }}</div>
      </div>

      <!-- Earned badge highlight -->
      <div v-if="earnedBadges.length" class="bg-parchment-mid border border-parchment-deep rounded-md px-5 sm:px-6 py-4 mb-4 flex items-center gap-3.5 w-full max-w-xs">
        <span class="text-2xl sm:text-[28px] shrink-0">{{ earnedBadges[0]!.emoji }}</span>
        <div class="text-start min-w-0">
          <div class="label mb-0.5">{{ $t('confirmBadgeLabel') }}</div>
          <div class="font-serif text-base font-semibold">{{ $t(earnedBadges[0]!.name) }}</div>
          <div class="text-xs text-ink-light mt-0.5">
            {{ earnedBadges.length > 1 ? $t('confirmBadgeMore', { n: earnedBadges.length - 1 }) : $t(earnedBadges[0]!.desc) }}
          </div>
        </div>
      </div>
    </template>

    <div class="flex flex-col gap-2.5 w-full max-w-xs">
      <button class="btn btn-primary btn-full min-h-[48px]" @click="emit('again')">{{ $t('confirmAnother') }}</button>
      <NuxtLink v-if="!queued && profile?.found" to="/me" class="btn btn-ghost btn-full min-h-[48px]">{{ $t('confirmViewProfile') }}</NuxtLink>
    </div>
  </div>
</template>
