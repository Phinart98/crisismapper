<script setup lang="ts">
import { useGeolocation } from '~/composables/useGeolocation'
import type { GpsResult } from '~/composables/useGeolocation'

const emit = defineEmits<{ resolved: [GpsResult] }>()
const props = defineProps<{ hasError?: boolean }>()

const { state, result, inputText, inputError, requestGps, confirmInput } = useGeolocation()

watch(result, (v) => { if (v) emit('resolved', v) })

function onInputEnter() {
  confirmInput()
}

function onInputBlur() {
  if (inputText.value && state.value !== 'done') confirmInput()
}
</script>

<template>
  <section class="mb-10 sm:mb-12">
    <div class="mb-5">
      <div class="label mb-1.5">{{ $t('step3label') }}</div>
      <div class="font-serif text-xl sm:text-2xl font-semibold leading-tight">{{ $t('step3title') }}</div>
    </div>

    <!-- GPS button -->
    <button
      class="flex items-center gap-2.5 w-full min-h-[48px] p-3.5 mb-3 rounded border transition-colors duration-200 text-sm font-medium cursor-pointer focus-ring"
      :class="state === 'done'
        ? 'bg-sev-minimal/10 border-sev-minimal text-ink'
        : 'bg-parchment-mid border-parchment-deep text-ink hover:bg-parchment-deep/60'"
      :disabled="state === 'locating'"
      @click="requestGps"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="shrink-0">
        <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>
      </svg>
      <span class="text-start">
        {{ state === 'locating' ? $t('gpsLocating') : state === 'done' ? $t('gpsLocated') : $t('gpsBtn') }}
      </span>
      <span v-if="state === 'done'" class="ms-auto text-sev-minimal text-base shrink-0">✓</span>
      <span
        v-if="state === 'locating'"
        class="ms-auto w-4 h-4 border-2 border-sev-partial border-t-transparent rounded-full animate-spin shrink-0"
      />
    </button>

    <!-- GPS result display -->
    <div
      v-if="state === 'done' && result"
      class="label text-ink-light px-3 py-2 bg-parchment-mid rounded-sm mb-3 break-words"
    >
      <template v-if="result.method === 'gps'">
        {{ result.lat.toFixed(4) }}° N, {{ result.lng.toFixed(4) }}° E
      </template>
      <template v-else>
        {{ result.plusCode }} ({{ result.lat.toFixed(4) }}° N, {{ result.lng.toFixed(4) }}° E)
      </template>
    </div>

    <!-- Denied message -->
    <div v-if="state === 'denied'" class="text-sm text-ink-light mb-2">
      {{ $t('gpsDenied') }}
    </div>

    <div class="label text-ink-ghost text-center my-3">— or —</div>

    <!-- Plus Code input. text-base prevents iOS Safari zoom-on-focus. -->
    <input
      v-model="inputText"
      type="text"
      :placeholder="$t('gpsPlaceholder')"
      class="w-full min-h-[48px] px-3.5 py-3 bg-white border rounded text-base text-ink transition-colors"
      :class="(hasError || inputError) ? 'border-accent' : 'border-parchment-deep'"
      @keydown.enter="onInputEnter"
      @blur="onInputBlur"
    />
    <div v-if="inputError" class="text-sm text-accent mt-2">{{ $t('gpsInvalid') }}</div>
  </section>
</template>
