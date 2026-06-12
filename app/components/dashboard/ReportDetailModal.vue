<script setup lang="ts">
import type { UiSeverity, TrustTier } from '~/utils/severity'
import { TRUST_COLORS } from '~/utils/severity'

const { t, locale } = useI18n()
const { uiSev, infra, trust } = useLabels()

interface ReportDetail {
  id: string
  severity: string
  damage_classification: UiSeverity | null
  infrastructure_type: string | null
  description: string | null
  submitted_at: string
  photo_url: string | null
  ai_confidence: number | null
  ai_reasoning: string | null
  ai_damage_indicators: string[] | null
  ai_damage_percentage: number | null
  reporter_trust_tier: TrustTier | null
  is_verified: boolean
  lat: number
  lng: number
}

const props = defineProps<{ reportId: string | null }>()
const emit = defineEmits<{ close: [] }>()

// Staff session gates the Verify/Flag actions; refresh() populates it from /api/auth/me.
const { isStaff, refresh: refreshStaff } = useStaff()
const moderating = ref(false)

const detail = ref<ReportDetail | null>(null)
const loading = ref(false)
const error = ref(false)

async function moderate(action: 'verify' | 'unverify') {
  if (!detail.value || moderating.value) return
  moderating.value = true
  try {
    const res = await $fetch<{ id: string; is_verified: boolean }>(
      `/api/admin/reports/${detail.value.id}/moderate`,
      { method: 'POST', body: { action } },
    )
    detail.value.is_verified = res.is_verified
  } catch { /* leave state unchanged on failure */ } finally {
    moderating.value = false
  }
}

