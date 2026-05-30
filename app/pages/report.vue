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
    Outer: full-viewport, parchment background. Inner: capped at 1100px (up from 860)
    so desktop uses more of the page; the context sidebar fills the left while the
    form keeps its deliberate phone-width column (480px) for ergonomics. Capped so it
    never sprawls on ultrawide monitors. Sidebar hidden < md; form full-width below md.
  -->
  <div class="min-h-screen flex justify-center bg-parchment">
    <div class="w-full max-w-[1100px] min-h-screen flex flex-col md:flex-row">
      <ReportDesktopSidebar class="hidden md:flex md:flex-1" />
      <div class="flex flex-col min-h-screen md:min-h-0 md:w-[480px] lg:w-[520px] md:shrink-0 md:border-s border-parchment-deep">
        <ReportPage />
      </div>
    </div>
  </div>
</template>
