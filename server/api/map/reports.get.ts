import * as v from 'valibot'
import { getDb } from '../../utils/db'
import { BBOX_REGEX, parseBbox } from '../../utils/bbox'
import { getStaffUser } from '../../utils/requireStaff'
import { snappedLocation, fuzzedTime } from '../../utils/privacy'

// GeoJSON FeatureCollection of damage-report points for the dashboard map.
// Minimal properties only — the map colors by `severity` and the feed needs
// infrastructure_type + submitted_at. Photo + AI reasoning are fetched per-marker
// on click via /api/reports/[id] (the anon path deliberately can't see photos).
//
// PRIVACY SPLIT (Phase 11): staff sessions get exact coordinates; anon gets locations
// snapped to a ~100m grid + timestamps fuzzed to the hour (UNDP Q16/Q18). This endpoint
// reads the base table via the privileged pooler (bypassing RLS), so the aggregation is
// applied here in SQL — the crisis_reports_public view's snapping covers the separate
// anon-key/PostgREST path, not this one.
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
  bbox: v.optional(v.pipe(v.string(), v.regex(BBOX_REGEX))),
  // Caller-supplied cap (e.g. the landing ticker only needs the latest few) — clamped to
  // MAX_FEATURES so it can only ever shrink the payload, never enlarge it.
  limit: v.optional(v.pipe(v.unknown(), v.transform(Number), v.number(), v.integer(), v.minValue(1))),
})

const MAX_FEATURES = 25000

export default defineEventHandler(async (event) => {
  const result = v.safeParse(QuerySchema, getQuery(event))
  if (!result.success) {
    throw createError({ statusCode: 400, message: 'Invalid query parameters' })
  }
  const { crisis_id, since, bbox, limit } = result.output
  const effectiveLimit = Math.min(limit ?? MAX_FEATURES, MAX_FEATURES)

  const bboxEnv = bbox ? parseBbox(bbox) : null

  const staff = await getStaffUser(event)
  const db = getDb()
  // Exact for staff; snapped to a ~100m grid + hour-truncated for anon.
  const geom = staff ? db`location` : snappedLocation(db)
  const ts = staff ? db`submitted_at` : fuzzedTime(db)

  // Build the FeatureCollection in Postgres — ST_AsGeoJSON encodes geometry
  // server-side and jsonb_agg returns a single row. The inner LIMIT caps how
  // many rows are scanned/encoded so payload + time stay bounded.
  const [row] = await db<{ fc: unknown }[]>`
    SELECT jsonb_build_object(
      'type', 'FeatureCollection',
      'features', coalesce(jsonb_agg(
        jsonb_build_object(
          'type', 'Feature',
          'geometry', ST_AsGeoJSON(geom)::jsonb,
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
      SELECT id, ${geom} AS geom, severity, infrastructure_type, ${ts} AS submitted_at
      FROM damage_reports
      WHERE crisis_id = ${crisis_id}
        AND is_duplicate = false
        ${since ? db`AND submitted_at > ${since}` : db``}
        ${bboxEnv ? db`AND location && ST_MakeEnvelope(${bboxEnv.w}, ${bboxEnv.s}, ${bboxEnv.e}, ${bboxEnv.n}, 4326)` : db``}
      ORDER BY submitted_at DESC
      LIMIT ${effectiveLimit}
    ) r
  `
  return row!.fc
})
