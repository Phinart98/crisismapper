// Incremental: ADD 7 scenario crises to fill the global map's empty regions,
// WITHOUT wiping existing data. Seeds ~11 reports each through the public API
// (POST /api/reports + photo), using the model-authored generator for AI fields
// (no live vision quota), reusing the curated photo pool by hazard bucket, then
// backdates only the new reports. Re-running is safe-ish (ON CONFLICT on crises;
// reports would duplicate, so run once).
//
// Run:  TARGET_URL=https://crisismapper.vercel.app node scripts/demo/add-crises.mjs

import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import postgres from 'postgres'
import sharp from 'sharp'
import { generate, bucketForHazard } from './classify.mjs'

const env = Object.fromEntries(
  (await readFile('.env', 'utf8')).split('\n')
    .map(l => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map(m => [m[1], m[2].trim()]),
)
const db = postgres(env.NUXT_DB_URL, { prepare: false, max: 2 })
const TARGET_URL = process.env.TARGET_URL ?? 'http://localhost:3000'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const pick = arr => arr[Math.floor(Math.random() * arr.length)]
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5

const id = n => `018f3c2a-${n.toString(16).padStart(4, '0')}-7000-8000-${n.toString(16).padStart(12, '0')}`

// New crises — bboxes chosen non-overlapping with the existing 14 (shared edges only).
const CRISES = [
  { id: id(15), name: 'SIMEX Gangetic Plain — Northern India Flood Exercise', type: 'flood', bbox: [75, 24, 85.5, 30], anchors: [[77.2, 28.6], [80.3, 26.4], [85.1, 25.6], [80.9, 26.8]] },
  { id: id(16), name: 'SIMEX Bengal Delta — Bay of Bengal Cyclone Exercise', type: 'cyclone', bbox: [85.5, 20.5, 93, 27], anchors: [[90.4, 23.8], [88.4, 22.6], [89.6, 22.8], [91.8, 22.4]] },
  { id: id(17), name: 'SIMEX Java — Sunda Arc Earthquake Exercise', type: 'earthquake', bbox: [105, -9, 115, -5], anchors: [[106.8, -6.2], [107.6, -6.9], [112.7, -7.3], [110.4, -7.0]] },
  { id: id(18), name: 'SIMEX Sichuan — Western China Earthquake Exercise', type: 'earthquake', bbox: [101, 27, 109, 33], anchors: [[104.1, 30.6], [106.5, 29.6], [104.7, 31.5], [104.4, 31.1]] },
  { id: id(19), name: 'SIMEX Sudeste — Southeast Brazil Flood Exercise', type: 'flood', bbox: [-50, -25, -40, -18], anchors: [[-46.6, -23.5], [-43.2, -22.9], [-43.9, -19.9], [-40.3, -20.3]] },
  { id: id(20), name: 'SIMEX Isthmus — Central America Storm Exercise', type: 'hurricane', bbox: [-92, 12, -83, 18], anchors: [[-90.5, 14.6], [-89.2, 13.7], [-87.2, 14.1], [-86.3, 12.1]] },
  { id: id(21), name: 'SIMEX Limpopo — Southern Africa Flood Exercise', type: 'flood', bbox: [24, -30, 30, -19], anchors: [[28.0, -26.2], [28.2, -25.7], [28.6, -20.15], [25.9, -24.6]] },
]

const PERSONAS = [
  'dddddddd-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000002',
  'dddddddd-0000-4000-8000-000000000003', 'dddddddd-0000-4000-8000-000000000004',
  'dddddddd-0000-4000-8000-000000000005', 'dddddddd-0000-4000-8000-000000000006',
  null, null, // anonymous share
]

const UI_FROM_DB = { negligible: 'minimal', moderate: 'partial', severe: 'complete', destroyed: 'complete' }
const SEV_WEIGHTED = () => {
  const r = Math.random()
  return r < 0.2 ? 'negligible' : r < 0.55 ? 'moderate' : r < 0.85 ? 'severe' : 'destroyed'
}

const NARRATIVE = {
  flood: ['Floodwater through the area; residents moving belongings to higher ground.', 'Street and ground floors inundated, access difficult.', 'Water rising against the structures along this stretch.'],
  wind: ['Storm damage across the block, roofing and debris everywhere.', 'Wind has torn through the area; several structures unroofed.', 'Severe storm impact, debris blocking the way.'],
  earthquake: ['Shaking damage visible across the area; cracked and leaning structures.', 'Quake left rubble and cracked walls along this street.', 'Structural damage from the tremor, residents outside.'],
}

const webpCache = new Map()
async function toWebp(file) {
  if (webpCache.has(file)) return webpCache.get(file)
  let q = 72, buf
  do {
    buf = await sharp(path.join('data/demo-photos', file)).rotate()
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }).webp({ quality: q }).toBuffer()
    q -= 10
  } while (buf.length > 200_000 && q >= 32)
  webpCache.set(file, buf)
  return buf
}

