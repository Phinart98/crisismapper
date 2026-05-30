<script setup lang="ts">
import { useReportForm } from '~/composables/useReportForm'
import type { PhotoResult } from '~/composables/usePhotoPipeline'
import type { GpsResult } from '~/composables/useGeolocation'

const form = useReportForm()

function onPhotoCaptured(result: PhotoResult) {
  form.photo.value = result
  form.step.value = 2
  form.runAiClassify(result.webpBlob)
}

function onRetake() {
  form.photo.value = null
  form.aiResult.value = null
  form.aiLoading.value = false
  form.step.value = 1
}

function onAiAdvance() { form.step.value = 3 }

function onLocationResolved(result: GpsResult) {
  form.location.value = result
  if (form.step.value < 4) form.step.value = 4
}

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
      <ReportPhotoStep @captured="onPhotoCaptured" @retake="onRetake" />

      <Transition name="slide-up">
        <ReportAiClassificationCard
          v-if="form.step.value >= 2"
          v-model="form.severity.value"
          :ai-result="form.aiResult.value"
          :ai-loading="form.aiLoading.value"
          @confirm="onAiAdvance"
          @correct="onAiAdvance"
        />
      </Transition>

      <Transition name="slide-up">
        <ReportLocationStep
          v-if="form.step.value >= 3"
          :has-error="form.errors.location"
          @resolved="onLocationResolved"
        />
      </Transition>

      <Transition name="slide-up">
        <ReportCrisisBadge
          v-if="form.step.value >= 4"
          :crises="form.crises.value"
          :model-value="form.crisisId.value"
          :outside-zones="form.crisisOutsideZones.value"
          @select="form.setCrisis"
        />
      </Transition>

      <Transition name="slide-up">
        <ReportInfraStep
          v-if="form.step.value >= 4"
          v-model="form.infraType.value"
          @update:model-value="onInfraSelected"
        />
      </Transition>

      <Transition name="slide-up">
        <ReportExtraStep
          v-if="form.step.value >= 5"
          :electricity-status="form.electricityStatus.value"
          :health-status="form.healthStatus.value"
          :community-needs="form.communityNeeds.value"
          :vulnerable-groups="form.vulnerableGroups.value"
          @update:electricity-status="form.electricityStatus.value = $event"
          @update:health-status="form.healthStatus.value = $event"
          @update:community-needs="form.communityNeeds.value = $event"
          @update:vulnerable-groups="form.vulnerableGroups.value = $event"
        />
      </Transition>
    </div>

    <!-- Sticky footer -->
    <ReportSubmitFooter
      v-if="form.step.value >= 4 && form.submitPhase.value !== 'done' && form.submitPhase.value !== 'queued'"
      :phase="form.submitPhase.value"
      @submit="form.submit()"
    />
  </div>
</template>

<style scoped>
.slide-up-enter-active { transition: opacity 0.35s ease, transform 0.35s ease; }
.slide-up-enter-from   { opacity: 0; transform: translateY(12px); }
</style>
