<script setup lang="ts">
import { useLabels } from '~/composables/useLabels'
import type { DbSeverity } from '~/utils/severity'

const { t, locale } = useI18n()
const { infra, dbSev } = useLabels()
const { relativeTime } = useFormatters()
const config = useRuntimeConfig()
const crisisId = config.public.demoCrisisId as string

useHead({
  title: 'CrisisMapper — UNDP Crisis Damage Reporting',
  meta: [{ name: 'description', content: t('landingTagline') }],
})

// Decorative map markers (static positions — no MapLibre on the landing; the first page
// low-bandwidth civilians hit must stay tiny). Severity classes drive the pin colour.
const MARKERS = [
  { x: 38, y: 22, sev: 'complete' }, { x: 52, y: 35, sev: 'partial' }, { x: 44, y: 48, sev: 'complete' },
  { x: 62, y: 28, sev: 'minimal' }, { x: 72, y: 44, sev: 'partial' }, { x: 58, y: 55, sev: 'complete' },
  { x: 35, y: 60, sev: 'minimal' }, { x: 68, y: 62, sev: 'partial' }, { x: 48, y: 68, sev: 'minimal' },
  { x: 78, y: 30, sev: 'minimal' }, { x: 30, y: 40, sev: 'partial' }, { x: 55, y: 72, sev: 'complete' },
  { x: 42, y: 32, sev: 'partial' }, { x: 66, y: 18, sev: 'minimal' }, { x: 25, y: 55, sev: 'complete' },
]

// Live overlay count + ticker — hydrated client-side from the (anon-aggregated) endpoints,
// with graceful fallbacks so SSR/offline still render something real.
const total = ref<number | null>(null)
// Raw features kept reactive so the ticker strings recompute when the locale changes
// (the labels go through infra()/dbSev()/relativeTime(), all locale-reactive).
type TickerFeature = { severity: DbSeverity; infrastructure_type: string | null; submitted_at: string }
const tickerFeatures = ref<TickerFeature[]>([])
const tickerIdx = ref(0)
const fmtNum = (n: number) => n.toLocaleString(locale.value)

const tickerItems = computed(() => tickerFeatures.value.map(
  p => `${t('landingTickerNew')} — ${infra(p.infrastructure_type)} · ${dbSev(p.severity)} · ${relativeTime(p.submitted_at)}`,
))

let rotate: ReturnType<typeof setInterval> | null = null
onMounted(async () => {
  if (!crisisId) return
  try {
    const [stats, fc] = await Promise.all([
      $fetch<{ total: number }>('/api/map/stats', { query: { crisis_id: crisisId } }),
      // Only the latest few for the ticker — the landing must stay tiny (no full fetch).
      $fetch<{ features: { properties: TickerFeature }[] }>(
        '/api/map/reports', { query: { crisis_id: crisisId, limit: 6 } },
      ),
    ])
    total.value = stats.total
    tickerFeatures.value = fc.features.slice(0, 6).map(f => f.properties)
  } catch { /* keep fallbacks */ }

  rotate = setInterval(() => {
    if (tickerItems.value.length) tickerIdx.value = (tickerIdx.value + 1) % tickerItems.value.length
  }, 4000)
})
onUnmounted(() => { if (rotate) clearInterval(rotate) })

const tickerText = computed(() => tickerItems.value[tickerIdx.value] ?? t('landingTickerFallback'))
</script>

