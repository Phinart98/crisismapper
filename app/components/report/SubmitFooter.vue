<script setup lang="ts">
import type { SubmitPhase } from '~/composables/useReportForm'

defineProps<{ phase: SubmitPhase }>()
const emit = defineEmits<{ submit: [] }>()
</script>

<template>
  <div class="sticky bottom-0 px-5 sm:px-7 md:px-6 py-3 sm:py-4 bg-parchment border-t border-parchment-deep">
    <div
      v-if="phase === 'error'"
      class="mb-3 px-3 py-2 rounded border border-sev-complete bg-sev-complete/10 text-sm text-sev-complete leading-snug"
      role="alert"
    >
      {{ $t('submitError') }}
    </div>
    <button
      class="btn btn-primary btn-full h-12 sm:h-[52px] text-base"
      :disabled="phase === 'metadata' || phase === 'photo'"
      @click="emit('submit')"
    >
      <span v-if="phase === 'metadata'">{{ $t('submitting') }}</span>
      <span v-else-if="phase === 'photo'">{{ $t('photoUploading') }}</span>
      <span v-else-if="phase === 'error'">{{ $t('retry') }}</span>
      <span v-else>{{ $t('submit') }}</span>
    </button>
  </div>
</template>
