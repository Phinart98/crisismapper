<script setup lang="ts">
const { locale } = useI18n()

const localeDir: Record<string, string> = { ar: 'rtl' }

useHead({
  htmlAttrs: {
    dir: computed(() => (localeDir[locale.value] ?? 'ltr') as 'ltr' | 'rtl'),
    lang: computed(() => locale.value),
  },
})
</script>

<template>
  <!--
    Outer: full-viewport flex justify-center — reliably centers the inner block.
    Inner: max-width 860px, flex-col on mobile → flex-row on desktop.
    Sidebar hidden on mobile; form fills full width on mobile.
  -->
  <div class="min-h-screen flex justify-center" style="background: var(--color-parchment)">
    <div class="w-full min-h-screen flex flex-col md:flex-row" style="max-width: 860px">
      <ReportDesktopSidebar class="hidden md:flex md:flex-1" />
      <div class="flex flex-col min-h-screen md:min-h-0 md:w-[480px] md:shrink-0 md:border-s border-parchment-deep">
        <ReportPage />
      </div>
    </div>
  </div>
</template>
