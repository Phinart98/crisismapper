import type postgres from 'postgres'
import * as v from 'valibot'
import { getDb } from '../utils/db'
import { resolveReporter } from '../utils/resolveReporter'
import { uiToDb } from '../utils/severity'

const ReportSchema = v.object({
  crisis_id: v.pipe(v.string(), v.uuid()),
  // Pseudonymous reporter identity (Phase 9). Optional — absent → anonymous report.
  device_id: v.optional(v.pipe(v.string(), v.uuid())),
  severity: v.picklist(['minimal', 'partial', 'complete']),
  infrastructure_type: v.picklist(['building', 'road', 'bridge', 'hospital', 'school', 'utility', 'other']),
  location: v.tuple([
    v.pipe(v.number(), v.minValue(-180), v.maxValue(180)), // lng
    v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),   // lat
  ]),
  // PWA channel only produces 'gps' and 'plus_code'; accepting other location
  // methods here would just be unverified attacker input.
  location_method: v.picklist(['gps', 'plus_code']),
  plus_code: v.optional(v.pipe(v.string(), v.maxLength(120))),
  description: v.optional(v.pipe(v.string(), v.maxLength(2000))),
  electricity_status: v.optional(v.picklist(['functional', 'partial', 'non-functional', 'unknown'])),
  health_status: v.optional(v.picklist(['operational', 'partial', 'down', 'unknown'])),
  // Structured Core Questions (Q&A #14): canonical tags from the wizard chips,
  // joined to TEXT for storage/export. The plain-string variant keeps reports
  // queued offline under the old free-text UI drainable after this deploy.
  community_needs: v.optional(v.union([
    v.pipe(v.array(v.picklist(['water', 'food', 'shelter', 'medical', 'search'])), v.maxLength(5)),
    v.pipe(v.string(), v.maxLength(500)),
  ])),
  vulnerable_groups: v.optional(v.union([
    v.pipe(v.array(v.picklist(['elderly', 'children', 'disabled', 'pregnant', 'injured'])), v.maxLength(5)),
    v.pipe(v.string(), v.maxLength(500)),
  ])),
  affected_population: v.optional(v.picklist(['<50', '50-200', '200-1000', '1000+'])),

  // All ai_* fields are optional: offline / degraded submissions omit them and the DB columns stay NULL.
  ai_severity: v.optional(v.picklist(['negligible', 'moderate', 'severe', 'destroyed', 'unknown'])),
  ai_confidence: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(1))),
  ai_infrastructure_visible: v.optional(v.boolean()),
  ai_raw_response: v.optional(v.record(v.string(), v.unknown())),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const result = v.safeParse(ReportSchema, body)
  if (!result.success) {
    throw createError({ statusCode: 400, message: 'Invalid report data' })
  }

  const d = result.output
  const dbSeverity = uiToDb[d.severity]
  const [lng, lat] = d.location

  const db = getDb()

  // Geofence: the crisis must exist + be active, and the point must fall inside its
  // bbox (expanded ~0.25° ≈ 25km for GPS jitter at zone edges; bbox NULL = open).
  // 422, not 400: drainQueue treats it as a permanent rejection and drops the queued
  // row instead of retrying a payload the server will never accept.
  const [zone] = await db<{ in_zone: boolean }[]>`
    SELECT (bbox IS NULL
            OR ST_Intersects(ST_Expand(bbox, 0.25),
                             ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326))) AS in_zone
    FROM crises
    WHERE id = ${d.crisis_id} AND is_active = true
  `
  if (!zone) {
    throw createError({ statusCode: 422, message: 'Unknown or inactive crisis' })
  }
  if (!zone.in_zone) {
    throw createError({ statusCode: 422, message: 'Report location is outside the selected crisis zone' })
  }

  const reporterId = d.device_id ? await resolveReporter(db, d.device_id) : null
  const [row] = await db<{ id: string }[]>`
    INSERT INTO damage_reports (
      crisis_id, reporter_id, channel, severity, infrastructure_type,
      location, location_method, plus_code,
      description, electricity_status, health_status,
      community_needs, vulnerable_groups, affected_population,
      ai_severity, ai_confidence, ai_infrastructure_visible, ai_raw_response
    ) VALUES (
      ${d.crisis_id}, ${reporterId}, 'pwa', ${dbSeverity}, ${d.infrastructure_type},
      ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326),
      ${d.location_method},
      ${d.plus_code ?? null},
      ${d.description ?? null}, ${d.electricity_status ?? null}, ${d.health_status ?? null},
      ${(Array.isArray(d.community_needs) ? d.community_needs.join('; ') : d.community_needs) ?? null},
      ${(Array.isArray(d.vulnerable_groups) ? d.vulnerable_groups.join('; ') : d.vulnerable_groups) ?? null},
      ${d.affected_population ?? null},
      ${d.ai_severity ?? null},
      ${d.ai_confidence ?? null},
      ${d.ai_infrastructure_visible ?? null},
      ${d.ai_raw_response ? db.json(d.ai_raw_response as postgres.JSONValue) : null}
    )
    RETURNING id
  `
  setResponseStatus(event, 201)
  return { id: row!.id }
})
