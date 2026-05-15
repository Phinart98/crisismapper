import type { UiSeverity } from '~/utils/severity'
import { dbToUi } from '~/utils/severity'
import type { GpsResult } from '~/composables/useGeolocation'
import type { PhotoResult } from '~/composables/usePhotoPipeline'
import type { ClassifyResult } from '~/utils/aiClassify'
import { isAiUsable } from '~/utils/aiClassify'
import { classifyPhoto } from '~/utils/classifyPhoto'
import { useOfflineQueue } from '~/composables/useOfflineQueue'

export type InfraType = 'building' | 'road' | 'bridge' | 'hospital' | 'school' | 'utility' | 'other'
export type SubmitPhase = 'idle' | 'metadata' | 'photo' | 'queued' | 'done' | 'error'

export function useReportForm() {
  const { public: { demoCrisisId } } = useRuntimeConfig()
  const queue = useOfflineQueue()

  const step = ref(1)
  const photo = ref<PhotoResult | null>(null)
  const aiResult = ref<ClassifyResult | null>(null)
  const aiLoading = ref(false)
  const severity = ref<UiSeverity>('partial')
  const location = ref<GpsResult | null>(null)
  const infraType = ref<InfraType | null>(null)
  const description = ref('')
  const electricityStatus = ref('')
  const healthStatus = ref('')
  const communityNeeds = ref('')
  const vulnerableGroups = ref('')

  const submitPhase = ref<SubmitPhase>('idle')
  const reportId = ref<string | null>(null)
  const photoError = ref(false)

  const errors = reactive<Record<string, boolean>>({})

  function validate(): boolean {
    errors.photo = !photo.value
    errors.location = !location.value
    errors.infra = !infraType.value
    return !Object.values(errors).some(Boolean)
  }

  async function submit() {
    if (!validate()) return
    submitPhase.value = 'metadata'

    const loc = location.value!
    // Strip Vue reactivity. ai_raw_response is the most painful one: structured-clone
    // (IndexedDB write inside Dexie) silently throws DataCloneError on a reactive Proxy,
    // which surfaces as the generic "could not save on your device" error path here.
    const aiRaw = aiResult.value ? JSON.parse(JSON.stringify(aiResult.value)) as ClassifyResult : null
    // Degraded results (no provider answered) are dropped so we don't pollute audit
    // data with synthetic 'unknown'/0 values from the fallback envelope.
    const ai = isAiUsable(aiRaw) ? aiRaw : null

    const payload = {
      crisis_id: demoCrisisId,
      severity: severity.value,
      infrastructure_type: infraType.value!,
      location: [loc.lng, loc.lat] as [number, number],
      location_method: loc.method,
      plus_code: loc.plusCode,
      description: description.value || undefined,
      electricity_status: electricityStatus.value || undefined,
      health_status: healthStatus.value || undefined,
      community_needs: communityNeeds.value || undefined,
      vulnerable_groups: vulnerableGroups.value || undefined,
      ai_severity: ai?.severity,
      ai_confidence: ai?.confidence,
      ai_infrastructure_visible: ai?.infrastructure_visible,
      ai_raw_response: ai as unknown as Record<string, unknown> | undefined,
    }

    let myId: number
    try {
      myId = await queue.enqueue({
        payload,
        photo: photo.value!.webpBlob,
        photo_hash: photo.value!.hashHex,
      })
    } catch {
      // Most likely cause: IndexedDB quota exceeded on a low-storage phone.
      // Nothing we can salvage — the photo Blob can't be persisted anywhere safe.
      submitPhase.value = 'error'
      return
    }

    submitPhase.value = 'photo'
    photoError.value = false
    const result = await queue.flush()

    if (result.drainedIds.includes(myId)) {
      submitPhase.value = 'done'
    } else {
      // Foreground drain failed; register Android Background Sync so the OS
      // retries on next connectivity. Skipping the register when the row
      // already drained avoids the SW double-POSTing the same row later.
      await queue.registerBackgroundSync()
      submitPhase.value = 'queued'
    }
  }

  async function runAiClassify(blob: Blob) {
    aiLoading.value = true
    aiResult.value = null
    try {
      const res = await classifyPhoto(blob)
      aiResult.value = res
      if (isAiUsable(res)) {
        const mapped = dbToUi(res.severity)
        if (mapped) severity.value = mapped
      }
    } finally {
      aiLoading.value = false
    }
  }

  function reset() {
    if (photo.value?.previewUrl) URL.revokeObjectURL(photo.value.previewUrl)
    photo.value = null
    aiResult.value = null
    aiLoading.value = false
    step.value = 1
    severity.value = 'partial'
    location.value = null
    infraType.value = null
    description.value = ''
    electricityStatus.value = ''
    healthStatus.value = ''
    communityNeeds.value = ''
    vulnerableGroups.value = ''
    submitPhase.value = 'idle'
    reportId.value = null
    photoError.value = false
    Object.keys(errors).forEach(k => delete errors[k])
  }

  return {
    step, photo, aiResult, aiLoading, severity, location, infraType,
    description, electricityStatus, healthStatus, communityNeeds, vulnerableGroups,
    submitPhase, reportId, photoError, errors,
    submit, reset, runAiClassify,
  }
}
