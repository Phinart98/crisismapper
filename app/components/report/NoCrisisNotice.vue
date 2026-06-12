<template>
  <section class="mb-10 sm:mb-12">
    <div class="border border-parchment-deep rounded bg-white p-5 sm:p-6 text-center">
      <div class="flex justify-center mb-4">
        <div class="relative" style="--size: 40px">
          <div class="crosshair" />
          <div class="crosshair-ring" />
        </div>
      </div>
      <h2 class="font-serif text-xl sm:text-2xl font-semibold leading-tight mb-2">
        {{ $t('noCrisisTitle') }}
      </h2>
      <p class="text-sm text-ink-light leading-relaxed max-w-sm mx-auto mb-5">
        {{ $t('noCrisisBody') }}
      </p>
      <div class="flex flex-col sm:flex-row gap-2.5 justify-center">
        <NuxtLink to="/dashboard" class="btn btn-primary min-h-[48px] text-sm">{{ $t('noCrisisDashboardCta') }}</NuxtLink>
        <NuxtLink to="/" class="btn btn-ghost min-h-[48px] text-sm">{{ $t('leaderboardHome') }}</NuxtLink>
      </div>
    </div>
  </section>
</template>
