import * as v from 'valibot'
import { requireAdmin } from '../utils/requireAdmin'

// Custom Language Pack pathway (Phase 8 / Q3). Proxies missing i18n keys to a
// self-hostable LibreTranslate instance (Apache-2.0, offline-capable) so an
// operator can bootstrap a new locale, then review + commit the result.
// The legit master is <200 keys; cap well above that but bounded so the endpoint
// can't be driven into unbounded MT cost/memory even by an authenticated caller.
const MAX_KEYS = 500
const MAX_LEN = 5000

const Schema = v.object({
  // ISO 639 code (+ optional region), e.g. 'sw', 'bn', 'pt-BR'.
  target: v.pipe(v.string(), v.regex(/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/)),
  // English master strings keyed by i18n key — only the keys still missing in the pack.
  keys: v.pipe(
    v.record(v.string(), v.pipe(v.string(), v.maxLength(MAX_LEN))),
    v.check((k) => Object.keys(k).length <= MAX_KEYS, `Too many keys (max ${MAX_KEYS})`),
  ),
})

// {placeholders} (e.g. "Reporter #{n}") must survive MT untouched. Mask them with
// sentinels the engine won't translate, then restore on the way out.
const PLACEHOLDER = /\{[^}]+\}/g
function mask(s: string) {
  const found: string[] = []
  const masked = s.replace(PLACEHOLDER, (m) => {
    found.push(m)
    return `⟦${found.length - 1}⟧`
  })
  return { masked, found }
}
function unmask(s: string, found: string[]) {
  return s.replace(/⟦(\d+)⟧/g, (_, i) => found[Number(i)] ?? '')
}

export default defineEventHandler(async (event) => {
  // Gate the MT proxy — an unauthenticated translate endpoint is a cost/abuse vector.
  requireAdmin(event)
  const cfg = useRuntimeConfig(event)

  const parsed = v.safeParse(Schema, await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid translate request' })
  }
  const { target, keys } = parsed.output

  const entries = Object.entries(keys)
  if (!entries.length) return { translations: {}, engine: 'libretranslate', failed: [] }

  const base = (cfg.libreTranslateUrl || 'http://localhost:5000').replace(/\/$/, '')
  const translations: Record<string, string> = {}
  const failed: string[] = []

  // Chunk to stay well under the public sustained rate (~20 req/min) and the
  // 2000-char/call cap; LibreTranslate accepts `q` as an array, so one call
  // covers many strings.
  const CHUNK = 20
  for (let i = 0; i < entries.length; i += CHUNK) {
    const slice = entries.slice(i, i + CHUNK)
    const masked = slice.map(([, en]) => mask(en))
    try {
      const res = await $fetch<{ translatedText: string[] }>(`${base}/translate`, {
        method: 'POST',
        body: {
          q: masked.map((m) => m.masked),
          source: 'en',
          target,
          format: 'text',
          ...(cfg.libreTranslateApiKey ? { api_key: cfg.libreTranslateApiKey } : {}),
        },
        timeout: 20_000,
      })
      const out = res.translatedText
      slice.forEach(([key], j) => {
        const t = Array.isArray(out) ? out[j] : undefined
        if (typeof t === 'string') translations[key] = unmask(t, masked[j]!.found)
        else failed.push(key)
      })
    } catch (err) {
      // Engine unreachable on the very first chunk → hard 503 so the UI can offer
      // the manual-upload fallback. Later partial failures are reported per-key.
      if (i === 0) {
        throw createError({
          statusCode: 503,
          message: `Translation engine unavailable at ${base}. Start a LibreTranslate instance or set NUXT_LIBRE_TRANSLATE_URL.`,
        })
      }
      slice.forEach(([key]) => failed.push(key))
    }
  }

  return { translations, engine: 'libretranslate', failed }
})
