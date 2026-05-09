<script setup lang="ts">
defineProps<{
  electricityStatus: string
  healthStatus: string
  communityNeeds: string
  vulnerableGroups: string
}>()

const emit = defineEmits<{
  'update:electricityStatus': [string]
  'update:healthStatus': [string]
  'update:communityNeeds': [string]
  'update:vulnerableGroups': [string]
}>()

const open = ref(false)

const FIELDS = [
  { key: 'elec',      labelKey: 'elec',      phKey: 'elecPlaceholder',       prop: 'electricityStatus', event: 'update:electricityStatus' },
  { key: 'health',    labelKey: 'health',    phKey: 'healthPlaceholder',     prop: 'healthStatus',      event: 'update:healthStatus' },
  { key: 'community', labelKey: 'community', phKey: 'communityPlaceholder',  prop: 'communityNeeds',    event: 'update:communityNeeds' },
  { key: 'vuln',      labelKey: 'vuln',      phKey: 'vulnPlaceholder',       prop: 'vulnerableGroups',  event: 'update:vulnerableGroups' },
] as const
</script>

<template>
  <section class="mb-10 sm:mb-12">
    <div class="mb-5">
      <div class="label mb-1.5">{{ $t('step5label') }}</div>
      <div class="font-serif text-xl sm:text-2xl font-semibold leading-tight">{{ $t('step5title') }}</div>
      <div class="text-sm text-ink-light mt-2">{{ $t('step5sub') }}</div>
    </div>

    <!-- Accordion trigger -->
    <button
      class="flex justify-between items-center w-full min-h-[48px] px-3.5 py-3 bg-parchment-mid border border-parchment-deep rounded cursor-pointer text-sm font-medium text-ink focus-ring transition-colors hover:bg-parchment-deep/60"
      @click="open = !open"
    >
      {{ $t('extraToggle') }}
      <span
        class="text-sm transition-transform duration-200"
        :style="{ transform: open ? 'rotate(180deg)' : 'none' }"
      >▾</span>
    </button>

    <div v-if="open" class="border border-parchment-deep border-t-0 rounded-b overflow-hidden">
      <div
        v-for="(field, i) in FIELDS"
        :key="field.key"
        :class="['bg-white px-3.5 py-3', i > 0 ? 'border-t border-parchment-deep' : '']"
      >
        <div class="label mb-1.5">{{ $t(field.labelKey) }}</div>
        <textarea
          rows="2"
          :placeholder="$t(field.phKey)"
          :value="(($props as unknown) as Record<string, string>)[field.prop]"
          class="w-full px-3 py-2.5 bg-parchment border border-parchment-deep rounded-sm text-base text-ink font-sans resize-y leading-relaxed transition-colors"
          @input="emit(field.event as any, ($event.target as HTMLTextAreaElement).value)"
        />
      </div>
    </div>
  </section>
</template>
