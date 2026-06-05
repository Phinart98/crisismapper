import { once } from 'node:events'
import { createReadStream, createWriteStream, unlink } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import type { H3Event } from 'h3'
import * as v from 'valibot'
import { GeoPackageAPI } from '@ngageoint/geopackage'
import { createConvertStream } from 'geojson2shp'
import { getDb } from '../utils/db'
import { requireStaff } from '../utils/requireStaff'
import { exportCursor, titleClass, type RawExportRow } from '../utils/exporters/query'

// GIS-interoperable export of a crisis's ground-truth (Webinar Q&A #14). Mandatory fields:
// geocoordinates (decimal degrees), timestamp, damage_classification (3-tier Minimal/Partial/
// Complete), infrastructure_type — plus the "Core Questions" extension columns. GeoJSON/CSV
// stream straight from a DB cursor (bounded memory at 500K rows); GPKG/Shapefile are container
// formats, so they build to a temp file (disk-bounded) and stream the result out.
const QuerySchema = v.object({
  crisis_id: v.pipe(v.string(), v.uuid()),
  format: v.picklist(['geojson', 'csv', 'gpkg', 'shapefile']),
  // Default excludes probable duplicates for an analyst-clean dataset; opt back in explicitly.
  include_duplicates: v.optional(v.pipe(v.string(), v.transform((s) => s === 'true')), 'false'),
})

const STREAM_BATCH = 10_000
const FILE_BATCH = 5_000

// Single source of truth for the attribute fields shared by GeoJSON feature properties and the
// GPKG feature-table columns (same names + order; SQLite tolerates long names). CSV and Shapefile
// keep their own column lists below — they legitimately differ (CSV splits geometry into
// latitude/longitude columns; Shapefile's DBF caps field names at 10 chars).
const PROPS: { key: string; value: (r: RawExportRow) => string | null }[] = [
  { key: 'report_id', value: (r) => r.report_id },
  { key: 'timestamp', value: (r) => new Date(r.submitted_at).toISOString() },
  { key: 'damage_classification', value: (r) => titleClass(r.damage_classification) },
  { key: 'infrastructure_type', value: (r) => r.infrastructure_type },
  { key: 'severity', value: (r) => r.severity },
  { key: 'electricity_status', value: (r) => r.electricity_status },
  { key: 'health_status', value: (r) => r.health_status },
  { key: 'community_needs', value: (r) => r.community_needs },
  { key: 'vulnerable_groups', value: (r) => r.vulnerable_groups },
  { key: 'affected_population', value: (r) => r.affected_population },
]

function properties(r: RawExportRow): Record<string, string | null> {
  return Object.fromEntries(PROPS.map((p) => [p.key, p.value(r)]))
}

function toFeature(r: RawExportRow) {
  return { type: 'Feature' as const, geometry: JSON.parse(r.geom_json), properties: properties(r) }
}

const CSV_HEADERS = [
  'latitude', 'longitude', 'timestamp', 'damage_classification', 'infrastructure_type',
  'severity', 'electricity_status', 'health_status', 'community_needs',
  'vulnerable_groups', 'affected_population', 'report_id',
] as const

function toCsvRow(r: RawExportRow): (string | number | null)[] {
  return [
    r.lat, r.lng, new Date(r.submitted_at).toISOString(), titleClass(r.damage_classification),
    r.infrastructure_type, r.severity, r.electricity_status, r.health_status,
    r.community_needs, r.vulnerable_groups, r.affected_population, r.report_id,
  ]
}

