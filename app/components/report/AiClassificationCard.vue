<script setup lang="ts">
import type { UiSeverity } from '~/utils/severity'
import type { ClassifyResult } from '~/utils/aiClassify'
import { isAiUsable } from '~/utils/aiClassify'

const props = defineProps<{
  modelValue: UiSeverity
  aiResult: ClassifyResult | null
  aiLoading: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [UiSeverity]
  confirm: []
  correct: []
}>()

const reasoningOpen = ref(false)

const SEV_COLORS: Record<UiSeverity, string> = {
  minimal: 'var(--color-sev-minimal)',
  partial: 'var(--color-sev-partial)',
  complete: 'var(--color-sev-complete)',
}

const SEV_KEYS: Record<UiSeverity, string> = {
  minimal: 'sevMinimal',
  partial: 'sevPartial',
  complete: 'sevComplete',
}

const hasResult = computed(() => isAiUsable(props.aiResult))
const isDegraded = computed(() => props.aiResult !== null && !hasResult.value)

const damageDisplay = computed(() =>
  hasResult.value ? `${props.aiResult!.damage_percentage}%` : '—'
)

const confidenceDisplay = computed(() =>
  hasResult.value ? `${Math.round(props.aiResult!.confidence * 100)}%` : '—'
)

// Width of the confidence bar — 0% when no result, full width at 100% confidence.
const confidenceBarStyle = computed(() => {
  const pct = hasResult.value ? Math.round(props.aiResult!.confidence * 100) : 0
  return { width: `${pct}%` }
})

// Confidence-based color: red <60 (manual-review threshold), partial 60-80, green ≥80.
const confidenceBarColor = computed(() => {
  if (!hasResult.value) return 'var(--color-parchment-deep)'
  const c = props.aiResult!.confidence
  if (c < 0.6) return 'var(--color-sev-complete)'
  if (c < 0.8) return 'var(--color-sev-partial)'
  return 'var(--color-sev-minimal)'
})
</script>

<template>
  <section class="mb-10 sm:mb-12">
    <div class="mb-5">
      <div class="label mb-1.5">{{ $t('step2label') }}</div>
      <div class="font-serif text-xl sm:text-2xl font-semibold leading-tight">{{ $t('aiTitle') }}</div>
    </div>

    <div class="border border-parchment-deep rounded overflow-hidden bg-white">
      <!-- Severity selector -->
      <div class="p-4 border-b border-parchment-deep">
        <div class="label mb-2.5">{{ $t('sevLabel') }}</div>
        <div class="flex gap-2">
          <button
            v-for="sev in (['minimal', 'partial', 'complete'] as UiSeverity[])"
            :key="sev"
            class="flex-1 min-h-[44px] py-2.5 px-2 rounded-sm label cursor-pointer transition-colors duration-150 focus-ring"
            :style="{
              border: `2px solid ${modelValue === sev ? SEV_COLORS[sev] : 'transparent'}`,
              background: modelValue === sev ? `color-mix(in srgb, ${SEV_COLORS[sev]} 15%, white)` : 'var(--color-parchment)',
              color: modelValue === sev ? SEV_COLORS[sev] : 'var(--color-ink-light)',
            }"
            @click="emit('update:modelValue', sev)"
          >{{ $t(SEV_KEYS[sev]) }}</button>
        </div>
      </div>

      <!-- Stats row -->
      <div class="grid grid-cols-1 sm:grid-cols-2 p-4 gap-4 border-b border-parchment-deep">
        <div>
          <div class="label mb-1">{{ $t('dmgLabel') }}</div>
          <div class="font-serif text-2xl sm:text-3xl font-bold text-ink leading-none">
            <span v-if="aiLoading" class="text-ink-light">…</span>
            <span v-else>{{ damageDisplay }}</span>
          </div>
        </div>
        <div>
          <div class="label mb-1">{{ $t('confLabel') }}</div>
          <div class="font-serif text-2xl sm:text-3xl font-bold text-ink leading-none">
            <span v-if="aiLoading" class="text-ink-light">…</span>
            <span v-else>{{ confidenceDisplay }}</span>
          </div>
          <div class="h-[3px] bg-parchment-deep rounded mt-1.5 overflow-hidden">
            <div
              class="h-full transition-all duration-300"
              :style="{ ...confidenceBarStyle, background: confidenceBarColor }"
            />
          </div>
        </div>
      </div>

      <!-- Reasoning accordion -->
      <div class="px-4">
        <button
          class="flex justify-between items-center w-full min-h-[44px] py-3 bg-transparent border-none cursor-pointer label text-ink-light focus-ring rounded-sm"
          @click="reasoningOpen = !reasoningOpen"
        >
          {{ $t('reasoningTitle') }}
          <span
            class="text-sm transition-transform duration-200"
            :style="{ transform: reasoningOpen ? 'rotate(180deg)' : 'none' }"
          >▾</span>
        </button>
        <div v-if="reasoningOpen" class="pb-4">
          <!-- Loading -->
          <div v-if="aiLoading" class="text-xs sm:text-sm text-ink-light leading-relaxed">
            {{ $t('aiThinking') }}
          </div>

          <!-- Degraded -->
          <div v-else-if="isDegraded" class="text-xs sm:text-sm text-ink-light leading-relaxed">
            {{ $t('aiUnavailable') }}
          </div>

          <!-- Result -->
          <div v-else-if="hasResult" class="text-xs sm:text-sm text-ink-light leading-relaxed space-y-3">
            <p>{{ aiResult!.reasoning }}</p>

            <div v-if="aiResult!.damage_indicators.length > 0">
              <div class="label mb-1.5">{{ $t('aiIndicatorsLabel') }}</div>
              <div class="flex flex-wrap gap-1.5">
                <span
                  v-for="(ind, i) in aiResult!.damage_indicators"
                  :key="i"
                  class="label px-2 py-0.5 bg-parchment border border-parchment-deep rounded-sm text-ink-mid"
                >{{ ind }}</span>
              </div>
            </div>

            <div v-if="aiResult!.recommendation">
              <div class="label mb-1">{{ $t('aiRecommendationLabel') }}</div>
              <p>{{ aiResult!.recommendation }}</p>
            </div>

            <div class="text-ink-ghost">
              {{ $t('aiQualityLabel') }}: {{ aiResult!.photo_quality }}
            </div>
          </div>

          <!-- No photo yet (shouldn't happen since the card only renders at step ≥2) -->
          <div v-else class="text-xs sm:text-sm text-ink-light leading-relaxed">
            {{ $t('aiPending') }}
          </div>
        </div>
      </div>
    </div>

    <!-- Offline banner -->
    <div
      v-if="isDegraded"
      class="mt-3 px-3 py-2 bg-sev-partial/10 border border-sev-partial rounded text-sm text-sev-partial text-start leading-snug"
    >
      ⚠ {{ $t('aiOffline') }}
    </div>

    <!-- Confirm / Correct -->
    <div class="flex gap-2.5 mt-3">
      <button class="btn btn-primary flex-1 min-h-[44px]" @click="emit('confirm')">{{ $t('aiConfirm') }}</button>
      <button class="btn btn-ghost flex-1 min-h-[44px]" @click="emit('correct')">{{ $t('aiCorrect') }}</button>
    </div>
  </section>
</template>
