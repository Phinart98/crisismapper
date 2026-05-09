// pluscodes ships CJS with __esModule + named exports and no default. Named
// imports trip Node ESM in production; default imports resolve to undefined
// under Vite SSR. Namespace import works in both.
import * as pluscodes from 'pluscodes'
const decodePlusCode = pluscodes.decode

const PLUS_CODE_RE = /[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}/i

export type GpsResult = { lng: number; lat: number; plusCode?: string; method: 'gps' | 'plus_code' }

export function useGeolocation() {
  const state = ref<'idle' | 'locating' | 'done' | 'denied'>('idle')
  const result = ref<GpsResult | null>(null)
  const inputText = ref('')

  async function requestGps(): Promise<void> {
    if (!navigator?.geolocation) {
      state.value = 'denied'
      return
    }
    state.value = 'locating'
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          result.value = { lng: pos.coords.longitude, lat: pos.coords.latitude, method: 'gps' }
          state.value = 'done'
          resolve()
        },
        () => {
          state.value = 'denied'
          resolve()
        },
        { enableHighAccuracy: true, timeout: 15000 }
      )
    })
  }

  // Landmark fallback removed; the previous hardcoded centroid was poisoning
  // every landmark_text row with identical coordinates.
  function resolveInput(text: string): GpsResult | null {
    const trimmed = text.trim()
    if (!trimmed) return null

    const plusMatch = trimmed.match(PLUS_CODE_RE)
    if (!plusMatch) return null

    const decoded = decodePlusCode(plusMatch[0].toUpperCase())
    if (!decoded) return null

    return {
      lng: decoded.longitude,
      lat: decoded.latitude,
      plusCode: plusMatch[0].toUpperCase(),
      method: 'plus_code',
    }
  }

  const inputError = ref(false)
  // Editing the input after a Plus Code resolution invalidates it — otherwise the
  // form would submit the previously confirmed coords while the visible text differs.
  watch(inputText, () => {
    inputError.value = false
    if (result.value?.method === 'plus_code') {
      result.value = null
      state.value = 'idle'
    }
  })

  function confirmInput(): boolean {
    const resolved = resolveInput(inputText.value)
    if (!resolved) {
      inputError.value = true
      return false
    }
    inputError.value = false
    result.value = resolved
    state.value = 'done'
    return true
  }

  function reset() {
    state.value = 'idle'
    result.value = null
    inputText.value = ''
    inputError.value = false
  }

  return { state, result, inputText, inputError, requestGps, confirmInput, reset }
}
