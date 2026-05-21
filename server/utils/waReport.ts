import type postgres from 'postgres'
import { getDb } from './db'
import type { ClassifyResult } from '~/utils/aiClassify'
import { isAiUsable } from '~/utils/aiClassify'
import type { DbSeverity, InfraType } from '~/utils/severity'

export type WaInfraType = InfraType
export type WaLocationMethod = 'whatsapp_share' | 'plus_code' | 'landmark_text'

export interface InsertWhatsappReportArgs {
  crisisId: string
  reporterId: string
  severity: DbSeverity
  infrastructureType: WaInfraType
  photoUrl: string | null
  photoHashHex: string | null
  ai: ClassifyResult | null // null = no AI run or degraded; ai_* columns stay null
  locationMethod: WaLocationMethod
  lng: number
  lat: number
  plusCode: string | null
  landmark: string | null
  qualityScore: number | null
}

export async function insertWhatsappReport(args: InsertWhatsappReportArgs): Promise<string> {
  const db = getDb()

  // Drop degraded ai results so the audit trail isn't polluted with
  // synthetic 'unknown'/0 fallback values. Mirrors PWA filter at submit.
  const ai = isAiUsable(args.ai) ? args.ai : null

  const [row] = await db<{ id: string }[]>`
    INSERT INTO damage_reports (
      crisis_id, reporter_id, channel,
      severity, infrastructure_type,
      location, location_method, plus_code, location_landmark,
      ai_severity, ai_confidence, ai_infrastructure_visible, ai_raw_response,
      photo_url, photo_hash,
      quality_score
    ) VALUES (
      ${args.crisisId}, ${args.reporterId}, 'whatsapp',
      ${args.severity}, ${args.infrastructureType},
      ST_SetSRID(ST_MakePoint(${args.lng}, ${args.lat}), 4326),
      ${args.locationMethod}, ${args.plusCode}, ${args.landmark},
      ${ai?.severity ?? null},
      ${ai?.confidence ?? null},
      ${ai?.infrastructure_visible ?? null},
      ${ai ? db.json(ai as unknown as postgres.JSONValue) : null},
      ${args.photoUrl}, ${args.photoHashHex ? Buffer.from(args.photoHashHex, 'hex') : null},
      ${args.qualityScore}
    )
    RETURNING id
  `
  return row!.id
}

export async function getReporterIdByHash(waIdHash: string): Promise<string | null> {
  const db = getDb()
  const [row] = await db<{ id: string }[]>`
    SELECT id FROM reporters WHERE whatsapp_id_hash = ${waIdHash} LIMIT 1
  `
  return row?.id ?? null
}

// Awards 'first_responder' if this reporter is among the first 50 *distinct*
// reporters for the crisis AND doesn't already carry the badge. Returns the
// rank (distinct reporter count including this insert) so callers don't need
// a second COUNT(DISTINCT) query. Idempotent: 'first_responder' = ANY(badges)
// guard prevents double-appending.
export async function awardFirstResponderIfEligible(
  crisisId: string,
  reporterId: string
): Promise<{ awarded: boolean; rank: number }> {
  const db = getDb()
  const [row] = await db<{ awarded: boolean; rank: string }[]>`
    WITH eligible AS (
      SELECT COUNT(DISTINCT reporter_id) AS distinct_reporters
      FROM damage_reports WHERE crisis_id = ${crisisId}
    )
    UPDATE reporters
       SET report_count = report_count + 1,
           badges = CASE
             WHEN 'first_responder' = ANY(badges) THEN badges
             WHEN (SELECT distinct_reporters FROM eligible) <= 50
               THEN array_append(badges, 'first_responder')
             ELSE badges
           END
     WHERE id = ${reporterId}
     RETURNING
       ('first_responder' = ANY(badges)) AS awarded,
       (SELECT distinct_reporters FROM eligible)::text AS rank
  `
  return { awarded: row?.awarded ?? false, rank: Number(row?.rank ?? '0') }
}

export type ElectricityStatus = 'functional' | 'partial' | 'non-functional' | 'unknown'
export type HealthStatus = 'operational' | 'partial' | 'down' | 'unknown'

export async function setElectricityStatus(reportId: string, status: ElectricityStatus): Promise<void> {
  const db = getDb()
  await db`UPDATE damage_reports SET electricity_status = ${status} WHERE id = ${reportId}`
}

export async function setHealthStatus(reportId: string, status: HealthStatus): Promise<void> {
  const db = getDb()
  await db`UPDATE damage_reports SET health_status = ${status} WHERE id = ${reportId}`
}

export async function setCommunityNeeds(reportId: string, needs: string[]): Promise<void> {
  const db = getDb()
  // Explicit ::text[] cast — without it, postgres.js with prepare:false sends
  // the array as untyped parameter and Postgres stores it as the literal
  // 'water,food' string instead of an array. Cast forces proper TEXT[] coercion.
  await db`UPDATE damage_reports SET community_needs = ${db.array(needs)}::text[] WHERE id = ${reportId}`
}

export interface StatusDigestArgs {
  crisisId: string
  reporterId: string | null
}

export interface StatusDigest {
  total: number
  byClass: { minimal: number; partial: number; complete: number }
  ownCount: number
  ownVerified: number
}

// One query, conditional FILTERs. Excludes damage_classification IS NULL rows
// (severity='unknown') so the per-class counts add up to 100%, matching the
// export filter contract in CLAUDE.md.
export async function getStatusDigest(args: StatusDigestArgs): Promise<StatusDigest> {
  const db = getDb()
  const rid = args.reporterId
  const [row] = await db<{
    total: string
    minimal: string
    partial: string
    complete: string
    own: string
    own_verified: string
  }[]>`
    SELECT
      COUNT(*) FILTER (WHERE damage_classification IS NOT NULL)::text             AS total,
      COUNT(*) FILTER (WHERE damage_classification = 'minimal')::text             AS minimal,
      COUNT(*) FILTER (WHERE damage_classification = 'partial')::text             AS partial,
      COUNT(*) FILTER (WHERE damage_classification = 'complete')::text            AS complete,
      COUNT(*) FILTER (WHERE reporter_id = ${rid})::text                           AS own,
      COUNT(*) FILTER (WHERE reporter_id = ${rid} AND is_verified)::text           AS own_verified
    FROM damage_reports
    WHERE crisis_id = ${args.crisisId}
      AND is_duplicate = false
  `
  return {
    total: Number(row?.total ?? '0'),
    byClass: {
      minimal: Number(row?.minimal ?? '0'),
      partial: Number(row?.partial ?? '0'),
      complete: Number(row?.complete ?? '0'),
    },
    ownCount: Number(row?.own ?? '0'),
    ownVerified: Number(row?.own_verified ?? '0'),
  }
}

// Crisis bbox centroid — landmark fallback location. Memoized at module
// scope; Fluid Compute reuses function instances so this survives across
// requests. Centroid only changes if crises.bbox is edited (out-of-band).
const centroidCache = new Map<string, { lng: number; lat: number }>()
export async function getCrisisCentroid(crisisId: string): Promise<{ lng: number; lat: number } | null> {
  const cached = centroidCache.get(crisisId)
  if (cached) return cached
  const db = getDb()
  const [row] = await db<{ lng: number; lat: number }[]>`
    SELECT ST_X(ST_Centroid(bbox))::float AS lng,
           ST_Y(ST_Centroid(bbox))::float AS lat
    FROM crises WHERE id = ${crisisId}
  `
  if (!row) return null
  const out = { lng: row.lng, lat: row.lat }
  centroidCache.set(crisisId, out)
  return out
}
