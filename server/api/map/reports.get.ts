import * as v from 'valibot'
import { getDb } from '../../utils/db'

// GeoJSON FeatureCollection of damage-report points for the dashboard map.
// Minimal properties only — the map colors by `severity` and the feed needs
// infrastructure_type + submitted_at. Photo + AI reasoning are fetched per-marker
// on click via /api/reports/[id] (the anon path deliberately can't see photos).
//
// The dashboard fetches the CURRENT VIEWPORT (`bbox`) and refetches on pan/zoom,
// capped at MAX_FEATURES. This bounds payload + query time regardless of total
// crisis size (50K–500K): a single unbounded fetch of 500K rows is ~180 MB and
// multi-second, so we never ship the whole set at once. Honest totals come from
// /api/map/stats (real count) — the map renders the in-view sample, clustered.
// `since` powers the polling fallback (delta fetch).
const QuerySchema = v.object({
  crisis_id: v.pipe(v.string(), v.uuid()),
  since: v.optional(v.pipe(v.string(), v.isoTimestamp())),
  // "minLng,minLat,maxLng,maxLat"
  bbox: v.optional(v.pipe(v.string(), v.regex(/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/))),
})

const MAX_FEATURES = 25000

export default defineEventHandler(async (event) => {
  const result = v.safeParse(QuerySchema, getQuery(event))
  if (!result.success) {
    throw createError({ statusCode: 400, message: 'Invalid query parameters' })
  }
  const { crisis_id, since, bbox } = result.output

  const bboxEnv = bbox
    ? (() => {
        const [w, s, e, n] = bbox.split(',').map(Number) as [number, number, number, number]
        return { w, s, e, n }
      })()
    : null

  const db = getDb()
  // Build the FeatureCollection in Postgres — ST_AsGeoJSON encodes geometry
  // server-side and jsonb_agg returns a single row. The inner LIMIT caps how
  // many rows are scanned/encoded so payload + time stay bounded.
  const [row] = await db<{ fc: unknown }[]>`
    SELECT jsonb_build_object(
      'type', 'FeatureCollection',
      'features', coalesce(jsonb_agg(
        jsonb_build_object(
          'type', 'Feature',
          'geometry', ST_AsGeoJSON(location)::jsonb,
          'properties', jsonb_build_object(
            'id', id,
            'severity', severity,
            'infrastructure_type', infrastructure_type,
            'submitted_at', submitted_at
          )
        )
      ), '[]'::jsonb)
    ) AS fc
    FROM (
      SELECT id, location, severity, infrastructure_type, submitted_at
      FROM damage_reports
      WHERE crisis_id = ${crisis_id}
        AND is_duplicate = false
        ${since ? db`AND submitted_at > ${since}` : db``}
        ${bboxEnv ? db`AND location && ST_MakeEnvelope(${bboxEnv.w}, ${bboxEnv.s}, ${bboxEnv.e}, ${bboxEnv.n}, 4326)` : db``}
      ORDER BY submitted_at DESC
      LIMIT ${MAX_FEATURES}
    ) r
  `
  return row!.fc
})
