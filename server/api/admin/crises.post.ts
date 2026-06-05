import * as v from 'valibot'
import { getDb } from '../../utils/db'
import { requireStaff } from '../../utils/requireStaff'
import { BboxTuple } from '../../utils/bbox'
import { HAZARD_TYPES } from '~/utils/severity'

// crisis_type is a free TEXT column (no DB enum); validating against HAZARD_TYPES (the
// shared hazard vocabulary the dashboard can label) keeps a created crisis renderable.
const CreateSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
  crisis_type: v.picklist(HAZARD_TYPES),
  bbox: BboxTuple, // [west, south, east, north] — the same extent shape /api/crises emits.
})

export default defineEventHandler(async (event) => {
  await requireStaff(event)

  const parsed = v.safeParse(CreateSchema, await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid crisis data' })
  }
  const { name, crisis_type, bbox: [w, s, e, n] } = parsed.output

  const db = getDb()
  const [row] = await db<{ id: string }[]>`
    INSERT INTO crises (name, crisis_type, bbox, is_active)
    VALUES (${name}, ${crisis_type}, ST_MakeEnvelope(${w}, ${s}, ${e}, ${n}, 4326), true)
    RETURNING id
  `
  setResponseStatus(event, 201)
  return { id: row!.id }
})
