<script setup lang="ts">
// Stub landing page so / has a real first impression while Phase 10
// builds the full mockup-faithful version (project/index.html). Visible copy
// is i18n'd (Phase 8); head meta stays English for stable SEO/social cards.
useHead({
  title: 'CrisisMapper — UNDP Crisis Damage Reporting',
  meta: [
    { name: 'description', content: 'Report damage from any phone, anywhere — even without internet. UNDP Crisis Mapping Challenge submission.' },
  ],
})
</script>

<template>
  <main class="min-h-screen flex flex-col bg-parchment">
    <!-- Locale switcher (no full header on the landing) -->
    <header class="flex justify-end px-5 sm:px-7 lg:px-8 pt-4">
      <LanguageSwitcher />
    </header>

    <!-- Hero -->
    <section class="flex-1 flex items-center justify-center px-5 sm:px-7 lg:px-8 py-12 sm:py-16">
      <div class="w-full max-w-xl text-center">
        <!-- Crosshair signature mark — --size cascades to both .crosshair and .crosshair-ring -->
        <div class="flex justify-center mb-8 sm:mb-10">
          <div class="relative" style="--size: 48px">
            <div class="crosshair" />
            <div class="crosshair-ring" />
          </div>
        </div>

        <span class="label">{{ $t('landingStatus') }}</span>
        <h1 class="font-serif font-bold text-4xl sm:text-5xl lg:text-6xl leading-[1.05] mt-3 mb-5 tracking-tight">
          CrisisMapper
        </h1>
        <p class="text-base sm:text-lg leading-relaxed text-ink-light max-w-md mx-auto">
          {{ $t('landingTagline') }}
        </p>

        <hr class="rule my-8 sm:my-10" />

        <!-- CTAs -->
        <div class="flex flex-col sm:flex-row justify-center items-stretch sm:items-center gap-3 mb-8">
          <NuxtLink to="/report" class="btn btn-primary min-h-[48px] text-base">
            {{ $t('landingOpenReporter') }}
          </NuxtLink>
          <NuxtLink to="/dashboard" class="btn btn-ghost min-h-[48px] text-base">
            {{ $t('landingOpenDashboard') }}
          </NuxtLink>
        </div>

        <!-- Severity legend -->
        <div class="flex justify-center gap-2 flex-wrap">
          <span class="sev-chip minimal">{{ $t('sevMinimal') }}</span>
          <span class="sev-chip partial">{{ $t('sevPartial') }}</span>
          <span class="sev-chip complete">{{ $t('sevComplete') }}</span>
        </div>
      </div>
    </section>

    <!-- Credibility footer — wider container than the hero so the meta line
         doesn't wrap awkwardly on desktop. -->
    <footer class="border-t border-parchment-deep px-5 sm:px-7 lg:px-8 py-5 sm:py-6">
      <div class="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-start">
        <div class="label text-ink-ghost">
          {{ $t('landingFooterOrg') }}
        </div>
        <div class="text-xs text-ink-ghost leading-relaxed">
          {{ $t('landingFooterMeta') }}
        </div>
      </div>
    </footer>
  </main>
</template>
