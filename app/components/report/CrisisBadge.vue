<script setup lang="ts">
import type { CrisisRow } from '~/composables/useActiveCrises'

const props = defineProps<{
  crises: CrisisRow[]
  modelValue: string
  outsideZones: boolean   // GPS resolved outside every active zone → force the picker
  manual: boolean         // user already overrode the auto-resolution
}>()
const emit = defineEmits<{ select: [id: string] }>()

// Start in picker mode when we couldn't auto-place the report.
const picking = ref(props.outsideZones)
watch(() => props.outsideZones, v => { if (v) picking.value = true })

const current = computed(() => props.crises.find(c => c.id === props.modelValue) ?? null)
const showPicker = computed(() => picking.value || props.outsideZones)

function onSelect(e: Event) {
  emit('select', (e.target as HTMLSelectElement).value)
  picking.value = false
}
</script>

<template>
  <!-- Only meaningful once we have active crises to attribute the report to. -->
  <section v-if="crises.length" class="mb-10 sm:mb-12">
    <div class="mb-3">
      <div class="label mb-1.5">Crisis event</div>
      <div class="font-serif text-xl sm:text-2xl font-semibold leading-tight">Which crisis is this?</div>
    </div>

    <!-- Auto-resolved: show the detected crisis with a change affordance. -->
    <div
      v-if="!showPicker"
      class="flex items-center gap-3 rounded-md border border-parchment-deep bg-parchment-mid px-4 py-3"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="text-accent shrink-0">
        <path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
      </svg>
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium text-ink truncate">{{ current?.name ?? 'Detected from your location' }}</div>
        <div class="font-mono text-[10px] tracking-[0.06em] uppercase text-ink-light">Detected from your location</div>
      </div>
      <button
        type="button"
        class="focus-ring text-[13px] font-medium text-accent min-h-[44px] px-2 cursor-pointer"
        @click="picking = true"
      >Change</button>
    </div>

    <!-- Manual picker: outside any zone, or user chose to change. -->
    <div v-else>
      <p v-if="outsideZones" class="text-[13px] text-ink-light leading-relaxed mb-2">
        Your location isn’t inside a known crisis zone. Please choose the event you’re reporting for.
      </p>
      <select
        class="focus-ring w-full px-4 min-h-[48px] bg-white border border-parchment-deep rounded-md text-base text-ink cursor-pointer appearance-none bg-no-repeat"
        style="background-image:url(&quot;data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236B6B6B' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E&quot;);background-position:right 16px center"
        :value="modelValue"
        @change="onSelect"
      >
        <option v-for="c in crises" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
    </div>
  </section>
</template>
