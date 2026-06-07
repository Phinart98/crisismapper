<script setup lang="ts">
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip,
} from 'chart.js'

// Tree-shaken registration — only the pieces this one chart needs. Lives in a .client.vue
// so Nuxt code-splitting keeps chart.js OUT of /report, /me, /leaderboard, and the landing
// bundles; it loads only when the dashboard renders in the browser (never SSR).
ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip)

const props = defineProps<{ hourly: number[] }>()

const data = computed(() => ({
  labels: props.hourly.map((_, i) => `${i - props.hourly.length + 1}h`),
  datasets: [{
    data: props.hourly,
    borderColor: '#C44536',
    backgroundColor: 'rgba(196,69,54,0.12)',
    fill: true,
    tension: 0.35,
    borderWidth: 1.5,
    pointRadius: 0,
    pointHoverRadius: 3,
  }],
}))

const options = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false as const,
  plugins: { legend: { display: false }, tooltip: { intersect: false, mode: 'index' as const } },
  scales: { x: { display: false }, y: { display: false, beginAtZero: true } },
}
</script>

<template>
  <div class="px-[18px] py-3 border-b border-parchment-deep">
    <div class="flex items-center justify-between mb-1.5">
      <span class="label">{{ $t('dashReportRate') }}</span>
      <span class="font-mono text-[9px] text-ink-ghost">24h</span>
    </div>
    <div class="h-12">
      <Line :data="data" :options="options" />
    </div>
  </div>
</template>
