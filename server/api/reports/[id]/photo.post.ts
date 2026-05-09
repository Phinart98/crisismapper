import { randomBytes } from 'node:crypto'
import * as v from 'valibot'
import { getDb } from '../../../utils/db'
import { getSupabaseAdmin } from '../../../utils/supabaseAdmin'

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

  const allowedTypes = ['image/webp', 'image/jpeg', 'image/png']
  const mime = filePart.type ?? ''
  if (!allowedTypes.includes(mime) || !hasImageMagicBytes(filePart.data, mime)) {
    throw createError({ statusCode: 415, message: 'Unsupported image type' })
  }
  if (filePart.data.length > 524288) {
    throw createError({ statusCode: 413, message: 'Photo exceeds 512 KB limit' })
  }

  // Per-request random suffix + upsert:false guarantees that a known reportId
  // can never overwrite an existing photo's bytes via a TOCTOU race against the
  // gated UPDATE below. The unguessable path also stops UUID-enumeration of photos.
  const supabase = getSupabaseAdmin()
  const path = `reports/${reportId}-${randomBytes(8).toString('hex')}.webp`
  const { error: uploadError } = await supabase.storage
    .from('damage-photos')
    .upload(path, filePart.data, { contentType: 'image/webp', upsert: false })

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
      AND submitted_at > now() - interval '10 minutes'
  `
  if (result.count === 0) {
    // Roll back the upload so we don't park an orphan in a public bucket.
    await supabase.storage.from('damage-photos').remove([path])
    throw createError({ statusCode: 404, message: 'Report not found, already has a photo, or upload window expired' })
  }

  return { photo_url: publicUrl }
})

// Magic-byte check: don't trust client-supplied Content-Type alone.
function hasImageMagicBytes(buf: Buffer, mime: string): boolean {
  if (buf.length < 12) return false
  if (mime === 'image/jpeg') return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
  if (mime === 'image/png') return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
  if (mime === 'image/webp') {
    return buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP'
  }
  return false
}