watch(() => props.reportId, async (id) => {
  detail.value = null
  error.value = false
  if (!id) return
  loading.value = true
  try {
    detail.value = await $fetch<ReportDetail>(`/api/reports/${id}`)
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
})

const chipClass = computed<UiSeverity>(() => detail.value?.damage_classification ?? 'partial')
const chipLabel = computed(() => detail.value?.damage_classification ? uiSev(detail.value.damage_classification) : t('sevUnknown'))
const fmtDate = (iso: string) => new Date(iso).toLocaleString(locale.value, { dateStyle: 'medium', timeStyle: 'short' })

function onKey(e: KeyboardEvent) { if (e.key === 'Escape') emit('close') }
onMounted(() => {
  window.addEventListener('keydown', onKey)
  refreshStaff()
})
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div
    v-if="reportId"
    class="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[rgba(26,26,26,0.4)]"
    @click.self="emit('close')"
  >
    <div class="bg-parchment w-full max-w-[480px] rounded-md overflow-hidden border border-parchment-deep shadow-2xl max-h-[90vh] overflow-y-auto">
      <!-- Photo / header -->
      <div class="relative aspect-[16/9] bg-parchment-mid">
        <img
          v-if="detail?.photo_url"
          :src="detail.photo_url"
          :alt="$t('modalPhotoAlt')"
          class="w-full h-full object-cover"
        >
        <div v-else class="w-full h-full flex items-center justify-center text-ink-ghost">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.4">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
          </svg>
        </div>
        <div v-if="detail" class="absolute top-3 start-3">
          <span class="sev-chip" :class="chipClass">{{ $t('modalDamageChip', { level: chipLabel }) }}</span>
        </div>
        <button
          type="button"
          class="focus-ring absolute top-3 end-3 w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center text-base cursor-pointer"
          :aria-label="$t('modalClose')"
          @click="emit('close')"
        >×</button>
      </div>

      <div class="p-5">
        <p v-if="loading" class="font-mono text-[11px] text-ink-light">{{ $t('modalLoading') }}</p>
        <p v-else-if="error" class="font-mono text-[11px] text-accent">{{ $t('modalError') }}</p>

        <template v-else-if="detail">
          <div class="flex items-center gap-2 mb-1">
            <div class="font-mono text-[10px] text-ink-ghost">{{ detail.id.slice(0, 8) }} · {{ fmtDate(detail.submitted_at) }}</div>
            <!-- Reporter trust tier — label only (no score, no identity; data minimization). -->
            <span
              v-if="detail.reporter_trust_tier"
              class="inline-flex items-center gap-1 font-mono text-[9px] tracking-[0.06em] uppercase text-ink-mid"
            >
              <span class="w-1.5 h-1.5 rounded-full shrink-0" :style="{ background: TRUST_COLORS[detail.reporter_trust_tier] }" />
              {{ trust(detail.reporter_trust_tier) }}
            </span>
          </div>
          <div class="font-serif text-lg font-semibold mb-1.5 capitalize">{{ $t('modalInfraHeading', { type: infra(detail.infrastructure_type) }) }}</div>
          <p v-if="detail.description" class="text-[13px] text-ink-mid leading-relaxed mb-3.5">{{ detail.description }}</p>

          <!-- AI reasoning -->
          <div v-if="detail.ai_reasoning" class="mb-4 p-3 rounded-sm bg-parchment-mid border border-parchment-deep">
            <div class="label mb-1.5">{{ $t('modalAiAssessment') }}</div>
            <p class="text-[12px] text-ink-mid leading-relaxed">{{ detail.ai_reasoning }}</p>
            <div v-if="detail.ai_damage_indicators?.length" class="flex flex-wrap gap-1 mt-2">
              <span v-for="ind in detail.ai_damage_indicators" :key="ind" class="font-mono text-[9px] px-1.5 py-0.5 rounded-sm bg-parchment text-ink-light">{{ ind }}</span>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-3 mb-4">
            <div>
              <div class="label mb-1">{{ $t('modalInfrastructure') }}</div>
              <div class="font-mono text-[11px] text-ink capitalize">{{ detail.infrastructure_type ? infra(detail.infrastructure_type) : '—' }}</div>
            </div>
            <div>
              <div class="label mb-1">{{ $t('modalAiConfidence') }}</div>
              <div class="font-mono text-[11px] text-ink">{{ detail.ai_confidence != null ? Math.round(detail.ai_confidence * 100) + '%' : '—' }}</div>
            </div>
            <div>
              <div class="label mb-1">{{ $t('modalDamageEst') }}</div>
              <div class="font-mono text-[11px] text-ink">{{ detail.ai_damage_percentage != null ? detail.ai_damage_percentage + '%' : '—' }}</div>
            </div>
          </div>

          <!-- Staff moderation (Phase 10): live for an authenticated staff session;
               disabled visual for anon dashboard viewers. -->
          <template v-if="isStaff">
            <div class="flex gap-2.5">
              <button
                type="button"
                :disabled="moderating || detail.is_verified"
                class="btn flex-1 text-[13px] min-h-[44px]"
                :class="detail.is_verified ? 'bg-ink/70 text-parchment cursor-default' : 'bg-ink text-parchment'"
                @click="moderate('verify')"
              >✓ {{ $t('modalVerify') }}</button>
              <button
                type="button"
                :disabled="moderating || !detail.is_verified"
                class="btn flex-1 bg-white text-ink border-[1.5px] border-parchment-deep text-[13px] min-h-[44px] disabled:opacity-50"
                @click="moderate('unverify')"
              >{{ $t('modalFlag') }}</button>
            </div>
            <p v-if="detail.is_verified" class="font-mono text-[9px] text-ink-light text-center mt-2">✓ {{ $t('modalVerify') }}</p>
          </template>
          <template v-else>
            <p class="font-mono text-[10px] text-ink-light text-center mb-2.5">{{ $t('modalModerationNote') }}</p>
            <NuxtLink to="/login?redirect=/dashboard" class="btn btn-ghost btn-full min-h-[44px] text-[13px]">
              {{ $t('modalSignIn') }}
            </NuxtLink>
          </template>
        </template>
      </div>
    </div>
  </div>
</template>