// RFC 4180 CSV escaping — free-text fields (description-derived community_needs etc.) can
// contain commas/quotes/newlines. Hand-rolled to avoid bundling papaparse (its source
// trips the Nitro/Rollup parser) for what is a fixed, simple column set.
function csvCell(v: string | number | null): string {
  if (v == null) return ''
  // Numeric cells (lat/lng) pass through verbatim — a leading '-' is a legitimate negative
  // coordinate, never a formula, and must stay numeric for GIS/Excel.
  if (typeof v === 'number') return String(v)
  // CSV formula-injection guard: reporter-supplied free text (community_needs, vulnerable_groups)
  // starting with = + - @ tab or CR is treated as a formula by Excel/Sheets when staff open the
  // export. Prefix with a single quote to force text. Applied before RFC-4180 quoting.
  const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
function csvLine(cells: readonly (string | number | null)[]): string {
  return cells.map(csvCell).join(',')
}

// GPKG feature-table columns — derived from the shared PROPS spec (all TEXT).
const GPKG_PROPS = PROPS.map((p) => ({ name: p.key, dataType: 'TEXT' }))

// Shapefile DBF caps field names at 10 chars — map to short, stable names.
function toShpFeature(r: RawExportRow) {
  return {
    type: 'Feature' as const,
    geometry: JSON.parse(r.geom_json),
    properties: {
      dmg_class: titleClass(r.damage_classification),
      infra_type: r.infrastructure_type,
      severity: r.severity,
      ts: new Date(r.submitted_at).toISOString(),
      elec_stat: r.electricity_status,
      health: r.health_status,
      needs: r.community_needs,
      vuln_grp: r.vulnerable_groups,
      affec_pop: r.affected_population,
      report_id: r.report_id,
    },
  }
}

async function writeBackpressured(s: PassThrough, chunk: string) {
  if (!s.write(chunk)) await once(s, 'drain')
}

// Shared scaffold for the two text-streaming formats (GeoJSON, CSV): set headers, open a
// back-pressured PassThrough, run the cursor inside an error-guarded IIFE. The caller supplies
// only the format-specific prelude, per-batch serializer, and suffix.
function streamRows(
  event: H3Event,
  db: ReturnType<typeof getDb>,
  crisisId: string,
  includeDuplicates: boolean,
  opts: {
    contentType: string
    filename: string
    prelude: string
    serialize: (rows: RawExportRow[], firstBatch: boolean) => string
    suffix?: string
  },
) {
  setResponseHeader(event, 'content-type', opts.contentType)
  setResponseHeader(event, 'content-disposition', `attachment; filename="${opts.filename}"`)
  const stream = new PassThrough()
  ;(async () => {
    try {
      await writeBackpressured(stream, opts.prelude)
      let firstBatch = true
      await exportCursor(db, crisisId, includeDuplicates, STREAM_BATCH, async (rows) => {
        await writeBackpressured(stream, opts.serialize(rows, firstBatch))
        firstBatch = false
      })
      if (opts.suffix) await writeBackpressured(stream, opts.suffix)
      stream.end()
    } catch (err) {
      stream.destroy(err as Error)
    }
  })()
  return stream
}

function streamTempFile(event: H3Event, path: string, contentType: string, filename: string) {
  setResponseHeader(event, 'content-type', contentType)
  setResponseHeader(event, 'content-disposition', `attachment; filename="${filename}"`)
  const rs = createReadStream(path)
  rs.on('close', () => unlink(path, () => {})) // best-effort cleanup of the ephemeral file
  return rs
}

export default defineEventHandler(async (event) => {
  await requireStaff(event)

  const parsed = v.safeParse(QuerySchema, getQuery(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid export parameters' })
  }
  const { crisis_id, format, include_duplicates } = parsed.output
  const db = getDb()

  const short = crisis_id.slice(0, 8)
  const date = new Date().toISOString().slice(0, 10)
  const base = `crisis-${short}-${date}`

  // ── GeoJSON — streamed FeatureCollection ──────────────────────────────────────────
  if (format === 'geojson') {
    return streamRows(event, db, crisis_id, include_duplicates, {
      contentType: 'application/geo+json',
      filename: `${base}.geojson`,
      prelude: '{"type":"FeatureCollection","features":[',
      // Comma-prefix every feature except the very first across the whole stream.
      serialize: (rows, firstBatch) =>
        rows.map((r, i) => (firstBatch && i === 0 ? '' : ',') + JSON.stringify(toFeature(r))).join(''),
      suffix: ']}',
    })
  }

  // ── CSV — streamed, mandatory columns first ─────────────────────────────────────────
  if (format === 'csv') {
    return streamRows(event, db, crisis_id, include_duplicates, {
      contentType: 'text/csv; charset=utf-8',
      filename: `${base}.csv`,
      prelude: csvLine(CSV_HEADERS) + '\r\n',
      serialize: (rows) => rows.map((r) => csvLine(toCsvRow(r))).join('\r\n') + '\r\n',
    })
  }

  // ── GeoPackage — built on disk via better-sqlite3 (bounded memory), then streamed ────
  if (format === 'gpkg') {
    const path = join(tmpdir(), `cm-export-${short}-${Date.now()}.gpkg`)
    const gp = await GeoPackageAPI.create(path)
    gp.createFeatureTableFromProperties('reports', GPKG_PROPS)
    await exportCursor(db, crisis_id, include_duplicates, FILE_BATCH, (rows) => {
      for (const r of rows) gp.addGeoJSONFeatureToGeoPackage(toFeature(r), 'reports')
    })
    gp.close()
    return streamTempFile(event, path, 'application/geopackage+sqlite3', `${base}.gpkg`)
  }

  // ── Shapefile — geojson2shp self-zips .shp/.shx/.dbf/.prj to a temp file ─────────────
  const path = join(tmpdir(), `cm-export-${short}-${Date.now()}.zip`)
  const conv = createConvertStream({ layer: 'reports', targetCrs: 4326 })
  const ws = createWriteStream(path)
  const done = new Promise<void>((resolve, reject) => {
    ws.on('finish', () => resolve())
    ws.on('error', reject)
    conv.on('error', reject)
  })
  conv.pipe(ws)
  await exportCursor(db, crisis_id, include_duplicates, FILE_BATCH, async (rows) => {
    for (const r of rows) {
      if (!conv.write(toShpFeature(r))) await once(conv, 'drain')
    }
  })
  conv.end()
  await done
  return streamTempFile(event, path, 'application/zip', `${base}.zip`)
})