<template>
  <main class="min-h-screen flex flex-col overflow-x-hidden bg-parchment">
    <!-- NAV -->
    <nav class="flex items-center justify-between px-5 sm:px-8 py-4 sm:py-5 border-b border-parchment-deep sticky top-0 bg-parchment z-[100]">
      <NuxtLink to="/" class="flex items-center gap-2.5 font-serif text-lg font-semibold tracking-tight text-ink no-underline">
        <span class="relative w-7 h-7 shrink-0 flex items-center justify-center" style="--size: 28px">
          <span class="crosshair !opacity-100" style="--size: 28px" />
          <span class="crosshair-ring !opacity-100 !border-accent" style="--size: 28px" />
        </span>
        <span class="hidden sm:inline">CrisisMapper</span>
      </NuxtLink>
      <div class="flex items-center gap-3 sm:gap-6">
        <NuxtLink to="/dashboard" class="flex items-center min-h-[44px] text-[13px] text-ink-light no-underline hover:text-ink transition-colors">{{ $t('landingNavDashboard') }}</NuxtLink>
        <NuxtLink to="/leaderboard" class="flex items-center min-h-[44px] text-[13px] text-ink-light no-underline hover:text-ink transition-colors">{{ $t('leaderboardTitle') }}</NuxtLink>
        <LanguageSwitcher />
      </div>
    </nav>

    <!-- HERO -->
    <section class="flex-1 grid grid-cols-1 lg:grid-cols-2">
      <div class="flex flex-col justify-center px-5 sm:px-8 lg:px-12 py-10 sm:py-16 max-w-2xl">
        <div class="flex items-center gap-3 mb-6">
          <div class="w-8 h-px bg-accent" />
          <span class="label">{{ $t('landingEyebrow') }}</span>
        </div>

        <h1 class="font-serif font-bold leading-[1.08] tracking-tight text-ink text-4xl sm:text-5xl lg:text-6xl mb-5">
          {{ $t('landingHeroPre') }}<em class="italic text-accent">{{ $t('landingHeroEm') }}</em>{{ $t('landingHeroPost') }}
        </h1>

        <p class="text-base sm:text-lg leading-relaxed text-ink-mid mb-7 max-w-md">{{ $t('landingHeroSub') }}</p>

        <div class="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center mb-7">
          <NuxtLink to="/report" class="btn btn-primary min-h-[48px] text-base">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5" /><circle cx="8" cy="8" r="3" fill="currentColor" /></svg>
            {{ $t('landingOpenReporter') }}
          </NuxtLink>
          <NuxtLink to="/login" class="btn btn-ghost min-h-[48px] text-base">
            {{ $t('landingStaffCta') }}&nbsp;<span class="rtl-flip">→</span>
          </NuxtLink>
        </div>

        <p class="font-mono text-[11px] text-ink-ghost tracking-[0.08em] flex items-center gap-1.5 flex-wrap">
          <span>{{ $t('landingMeta') }}</span>
          <span class="inline-flex items-center gap-1.5"><span class="text-accent">●</span> {{ $t('landingMetaLive') }}</span>
        </p>
      </div>

      <!-- DECORATIVE MAP PANEL -->
      <div class="hero-map relative overflow-hidden min-h-[300px] lg:min-h-0">
        <div class="hero-map-grid" />
        <div class="absolute inset-0 flex items-center justify-center">
          <svg class="w-full h-full opacity-[0.08]" viewBox="0 0 600 700" preserveAspectRatio="xMidYMid slice">
            <path d="M50,350 Q150,200 300,250 Q450,300 550,150" fill="none" stroke="#1A1A1A" stroke-width="1.2" />
            <path d="M30,380 Q130,230 280,280 Q430,330 570,180" fill="none" stroke="#1A1A1A" stroke-width="1.2" />
            <path d="M70,320 Q170,170 320,220 Q470,270 580,120" fill="none" stroke="#1A1A1A" stroke-width="1.2" />
            <path d="M20,420 Q120,280 270,320 Q420,360 560,220" fill="none" stroke="#1A1A1A" stroke-width="1.2" />
            <path d="M100,400 Q200,280 350,310 Q480,340 580,250" fill="none" stroke="#1A1A1A" stroke-width="1" />
            <path d="M150,450 Q250,350 380,370 Q490,390 580,320" fill="none" stroke="#1A1A1A" stroke-width="1" />
            <path d="M80,480 Q200,400 330,420 Q450,440 560,390" fill="none" stroke="#1A1A1A" stroke-width="0.8" />
            <path d="M60,520 Q180,450 310,460 Q440,470 560,430" fill="none" stroke="#1A1A1A" stroke-width="0.8" />
            <path d="M200,200 Q300,300 250,450 Q200,550 300,600" fill="none" stroke="#1A1A1A" stroke-width="0.8" />
            <path d="M350,100 Q400,250 370,400 Q340,500 420,580" fill="none" stroke="#1A1A1A" stroke-width="0.8" />
          </svg>
        </div>

        <span class="reg-mark tl" /><span class="reg-mark tr" /><span class="reg-mark bl" /><span class="reg-mark br" />

        <div class="absolute inset-0">
          <div
            v-for="(m, i) in MARKERS"
            :key="i"
            class="map-marker"
            :class="m.sev"
            :style="{ left: `${m.x}%`, top: `${m.y}%`, animationDelay: `${i * 0.06}s` }"
          >
            <span class="map-marker-pin" /><span class="map-marker-stem" />
          </div>
        </div>

        <!-- Overlay stat (live count) -->
        <div class="absolute top-6 start-6 bg-[color-mix(in_srgb,var(--c-parchment)_90%,transparent)] border border-parchment-deep px-3.5 py-2.5 rounded-sm backdrop-blur-sm">
          <div class="label mb-1">{{ $t('landingMapTitle') }}</div>
          <div class="font-serif text-[22px] font-bold text-ink leading-none">{{ total != null ? fmtNum(total) : '—' }}</div>
          <div class="text-[11px] text-ink-light mt-0.5">{{ $t('landingMapSub') }}</div>
        </div>

        <!-- Live ticker -->
        <div class="absolute bottom-6 start-6 end-6 bg-[color-mix(in_srgb,var(--c-ink)_92%,var(--c-parchment))] text-parchment px-3.5 py-2.5 rounded-sm flex items-center gap-2 overflow-hidden">
          <span class="ticker-dot" />
          <span class="font-mono text-[11px] tracking-[0.06em] text-parchment-mid whitespace-nowrap overflow-hidden text-ellipsis transition-opacity">{{ tickerText }}</span>
        </div>
      </div>
    </section>

    <!-- FEATURE STRIP -->
    <section class="border-t border-parchment-deep grid grid-cols-2 lg:grid-cols-4">
      <div class="p-6 sm:p-8 border-e border-parchment-deep">
        <div class="font-serif text-3xl sm:text-4xl font-bold text-ink leading-none mb-2">{{ total != null ? fmtNum(total) : '—' }}<span class="text-accent">+</span></div>
        <div class="text-[13px] text-ink-light leading-snug">{{ $t('landingFeat1') }}</div>
      </div>
      <div class="p-6 sm:p-8 lg:border-e border-parchment-deep">
        <div class="font-serif text-3xl sm:text-4xl font-bold text-ink leading-none mb-2">94<span class="text-accent">%</span></div>
        <div class="text-[13px] text-ink-light leading-snug">{{ $t('landingFeat2') }}</div>
      </div>
      <div class="p-6 sm:p-8 border-e border-parchment-deep border-t lg:border-t-0">
        <div class="font-serif text-3xl sm:text-4xl font-bold text-ink leading-none mb-2">&lt;100<span class="text-accent">KB</span></div>
        <div class="text-[13px] text-ink-light leading-snug">{{ $t('landingFeat3') }}</div>
      </div>
      <div class="p-6 sm:p-8 border-t lg:border-t-0">
        <div class="font-serif text-3xl sm:text-4xl font-bold text-ink leading-none mb-2">7</div>
        <div class="text-[13px] text-ink-light leading-snug">{{ $t('landingFeat4') }}</div>
      </div>
    </section>

    <!-- FOOTER -->
    <footer class="border-t border-parchment-deep px-5 sm:px-12 py-5 sm:py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
      <div class="flex items-center gap-4">
        <span class="font-sans text-[11px] font-semibold tracking-[0.12em] uppercase text-[#006EB6] border-[1.5px] border-[#006EB6] px-2 py-1 rounded-[2px]">UNDP</span>
        <span class="text-xs text-ink-ghost">{{ $t('landingMeta') }}</span>
      </div>
      <div class="flex gap-5">
        <NuxtLink to="/leaderboard" class="text-xs text-ink-light no-underline hover:text-ink transition-colors">{{ $t('leaderboardTitle') }}</NuxtLink>
        <NuxtLink to="/terms" class="text-xs text-ink-light no-underline hover:text-ink transition-colors">{{ $t('landingFooterTerms') }}</NuxtLink>
        <NuxtLink to="/privacy" class="text-xs text-ink-light no-underline hover:text-ink transition-colors">{{ $t('landingFooterPrivacy') }}</NuxtLink>
      </div>
    </footer>
  </main>
