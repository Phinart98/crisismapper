<script setup lang="ts">
import ProfileReporterAvatar from '~/components/profile/ReporterAvatar.vue'
import { TRUST_COLORS } from '~/utils/severity'

const { t } = useI18n()
const { trust } = useLabels()
const config = useRuntimeConfig()
const crisisId = config.public.demoCrisisId as string

const { rows, scope, loading, error, load } = useLeaderboard(crisisId)

useHead({ title: () => `${t('leaderboardTitle')} — CrisisMapper` })
onMounted(load)

const MEDALS = ['🥇', '🥈', '🥉']
const MEDAL_COLORS = ['#C9A227', '#A8A8A8', '#B87333']

const podium = computed(() => (rows.value.length >= 3 ? rows.value.slice(0, 3) : []))
const headerCrisis = computed(() => rows.value.find(r => r.area)?.area ?? t('leaderboardTitle'))
const shortNick = (nick: string) => nick.replace('anon_', '')
const areaLabel = (r: { area: string | null; multi_crisis: boolean }) =>
  r.multi_crisis ? t('leaderboardMultipleCrises') : (r.area ?? '')
</script>

<template>
  <main class="bg-parchment min-h-screen max-w-[480px] mx-auto pb-10">
    <!-- TOP NAV -->
    <div class="flex items-center gap-3 px-4 h-[52px] border-b border-parchment-deep bg-parchment sticky top-0 z-50">
      <NuxtLink to="/me" class="font-mono text-xs text-ink-light tracking-[0.06em] no-underline min-h-[44px] flex items-center">
        <span class="rtl-flip">←</span>&nbsp;{{ $t('leaderboardProfile') }}
      </NuxtLink>
      <div class="flex-1 text-center font-serif font-semibold text-[15px]">{{ $t('leaderboardTitle') }}</div>
      <NuxtLink to="/" class="font-mono text-xs text-ink-light tracking-[0.06em] no-underline min-h-[44px] flex items-center">
        {{ $t('leaderboardHome') }}
      </NuxtLink>
    </div>

    <!-- HEADER -->
    <div class="px-5 pt-6">
      <div class="flex gap-2 items-center mb-3.5">
        <div class="relative" style="--size: 16px"><div class="crosshair" /><div class="crosshair-ring" /></div>
        <span class="label">{{ headerCrisis }}</span>
      </div>
      <h1 class="font-serif text-[26px] font-bold leading-tight mb-2.5">{{ $t('leaderboardHeading') }}</h1>

      <!-- Privacy notice -->
      <div class="flex gap-2 items-start bg-parchment-mid rounded-sm px-3 py-2.5 mb-5 border border-parchment-deep">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="shrink-0 mt-0.5">
          <circle cx="7" cy="7" r="6" stroke="var(--c-ink-ghost)" stroke-width="1.2" />
          <line x1="7" y1="6" x2="7" y2="10" stroke="var(--c-ink-ghost)" stroke-width="1.2" stroke-linecap="round" />
          <circle cx="7" cy="4.5" r="0.6" fill="var(--c-ink-ghost)" />
        </svg>
        <div class="text-xs text-ink-light leading-relaxed">
          <strong class="text-ink">{{ $t('leaderboardPrivacyStrong') }}</strong> {{ $t('leaderboardPrivacyBody') }}
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex gap-0.5 bg-parchment-mid p-[3px] rounded-sm border border-parchment-deep">
        <button
          v-for="tab in (['crisis', 'all'] as const)"
          :key="tab"
          type="button"
          class="focus-ring flex-1 py-2 min-h-[36px] border-none rounded-[3px] font-mono text-[10px] tracking-[0.08em] uppercase cursor-pointer transition-all duration-150"
          :class="scope === tab ? 'bg-white text-ink shadow-sm' : 'bg-transparent text-ink-light'"
          @click="scope = tab"
        >{{ tab === 'crisis' ? $t('leaderboardTabCrisis') : $t('leaderboardTabAll') }}</button>
      </div>
    </div>

    <!-- LOADING / ERROR / EMPTY -->
    <div v-if="loading" class="p-10 text-center font-mono text-[11px] text-ink-light">{{ $t('modalLoading') }}</div>
    <div v-else-if="error" class="p-10 text-center font-mono text-[11px] text-accent">{{ $t('modalError') }}</div>
    <div v-else-if="!rows.length" class="p-10 text-center font-mono text-[11px] text-ink-light">{{ $t('leaderboardEmpty') }}</div>

    <template v-else>
      <!-- PODIUM (top 3) -->
      <div v-if="podium.length === 3" class="px-5 pt-5">
        <div class="grid grid-cols-[1fr_1.1fr_1fr] gap-2 items-end mb-1">
          <!-- 2nd -->
          <div class="flex flex-col items-center gap-2 pt-4">
            <ProfileReporterAvatar :seed="podium[1]!.nickname" :size="44" />
            <div class="font-mono text-[9px] tracking-[0.06em] text-ink-light text-center leading-tight">{{ shortNick(podium[1]!.nickname) }}</div>
            <div class="font-serif text-base font-bold">{{ podium[1]!.reports }}</div>
            <div class="w-full rounded-t-sm h-10 flex items-center justify-center text-lg" :style="{ background: 'color-mix(in srgb, #A8A8A8 20%, var(--c-parchment))', border: '2px solid #A8A8A8', borderBottom: 'none' }">🥈</div>
          </div>
          <!-- 1st -->
          <div class="flex flex-col items-center gap-2">
            <span class="w-2 h-2 rounded-full" style="background:#C9A227" />
            <ProfileReporterAvatar :seed="podium[0]!.nickname" :size="52" />
            <div class="font-mono text-[9px] tracking-[0.06em] text-ink-light text-center leading-tight">{{ shortNick(podium[0]!.nickname) }}</div>
            <div class="font-serif text-lg font-bold">{{ podium[0]!.reports }}</div>
            <div class="w-full rounded-t-sm h-14 flex items-center justify-center text-xl" :style="{ background: 'color-mix(in srgb, #C9A227 20%, var(--c-parchment))', border: '2px solid #C9A227', borderBottom: 'none' }">🥇</div>
          </div>
          <!-- 3rd -->
          <div class="flex flex-col items-center gap-2 pt-6">
            <ProfileReporterAvatar :seed="podium[2]!.nickname" :size="40" />
            <div class="font-mono text-[9px] tracking-[0.06em] text-ink-light text-center leading-tight">{{ shortNick(podium[2]!.nickname) }}</div>
            <div class="font-serif text-[15px] font-bold">{{ podium[2]!.reports }}</div>
            <div class="w-full rounded-t-sm h-[30px] flex items-center justify-center text-base" :style="{ background: 'color-mix(in srgb, #B87333 20%, var(--c-parchment))', border: '2px solid #B87333', borderBottom: 'none' }">🥉</div>
          </div>
        </div>
        <div class="h-0.5 bg-parchment-deep rounded-full mb-4" />
      </div>

      <!-- FULL LIST -->
      <div class="px-5">
        <!-- header row -->
        <div class="grid grid-cols-[28px_1fr_40px_52px] gap-x-3 label pb-2">
          <span>#</span><span>{{ $t('leaderboardColReporter') }}</span>
          <span class="text-center">{{ $t('leaderboardColBadges') }}</span>
          <span class="text-end">{{ $t('leaderboardColReports') }}</span>
        </div>

        <div
          v-for="entry in rows"
          :key="entry.rank"
          class="grid grid-cols-[28px_auto_1fr_40px_52px] gap-x-2.5 items-center py-2.5 border-b border-parchment-deep"
          :class="entry.isMe ? 'rounded-[3px] px-2 -mx-2' : ''"
          :style="entry.isMe ? { background: 'color-mix(in srgb, var(--c-accent) 6%, var(--c-parchment))' } : {}"
        >
          <!-- rank -->
          <div
            class="w-7 h-7 rounded-full shrink-0 flex items-center justify-center font-mono text-[11px] font-medium"
            :style="entry.rank <= 3
              ? { background: `color-mix(in srgb, ${MEDAL_COLORS[entry.rank - 1]} 20%, white)`, border: `2px solid ${MEDAL_COLORS[entry.rank - 1]}`, color: MEDAL_COLORS[entry.rank - 1] }
              : { background: 'var(--c-parchment-mid)', border: '1.5px solid var(--c-parchment-deep)', color: 'var(--c-ink-light)' }"
          >{{ entry.rank <= 3 ? MEDALS[entry.rank - 1] : entry.rank }}</div>
          <!-- avatar -->
          <ProfileReporterAvatar :seed="entry.nickname" :size="32" />
          <!-- info -->
          <div class="min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-mono text-[11px] text-ink font-medium">{{ shortNick(entry.nickname) }}</span>
              <span v-if="entry.isMe" class="font-mono text-[8px] tracking-[0.08em] text-accent border border-accent px-1.5 py-px rounded-[2px]">{{ $t('leaderboardYou') }}</span>
            </div>
            <div class="flex items-center gap-1.5 mt-0.5">
              <span class="w-1.5 h-1.5 rounded-full shrink-0" :style="{ background: TRUST_COLORS[entry.trust_tier] }" />
              <span class="font-mono text-[9px] text-ink-ghost tracking-[0.06em] truncate">{{ trust(entry.trust_tier) }}<template v-if="areaLabel(entry)"> · {{ areaLabel(entry) }}</template></span>
            </div>
          </div>
          <!-- badges -->
          <div class="text-center font-serif text-sm font-semibold text-ink-mid">{{ entry.badges > 0 ? entry.badges : '—' }}</div>
          <!-- reports -->
          <div class="text-end font-serif text-base font-bold text-ink">{{ entry.reports }}</div>
        </div>

        <!-- footer note -->
        <div class="mt-6 pt-3 border-t border-parchment-deep">
          <p class="text-[11px] text-ink-ghost leading-relaxed text-center">{{ $t('leaderboardFooter') }}</p>
        </div>
      </div>
    </template>
  </main>
</template>
