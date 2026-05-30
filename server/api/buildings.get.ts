import * as v from 'valibot'
import { getDb } from '../utils/db'
import { BBOX_REGEX, parseBbox } from '../utils/bbox'

// Building-footprint polygons for a crisis, as a GeoJSON FeatureCollection.
// Sourced from the PostGIS `buildings` table (loaded from Overture Maps per
// crisis bbox — see scripts/ingest-buildings.md). The dashboard renders these
// as the signature geographic overlay beneath the damage markers.
const QuerySchema = v.object({
  crisis_id: v.pipe(v.string(), v.uuid()),
  bbox: v.optional(v.pipe(v.string(), v.regex(BBOX_REGEX))),
})

const MAX_FEATURES = 60000

export default defineEventHandler(async (event) => {
  const result = v.safeParse(QuerySchema, getQuery(event))
  if (!result.success) {
    throw createError({ statusCode: 400, message: 'Invalid query parameters' })
  }
  const { crisis_id, bbox } = result.output

  const bboxEnv = bbox ? parseBbox(bbox) : null

  const db = getDb()
  const [row] = await db<{ fc: unknown }[]>`
    SELECT jsonb_build_object(
      'type', 'FeatureCollection',
      'features', coalesce(jsonb_agg(
        jsonb_build_object(
          'type', 'Feature',
          'geometry', ST_AsGeoJSON(geom)::jsonb,
          'properties', jsonb_build_object('id', id, 'height_m', height_m)
        )
      ), '[]'::jsonb)
    ) AS fc
    FROM (
      SELECT id, geom, height_m
      FROM buildings
      WHERE crisis_id = ${crisis_id}
        ${bboxEnv ? db`AND geom && ST_MakeEnvelope(${bboxEnv.w}, ${bboxEnv.s}, ${bboxEnv.e}, ${bboxEnv.n}, 4326)` : db``}
      LIMIT ${MAX_FEATURES}
    ) b
  `
  return row!.fc
})
