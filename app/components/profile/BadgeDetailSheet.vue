<script setup lang="ts">
import type { BadgeMeta } from '~/utils/badges'

defineProps<{ badge: BadgeMeta; earned: boolean }>()
const emit = defineEmits<{ close: [] }>()

function onKey(e: KeyboardEvent) { if (e.key === 'Escape') emit('close') }
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div
    class="fixed inset-0 z-[200] flex items-end justify-center bg-[rgba(26,26,26,0.5)]"
    @click.self="emit('close')"
  >
    <div class="bg-parchment w-full max-w-[480px] rounded-t-xl p-6 pb-10">
      <div class="flex items-center gap-3.5 mb-4">
        <span class="text-4xl leading-none" aria-hidden="true">{{ badge.emoji }}</span>
        <div>
          <div class="font-serif text-xl font-semibold">{{ $t(badge.name) }}</div>
          <div v-if="earned" class="font-mono text-[10px] tracking-[0.08em] uppercase text-sev-minimal mt-1">
            ✓ {{ $t('badgeEarned') }}
          </div>
          <div v-else class="font-mono text-[10px] tracking-[0.08em] uppercase text-ink-ghost mt-1">
            {{ $t('badgeLocked') }}
          </div>
        </div>
      </div>
      <p class="text-sm text-ink-mid leading-relaxed" :class="earned ? '' : 'mb-3.5'">{{ $t(badge.desc) }}</p>
      <div
        v-if="!earned"
        class="bg-parchment-mid rounded-sm px-3.5 py-3 text-[13px] text-ink-light leading-relaxed border-s-2 border-accent"
      >{{ $t(badge.how) }}</div>
      <button type="button" class="btn btn-full bg-ink text-parchment mt-5" @click="emit('close')">
        {{ $t('modalClose') }}
      </button>
    </div>
  </div>
</template>
