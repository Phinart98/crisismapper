import type { UiSeverity } from '~/utils/severity'
import type { GpsResult } from '~/composables/useGeolocation'
import type { PhotoResult } from '~/composables/usePhotoPipeline'

export type InfraType = 'building' | 'road' | 'bridge' | 'hospital' | 'school' | 'utility' | 'other'
export type SubmitPhase = 'idle' | 'metadata' | 'photo' | 'done' | 'error'

export function useReportForm() {
  const { public: { demoCrisisId } } = useRuntimeConfig()

  // Step state
  const step = ref(1)

  // Step 1 — photo
  const photo = ref<PhotoResult | null>(null)

  // Step 2 — severity (user confirms or overrides)
  const severity = ref<UiSeverity>('partial')

  // Step 3 — location
  const location = ref<GpsResult | null>(null)

  // Step 4 — infra
  const infraType = ref<InfraType | null>(null)

  // Step 5 — extras
  const description = ref('')
  const electricityStatus = ref('')
  const healthStatus = ref('')
  const communityNeeds = ref('')
  const vulnerableGroups = ref('')

  // Submit
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
    const body = {
      crisis_id: demoCrisisId,
      severity: severity.value,
      infrastructure_type: infraType.value,
      location: [loc.lng, loc.lat],
      location_method: loc.method,
      plus_code: loc.plusCode,
      location_landmark: loc.method === 'landmark_text' ? (loc.landmark ?? '') : undefined,
      description: description.value || undefined,
      electricity_status: electricityStatus.value || undefined,
      health_status: healthStatus.value || undefined,
      community_needs: communityNeeds.value || undefined,
      vulnerable_groups: vulnerableGroups.value || undefined,
    }

    try {
      const res = await $fetch<{ id: string }>('/api/reports', { method: 'POST', body })
      reportId.value = res.id
    } catch {
      submitPhase.value = 'error'
      return
    }

    // Phase 2: upload photo
    submitPhase.value = 'photo'
    photoError.value = false
    await uploadPhoto()
  }

  async function uploadPhoto() {
    if (!photo.value || !reportId.value) return
    const fd = new FormData()
    fd.append('photo', photo.value.webpBlob, 'photo.webp')
    fd.append('photo_hash', photo.value.hashHex)

    try {
      await $fetch(`/api/reports/${reportId.value}/photo`, { method: 'POST', body: fd })
      submitPhase.value = 'done'
    } catch {
      photoError.value = true
      submitPhase.value = 'done' // still show confirm — metadata is in DB
    }
  }

  function reset() {
    if (photo.value?.previewUrl) URL.revokeObjectURL(photo.value.previewUrl)
    photo.value = null
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
    step, photo, severity, location, infraType,
    description, electricityStatus, healthStatus, communityNeeds, vulnerableGroups,
    submitPhase, reportId, photoError, errors,
    submit, uploadPhoto, reset,
  }
}
