import * as v from 'valibot'
import { getDb } from '../utils/db'
import { hashDeviceId } from '../utils/resolveReporter'
import { nicknameForReporter } from '../utils/nickname'

// Anonymous reporter leaderboard. Aggregates per reporter (non-duplicate report count +
// earned-badge count + trust tier) for one crisis or all-time. The reporter UUID NEVER
// leaves the server — it's used only to derive the deterministic nickname and (when the
// caller passes their own device_id) to flag the "YOU" row. No coordinates, photos,
// descriptions, or device hashes are exposed.
//
// POST (not GET) so the caller's device_id stays out of URLs / access logs / Referer —
// same data-minimization posture as /api/me. The body carries scope + crisis_id + the
// optional device_id.
const BodySchema = v.object({
  scope: v.optional(v.picklist(['crisis', 'all']), 'crisis'),
  crisis_id: v.optional(v.pipe(v.string(), v.uuid())),
  device_id: v.optional(v.pipe(v.string(), v.uuid())),
})

const LIMIT = 50

interface Row {
  id: string
  badges: string[] | null
  trust_tier: string
  reports: number
  area: string | null
  multi_crisis: boolean
}

export default defineEventHandler(async (event) => {
  const result = v.safeParse(BodySchema, await readBody(event))
  if (!result.success) {
    throw createError({ statusCode: 400, message: 'Invalid request' })
  }
  const { scope, crisis_id, device_id } = result.output
  if (scope === 'crisis' && !crisis_id) {
    throw createError({ statusCode: 400, message: 'crisis_id required for crisis scope' })
  }

  const db = getDb()

  // The caller's reporter id (for the "YOU" flag) is independent of the ranking, so run
  // both round-trips concurrently. The id never leaves the server — it's only compared below.
  const hash = device_id ? hashDeviceId(device_id) : null
  const myIdQuery = hash
    ? db<{ id: string }[]>`SELECT id FROM reporters WHERE device_hash = ${hash}`.then(r => r[0]?.id ?? null)
    : Promise.resolve(null)

  const rowsQuery = scope === 'crisis'
    ? db<Row[]>`
        SELECT r.id, r.badges, r.trust_tier,
               count(dr.*)::int AS reports,
               c.name           AS area,
               false            AS multi_crisis
        FROM reporters r
        JOIN damage_reports dr
          ON dr.reporter_id = r.id AND dr.is_duplicate = false AND dr.crisis_id = ${crisis_id!}
        JOIN crises c ON c.id = ${crisis_id!}
        GROUP BY r.id, r.badges, r.trust_tier, c.name
        ORDER BY reports DESC
        LIMIT ${LIMIT}
      `
    : db<Row[]>`
        SELECT r.id, r.badges, r.trust_tier,
               count(dr.*)::int                         AS reports,
               CASE WHEN count(DISTINCT dr.crisis_id) > 1
                    THEN NULL ELSE max(c.name) END       AS area,
               count(DISTINCT dr.crisis_id) > 1          AS multi_crisis
        FROM reporters r
        JOIN damage_reports dr ON dr.reporter_id = r.id AND dr.is_duplicate = false
        JOIN crises c ON c.id = dr.crisis_id
        GROUP BY r.id, r.badges, r.trust_tier
        ORDER BY reports DESC
        LIMIT ${LIMIT}
      `

  const [myId, rows] = await Promise.all([myIdQuery, rowsQuery])

  return rows.map((row, i) => ({
    rank: i + 1,
    nickname: nicknameForReporter(row.id),
    badges: row.badges?.length ?? 0,
    reports: row.reports,
    trust_tier: row.trust_tier,
    area: row.area,
    multi_crisis: row.multi_crisis,
    isMe: myId != null && row.id === myId,
  }))
})
