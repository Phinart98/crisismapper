<script setup lang="ts">
import { BADGES, type BadgeMeta } from '~/utils/badges'

const props = defineProps<{ earned: string[] }>()
const emit = defineEmits<{ select: [badge: BadgeMeta, earned: boolean] }>()

const has = (code: string) => props.earned.includes(code)
</script>

<template>
  <div class="grid grid-cols-4 gap-2">
    <button
      v-for="badge in BADGES"
      :key="badge.code"
      type="button"
      class="focus-ring relative flex flex-col items-center gap-1.5 px-2 py-3.5 rounded-sm border-[1.5px] border-parchment-deep cursor-pointer transition-colors duration-150 min-h-[44px]"
      :class="has(badge.code)
        ? 'bg-white hover:bg-parchment-mid'
        : 'bg-parchment-mid opacity-45 grayscale'"
      @click="emit('select', badge, has(badge.code))"
    >
      <span class="text-2xl leading-none" aria-hidden="true">{{ badge.emoji }}</span>
      <span class="font-mono text-[9px] tracking-[0.08em] uppercase text-ink-light text-center leading-tight">{{ $t(badge.name) }}</span>
      <span v-if="has(badge.code)" class="absolute top-1.5 end-1.5 w-2 h-2 rounded-full bg-sev-minimal" />
    </button>
  </div>
</template>
