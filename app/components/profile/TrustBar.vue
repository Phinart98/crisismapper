<script setup lang="ts">
import { TRUST_COLORS, type TrustTier } from '~/utils/severity'

const props = defineProps<{ tier: TrustTier }>()
const { trust } = useLabels()

const TIERS: TrustTier[] = ['unverified', 'contributing', 'trusted']
const idx = computed(() => TIERS.indexOf(props.tier))
</script>

<template>
  <div class="inline-flex items-center gap-1.5">
    <div
      v-for="(t, i) in TIERS"
      :key="t"
      class="h-1.5 rounded-full transition-all duration-300"
      :class="i === idx ? 'w-8' : 'w-5'"
      :style="{ background: i <= idx ? TRUST_COLORS[t] : 'var(--c-parchment-deep)' }"
    />
    <span class="label ms-1" :style="{ color: TRUST_COLORS[tier] }">{{ trust(tier) }}</span>
  </div>
</template>
