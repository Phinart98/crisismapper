import { classifyDamage } from '../../utils/aiVision'
import { ALLOWED_IMAGE_MIMES, hasImageMagicBytes } from '../../utils/imageMagic'
import { stripExif } from '../../utils/sharpStrip'

export default defineEventHandler(async (event) => {
  const parts = await readMultipartFormData(event)
  if (!parts || parts.length === 0) {
    throw createError({ statusCode: 400, message: 'No file uploaded' })
  }

  const filePart = parts.find(p => p.name === 'photo')
  if (!filePart?.data) throw createError({ statusCode: 400, message: 'No photo part' })

  const mime = filePart.type ?? ''
  if (!ALLOWED_IMAGE_MIMES.includes(mime as typeof ALLOWED_IMAGE_MIMES[number]) || !hasImageMagicBytes(filePart.data, mime)) {
    throw createError({ statusCode: 415, message: 'Unsupported image type' })
  }
  if (filePart.data.length > 524288) {
    throw createError({ statusCode: 413, message: 'Photo exceeds 512 KB limit' })
  }

  const cleaned = await stripExif(filePart.data)
  const result = await classifyDamage(cleaned)
  return result
})
