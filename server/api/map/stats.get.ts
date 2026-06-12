import * as v from 'valibot'
import { getDb } from '../../utils/db'

// Header summary statistics for the dashboard (Webinar Q&A #18: "summary
// statistics on impacted infrastructure"):
//   total        — non-duplicate report count for the crisis
//   coverage_pct — share of ~1km grid cells in the crisis bbox that have ≥1 report
//   hourly       — 24 hourly report counts (last 24h) for the header sparkline
// crisis_id omitted → aggregate across all active crises (the landing overlay);
// coverage_pct is per-crisis-bbox and meaningless globally, so it returns 0 there.
const QuerySchema = v.object({ crisis_id: v.optional(v.pipe(v.string(), v.uuid())) })

const GRID = 0.01 // ~1.1km at this latitude

export default defineEventHandler(async (event) => {
  const result = v.safeParse(QuerySchema, getQuery(event))
  if (!result.success) {
    throw createError({ statusCode: 400, message: 'Invalid query parameters' })
  }
  const { crisis_id } = result.output
  const db = getDb()

  const byCrisis = crisis_id
    ? db`crisis_id = ${crisis_id}`
    : db`crisis_id IN (SELECT id FROM crises WHERE is_active = true)`

  // Independent queries — run concurrently to halve the endpoint's round-trip latency.
  const totalsQuery = crisis_id
    ? db<{ total: number; coverage_pct: number; duplicate_count: number }[]>`
      WITH c AS (
        SELECT bbox FROM crises WHERE id = ${crisis_id}
      ),
      cells AS (
        SELECT GREATEST(1, ceil((ST_XMax(bbox) - ST_XMin(bbox)) / ${GRID})
                         * ceil((ST_YMax(bbox) - ST_YMin(bbox)) / ${GRID}))::int AS total_cells
        FROM c
      ),
      covered AS (
        SELECT count(DISTINCT ST_SnapToGrid(location, ${GRID}))::int AS n
        FROM damage_reports
        WHERE crisis_id = ${crisis_id} AND is_duplicate = false
      ),
      counts AS (
        -- Single pass over the crisis's reports: non-dupe total + dupe count via FILTER,
        -- instead of two separate full COUNT subqueries.
        SELECT
          count(*) FILTER (WHERE NOT is_duplicate)::int AS total,
          count(*) FILTER (WHERE is_duplicate)::int     AS duplicate_count
        FROM damage_reports WHERE crisis_id = ${crisis_id}
      )
      SELECT
        counts.total,
        counts.duplicate_count,
        LEAST(100, round(100.0 * covered.n / cells.total_cells))::int AS coverage_pct
      FROM cells, covered, counts
    `
    : db<{ total: number; coverage_pct: number; duplicate_count: number }[]>`
      SELECT
        count(*) FILTER (WHERE NOT is_duplicate)::int AS total,
        count(*) FILTER (WHERE is_duplicate)::int     AS duplicate_count,
        0::int                                        AS coverage_pct
      FROM damage_reports
      WHERE ${byCrisis}
    `

  const [[totals], hourly] = await Promise.all([
    totalsQuery,
    db<{ n: number }[]>`
      WITH hours AS (
        SELECT generate_series(
          date_trunc('hour', now()) - interval '23 hours',
          date_trunc('hour', now()),
          interval '1 hour'
        ) AS h
      )
      SELECT count(r.id)::int AS n
      FROM hours
      LEFT JOIN damage_reports r
        ON r.${byCrisis}
        AND r.is_duplicate = false
        AND date_trunc('hour', r.submitted_at) = hours.h
      GROUP BY hours.h
      ORDER BY hours.h
    `,
  ])

  return {
    total: totals?.total ?? 0,
    duplicate_count: totals?.duplicate_count ?? 0,
    coverage_pct: totals?.coverage_pct ?? 0,
    hourly: hourly.map(r => r.n),
  }
})
