<script setup lang="ts">
import { useReportForm } from '~/composables/useReportForm'
import type { PhotoResult } from '~/composables/usePhotoPipeline'
import type { GpsResult } from '~/composables/useGeolocation'

const form = useReportForm()

// Location is step 1 — crisis context is established before anything else, so a
// reporter outside every active zone is stopped before taking a photo.
function onLocationResolved(result: GpsResult) {
  form.location.value = result
  if (form.step.value < 2) form.step.value = 2
}

function onPhotoCaptured(result: PhotoResult) {
  form.photo.value = result
  if (form.step.value < 3) form.step.value = 3
  form.runAiClassify(result.webpBlob)
}

function onRetake() {
  form.photo.value = null
  form.aiResult.value = null
  form.aiLoading.value = false
  form.step.value = 2
}

function onAiAdvance() { if (form.step.value < 4) form.step.value = 4 }

function onInfraSelected() {
  if (form.step.value < 5) form.step.value = 5
}
</script>

<template>
  <div class="flex flex-col min-h-screen">
    <ReportTopBar />
    <ReportStepProgress :current="form.step.value" />

    <!-- Confirm screen -->
    <ReportConfirmScreen
      v-if="form.submitPhase.value === 'done' || form.submitPhase.value === 'queued'"
      :photo-error="form.photoError.value"
      :queued="form.submitPhase.value === 'queued'"
      :crisis-id="form.crisisId.value"
      :crisis-name="form.selectedCrisisName.value"
      @again="form.reset"
    />

    <!-- Form body -->
    <div v-else class="flex-1 px-5 sm:px-7 md:px-6 pt-6 sm:pt-8 pb-24 sm:pb-28 overflow-auto">
      <!-- Step 1: location FIRST — establishes which crisis (if any) this report
           belongs to before the reporter invests in a photo. -->
      <ReportLocationStep
        :has-error="form.errors.location"
        @resolved="onLocationResolved"
      />

      <!-- Location resolved but no active crisis zone covers it: stop here. -->
      <Transition name="slide-up">
        <ReportNoCrisisNotice v-if="form.noCrisisHere.value" />
      </Transition>

      <!-- Detected crisis (with a change affordance among containing zones). -->
      <Transition name="slide-up">
        <ReportCrisisBadge
          v-if="form.step.value >= 2 && !form.noCrisisHere.value"
          :crises="form.pickerCrises.value"
          :model-value="form.crisisId.value"
          :outside-zones="form.crisisOutsideZones.value"
          @select="form.setCrisis"
        />
      </Transition>

      <Transition name="slide-up">
        <ReportPhotoStep
          v-if="form.step.value >= 2 && !form.noCrisisHere.value"
          @captured="onPhotoCaptured"
          @retake="onRetake"
        />
      </Transition>

      <Transition name="slide-up">
        <ReportAiClassificationCard
          v-if="form.step.value >= 3 && !form.noCrisisHere.value"
          v-model="form.severity.value"
          :ai-result="form.aiResult.value"
          :ai-loading="form.aiLoading.value"
          @confirm="onAiAdvance"
          @correct="onAiAdvance"
        />
      </Transition>

      <Transition name="slide-up">
        <ReportInfraStep
          v-if="form.step.value >= 4 && !form.noCrisisHere.value"
          v-model="form.infraType.value"
          @update:model-value="onInfraSelected"
        />
      </Transition>

      <Transition name="slide-up">
        <ReportExtraStep
          v-if="form.step.value >= 5 && !form.noCrisisHere.value"
          v-model:electricity-status="form.electricityStatus.value"
          v-model:health-status="form.healthStatus.value"
          v-model:community-needs="form.communityNeeds.value"
          v-model:vulnerable-groups="form.vulnerableGroups.value"
          v-model:affected-population="form.affectedPopulation.value"
        />
      </Transition>
    </div>

    <!-- Sticky footer — appears once infra (step 4) is reachable. -->
    <ReportSubmitFooter
      v-if="form.step.value >= 4 && !form.noCrisisHere.value && form.submitPhase.value !== 'done' && form.submitPhase.value !== 'queued'"
      :phase="form.submitPhase.value"
      @submit="form.submit()"
    />
  </div>
</template>

<style scoped>
.slide-up-enter-active { transition: opacity 0.35s ease, transform 0.35s ease; }
.slide-up-enter-from   { opacity: 0; transform: translateY(12px); }
</style>
