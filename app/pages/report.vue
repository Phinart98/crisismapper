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
    Outer: full-viewport, parchment background. Inner: max-w-[860px] caps the layout
    so the sidebar + 480px form pair never sprawls on ultrawide monitors.
    Sidebar hidden on mobile (< md); form fills full width below md.
  -->
  <div class="min-h-screen flex justify-center bg-parchment">
    <div class="w-full max-w-[860px] min-h-screen flex flex-col md:flex-row">
      <ReportDesktopSidebar class="hidden md:flex md:flex-1" />
      <div class="flex flex-col min-h-screen md:min-h-0 md:w-[480px] md:shrink-0 md:border-s border-parchment-deep">
        <ReportPage />
      </div>
    </div>
  </div>
</template>
