import * as v from 'valibot'
import { getDb } from '../utils/db'
import { uiToDb } from '../utils/severity'

const ReportSchema = v.object({
  crisis_id: v.pipe(v.string(), v.uuid()),
  severity: v.picklist(['minimal', 'partial', 'complete']),
  infrastructure_type: v.picklist(['building', 'road', 'bridge', 'hospital', 'school', 'utility', 'other']),
  location: v.tuple([v.number(), v.number()]),   // [lng, lat]
  location_method: v.picklist(['gps', 'plus_code', 'landmark_text']),
  plus_code: v.optional(v.string()),
  location_landmark: v.optional(v.string()),
  description: v.optional(v.string()),
  electricity_status: v.optional(v.picklist(['functional', 'partial', 'non-functional', 'unknown'])),
  health_status: v.optional(v.picklist(['operational', 'partial', 'down', 'unknown'])),
  community_needs: v.optional(v.string()),
  vulnerable_groups: v.optional(v.string()),
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
      location, location_method, plus_code, location_landmark,
      description, electricity_status, health_status,
      community_needs, vulnerable_groups
    ) VALUES (
      ${d.crisis_id}, 'pwa', ${dbSeverity}, ${d.infrastructure_type},
      ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326),
      ${d.location_method},
      ${d.plus_code ?? null}, ${d.location_landmark ?? null},
      ${d.description ?? null}, ${d.electricity_status ?? null}, ${d.health_status ?? null},
      ${d.community_needs ?? null}, ${d.vulnerable_groups ?? null}
    )
    RETURNING id
  `
  setResponseStatus(event, 201)
  return { id: row!.id }
})
