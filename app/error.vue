<script setup lang="ts">
import type { NuxtError } from '#app'

// App-level fatal fallback (unhandled SSR/route errors). Component-level NuxtErrorBoundary
// handles recoverable in-page failures (map, profile, leaderboard); this catches the rest.
const props = defineProps<{ error: NuxtError }>()
const { t } = useI18n()

useHead({ title: () => `${t('errorTitle')} — CrisisMapper` })

const is404 = computed(() => props.error?.statusCode === 404)
</script>

<template>
  <main class="min-h-screen flex flex-col items-center justify-center bg-parchment px-6 text-center">
    <div class="flex justify-center mb-8">
      <div class="relative" style="--size: 56px"><div class="crosshair" /><div class="crosshair-ring" /></div>
    </div>
    <span class="label">{{ error?.statusCode ?? 500 }}</span>
    <h1 class="font-serif text-3xl sm:text-4xl font-bold mt-2 mb-3">
      {{ is404 ? $t('error404Title') : $t('errorTitle') }}
    </h1>
    <p class="text-sm text-ink-light leading-relaxed max-w-sm mb-8">
      {{ is404 ? $t('error404Body') : $t('errorBody') }}
    </p>
    <div class="flex flex-col sm:flex-row gap-3">
      <button type="button" class="btn btn-primary min-h-[48px] text-base" @click="clearError({ redirect: '/' })">
        {{ $t('errorHome') }}
      </button>
      <button v-if="!is404" type="button" class="btn btn-ghost min-h-[48px] text-base" @click="clearError({ redirect: '/' })">
        {{ $t('errorRetry') }}
      </button>
    </div>
  </main>
</template>
