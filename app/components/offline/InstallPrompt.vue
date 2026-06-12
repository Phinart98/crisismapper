<script setup lang="ts">
const { $pwa } = useNuxtApp() as any
const dismissed = ref(false)
const visible = computed(() => $pwa?.showInstallPrompt && !$pwa?.isPWAInstalled && !dismissed.value)

function handleInstall() {
  $pwa.install?.()
  dismissed.value = true
}
</script>

<template>
  <div
    v-if="visible"
    class="fixed start-4 end-4 top-4 z-[110] mx-auto max-w-sm rounded border border-ink/15 bg-parchment p-3 shadow-md sm:start-auto sm:end-4"
    role="status"
  >
    <div class="label">{{ $t('installTitle') }}</div>
    <div class="text-sm text-ink/70">{{ $t('installSub') }}</div>
    <div class="mt-3 flex gap-2">
      <button
        class="btn btn-primary focus-ring min-h-[44px] flex-1 text-sm"
        @click="handleInstall"
      >
        {{ $t('installAdd') }}
      </button>
      <button
        class="btn btn-ghost focus-ring min-h-[44px] text-sm"
        @click="dismissed = true"
      >
        {{ $t('installLater') }}
      </button>
    </div>
  </div>
</template>
