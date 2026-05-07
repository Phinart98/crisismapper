<script setup lang="ts">
const { locale, setLocale } = useI18n()

const LOCALES = ['en', 'es', 'fr', 'ar', 'ru', 'zh'] as const
const pendingCount = ref(0) // Phase 3 wires to Dexie queue count
</script>

<template>
  <div
    class="flex items-center justify-between px-4 h-[52px] border-b border-parchment-deep bg-parchment sticky top-0 z-50 shrink-0"
  >
    <!-- Logo -->
    <NuxtLink to="/" class="flex items-center gap-2 no-underline text-ink font-serif font-semibold text-[15px]">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" class="shrink-0">
        <circle cx="10" cy="10" r="9" stroke="var(--color-accent)" stroke-width="2" fill="none"/>
        <line x1="0" y1="10" x2="20" y2="10" stroke="var(--color-accent)" stroke-width="1.5"/>
        <line x1="10" y1="0" x2="10" y2="20" stroke="var(--color-accent)" stroke-width="1.5"/>
      </svg>
      {{ $t('title') }}
    </NuxtLink>

    <div class="flex items-center gap-2.5">
      <!-- Locale switcher -->
      <div class="flex gap-0.5">
        <button
          v-for="code in LOCALES"
          :key="code"
          class="label px-1.5 py-1 rounded-sm border-none cursor-pointer transition-all duration-[120ms]"
          :class="locale === code
            ? 'bg-ink text-parchment'
            : 'bg-transparent text-ink-light hover:text-ink'"
          @click="setLocale(code)"
        >{{ code.toUpperCase() }}</button>
      </div>

      <!-- Pending sync badge -->
      <button
        class="flex items-center gap-1.5 label px-2 py-1 rounded-sm border cursor-pointer"
        :class="pendingCount > 0
          ? 'border-sev-partial text-sev-partial bg-sev-partial/10'
          : 'border-parchment-deep text-ink-ghost bg-transparent'"
      >
        <span v-if="pendingCount > 0" class="w-1.5 h-1.5 rounded-full bg-sev-partial shrink-0" />
        {{ $t('pending') }} ({{ pendingCount }})
      </button>
    </div>
  </div>
</template>
