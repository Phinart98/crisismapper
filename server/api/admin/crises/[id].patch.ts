import * as v from 'valibot'
import { getDb } from '../../../utils/db'
import { requireStaff } from '../../../utils/requireStaff'
import { BboxTuple } from '../../../utils/bbox'
import { HAZARD_TYPES } from '~/utils/severity'

// Partial update — every field optional. activate/deactivate is just is_active here.
const PatchSchema = v.object({
  name: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200))),
  crisis_type: v.optional(v.picklist(HAZARD_TYPES)),
  is_active: v.optional(v.boolean()),
  bbox: v.optional(BboxTuple),
})

export default defineEventHandler(async (event) => {
  await requireStaff(event)

  const idResult = v.safeParse(v.pipe(v.string(), v.uuid()), getRouterParam(event, 'id'))
  if (!idResult.success) {
    throw createError({ statusCode: 400, message: 'Invalid crisis id' })
  }
  const parsed = v.safeParse(PatchSchema, await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid crisis data' })
  }
  const d = parsed.output
  const hasBbox = d.bbox !== undefined
  const [w, s, e, n] = d.bbox ?? [0, 0, 0, 0]

  const db = getDb()
  // COALESCE leaves a column untouched when its field is omitted; the bbox CASE only
  // rebuilds the envelope when a new bbox was supplied (short-circuited otherwise).
  const [row] = await db<{ id: string }[]>`
    UPDATE crises SET
      name        = COALESCE(${d.name ?? null}, name),
      crisis_type = COALESCE(${d.crisis_type ?? null}, crisis_type),
      is_active   = COALESCE(${d.is_active ?? null}, is_active),
      bbox        = CASE WHEN ${hasBbox}
                         THEN ST_MakeEnvelope(${w}, ${s}, ${e}, ${n}, 4326)
                         ELSE bbox END
    WHERE id = ${idResult.output}
    RETURNING id
  `
  if (!row) {
    throw createError({ statusCode: 404, message: 'Crisis not found' })
  }
  return { id: row.id }
})
