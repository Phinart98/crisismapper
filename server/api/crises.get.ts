import { getDb } from '../utils/db'

// Active crises for the dashboard selector + reporter location-based assignment.
// bbox is the numeric extent [west, south, east, north] (decimal degrees) — small
// enough to cache client-side for offline point-in-bbox crisis resolution.
export default defineEventHandler(async () => {
  const db = getDb()
  const rows = await db<{
    id: string
    name: string
    crisis_type: string
    bbox: [number, number, number, number] | null
  }[]>`
    SELECT id, name, crisis_type,
      CASE WHEN bbox IS NULL THEN NULL
        ELSE ARRAY[ST_XMin(bbox), ST_YMin(bbox), ST_XMax(bbox), ST_YMax(bbox)]
      END AS bbox
    FROM crises
    WHERE is_active = true
    ORDER BY created_at DESC
  `
  return rows
})
