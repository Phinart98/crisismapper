import { randomBytes } from 'node:crypto'
import * as v from 'valibot'
import { getDb } from '../../../utils/db'
import { getSupabaseAdmin } from '../../../utils/supabaseAdmin'
import { ALLOWED_IMAGE_MIMES, hasImageMagicBytes } from '../../../utils/imageMagic'
import { stripExif } from '../../../utils/sharpStrip'

export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, 'id')
  const idResult = v.safeParse(v.pipe(v.string(), v.uuid()), rawId)
  if (!idResult.success) {
    throw createError({ statusCode: 400, message: 'Invalid report id' })
  }
  const reportId = idResult.output

  const parts = await readMultipartFormData(event)
  if (!parts || parts.length === 0) {
    throw createError({ statusCode: 400, message: 'No file uploaded' })
  }

  const filePart = parts.find(p => p.name === 'photo')
  const hashPart = parts.find(p => p.name === 'photo_hash')
  if (!filePart?.data) throw createError({ statusCode: 400, message: 'No photo part' })

  const mime = filePart.type ?? ''
  if (!ALLOWED_IMAGE_MIMES.includes(mime as typeof ALLOWED_IMAGE_MIMES[number]) || !hasImageMagicBytes(filePart.data, mime)) {
    throw createError({ statusCode: 415, message: 'Unsupported image type' })
  }
  if (filePart.data.length > 524288) {
    throw createError({ statusCode: 413, message: 'Photo exceeds 512 KB limit' })
  }

  // Defense in depth: strip EXIF server-side even though browser-image-compression
  // re-encodes to WebP on the client (which discards most metadata). The server-side
  // strip is the durable guarantee in case any client uploads an image that still
  // carries EXIF GPS.
  const cleaned = await stripExif(filePart.data)

  // Per-request random suffix + upsert:false guarantees that a known reportId
  // can never overwrite an existing photo's bytes via a TOCTOU race against the
  // gated UPDATE below. The unguessable path also stops UUID-enumeration of photos.
  const supabase = getSupabaseAdmin()
  const path = `reports/${reportId}-${randomBytes(8).toString('hex')}.webp`
  const { error: uploadError } = await supabase.storage
    .from('damage-photos')
    .upload(path, cleaned, { contentType: 'image/webp', upsert: false })

  if (uploadError) {
    throw createError({ statusCode: 502, message: uploadError.message })
  }

  const { data: { publicUrl } } = supabase.storage
    .from('damage-photos')
    .getPublicUrl(path)

  const photoHashHex = hashPart?.data ? Buffer.from(hashPart.data).toString('utf8').trim() : null

  const db = getDb()
  const result = await db`
    UPDATE damage_reports
    SET photo_url = ${publicUrl},
        photo_hash = ${photoHashHex ? Buffer.from(photoHashHex, 'hex') : null}
    WHERE id = ${reportId}
      AND photo_url IS NULL
      AND submitted_at > now() - interval '72 hours'
  `
  if (result.count === 0) {
    // Roll back the upload so we don't park an orphan in a public bucket.
    await supabase.storage.from('damage-photos').remove([path])
    throw createError({ statusCode: 404, message: 'Report not found, already has a photo, or upload window expired' })
  }

  return { photo_url: publicUrl }
})
