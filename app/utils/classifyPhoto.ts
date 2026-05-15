import type { ClassifyResult } from './aiClassify'

// Hard cap on how long the UI waits for a classification before giving up.
// Groq Scout typically lands in ~2 s, Gemini fallback adds another ~3 s, so 10 s
// covers a single provider failure plus a slow fallback while still letting the
// reporter move on if the network is fully dead.
const CLASSIFY_TIMEOUT_MS = 10_000

export async function classifyPhoto(blob: Blob): Promise<ClassifyResult | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CLASSIFY_TIMEOUT_MS)
  try {
    const fd = new FormData()
    fd.append('photo', blob, 'photo.webp')
    const res = await fetch('/api/ai/classify', {
      method: 'POST',
      body: fd,
      signal: controller.signal,
    })
    if (!res.ok) return null
    return await res.json() as ClassifyResult
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
