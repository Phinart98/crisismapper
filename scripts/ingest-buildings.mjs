// Ingest an Overture/GeoJSON building FeatureCollection into the PostGIS
// `buildings` table for the demo crisis. No GDAL required.
//
//   NUXT_DB_URL=... node scripts/ingest-buildings.mjs mandalay-buildings.geojson
//
// Reads NUXT_DB_URL (Supavisor pooler / direct connection string). Batches inserts
// via postgres.js + ST_GeomFromGeoJSON. Polygons/MultiPolygons only.

import { readFileSync } from 'node:fs'
import postgres from 'postgres'

const CRISIS_ID = '018f3c2a-0001-7000-8000-000000000001'
const BATCH = 1000

const file = process.argv[2]
if (!file) {
  console.error('usage: node scripts/ingest-buildings.mjs <buildings.geojson>')
  process.exit(1)
}
const dbUrl = process.env.NUXT_DB_URL
if (!dbUrl) {
  console.error('NUXT_DB_URL env var is required')
  process.exit(1)
}

const fc = JSON.parse(readFileSync(file, 'utf8'))
const features = (fc.features ?? []).filter(
  (f) => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'),
)
console.log(`${features.length} building polygons to ingest`)

const sql = postgres(dbUrl, { prepare: false, max: 4 })

let inserted = 0
try {
  for (let i = 0; i < features.length; i += BATCH) {
    const slice = features.slice(i, i + BATCH)
    // Parallel arrays + unnest so each GeoJSON geometry goes through
    // ST_GeomFromGeoJSON (a plain text value can't cast into a GEOMETRY column).
    const geoms = slice.map((f) => JSON.stringify(f.geometry))
    const heights = slice.map((f) => (f.properties?.height != null ? Number(f.properties.height) || null : null))
    const osms = slice.map((f) => f.properties?.class ?? f.properties?.subtype ?? null)
    await sql`
      INSERT INTO buildings (crisis_id, geom, height_m, osm_type)
      SELECT ${CRISIS_ID}, ST_SetSRID(ST_GeomFromGeoJSON(g), 4326), h, o
      FROM unnest(${geoms}::text[], ${heights}::numeric[], ${osms}::text[]) AS t(g, h, o)
    `
    inserted += slice.length
    process.stdout.write(`\r${inserted}/${features.length}`)
  }
} finally {
  await sql.end()
}
console.log(`\ndone — ${inserted} rows`)
