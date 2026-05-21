import { readFile } from 'node:fs/promises'
import { ALLOWED_IMAGE_MIMES, hasImageMagicBytes } from './imageMagic'

const MAX_BYTES = 524288 // 512 KB — same cap as PWA pipeline
const GRAPH_VERSION = 'v22.0'
const FETCH_TIMEOUT_MS = 5000

export interface MediaPayload {
  buf: Buffer
  mime: string
}

// Two-step Meta Graph media download. Step 1 returns a 5-min signed CDN URL;
// step 2 fetches the raw bytes. Both require the WABA bearer.
//
// Test mode: when NUXT_TEST_WA_MEDIA_FIXTURE_PATH is set, treat any mediaId
// starting with 'fixture_' as a local-file pointer and skip Meta entirely.
// Scoped to dev/test runs — production never sets that env.
export async function downloadMedia(mediaId: string): Promise<MediaPayload> {
  const fixturePath = process.env.NUXT_TEST_WA_MEDIA_FIXTURE_PATH
  if (fixturePath && mediaId.startsWith('fixture_')) {
    const buf = await readFile(fixturePath)
    if (buf.length > MAX_BYTES) throw new Error('fixture exceeds 512 KB cap')
    const mime = sniffMime(buf)
    if (!mime) throw new Error('fixture is not a supported image')
    return { buf, mime }
  }

  const { metaWabaToken } = useRuntimeConfig()
  if (!metaWabaToken) throw new Error('metaWabaToken missing — cannot download media')

  const metaUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(mediaId)}`
  const metaResp = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${metaWabaToken}` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!metaResp.ok) throw new Error(`media metadata fetch failed: ${metaResp.status}`)
  const meta = (await metaResp.json()) as { url?: string; mime_type?: string; file_size?: number }
  if (!meta.url || !meta.mime_type) throw new Error('media metadata missing url/mime_type')
  if (!ALLOWED_IMAGE_MIMES.includes(meta.mime_type as typeof ALLOWED_IMAGE_MIMES[number])) {
    throw new Error(`unsupported mime: ${meta.mime_type}`)
  }
  if (typeof meta.file_size === 'number' && meta.file_size > MAX_BYTES) {
    throw new Error(`media exceeds 512 KB cap (${meta.file_size} bytes)`)
  }

  const bytesResp = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${metaWabaToken}` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!bytesResp.ok) throw new Error(`media bytes fetch failed: ${bytesResp.status}`)
  const buf = Buffer.from(await bytesResp.arrayBuffer())
  if (buf.length > MAX_BYTES) throw new Error(`media exceeds 512 KB cap after download`)

  // Defense in depth: Meta said it was a webp/jpeg/png, but verify the bytes match
  // before handing off to Sharp / classifier downstream.
  if (!hasImageMagicBytes(buf, meta.mime_type)) {
    throw new Error(`media bytes do not match declared mime ${meta.mime_type}`)
  }

  return { buf, mime: meta.mime_type }
}

function sniffMime(buf: Buffer): string | null {
  for (const m of ALLOWED_IMAGE_MIMES) {
    if (hasImageMagicBytes(buf, m)) return m
  }
  return null
}
