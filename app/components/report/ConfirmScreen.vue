<script setup lang="ts">
defineProps<{ photoError?: boolean }>()
const emit = defineEmits<{ again: [] }>()
</script>

<template>
  <div class="flex-1 flex flex-col items-center justify-center px-8 py-12 text-center min-h-screen">
    <!-- Checkmark -->
    <div
      class="w-[72px] h-[72px] rounded-full flex items-center justify-center mb-6 text-[28px]"
      style="background: color-mix(in srgb, var(--color-accent) 15%, var(--color-parchment)); border: 2px solid var(--color-accent)"
    >✓</div>

    <div class="label mb-2.5" style="color: var(--color-accent)">{{ $t('confirmLabel') }}</div>
    <div class="font-serif text-[28px] font-bold leading-tight mb-3">
      {{ $t('confirmTitle', { n: 47 }) }}
    </div>
    <div class="text-[14px] text-ink-light mb-7 leading-relaxed max-w-xs">
      {{ $t('confirmBody') }}
    </div>

    <!-- Photo error banner -->
    <div v-if="photoError" class="w-full max-w-xs mb-4 px-3 py-2 bg-sev-partial/10 border border-sev-partial rounded text-[13px] text-sev-partial text-start leading-snug">
      ⚠ {{ $t('retryPhoto') }} — report is saved, photo can be re-uploaded later.
    </div>

    <!-- Badge placeholder -->
    <div class="bg-parchment-mid border border-parchment-deep rounded-md px-6 py-4 mb-7 flex items-center gap-3.5 w-full max-w-xs">
      <span class="text-[28px]">🚨</span>
      <div class="text-start">
        <div class="label mb-0.5">{{ $t('confirmBadgeLabel') }}</div>
        <div class="font-serif text-base font-semibold">{{ $t('confirmBadgeName') }}</div>
        <div class="text-[12px] text-ink-light mt-0.5">{{ $t('confirmBadgeSub') }}</div>
      </div>
    </div>

    <div class="flex flex-col gap-2.5 w-full max-w-xs">
      <button class="btn btn-primary btn-full" @click="emit('again')">{{ $t('confirmAnother') }}</button>
    </div>
  </div>
</template>
