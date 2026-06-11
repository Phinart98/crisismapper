<script setup lang="ts">
import type { InfraType } from '~/utils/severity'

const props = defineProps<{ modelValue: InfraType | null }>()
const emit = defineEmits<{ 'update:modelValue': [InfraType] }>()

const INFRA: { key: InfraType; i18nKey: string }[] = [
  { key: 'building',  i18nKey: 'infraBuilding' },
  { key: 'road',      i18nKey: 'infraRoad' },
  { key: 'bridge',    i18nKey: 'infraBridge' },
  { key: 'hospital',  i18nKey: 'infraHospital' },
  { key: 'school',    i18nKey: 'infraSchool' },
  { key: 'utility',   i18nKey: 'infraUtility' },
  { key: 'other',     i18nKey: 'infraOther' },
]
</script>

<template>
  <section class="mb-10 sm:mb-12">
    <div class="mb-5">
      <div class="label mb-1.5">{{ $t('step4label') }}</div>
      <div class="font-serif text-xl sm:text-2xl font-semibold leading-tight">{{ $t('step4title') }}</div>
    </div>

    <div class="flex flex-wrap gap-2">
      <button
        v-for="item in INFRA"
        :key="item.key"
        class="min-h-[44px] py-2.5 px-4 rounded-full text-sm font-medium cursor-pointer transition-colors duration-150 focus-ring"
        :class="modelValue === item.key
          ? 'border-2 border-ink bg-ink text-parchment'
          : 'border border-parchment-deep bg-white text-ink-mid hover:border-ink-light hover:bg-parchment-mid'"
        @click="emit('update:modelValue', item.key)"
      >{{ $t(item.i18nKey) }}</button>
    </div>
  </section>
</template>
