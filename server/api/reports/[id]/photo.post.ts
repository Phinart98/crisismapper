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
  const mime = filePart.type ?? 'image/webp'
  if (!allowedTypes.includes(mime)) {
    throw createError({ statusCode: 415, message: 'Unsupported image type' })
  }
  if (filePart.data.length > 524288) {
    throw createError({ statusCode: 413, message: 'Photo exceeds 512 KB limit' })
  }

  const supabase = getSupabaseAdmin()
  const path = `reports/${reportId}.webp`
  const { error: uploadError } = await supabase.storage
    .from('damage-photos')
    .upload(path, filePart.data, { contentType: 'image/webp', upsert: true })

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
  `
  if (result.count === 0) {
    throw createError({ statusCode: 404, message: 'Report not found' })
  }

  return { photo_url: publicUrl }
})
