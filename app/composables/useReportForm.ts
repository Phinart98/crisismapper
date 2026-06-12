import type { InfraType, UiSeverity } from '~/utils/severity'
import { dbToUi } from '~/utils/severity'
import type { GpsResult } from '~/composables/useGeolocation'
import type { PhotoResult } from '~/composables/usePhotoPipeline'
import type { ClassifyResult } from '~/utils/aiClassify'
import { isAiUsable } from '~/utils/aiClassify'
import { classifyPhoto } from '~/utils/classifyPhoto'
import { useOfflineQueue } from '~/composables/useOfflineQueue'
import { useActiveCrises } from '~/composables/useActiveCrises'

export type SubmitPhase = 'idle' | 'metadata' | 'photo' | 'queued' | 'done' | 'error'

export function useReportForm() {
  const queue = useOfflineQueue()
  const { crises, loaded, load: loadCrises, containingCrises } = useActiveCrises()
  onMounted(loadCrises)

  const step = ref(1)
  const photo = ref<PhotoResult | null>(null)
  const aiResult = ref<ClassifyResult | null>(null)
  const aiLoading = ref(false)
  const severity = ref<UiSeverity>('partial')
  const location = ref<GpsResult | null>(null)
  const infraType = ref<InfraType | null>(null)

  // Which crisis this report belongs to. Empty until the reporter's GPS resolves —
  // never pre-filled, so the UI can't show a far-away crisis as a misleading default.
  // `crisisManual` marks an explicit picker override among containing zones.
  const crisisId = ref<string>('')
  const crisisManual = ref(false)
  const crisisOutsideZones = ref(false)

  // Strict geofence: the picker only ever offers zones containing the located point
  // (Ghana can't report into Myanmar; the server enforces the same with a 422).
  const pickerCrises = computed(() => {
    const loc = location.value
    if (!loc) return []
    return containingCrises(loc.lat, loc.lng)
  })

  // Location confirmed but no active crisis zone covers it → the flow blocks with
  // the no-crisis notice instead of a picker.
  const noCrisisHere = computed(() =>
    loaded.value && !!location.value && pickerCrises.value.length === 0)

  watch(location, (loc) => {
    if (!loc) return
    const within = containingCrises(loc.lat, loc.lng)
    // A manual pick stays sticky only while it still contains the (new) location.
    if (crisisManual.value && within.some(c => c.id === crisisId.value)) return
    crisisManual.value = false
    if (within[0]) {
      crisisId.value = within[0].id
      crisisOutsideZones.value = false
    } else {
      crisisId.value = ''
      crisisOutsideZones.value = crises.value.length > 0
    }
  })

  const selectedCrisisName = computed(() => crises.value.find(c => c.id === crisisId.value)?.name ?? null)
  // Shared so chrome outside this component tree (the desktop sidebar) can show
  // the crisis the report will actually be attributed to.
  const sharedCrisisName = useState<string | null>('cm_report_crisis_name', () => null)
  watchEffect(() => { sharedCrisisName.value = selectedCrisisName.value })

  const description = ref('')
  const electricityStatus = ref('')
  const healthStatus = ref('')
  const communityNeeds = ref<string[]>([])
  const vulnerableGroups = ref<string[]>([])
  const affectedPopulation = ref('')

  const submitPhase = ref<SubmitPhase>('idle')
  const reportId = ref<string | null>(null)
  const photoError = ref(false)

  const errors = reactive<Record<string, boolean>>({})

  function validate(): boolean {
    errors.photo = !photo.value
    errors.location = !location.value || !crisisId.value
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
      crisis_id: crisisId.value,
      // Pseudonymous reporter id — rides inside the queued payload so it survives the
      // offline queue and is replayed verbatim on sync (trust accrues to this device).
      device_id: useDeviceId() ?? undefined,
      severity: severity.value,
      infrastructure_type: infraType.value!,
      location: [loc.lng, loc.lat] as [number, number],
      location_method: loc.method,
      plus_code: loc.plusCode,
      description: description.value || undefined,
      electricity_status: electricityStatus.value || undefined,
      health_status: healthStatus.value || undefined,
      community_needs: communityNeeds.value.length ? [...communityNeeds.value] : undefined,
      vulnerable_groups: vulnerableGroups.value.length ? [...vulnerableGroups.value] : undefined,
      affected_population: affectedPopulation.value || undefined,
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
      photoError.value = result.photoFailedIds.includes(myId)
      submitPhase.value = 'done'
    } else {
      // Foreground drain failed; register Android Background Sync so the OS
      // retries on next connectivity. Fire-and-forget: serviceWorker.ready
      // never settles when no SW is available (private mode, SW disabled),
      // so awaiting it would hang the queued confirmation forever.
      queue.registerBackgroundSync()
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

  function setCrisis(id: string) {
    crisisId.value = id
    crisisManual.value = true
    crisisOutsideZones.value = false
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
    crisisId.value = ''
    crisisManual.value = false
    crisisOutsideZones.value = false
    description.value = ''
    electricityStatus.value = ''
    healthStatus.value = ''
    communityNeeds.value = []
    vulnerableGroups.value = []
    affectedPopulation.value = ''
    submitPhase.value = 'idle'
    reportId.value = null
    photoError.value = false
    Object.keys(errors).forEach(k => delete errors[k])
  }

  return {
    step, photo, aiResult, aiLoading, severity, location, infraType,
    description, electricityStatus, healthStatus, communityNeeds, vulnerableGroups, affectedPopulation,
    submitPhase, reportId, photoError, errors,
    crises, pickerCrises, noCrisisHere, crisisId, crisisManual, crisisOutsideZones, selectedCrisisName, setCrisis,
    submit, reset, runAiClassify,
  }
}
