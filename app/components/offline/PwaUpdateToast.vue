<script setup lang="ts">
const { $pwa } = useNuxtApp() as any
const dismissed = ref(false)
</script>

<template>
  <div
    v-if="$pwa?.needRefresh && !dismissed"
    class="fixed bottom-4 start-4 end-4 z-40 mx-auto max-w-sm rounded border border-ink/15 bg-parchment p-3 shadow-md sm:start-auto sm:end-4"
    role="status"
  >
    <div class="label">{{ $t('updateTitle') }}</div>
    <div class="text-sm text-ink/70">{{ $t('updateSub') }}</div>
    <div class="mt-3 flex gap-2">
      <button
        class="btn btn-primary focus-ring min-h-[44px] flex-1 text-sm"
        @click="$pwa.updateServiceWorker(true)"
      >
        {{ $t('updateReload') }}
      </button>
      <button
        class="btn btn-ghost focus-ring min-h-[44px] text-sm"
        @click="dismissed = true"
      >
        {{ $t('updateLater') }}
      </button>
    </div>
  </div>
</template>
