<script setup lang="ts">
// Deterministic avatar generated from the nickname seed (mirrors me.html / leaderboard
// mockups). Same seed → same colour + initials, with no stored image and no identity.
const props = withDefaults(defineProps<{ seed: string; size?: number }>(), { size: 72 })

const hash = computed(() => {
  let h = 0
  for (const c of props.seed) h = ((h << 5) - h + c.charCodeAt(0)) | 0
  return Math.abs(h)
})
const bg = computed(() => `oklch(0.55 0.12 ${hash.value % 360})`)
const initials = computed(() =>
  props.seed.replace('anon_', '').split('_').map(w => w[0]?.toUpperCase() ?? '').join('').slice(0, 2),
)
const fontSize = computed(() => Math.round(props.size * 0.3))
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 72 72" class="shrink-0" role="img" :aria-label="seed">
    <circle cx="36" cy="36" r="36" :fill="bg" />
    <text
      x="36" y="36" text-anchor="middle" dominant-baseline="central"
      font-family="var(--font-serif)" :font-size="fontSize" font-weight="700"
      fill="rgba(255,255,255,0.92)"
    >{{ initials }}</text>
  </svg>
</template>
