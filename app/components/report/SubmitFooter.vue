<script setup lang="ts">
import type { SubmitPhase } from '~/composables/useReportForm'

defineProps<{ phase: SubmitPhase }>()
const emit = defineEmits<{ submit: [] }>()
</script>

<template>
  <div class="sticky bottom-0 px-4 py-3 bg-parchment border-t border-parchment-deep">
    <button
      class="btn btn-primary btn-full h-[52px] text-base"
      :disabled="phase === 'metadata' || phase === 'photo'"
      :style="{ opacity: phase === 'metadata' || phase === 'photo' ? 0.7 : 1 }"
      @click="emit('submit')"
    >
      <span v-if="phase === 'metadata'">{{ $t('submitting') }}</span>
      <span v-else-if="phase === 'photo'">{{ $t('photoUploading') }}</span>
      <span v-else>{{ $t('submit') }}</span>
    </button>
  </div>
</template>
