import * as v from 'valibot'
import { getDb } from '../../utils/db'

// Full single-report detail for the dashboard marker modal.
//
// Returns photo_url + AI reasoning + exact lat/lng. The anon Postgres view
// (crisis_reports_public) drops photo_url, so this server route — reading via dbUrl —
// is how the modal gets it. NOTE: still intentionally UNAUTHENTICATED. Phase 10 built
// staff auth + the crisis_reports_authenticated view, but DELIBERATELY left the anon
// read path unchanged; gating this route (exact data → staff only) + the ST_SnapToGrid
// public aggregation is deferred to Phase 11 (see snoopy-dazzling-tide.md Phase 11
// notes). Exposure is bounded meanwhile: photos are EXIF-stripped (no GPS leak) and the
// map already exposes exact coords via /api/map/reports. Path is by-UUID, not enumerable.
export default defineEventHandler(async (event) => {
  const idResult = v.safeParse(v.pipe(v.string(), v.uuid()), getRouterParam(event, 'id'))
  if (!idResult.success) {
    throw createError({ statusCode: 400, message: 'Invalid report id' })
  }

  const db = getDb()
  const [row] = await db<Record<string, unknown>[]>`
    SELECT
      damage_reports.id,
      severity,
      damage_classification,
      infrastructure_type,
      description,
      submitted_at,
      photo_url,
      ai_confidence,
      is_verified,
      ai_raw_response->>'reasoning'          AS ai_reasoning,
      ai_raw_response->'damage_indicators'   AS ai_damage_indicators,
      (ai_raw_response->>'damage_percentage')::numeric AS ai_damage_percentage,
      rep.trust_tier AS reporter_trust_tier,
      ST_Y(location) AS lat,
      ST_X(location) AS lng
    FROM damage_reports
    LEFT JOIN reporters rep ON rep.id = damage_reports.reporter_id
    WHERE damage_reports.id = ${idResult.output}
  `
  if (!row) {
    throw createError({ statusCode: 404, message: 'Report not found' })
  }
  return row
})
