<script setup lang="ts">
import { usePhotoPipeline } from '~/composables/usePhotoPipeline'
import type { PhotoResult } from '~/composables/usePhotoPipeline'

const emit = defineEmits<{ captured: [PhotoResult]; retake: [] }>()

const { processing, error, processPhoto } = usePhotoPipeline()
const photo = ref<PhotoResult | null>(null)
const fileInput = ref<HTMLInputElement>()

async function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  error.value = null
  const result = await processPhoto(file)
  if (result) {
    photo.value = result
    emit('captured', result)
  }
}

function retake() {
  if (photo.value?.previewUrl) URL.revokeObjectURL(photo.value.previewUrl)
  photo.value = null
  error.value = null
  if (fileInput.value) fileInput.value.value = ''
  emit('retake')
}
</script>

<template>
  <section class="mb-10 sm:mb-12">
    <div class="mb-5">
      <div class="label mb-1.5">{{ $t('step2label') }}</div>
      <div class="font-serif text-xl sm:text-2xl font-semibold leading-tight">{{ $t('step2title') }}</div>
    </div>

    <!-- Tips (shown before capture) -->
    <div v-if="!photo" class="mb-6">
      <div
        v-for="(key, i) in ['tip1', 'tip2', 'tip3']"
        :key="key"
        class="flex items-start gap-3 mb-3 last:mb-0"
      >
        <div class="label text-ink-ghost mt-1 shrink-0">{{ String(i + 1).padStart(2, '0') }}</div>
        <div class="text-sm text-ink-mid leading-relaxed">{{ $t(key) }}</div>
      </div>
    </div>

    <!-- Capture button -->
    <div v-if="!photo">
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        capture="environment"
        class="sr-only"
        @change="onFileChange"
      />
      <button
        class="btn btn-primary btn-full h-14 sm:h-16 text-base gap-2.5"
        :disabled="processing"
        @click="fileInput?.click()"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
        {{ processing ? '…' : $t('capture') }}
      </button>
    </div>

    <!-- Warnings -->
    <div v-if="error" class="mt-2.5 text-sm text-accent leading-snug">
      {{ $t(error) }}
    </div>

    <!-- Preview -->
    <div v-if="photo" class="relative">
      <div
        class="w-full aspect-[4/3] sm:aspect-[16/10] rounded border border-parchment-deep relative overflow-hidden"
        style="background: linear-gradient(135deg, #B5A898 0%, #8A7A6A 50%, #C4B08A 100%)"
      >
        <img :src="photo.previewUrl" class="w-full h-full object-cover" :alt="$t('photoAlt')" />
        <!-- Crosshair overlay -->
        <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
          <svg width="40" height="40" viewBox="0 0 40 40" class="opacity-20">
            <line x1="0" y1="20" x2="40" y2="20" stroke="white" stroke-width="1"/>
            <line x1="20" y1="0" x2="20" y2="40" stroke="white" stroke-width="1"/>
            <circle cx="20" cy="20" r="6" stroke="white" stroke-width="1" fill="none"/>
          </svg>
        </div>
        <!-- Size badge -->
        <div class="absolute bottom-2 end-2 bg-ink/70 text-parchment label px-1.5 py-0.5 rounded-sm">
          ↓ {{ Math.round(photo.sizeBytes / 1024) }}KB compressed
        </div>
      </div>

      <!-- Quality warnings (non-blocking) -->
      <div v-if="photo.blurry" class="mt-2 text-sm text-sev-partial leading-snug">⚠ {{ $t('blurWarning') }}</div>
      <div v-if="photo.peopleDetected" class="mt-2 text-sm text-sev-partial leading-snug">⚠ {{ $t('faceWarning') }}</div>

      <button
        class="mt-3 min-h-[36px] label text-ink-light bg-transparent border-none cursor-pointer underline focus-ring rounded-sm px-1"
        @click="retake"
      >{{ $t('retake') }}</button>
    </div>
  </section>
</template>
