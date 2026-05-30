<script setup lang="ts">
// Hourly report-rate sparkline for the header (last 24h). Ported from the
// dashboard.html mockup; data comes from /api/map/stats.
const props = withDefaults(defineProps<{
  data: number[]
  width?: number
  height?: number
}>(), { width: 120, height: 28 })

const points = computed(() => {
  const d = props.data.length ? props.data : [0]
  const max = Math.max(...d, 1)
  const n = Math.max(d.length - 1, 1)
  return d
    .map((v, i) => `${(i / n) * props.width},${props.height - (v / max) * props.height}`)
    .join(' ')
})
</script>

<template>
  <svg :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" class="block">
    <polyline
      :points="points"
      fill="none"
      stroke="var(--c-accent)"
      stroke-width="1.5"
      stroke-linejoin="round"
      stroke-linecap="round"
    />
  </svg>
</template>
