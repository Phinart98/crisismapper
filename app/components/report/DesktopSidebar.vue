<template>
  <!--
    Follows the dashboard.html sidebar pattern: sections self-pad at 20px,
    each separated by a border-b rule, aside has no outer padding.
    Sticky + h-screen keeps this fixed while the form scrolls.
  -->
  <aside class="flex-col h-screen sticky top-0 border-e border-parchment-deep overflow-y-auto">

    <!-- Branding -->
    <div class="flex items-center gap-2.5 px-5 lg:px-6 py-4 border-b border-parchment-deep shrink-0">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" class="shrink-0">
        <circle cx="10" cy="10" r="9" stroke="var(--color-accent)" stroke-width="2"/>
        <line x1="0" y1="10" x2="20" y2="10" stroke="var(--color-accent)" stroke-width="1.5"/>
        <line x1="10" y1="0" x2="10" y2="20" stroke="var(--color-accent)" stroke-width="1.5"/>
      </svg>
      <div class="min-w-0">
        <div class="font-serif font-semibold text-[15px] lg:text-base tracking-[-0.01em] text-ink leading-none">CrisisMapper</div>
        <div class="label text-ink-ghost mt-1">UNDP Crisis Mapping</div>
      </div>
    </div>

    <!-- Active crisis -->
    <div class="px-5 lg:px-6 py-4 border-b border-parchment-deep shrink-0">
      <div class="label text-ink-ghost mb-2.5">Active Crisis</div>
      <div class="font-serif font-semibold text-base lg:text-lg leading-snug text-ink mb-1.5">
        Myanmar Earthquake 2026
      </div>
      <div class="flex items-center gap-1.5">
        <span class="w-1.5 h-1.5 rounded-full bg-accent shrink-0 animate-pulse" />
        <span class="text-xs text-ink-mid leading-none">Live · Mandalay Region</span>
      </div>
    </div>

    <!-- Photo tips -->
    <div class="px-5 lg:px-6 py-4 border-b border-parchment-deep shrink-0">
      <div class="label text-ink-ghost mb-3">Photo tips</div>
      <div class="flex flex-col gap-2.5">
        <div
          v-for="(key, i) in ['tip1', 'tip2', 'tip3']"
          :key="key"
          class="flex items-start gap-2.5"
        >
          <span class="label text-ink-ghost shrink-0 mt-0.5 w-4">{{ String(i + 1).padStart(2, '0') }}</span>
          <span class="text-xs lg:text-[13px] text-ink-mid leading-relaxed">{{ $t(key) }}</span>
        </div>
      </div>
    </div>

    <!-- Severity guide -->
    <div class="px-5 lg:px-6 py-4 border-b border-parchment-deep shrink-0">
      <div class="label text-ink-ghost mb-3">Damage severity</div>
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-2.5">
          <span class="sev-chip minimal shrink-0">{{ $t('sevMinimal') }}</span>
          <span class="text-xs text-ink-ghost leading-snug">Structural integrity intact</span>
        </div>
        <div class="flex items-center gap-2.5">
          <span class="sev-chip partial shrink-0">{{ $t('sevPartial') }}</span>
          <span class="text-xs text-ink-ghost leading-snug">Significant damage</span>
        </div>
        <div class="flex items-center gap-2.5">
          <span class="sev-chip complete shrink-0">{{ $t('sevComplete') }}</span>
          <span class="text-xs text-ink-ghost leading-snug">Total loss / collapsed</span>
        </div>
      </div>
    </div>

    <!-- Decorative spacer with topo watermark -->
    <div class="flex-1 relative overflow-hidden min-h-[60px]">
      <svg
        class="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none"
        viewBox="0 0 300 200"
        preserveAspectRatio="xMidYMid slice"
      >
        <!-- Topographic contour lines -->
        <path d="M20,80 Q80,40 160,70 Q240,100 290,60" fill="none" stroke="var(--color-ink)" stroke-width="1.2"/>
        <path d="M10,110 Q70,65 160,95 Q250,125 295,85" fill="none" stroke="var(--color-ink)" stroke-width="1"/>
        <path d="M0,140 Q60,90 160,120 Q260,150 300,110" fill="none" stroke="var(--color-ink)" stroke-width="0.8"/>
        <path d="M0,165 Q55,115 160,145 Q265,175 300,135" fill="none" stroke="var(--color-ink)" stroke-width="0.6"/>
        <!-- Vertical contours -->
        <path d="M100,0 Q110,100 95,200" fill="none" stroke="var(--color-ink)" stroke-width="0.8"/>
        <path d="M190,0 Q200,100 185,200" fill="none" stroke="var(--color-ink)" stroke-width="0.6"/>
        <!-- Registration crosshair -->
        <line x1="145" y1="0" x2="145" y2="200" stroke="var(--color-ink)" stroke-width="0.5"/>
        <line x1="0" y1="100" x2="300" y2="100" stroke="var(--color-ink)" stroke-width="0.5"/>
        <circle cx="145" cy="100" r="20" fill="none" stroke="var(--color-ink)" stroke-width="0.8"/>
        <circle cx="145" cy="100" r="5" fill="none" stroke="var(--color-ink)" stroke-width="0.8"/>
      </svg>
    </div>

    <!-- Footer -->
    <div class="px-5 lg:px-6 py-4 border-t border-parchment-deep shrink-0">
      <div class="label text-ink-ghost leading-[1.9]">
        Phase 2 · Reporter Form<br>
        Open source · Built for resilience
      </div>
    </div>

  </aside>
</template>
