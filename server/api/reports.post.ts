import type postgres from 'postgres'
import * as v from 'valibot'
import { getDb } from '../utils/db'
import { uiToDb } from '../utils/severity'

const ReportSchema = v.object({
  crisis_id: v.pipe(v.string(), v.uuid()),
  severity: v.picklist(['minimal', 'partial', 'complete']),
  infrastructure_type: v.picklist(['building', 'road', 'bridge', 'hospital', 'school', 'utility', 'other']),
  location: v.tuple([
    v.pipe(v.number(), v.minValue(-180), v.maxValue(180)), // lng
    v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),   // lat
  ]),
  // PWA channel only produces 'gps' and 'plus_code'. WhatsApp (Phase 5) submits
  // through a separate webhook, not this endpoint, so accepting other methods here
  // would just be unverified attacker input.
  location_method: v.picklist(['gps', 'plus_code']),
  plus_code: v.optional(v.string()),
  description: v.optional(v.string()),
  electricity_status: v.optional(v.picklist(['functional', 'partial', 'non-functional', 'unknown'])),
  health_status: v.optional(v.picklist(['operational', 'partial', 'down', 'unknown'])),
  community_needs: v.optional(v.string()),
  vulnerable_groups: v.optional(v.string()),

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
  const [row] = await db<{ id: string }[]>`
    INSERT INTO damage_reports (
      crisis_id, channel, severity, infrastructure_type,
      location, location_method, plus_code,
      description, electricity_status, health_status,
      community_needs, vulnerable_groups,
      ai_severity, ai_confidence, ai_infrastructure_visible, ai_raw_response
    ) VALUES (
      ${d.crisis_id}, 'pwa', ${dbSeverity}, ${d.infrastructure_type},
      ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326),
      ${d.location_method},
      ${d.plus_code ?? null},
      ${d.description ?? null}, ${d.electricity_status ?? null}, ${d.health_status ?? null},
      ${d.community_needs ?? null}, ${d.vulnerable_groups ?? null},
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
