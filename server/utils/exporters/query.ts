import type { getDb } from '../db'

type Db = ReturnType<typeof getDb>

// One raw row straight from PostGIS. damage_classification is the generated 3-tier value
// (lowercase); title-case it for output to match the Q&A #14 wording exactly.
export interface RawExportRow {
  report_id: string
  lng: number
  lat: number
  submitted_at: string
  damage_classification: 'minimal' | 'partial' | 'complete'
  infrastructure_type: string | null
  hazard_type: string
  severity: string
  electricity_status: string | null
  health_status: string | null
  community_needs: string | null
  vulnerable_groups: string | null
  affected_population: string | null
  geom_json: string
}

export function titleClass(c: RawExportRow['damage_classification']): string {
  return c.charAt(0).toUpperCase() + c.slice(1)
}

// Cursor over a crisis's exportable reports, back-pressured (postgres.js won't fetch the
// next batch until `cb` resolves) → memory stays bounded at the 500K national-crisis volume.
// Excludes unknown-severity rows (damage_classification IS NULL per CLAUDE.md) and, unless
// asked otherwise, probable duplicates — the export is meant to be an analyst-clean dataset.
export async function exportCursor(
  db: Db,
  crisisId: string,
  includeDuplicates: boolean,
  batch: number,
  cb: (rows: RawExportRow[]) => Promise<void> | void,
): Promise<void> {
  // Columns qualified with r. — the crises JOIN (hazard_type, Q&A #14) makes bare
  // names ambiguous.
  await db<RawExportRow[]>`
    SELECT
      r.id::text                       AS report_id,
      ST_X(r.location)                 AS lng,
      ST_Y(r.location)                 AS lat,
      r.submitted_at,
      r.damage_classification,
      r.infrastructure_type,
      c.crisis_type                    AS hazard_type,
      r.severity,
      r.electricity_status,
      r.health_status,
      r.community_needs,
      r.vulnerable_groups,
      r.affected_population,
      ST_AsGeoJSON(r.location)         AS geom_json
    FROM damage_reports r
    JOIN crises c ON c.id = r.crisis_id
    WHERE r.crisis_id = ${crisisId}
      AND r.damage_classification IS NOT NULL
      AND (${includeDuplicates} OR r.is_duplicate = false)
    ORDER BY r.submitted_at
  `.cursor(batch, cb)
}