</template>

<style scoped>
.hero-map { background: color-mix(in srgb, var(--c-parchment-mid) 60%, #C8BCA8); }
.hero-map-grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(var(--c-parchment-deep) 1px, transparent 1px),
    linear-gradient(90deg, var(--c-parchment-deep) 1px, transparent 1px);
  background-size: 48px 48px;
  opacity: 0.6;
}
.reg-mark { position: absolute; width: 20px; height: 20px; opacity: 0.25; }
.reg-mark::before, .reg-mark::after { content: ''; position: absolute; background: var(--c-ink); }
.reg-mark::before { top: 50%; left: 0; right: 0; height: 1px; }
.reg-mark::after { left: 50%; top: 0; bottom: 0; width: 1px; }
.reg-mark.tl { top: 20px; left: 20px; }
.reg-mark.tr { top: 20px; right: 20px; }
.reg-mark.bl { bottom: 20px; left: 20px; }
.reg-mark.br { bottom: 20px; right: 20px; }

.map-marker {
  position: absolute;
  display: flex; flex-direction: column; align-items: center;
  transform: translate(-50%, -100%);
  animation: markerIn 0.4s ease both;
}
@keyframes markerIn {
  from { opacity: 0; transform: translate(-50%, -80%); }
  to   { opacity: 1; transform: translate(-50%, -100%); }
}
.map-marker-pin { width: 12px; height: 12px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.6); box-shadow: 0 2px 8px rgba(0,0,0,0.25); }
.map-marker-stem { width: 1.5px; height: 8px; background: rgba(0,0,0,0.3); }
.map-marker.minimal  .map-marker-pin { background: var(--c-sev-minimal); }
.map-marker.partial  .map-marker-pin { background: var(--c-sev-partial); }
.map-marker.complete .map-marker-pin { background: var(--c-sev-complete); }

.ticker-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--c-accent); flex-shrink: 0; animation: pulse 2s infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
</style>
