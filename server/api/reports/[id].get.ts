import * as v from 'valibot'
import { getDb } from '../../utils/db'
import { getStaffUser } from '../../utils/requireStaff'
import { snappedLocation, fuzzedTime } from '../../utils/privacy'

// Single-report detail for the dashboard marker modal.
//
// PRIVACY GATE (Phase 11): this is the gate the Phase 10 comment anticipated. Staff
// sessions get the full row — photo_url, exact lat/lng, free-text description, and the
// reporter's trust tier. Anonymous callers get a REDACTED payload: severity / class /
// infrastructure only, coordinates snapped to a ~100m grid, timestamp fuzzed to the hour,
// and NO photo, description, or reporter info (all PII / sensitive ground-truth per UNDP
// Q16/Q18). The route reads via the privileged pooler (bypasses RLS), so the redaction is
// enforced here in the projection — by session, not by Postgres role.
export default defineEventHandler(async (event) => {
  const idResult = v.safeParse(v.pipe(v.string(), v.uuid()), getRouterParam(event, 'id'))
  if (!idResult.success) {
    throw createError({ statusCode: 400, message: 'Invalid report id' })
  }

  const staff = await getStaffUser(event)
  const db = getDb()

  if (staff) {
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
  }

  // Anonymous: redacted + aggregated. No photo_url, description, AI reasoning, or
  // reporter — snapped coordinates and hour-truncated time only.
  const [row] = await db<Record<string, unknown>[]>`
    SELECT
      id,
      severity,
      damage_classification,
      infrastructure_type,
      ${fuzzedTime(db)}            AS submitted_at,
      ai_confidence,
      is_verified,
      ST_Y(${snappedLocation(db)}) AS lat,
      ST_X(${snappedLocation(db)}) AS lng
    FROM damage_reports
    WHERE id = ${idResult.output}
  `
  if (!row) {
    throw createError({ statusCode: 404, message: 'Report not found' })
  }
  return row
})
