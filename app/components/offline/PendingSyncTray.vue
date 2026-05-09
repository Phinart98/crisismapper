<script setup lang="ts">
const { pendingCount, isFlushing, flush } = useOfflineQueue()
const dismissed = ref(false)
const visible = computed(() => pendingCount.value > 0 && !dismissed.value)

function handleSync() { flush() }
function handleDismiss() { dismissed.value = true }

watch(pendingCount, (n, prev) => {
  if (n > prev) dismissed.value = false
})
</script>

<template>
  <Transition
    enter-from-class="translate-y-full opacity-0"
    enter-active-class="transition duration-200"
    leave-to-class="translate-y-full opacity-0"
    leave-active-class="transition duration-150"
  >
    <div
      v-if="visible"
      class="fixed inset-x-0 bottom-0 z-50 border-t border-ink/15 bg-parchment shadow-[0_-2px_8px_rgba(0,0,0,0.06)]"
      role="status"
      aria-live="polite"
    >
      <div class="mx-auto flex max-w-screen-md items-center gap-3 px-4 py-3 sm:px-6">
        <div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-ink/5">
          <span class="label">{{ pendingCount }}</span>
        </div>
        <div class="min-w-0 flex-1 text-start">
          <div class="label truncate">{{ $t('syncTitle') }}</div>
          <div class="hidden sm:block text-sm text-ink/70">{{ $t('syncSub') }}</div>
        </div>
        <button
          type="button"
          class="btn btn-ghost focus-ring min-h-[44px] px-4 text-sm"
          :disabled="isFlushing"
          @click="handleSync"
        >
          {{ isFlushing ? $t('submitting') : $t('syncNow') }}
        </button>
        <button
          type="button"
          class="focus-ring flex h-9 w-9 items-center justify-center rounded text-ink/60 hover:text-ink"
          :aria-label="$t('syncClose')"
          @click="handleDismiss"
        >
          ×
        </button>
      </div>
    </div>
  </Transition>
</template>
