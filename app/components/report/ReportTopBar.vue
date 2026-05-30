<script setup lang="ts">
const { locale, setLocale } = useI18n()
const { pendingCount, flush, isFlushing } = useOfflineQueue()

const LOCALES = ['en', 'es', 'fr', 'ar', 'ru', 'zh'] as const
</script>

<template>
  <div
    class="flex items-center justify-between gap-2 px-5 sm:px-6 md:px-5 h-[52px] border-b border-parchment-deep bg-parchment sticky top-0 z-50 shrink-0"
  >
    <!-- Logo -->
    <NuxtLink
      to="/"
      class="flex items-center gap-2 no-underline text-ink font-serif font-semibold text-sm focus-ring rounded-sm min-w-0"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" class="shrink-0">
        <circle cx="10" cy="10" r="9" stroke="var(--color-accent)" stroke-width="2" fill="none"/>
        <line x1="0" y1="10" x2="20" y2="10" stroke="var(--color-accent)" stroke-width="1.5"/>
        <line x1="10" y1="0" x2="10" y2="20" stroke="var(--color-accent)" stroke-width="1.5"/>
      </svg>
      <span class="truncate hidden sm:inline">{{ $t('title') }}</span>
    </NuxtLink>

    <div class="flex items-center gap-1.5 shrink-0">
      <!-- Locale switcher — chips kept tight (32×28px hit zone) so the bar fits at 480px column -->
      <div class="flex gap-0.5">
        <button
          v-for="code in LOCALES"
          :key="code"
          class="label min-h-[32px] min-w-[28px] px-1.5 rounded-sm border-none cursor-pointer transition-colors duration-[120ms] focus-ring"
          :class="locale === code
            ? 'bg-ink text-parchment'
            : 'bg-transparent text-ink-light hover:text-ink hover:bg-parchment-mid'"
          :aria-label="`${$t('locale')} (${code.toUpperCase()})`"
          @click="setLocale(code)"
        >{{ code.toUpperCase() }}</button>
      </div>

      <!-- Pending sync badge — clicking flushes immediately when count > 0 -->
      <button
        class="flex items-center gap-1.5 label min-h-[32px] px-2 rounded-sm border cursor-pointer focus-ring transition-colors disabled:opacity-50"
        :class="pendingCount > 0
          ? 'border-sev-partial text-sev-partial bg-sev-partial/10'
          : 'border-parchment-deep text-ink-ghost bg-transparent hover:bg-parchment-mid'"
        :aria-label="$t('pending') + ' (' + pendingCount + ')'"
        :disabled="pendingCount === 0 || isFlushing"
        @click="flush()"
      >
        <span v-if="pendingCount > 0" class="w-1.5 h-1.5 rounded-full bg-sev-partial shrink-0" />
        <span>({{ pendingCount }})</span>
      </button>
    </div>
  </div>
</template>
