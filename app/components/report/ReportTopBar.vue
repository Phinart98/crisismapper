<script setup lang="ts">
const { pendingCount, flush, isFlushing } = useOfflineQueue()
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
      <!-- Locale switcher — compact native-select dropdown, fits the 480px column -->
      <LanguageSwitcher />

      <!-- Pending sync badge — only rendered while reports wait offline; click flushes. -->
      <button
        v-if="pendingCount > 0"
        class="flex items-center gap-1.5 label min-h-[32px] px-2 rounded-sm border cursor-pointer focus-ring transition-colors disabled:opacity-50 border-sev-partial text-sev-partial bg-sev-partial/10"
        :aria-label="$t('pending') + ' (' + pendingCount + ')'"
        :disabled="isFlushing"
        @click="flush()"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-sev-partial shrink-0" />
        <span>({{ pendingCount }})</span>
      </button>
    </div>
  </div>
</template>
