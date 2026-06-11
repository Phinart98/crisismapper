import * as v from 'valibot'
import { getDb } from '../utils/db'
import { hashDeviceId } from '../utils/resolveReporter'
import { nicknameForReporter } from '../utils/nickname'
import { snappedLocation, fuzzedTime, CELL_KM2 } from '../utils/privacy'

// Reporter self-profile for /me. POST (not GET) so the device id stays out of URLs/logs.
// Looks the reporter up by the one-way device hash — never creates a row (a read must not
// have side effects), so a device that has not reported yet returns { found: false } and
// the page shows an onboarding state.
//
// Privacy: the payload is the reporter's OWN data, keyed by their own device — no other
// reporter is exposed. Coordinates are never returned; "impact" is reduced to a count of
// distinct ~100m zones (and the derived km²), and recent reports carry only
// severity/class/infra/hour, never location or photo.
const BodySchema = v.object({ device_id: v.pipe(v.string(), v.uuid()) })

export default defineEventHandler(async (event) => {
  const result = v.safeParse(BodySchema, await readBody(event))
  if (!result.success) {
    throw createError({ statusCode: 400, message: 'Invalid request' })
  }

  const hash = hashDeviceId(result.output.device_id)
  if (!hash) return { found: false }

  const db = getDb()
  const [reporter] = await db<{ id: string; badges: string[]; trust_tier: string }[]>`
    SELECT id, badges, trust_tier FROM reporters WHERE device_hash = ${hash}
  `
  if (!reporter) return { found: false }

  const [[totals], [primary], recent] = await Promise.all([
    db<{ total: number; verified: number; zones: number }[]>`
      SELECT
        count(*) FILTER (WHERE NOT is_duplicate)::int                               AS total,
        count(*) FILTER (WHERE NOT is_duplicate AND is_verified)::int               AS verified,
        count(DISTINCT ${snappedLocation(db)})
          FILTER (WHERE NOT is_duplicate)::int                                      AS zones
      FROM damage_reports WHERE reporter_id = ${reporter.id}
    `,
    db<{ name: string }[]>`
      SELECT c.name
      FROM damage_reports dr JOIN crises c ON c.id = dr.crisis_id
      WHERE dr.reporter_id = ${reporter.id} AND dr.is_duplicate = false
      GROUP BY c.name
      ORDER BY count(*) DESC
      LIMIT 1
    `,
    db<Record<string, unknown>[]>`
      SELECT
        id, severity, damage_classification, infrastructure_type,
        ${fuzzedTime(db)} AS submitted_at, is_verified
      FROM damage_reports
      WHERE reporter_id = ${reporter.id} AND is_duplicate = false
      ORDER BY submitted_at DESC
      LIMIT 5
    `,
  ])

  const zones = totals?.zones ?? 0
  return {
    found: true,
    nickname: nicknameForReporter(reporter.id),
    trust_tier: reporter.trust_tier,
    badges: reporter.badges ?? [],
    total: totals?.total ?? 0,
    verified: totals?.verified ?? 0,
    zones,
    impact_km2: Math.round(zones * CELL_KM2 * 100) / 100,
    crisis_name: primary?.name ?? null,
    recent,
  }
})
