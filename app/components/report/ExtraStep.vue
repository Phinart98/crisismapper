<script setup lang="ts">
// Structured Core Questions (Q&A #14/#16): chip selectors, not free text. The values
// mirror the DB CHECK constraints (electricity/health/affected_population) — free text
// here used to 400 at the API and strand the report in the offline queue.
const electricityStatus = defineModel<string>('electricityStatus', { required: true })
const healthStatus = defineModel<string>('healthStatus', { required: true })
const communityNeeds = defineModel<string[]>('communityNeeds', { required: true })
const vulnerableGroups = defineModel<string[]>('vulnerableGroups', { required: true })
const affectedPopulation = defineModel<string>('affectedPopulation', { required: true })

const open = ref(false)

const ELEC = [
  { value: 'functional', i18nKey: 'elecFunctional' },
  { value: 'partial', i18nKey: 'optPartial' },
  { value: 'non-functional', i18nKey: 'elecNone' },
  { value: 'unknown', i18nKey: 'optUnknown' },
]
const HEALTH = [
  { value: 'operational', i18nKey: 'healthOperational' },
  { value: 'partial', i18nKey: 'optPartial' },
  { value: 'down', i18nKey: 'healthDown' },
  { value: 'unknown', i18nKey: 'optUnknown' },
]
const NEEDS = [
  { value: 'water', i18nKey: 'needWater' },
  { value: 'food', i18nKey: 'needFood' },
  { value: 'shelter', i18nKey: 'needShelter' },
  { value: 'medical', i18nKey: 'needMedical' },
  { value: 'search', i18nKey: 'needSearch' },
]
const VULN = [
  { value: 'elderly', i18nKey: 'vulnElderly' },
  { value: 'children', i18nKey: 'vulnChildren' },
  { value: 'disabled', i18nKey: 'vulnDisabled' },
  { value: 'pregnant', i18nKey: 'vulnPregnant' },
  { value: 'injured', i18nKey: 'vulnInjured' },
]
const POP = ['<50', '50-200', '200-1000', '1000+']

function toggleIn(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter(v => v !== value) : [...list, value]
}

const chipClass = (active: boolean) => [
  'min-h-[36px] px-3 rounded-full text-sm cursor-pointer transition-colors duration-150 focus-ring',
  active
    ? 'border-2 border-ink bg-ink text-parchment'
    : 'border border-parchment-deep bg-parchment text-ink-mid hover:border-ink-light',
]
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
      type="button"
      class="flex justify-between items-center w-full min-h-[48px] px-3.5 py-3 bg-parchment-mid border border-parchment-deep rounded cursor-pointer text-sm font-medium text-ink focus-ring transition-colors hover:bg-parchment-deep/60"
      :aria-expanded="open"
      @click="open = !open"
    >
      {{ $t('extraToggle') }}
      <span
        class="text-sm transition-transform duration-200"
        :style="{ transform: open ? 'rotate(180deg)' : 'none' }"
      >▾</span>
    </button>

    <div v-if="open" class="border border-parchment-deep border-t-0 rounded-b overflow-hidden">
      <!-- Electricity — single select, tap again to clear -->
      <div class="bg-white px-3.5 py-3">
        <div class="label mb-2">{{ $t('elec') }}</div>
        <div class="flex flex-wrap gap-1.5">
          <button
            type="button"
            v-for="o in ELEC" :key="o.value"
            :class="chipClass(electricityStatus === o.value)"
            :aria-pressed="electricityStatus === o.value"
            @click="electricityStatus = electricityStatus === o.value ? '' : o.value"
          >{{ $t(o.i18nKey) }}</button>
        </div>
      </div>

      <!-- Health services — single select -->
      <div class="bg-white px-3.5 py-3 border-t border-parchment-deep">
        <div class="label mb-2">{{ $t('health') }}</div>
        <div class="flex flex-wrap gap-1.5">
          <button
            type="button"
            v-for="o in HEALTH" :key="o.value"
            :class="chipClass(healthStatus === o.value)"
            :aria-pressed="healthStatus === o.value"
            @click="healthStatus = healthStatus === o.value ? '' : o.value"
          >{{ $t(o.i18nKey) }}</button>
        </div>
      </div>

      <!-- Community needs — multi select -->
      <div class="bg-white px-3.5 py-3 border-t border-parchment-deep">
        <div class="label mb-2">{{ $t('community') }}</div>
        <div class="flex flex-wrap gap-1.5">
          <button
            type="button"
            v-for="o in NEEDS" :key="o.value"
            :class="chipClass(communityNeeds.includes(o.value))"
            :aria-pressed="communityNeeds.includes(o.value)"
            @click="communityNeeds = toggleIn(communityNeeds, o.value)"
          >{{ $t(o.i18nKey) }}</button>
        </div>
      </div>

      <!-- Vulnerable groups — multi select -->
      <div class="bg-white px-3.5 py-3 border-t border-parchment-deep">
        <div class="label mb-2">{{ $t('vuln') }}</div>
        <div class="flex flex-wrap gap-1.5">
          <button
            type="button"
            v-for="o in VULN" :key="o.value"
            :class="chipClass(vulnerableGroups.includes(o.value))"
            :aria-pressed="vulnerableGroups.includes(o.value)"
            @click="vulnerableGroups = toggleIn(vulnerableGroups, o.value)"
          >{{ $t(o.i18nKey) }}</button>
        </div>
      </div>

      <!-- Affected population — single select, values are universal numerals -->
      <div class="bg-white px-3.5 py-3 border-t border-parchment-deep">
        <div class="label mb-2">{{ $t('affectedPop') }}</div>
        <div class="flex flex-wrap gap-1.5">
          <button
            type="button"
            v-for="p in POP" :key="p"
            dir="ltr"
            :class="chipClass(affectedPopulation === p)"
            :aria-pressed="affectedPopulation === p"
            @click="affectedPopulation = affectedPopulation === p ? '' : p"
          >{{ p }}</button>
        </div>
      </div>
    </div>
  </section>
</template>
