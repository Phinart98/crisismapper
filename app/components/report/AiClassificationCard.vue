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
  <section class="mb-7">
    <div class="mb-3.5">
      <div class="label mb-1">{{ $t('step2label') }}</div>
      <div class="font-serif text-xl font-semibold leading-tight">{{ $t('aiTitle') }}</div>
    </div>

    <div class="border border-parchment-deep rounded overflow-hidden bg-white">
      <!-- Severity selector -->
      <div class="p-3.5 border-b border-parchment-deep">
        <div class="label mb-2.5">{{ $t('sevLabel') }}</div>
        <div class="flex gap-2">
          <button
            v-for="sev in (['minimal', 'partial', 'complete'] as UiSeverity[])"
            :key="sev"
            class="flex-1 py-2.5 px-2 rounded-sm label cursor-pointer transition-all duration-150"
            :style="{
              border: `2px solid ${modelValue === sev ? SEV_COLORS[sev] : 'transparent'}`,
              background: modelValue === sev ? `color-mix(in srgb, ${SEV_COLORS[sev]} 15%, white)` : 'var(--color-parchment)',
              color: modelValue === sev ? SEV_COLORS[sev] : 'var(--color-ink-light)',
            }"
            @click="emit('update:modelValue', sev)"
          >{{ $t(SEV_KEYS[sev]) }}</button>
        </div>
      </div>

      <!-- Stats row — placeholders until Phase 4 AI -->
      <div class="grid grid-cols-2 p-3 gap-3 border-b border-parchment-deep">
        <div>
          <div class="label mb-1">{{ $t('dmgLabel') }}</div>
          <div class="font-serif text-2xl font-bold text-ink">—</div>
        </div>
        <div>
          <div class="label mb-1">{{ $t('confLabel') }}</div>
          <div class="font-serif text-2xl font-bold text-ink">—</div>
          <div class="h-[3px] bg-parchment-deep rounded mt-1" />
        </div>
      </div>

      <!-- Reasoning accordion -->
      <div class="px-4">
        <button
          class="flex justify-between items-center w-full py-3 bg-transparent border-none cursor-pointer label text-ink-light"
          @click="reasoningOpen = !reasoningOpen"
        >
          {{ $t('reasoningTitle') }}
          <span
            class="text-sm transition-transform duration-200"
            :style="{ transform: reasoningOpen ? 'rotate(180deg)' : 'none' }"
          >▾</span>
        </button>
        <div v-if="reasoningOpen" class="pb-3.5">
          <div class="text-[12px] text-ink-light leading-relaxed">{{ $t('aiPending') }}</div>
        </div>
      </div>
    </div>

    <!-- Confirm / Correct -->
    <div class="flex gap-2.5 mt-3">
      <button class="btn btn-primary flex-1" @click="emit('confirm')">{{ $t('aiConfirm') }}</button>
      <button class="btn btn-ghost flex-1" @click="emit('correct')">{{ $t('aiCorrect') }}</button>
    </div>
  </section>
</template>
