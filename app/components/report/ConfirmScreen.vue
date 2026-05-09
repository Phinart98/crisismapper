<script setup lang="ts">
defineProps<{ photoError?: boolean; queued?: boolean }>()
const emit = defineEmits<{ again: [] }>()
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
      {{ queued ? $t('queuedTitle') : $t('confirmTitle', { n: 47 }) }}
    </div>
    <div class="text-sm text-ink-light mb-7 leading-relaxed max-w-xs">
      {{ queued ? $t('queuedBody') : $t('confirmBody') }}
    </div>

    <!-- Photo error banner -->
    <div v-if="photoError" class="w-full max-w-xs mb-4 px-3 py-2 bg-sev-partial/10 border border-sev-partial rounded text-sm text-sev-partial text-start leading-snug">
      ⚠ {{ $t('retryPhoto') }} — report is saved, photo can be re-uploaded later.
    </div>

    <!-- Badge placeholder — only shown for fully-submitted reports.
         Queued reports have not reached UNDP yet, so the reward would be premature. -->
    <div v-if="!queued" class="bg-parchment-mid border border-parchment-deep rounded-md px-5 sm:px-6 py-4 mb-7 flex items-center gap-3.5 w-full max-w-xs">
      <span class="text-2xl sm:text-[28px] shrink-0">🚨</span>
      <div class="text-start min-w-0">
        <div class="label mb-0.5">{{ $t('confirmBadgeLabel') }}</div>
        <div class="font-serif text-base font-semibold">{{ $t('confirmBadgeName') }}</div>
        <div class="text-xs text-ink-light mt-0.5">{{ $t('confirmBadgeSub') }}</div>
      </div>
    </div>

    <div class="flex flex-col gap-2.5 w-full max-w-xs">
      <button class="btn btn-primary btn-full min-h-[48px]" @click="emit('again')">{{ $t('confirmAnother') }}</button>
    </div>
  </div>
</template>
