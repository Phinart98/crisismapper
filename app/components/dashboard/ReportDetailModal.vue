<script setup lang="ts">
import type { UiSeverity } from '~/utils/severity'

const { t, locale } = useI18n()
const { uiSev, infra } = useLabels()

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
  lat: number
  lng: number
}

const props = defineProps<{ reportId: string | null }>()
const emit = defineEmits<{ close: [] }>()

const detail = ref<ReportDetail | null>(null)
const loading = ref(false)
const error = ref(false)

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
onMounted(() => window.addEventListener('keydown', onKey))
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
          <div class="font-mono text-[10px] text-ink-ghost mb-1">{{ detail.id.slice(0, 8) }} · {{ fmtDate(detail.submitted_at) }}</div>
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

          <!-- Staff actions — visual-only in Phase 7 (no auth/moderation backend yet) -->
          <div class="flex gap-2.5">
            <button type="button" disabled class="btn flex-1 bg-ink text-parchment opacity-60 cursor-not-allowed text-[13px] min-h-[44px]">✓ {{ $t('modalVerify') }}</button>
            <button type="button" disabled class="btn flex-1 bg-white text-ink border-[1.5px] border-parchment-deep opacity-60 cursor-not-allowed text-[13px] min-h-[44px]">{{ $t('modalFlag') }}</button>
          </div>
          <p class="font-mono text-[9px] text-ink-ghost text-center mt-2">{{ $t('modalModerationNote') }}</p>
        </template>
      </div>
    </div>
  </div>
</template>
