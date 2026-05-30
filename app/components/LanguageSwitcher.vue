<script setup lang="ts">
import type { LocaleObject } from '@nuxtjs/i18n'

// Driven by config — any locale added to nuxt.config.ts (incl. a committed Custom
// Language Pack like sw.json) appears here automatically, no edits needed.
const { locale, locales, setLocale } = useI18n()
const list = computed(() => locales.value as LocaleObject[])
</script>

<template>
  <div class="flex gap-0.5">
    <button
      v-for="l in list"
      :key="l.code"
      type="button"
      class="label min-h-[32px] min-w-[28px] px-1.5 rounded-sm border-none cursor-pointer transition-colors duration-[120ms] focus-ring"
      :class="locale === l.code
        ? 'bg-ink text-parchment'
        : 'bg-transparent text-ink-light hover:text-ink hover:bg-parchment-mid'"
      :lang="l.code"
      :aria-label="`${$t('locale')} (${l.name ?? l.code})`"
      :aria-current="locale === l.code ? 'true' : undefined"
      @click="setLocale(l.code)"
    >{{ l.code.toUpperCase() }}</button>
  </div>
</template>
