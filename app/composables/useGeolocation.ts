import { decode as decodePlusCode } from 'pluscodes'

const PLUS_CODE_RE = /[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}/i

export type GpsResult = { lng: number; lat: number; plusCode?: string; landmark?: string; method: 'gps' | 'plus_code' | 'landmark_text' }

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

  function resolveInput(text: string): GpsResult | null {
    const trimmed = text.trim()
    if (!trimmed) return null

    const plusMatch = trimmed.match(PLUS_CODE_RE)
    if (plusMatch) {
      const decoded = decodePlusCode(plusMatch[0].toUpperCase())
      if (decoded) {
        return {
          lng: decoded.longitude,
          lat: decoded.latitude,
          plusCode: plusMatch[0].toUpperCase(),
          method: 'plus_code',
        }
      }
    }

    // Landmark fallback: use demo crisis centroid (Mandalay bbox center)
    return { lng: 96.15, lat: 21.85, landmark: trimmed, method: 'landmark_text' }
  }

  function confirmInput(): boolean {
    const resolved = resolveInput(inputText.value)
    if (!resolved) return false
    result.value = resolved
    state.value = 'done'
    return true
  }

  function reset() {
    state.value = 'idle'
    result.value = null
    inputText.value = ''
  }

  return { state, result, inputText, requestGps, confirmInput, reset }
}
