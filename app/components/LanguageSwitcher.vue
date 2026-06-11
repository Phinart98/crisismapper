<script setup lang="ts">
import type { LocaleObject } from '@nuxtjs/i18n'

// Driven by config — any locale added to nuxt.config.ts (incl. a committed Custom
// Language Pack like sw.json) appears here automatically, no edits needed.
const { locale, locales, setLocale } = useI18n()
const list = computed(() => locales.value as LocaleObject[])
const current = computed(() => list.value.find(l => l.code === locale.value)?.name ?? locale.value)

function onChange(e: Event) {
  setLocale((e.target as HTMLSelectElement).value as typeof locale.value)
}
</script>

<template>
  <div class="relative inline-flex">
    <!-- The real control: transparent but full-bleed, so activating it opens the
         OS-native picker. text-base prevents iOS zoom-on-focus; keyboard focus is
         surfaced on the trigger via the .lang-select rule in main.css. -->
    <select
      class="lang-select peer absolute inset-0 w-full h-full opacity-0 cursor-pointer text-base"
      :value="locale"
      :aria-label="$t('locale')"
      @change="onChange"
    >
      <option v-for="l in list" :key="l.code" :value="l.code" :lang="l.code">{{ l.name }}</option>
    </select>
    <span
      aria-hidden="true"
      class="lang-trigger label flex items-center gap-1.5 min-h-[36px] ps-2.5 pe-2 rounded-sm
             border border-parchment-deep text-ink pointer-events-none
             peer-hover:bg-parchment-mid transition-colors duration-[120ms]"
    >
      {{ current }}
      <svg width="8" height="5" viewBox="0 0 8 5" fill="none" class="shrink-0">
        <path d="M1 1l3 3 3-3" stroke="currentColor" stroke-width="1.2" />
      </svg>
    </span>
  </div>
</template>