async function main() {
  const health = await fetch(`${TARGET_URL}/api/health`).then(r => r.json())
  if (!health.ok) throw new Error('target health not ok')

  const manifest = JSON.parse(await readFile('data/demo-photos/manifest.json', 'utf8'))
  const byBucket = {}
  for (const m of manifest) { if (m.keep && m.infra) (byBucket[m.file.split('/')[0]] ??= []).push(m) }

  for (const c of CRISES) {
    await db`INSERT INTO crises (id, name, crisis_type, bbox, is_active)
             VALUES (${c.id}, ${c.name}, ${c.type},
                     ST_MakeEnvelope(${c.bbox[0]}, ${c.bbox[1]}, ${c.bbox[2]}, ${c.bbox[3]}, 4326), true)
             ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, crisis_type = EXCLUDED.crisis_type,
                     bbox = EXCLUDED.bbox, is_active = true`
  }
  console.log(`${CRISES.length} crises inserted`)

  const newIds = []
  let count = 0
  for (const c of CRISES) {
    const bucket = bucketForHazard(c.type)
    const photos = byBucket[bucket]
    let pIdx = Math.floor(Math.random() * photos.length)
    const n = 10 + Math.floor(Math.random() * 3) // 10-12
    for (let i = 0; i < n; i++) {
      const anchor = c.anchors[i % c.anchors.length]
      const lng = +(anchor[0] + gauss() * 0.02).toFixed(5)
      const lat = +(anchor[1] + gauss() * 0.02).toFixed(5)
      const photo = photos[pIdx++ % photos.length]
      const dbSev = SEV_WEIGHTED()
      const ai = generate(bucket, photo.infra, dbSev)
      const device = pick(PERSONAS)
      const attribution = `[Demo imagery: ${photo.artist}, ${photo.license}, via Wikimedia Commons — ${photo.descriptionUrl}]`
      const body = {
        crisis_id: c.id,
        ...(device && { device_id: device }),
        severity: UI_FROM_DB[dbSev],
        infrastructure_type: photo.infra,
        location: [lng, lat],
        location_method: 'gps',
        description: `${pick(NARRATIVE[bucket])} ${attribution}`.slice(0, 2000),
        ...(Math.random() < 0.5 && { electricity_status: pick(['non-functional', 'partial', 'unknown']), affected_population: pick(['<50', '50-200', '200-1000']) }),
        ai_severity: ai.severity, ai_confidence: ai.confidence,
        ai_infrastructure_visible: ai.infrastructure_visible, ai_raw_response: ai,
      }
      const res = await fetch(`${TARGET_URL}/api/reports`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      })
      if (res.status !== 201) { console.warn(`  ${c.name} [${lng},${lat}] -> ${res.status}: ${await res.text()}`); continue }
      const { id: rid } = await res.json()
      newIds.push(rid)

      const webp = await toWebp(photo.file)
      const fd = new FormData()
      fd.append('photo', new Blob([webp], { type: 'image/webp' }), 'photo.webp')
      fd.append('photo_hash', createHash('sha256').update(webp).digest('hex'))
      await fetch(`${TARGET_URL}/api/reports/${rid}/photo`, { method: 'POST', body: fd })
      count++
      await sleep(700)
    }
    console.log(`  ${c.name.split('—')[0].trim()}: ${n}`)
  }

  // Backdate ONLY the new reports (existing ones keep their spread).
  await db`
    UPDATE damage_reports d SET submitted_at = now() - (
      CASE WHEN s.r < 0.4 THEN (1 + random()*23)*interval '1 hour'
           WHEN s.r < 0.75 THEN (24 + random()*48)*interval '1 hour'
           ELSE (72 + random()*168)*interval '1 hour' END)
    FROM (SELECT unnest(${newIds}::uuid[]) AS id, random() AS r) s WHERE d.id = s.id`
  await db`UPDATE reporters SET badges = evaluate_reporter_badges(id)`

  const [t] = await db`SELECT count(*)::int AS crises FROM crises WHERE is_active`
  const [r] = await db`SELECT count(*)::int AS total, count(ai_confidence)::int AS with_ai FROM damage_reports`
  console.log(`\ndone: +${count} reports across ${CRISES.length} new crises. Now ${t.crises} crises, ${r.total} reports (${r.with_ai} AI).`)
  await db.end()
}

main().catch(async (e) => { console.error(e); await db.end(); process.exit(1) })
