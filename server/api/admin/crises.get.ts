import { getDb } from '../../utils/db'
import { requireStaff } from '../../utils/requireStaff'

// Staff-only crisis list — includes INACTIVE zones (the public /api/crises filters to
// active). bbox is the numeric extent [west, south, east, north]; same shape the
// dashboard selector + reporter point-in-bbox attribution already consume.
export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const db = getDb()
  const rows = await db<{
    id: string
    name: string
    crisis_type: string
    is_active: boolean
    created_at: string
    bbox: [number, number, number, number] | null
  }[]>`
    SELECT id, name, crisis_type, is_active, created_at,
      CASE WHEN bbox IS NULL THEN NULL
        ELSE ARRAY[ST_XMin(bbox), ST_YMin(bbox), ST_XMax(bbox), ST_YMax(bbox)]
      END AS bbox
    FROM crises
    ORDER BY is_active DESC, created_at DESC
  `
  return rows
})
