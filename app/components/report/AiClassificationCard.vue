<script setup lang="ts">
import type { UiSeverity } from '~/utils/severity'

const props = defineProps<{ modelValue: UiSeverity }>()
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

      <!-- Stats row — placeholders until Phase 4 AI. Stack on phones, two-up on sm+. -->
      <div class="grid grid-cols-1 sm:grid-cols-2 p-4 gap-4 border-b border-parchment-deep">
        <div>
          <div class="label mb-1">{{ $t('dmgLabel') }}</div>
          <div class="font-serif text-2xl sm:text-3xl font-bold text-ink leading-none">—</div>
        </div>
        <div>
          <div class="label mb-1">{{ $t('confLabel') }}</div>
          <div class="font-serif text-2xl sm:text-3xl font-bold text-ink leading-none">—</div>
          <div class="h-[3px] bg-parchment-deep rounded mt-1.5" />
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
          <div class="text-xs sm:text-sm text-ink-light leading-relaxed">{{ $t('aiPending') }}</div>
        </div>
      </div>
    </div>

    <!-- Confirm / Correct -->
    <div class="flex gap-2.5 mt-3">
      <button class="btn btn-primary flex-1 min-h-[44px]" @click="emit('confirm')">{{ $t('aiConfirm') }}</button>
      <button class="btn btn-ghost flex-1 min-h-[44px]" @click="emit('correct')">{{ $t('aiCorrect') }}</button>
    </div>
  </section>
</template>
