#!/usr/bin/env node
// Demo-data rebuild: wipes all reports/reporters/photos and the non-flagship crises,
// creates the 14 SIMEX scenario crises, then seeds ~218 reports THROUGH THE REAL
// PIPELINE (live /api/ai/classify, /api/reports geofence + triggers, photo upload)
// using curated Wikimedia Commons photos from data/demo-photos/ (see fetch-photos.mjs
// + manifest.json), finally backdating timestamps and recomputing badges.
//
// Run:  TARGET_URL=https://crisismapper.vercel.app node scripts/demo/seed.mjs
// Flags: --wipe-only | --skip-wipe | --dry-run | --start-index N (resume)
//
// Order is load-bearing: canonicals before their near-dupes (insert-time dedup
// window), photos before backdating (72h upload window), badge recompute last.

import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import postgres from 'postgres'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

// ─── env / args ──────────────────────────────────────────────────────────────
const env = Object.fromEntries(
  (await readFile('.env', 'utf8')).split('\n')
    .map(l => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map(m => [m[1], m[2].trim()]),
)
const DB_URL = env.NUXT_DB_URL
const SB_URL = env.NUXT_PUBLIC_SUPABASE_URL
const SB_KEY = env.NUXT_SUPABASE_SERVICE_KEY
const TARGET_URL = process.env.TARGET_URL ?? 'http://localhost:3000'
const ARGS = new Set(process.argv.slice(2))
const START_INDEX = Number(process.argv[process.argv.indexOf('--start-index') + 1]) || 0

if (!DB_URL || !SB_URL || !SB_KEY) throw new Error('Missing NUXT_DB_URL / NUXT_PUBLIC_SUPABASE_URL / NUXT_SUPABASE_SERVICE_KEY in .env')

const db = postgres(DB_URL, { prepare: false, max: 2 })
const sb = createClient(SB_URL, SB_KEY)
const sleep = ms => new Promise(r => setTimeout(r, ms))

// Deterministic RNG so --start-index resume replays the identical plan.
let rngState = 0xC0FFEE
function rng() {
  rngState |= 0; rngState = (rngState + 0x6D2B79F5) | 0
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = arr => arr[Math.floor(rng() * arr.length)]
const gauss = () => (rng() + rng() + rng() - 1.5) / 1.5 // ~N(0, 0.33), clamped by construction

// ─── the 14 SIMEX scenario crises ────────────────────────────────────────────
const FLAGSHIP_ID = '018f3c2a-0001-7000-8000-000000000001'
const id = n => `018f3c2a-${n.toString(16).padStart(4, '0')}-7000-8000-${n.toString(16).padStart(12, '0')}`

const CRISES = [
  { id: FLAGSHIP_ID, name: 'SIMEX Mandalay — Central Myanmar Earthquake', type: 'earthquake', bbox: [95.0, 19.0, 97.8, 23.8], bucket: 'earthquake', reports: 30, anchors: [[96.085, 21.975], [95.97, 21.88], [96.06, 21.90], [95.87, 20.88], [96.13, 19.75]] },
  { id: id(2), name: 'SIMEX Anatolia — Cross-Border Earthquake Exercise', type: 'earthquake', bbox: [26.0, 35.0, 45.0, 42.0], bucket: 'earthquake', reports: 16, anchors: [[37.38, 37.07], [36.16, 36.20], [36.93, 37.58], [37.16, 36.20]] },
  { id: id(3), name: 'SIMEX Andes — Pacific Rim Seismic Drill', type: 'earthquake', bbox: [-82.0, -35.0, -66.0, 2.0], bucket: 'earthquake', reports: 14, anchors: [[-77.04, -12.05], [-78.47, -0.18], [-71.54, -16.41], [-71.62, -33.05]] },
  { id: id(4), name: 'SIMEX Maghreb — Atlas Earthquake Scenario', type: 'earthquake', bbox: [-13.0, 28.0, 10.0, 37.5], bucket: 'earthquake', reports: 12, anchors: [[-7.99, 31.63], [-9.60, 30.42], [-3.93, 35.25], [3.06, 36.75]] },
  { id: id(5), name: 'SIMEX Indus — Monsoon Flood Response Exercise', type: 'flood', bbox: [66.0, 24.0, 74.5, 34.5], bucket: 'flood', reports: 16, anchors: [[67.01, 24.86], [68.37, 25.39], [68.86, 27.71], [71.47, 30.20]] },
  { id: id(6), name: 'SIMEX Gulf of Guinea — Coastal Flood Exercise', type: 'flood', bbox: [-4.0, 4.0, 9.0, 14.0], bucket: 'flood', reports: 16, anchors: [[-0.19, 5.60], [3.38, 6.52], [2.43, 6.37], [6.74, 7.80]] },
  { id: id(7), name: 'SIMEX Rhineland — River Basin Flood Exercise', type: 'flood', bbox: [-5.0, 46.0, 15.0, 56.0], bucket: 'flood', reports: 16, anchors: [[7.09, 50.54], [5.57, 50.63], [6.96, 50.94], [5.69, 50.85]] },
  { id: id(8), name: 'SIMEX Visayas — Typhoon Landfall Exercise', type: 'cyclone', bbox: [117.0, 5.0, 127.0, 19.5], bucket: 'wind', reports: 16, anchors: [[125.00, 11.24], [123.89, 10.32], [120.98, 14.60], [125.61, 7.07]] },
  { id: id(9), name: 'SIMEX Sofala — Cyclone Preparedness Exercise', type: 'cyclone', bbox: [30.0, -27.0, 41.0, -10.0], bucket: 'wind', reports: 16, anchors: [[34.84, -19.84], [33.48, -19.12], [36.89, -17.88], [32.59, -25.97]] },
  { id: id(10), name: 'SIMEX Antilles — Hurricane Season Drill', type: 'hurricane', bbox: [-85.0, 17.0, -64.0, 23.5], bucket: 'wind', reports: 16, anchors: [[-72.34, 18.54], [-69.93, 18.49], [-66.11, 18.47], [-75.82, 20.02]] },
  { id: id(11), name: 'SIMEX Atlantic Seaboard — Hurricane Surge Exercise', type: 'hurricane', bbox: [-98.0, 24.5, -73.5, 41.0], bucket: 'wind', reports: 16, anchors: [[-81.87, 26.64], [-90.07, 29.95], [-95.37, 29.76], [-79.93, 32.78]] },
  { id: id(12), name: 'SIMEX Murray-Darling — Eastern Australia Flood Exercise', type: 'flood', bbox: [140.0, -39.5, 153.7, -28.0], bucket: 'flood', reports: 14, anchors: [[153.02, -30.65], [150.18, -35.71], [149.13, -35.28], [151.21, -33.87]] },
  { id: id(13), name: 'SIMEX Mekong — Delta Flood Response Exercise', type: 'flood', bbox: [97.0, 8.0, 109.0, 20.0], bucket: 'flood', reports: 16, anchors: [[100.50, 13.76], [104.92, 11.56], [106.63, 10.82], [105.78, 10.03]] },
  { id: id(14), name: 'SIMEX Rift Valley — East Africa Flood Exercise', type: 'flood', bbox: [29.0, -8.0, 42.0, 12.0], bucket: 'flood', reports: 14, anchors: [[36.82, -1.29], [38.74, 9.03], [32.58, 0.32], [39.27, -6.82]] },
]

// ─── personas (fixed device UUIDs → stable pseudonymous reporters) ───────────
const persona = (n, count, extended) => ({ deviceId: `dddddddd-0000-4000-8000-${String(n).padStart(12, '0')}`, count, extended })
const PERSONAS = [
  persona(1, 30, 0.95), // power reporter — community_voice (25+) + coverage_hero
  persona(2, 22, 0.8),  // field volunteers
  persona(3, 20, 0.8),
  persona(4, 16, 0.5),  // regulars
  persona(5, 15, 0.5),
  persona(6, 14, 0.5),
  persona(7, 12, 0.3),  // casuals
  persona(8, 11, 0.3),
  persona(9, 10, 0.3),
  persona(10, 9, 0.3),
  persona(11, 2, 0.2),  // one-timers
  persona(12, 2, 0.2),
]

// ─── report narratives (per bucket × infra; attribution appended separately) ─
const NARRATIVES = {
  earthquake: {
    building: ['Multi-storey building partially collapsed, upper floors pancaked. Street cordoned by residents.', 'Severe cracking across the facade, masonry fallen onto the pavement. Occupants evacuated.', 'Corner building down to rubble. Neighbouring walls look unstable.', 'Old masonry structure collapsed inward. Dust still settling when photographed.'],
    road: ['Road surface buckled and cracked, impassable for vehicles.', 'Deep fissures across the carriageway near the junction.'],
    school: ['School block heavily damaged, classroom wing unsafe. Children relocated.', 'Visible structural failure at the school building, entrance blocked by debris.'],
    hospital: ['Clinic building cracked, patients moved to the courtyard.', 'Hospital annex damaged, main entrance obstructed.'],
    bridge: ['Bridge approach slumped, deck visibly displaced.'],
    utility: ['Substation wall collapsed, lines down across the street.'],
    other: ['Widespread rubble across the block, several structures affected.'],
  },
  flood: {
    building: ['Ground floor fully flooded, water line above the windowsills. Family moved upstairs.', 'House inundated, furniture and stock destroyed. Water receding slowly.', 'Commercial block flooded, shopfronts breached by the current.'],
    road: ['Street under water, only passable by boat. Several vehicles submerged.', 'Road washed out at the bend, asphalt carried away.', 'Main road flooded curb to curb, traffic impossible.'],
    bridge: ['Bridge deck overtopped, approaches eroded. Closed to all traffic.', 'Temporary bridge in place after the crossing washed away.'],
    school: ['School compound flooded, classrooms under half a metre of water.'],
    hospital: ['Health post cut off by floodwater, access only by boat.'],
    utility: ['Power distribution point flooded, neighbourhood without electricity.'],
    other: ['Whole block inundated, residents evacuating with what they can carry.'],
  },
  wind: {
    building: ['Roof torn off completely, interior exposed to rain. Family sheltering with neighbours.', 'House destroyed by storm surge, only the frame left standing.', 'Storefront smashed, debris field across the lot.', 'Walls standing but roof and windows gone. Severe water damage inside.'],
    road: ['Street blocked by structural debris and downed trees.', 'Debris field across the road, impassable.'],
    school: ['Classroom block unroofed, materials destroyed.'],
    hospital: ['Clinic roof damaged, services suspended.'],
    bridge: ['Bridge railing destroyed, deck littered with debris.'],
    utility: ['Power poles snapped along the street, lines on the ground.'],
    other: ['Block-wide destruction, most structures unusable.'],
  },
}

// ─── plan generation (deterministic) ─────────────────────────────────────────
async function buildPlan() {
  const manifest = JSON.parse(await readFile('data/demo-photos/manifest.json', 'utf8'))
  const photosByBucket = {}
  for (const m of manifest) {
    if (!m.keep || !m.infra) continue
    const bucket = m.file.split('/')[0]
    ;(photosByBucket[bucket] ??= []).push(m)
  }
  for (const c of CRISES) {
    if (!photosByBucket[c.bucket]?.length) throw new Error(`No curated photos for bucket ${c.bucket}`)
  }

  // Persona deck: power reporter front-loads the flagship (coverage_hero needs 5
  // distinct ~100m zones in ONE crisis), everyone else round-robins.
  const deck = []
  for (const p of PERSONAS) for (let i = 0; i < p.count; i++) deck.push(p)
  const totalReports = CRISES.reduce((s, c) => s + c.reports, 0)
  while (deck.length < totalReports) deck.push(null) // anonymous remainder
  // Shuffle (deterministic), then force persona 1 into the first 12 flagship slots.
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]] }

  const now = Date.now()
  const plan = []
  let deckIdx = 0
  for (const crisis of CRISES) {
    const photos = photosByBucket[crisis.bucket]
    let photoIdx = Math.floor(rng() * photos.length)
    for (let i = 0; i < crisis.reports; i++) {
      const isFlagshipPower = crisis.id === FLAGSHIP_ID && i < 12
      const p = isFlagshipPower ? PERSONAS[0] : deck[deckIdx++]
      const anchor = crisis.anchors[i % crisis.anchors.length]
      const lng = +(anchor[0] + gauss() * 0.02).toFixed(5)
      const lat = +(anchor[1] + gauss() * 0.02).toFixed(5)
      const photo = photos[photoIdx++ % photos.length]
      // Timestamp distribution: 40% <24h, 35% 1–3d, 25% 3–10d.
      const r = rng()
      const ageMs = r < 0.4 ? (1 + rng() * 23) * 3600_000
        : r < 0.75 ? (24 + rng() * 48) * 3600_000
        : (72 + rng() * 168) * 3600_000
      plan.push({
        crisis, persona: p, lng, lat, photo,
        infra: photo.infra,
        extended: p ? rng() < p.extended : rng() < 0.3,
        disagrees: rng() < 0.12,
        ts: new Date(now - ageMs),
        dupeOf: null,
      })
    }
  }
  // Force 4 recent reports into the last hour (live-feel for the dashboard feed).
  for (let i = 0; i < 4; i++) plan[Math.floor(rng() * plan.length)].ts = new Date(now - (5 + rng() * 50) * 60_000)

  // ~8% near-dupes: clone a canonical with ≤40m offset, different/no persona,
  // timestamp shortly after. Inserted immediately after their canonical.
  const withDupes = []
  for (const [i, r] of plan.entries()) {
    withDupes.push(r)
    if (i % 13 === 5) {
      withDupes.push({
        ...r,
        persona: pick([null, ...PERSONAS.slice(4)]),
        lng: +(r.lng + (rng() - 0.5) * 0.0006).toFixed(5),
        lat: +(r.lat + (rng() - 0.5) * 0.0006).toFixed(5),
        ts: new Date(Math.min(r.ts.getTime() + rng() * 6 * 3600_000, now - 4 * 60_000)),
        dupeOf: i,
        extended: false,
      })
    }
  }
  return withDupes
}

// ─── wipe ─────────────────────────────────────────────────────────────────────
async function wipe() {
  console.log('— wiping storage…')
  const paths = []
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await sb.storage.from('damage-photos').list('reports', { limit: 100, offset })
    if (error) throw error
    paths.push(...data.map(f => `reports/${f.name}`))
    if (data.length < 100) break
  }
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await sb.storage.from('damage-photos').remove(paths.slice(i, i + 100))
    if (error) throw error
  }
  console.log(`  removed ${paths.length} objects`)

  console.log('— wiping tables…')
  await db`TRUNCATE TABLE damage_reports, reporters`
  // NEVER delete the flagship row: buildings.crisis_id has ON DELETE CASCADE and
  // the ingested Overture footprints hang off it. Update it in place instead.
  await db`DELETE FROM crises WHERE id <> ${FLAGSHIP_ID}`
  const f = CRISES[0]
  await db`UPDATE crises SET name = ${f.name}, crisis_type = ${f.type}, is_active = true,
           bbox = ST_MakeEnvelope(${f.bbox[0]}, ${f.bbox[1]}, ${f.bbox[2]}, ${f.bbox[3]}, 4326),
           created_at = now() WHERE id = ${FLAGSHIP_ID}`
  for (const c of CRISES.slice(1)) {
    await db`INSERT INTO crises (id, name, crisis_type, bbox, is_active)
             VALUES (${c.id}, ${c.name}, ${c.type},
                     ST_MakeEnvelope(${c.bbox[0]}, ${c.bbox[1]}, ${c.bbox[2]}, ${c.bbox[3]}, 4326), true)`
  }
  console.log(`  ${CRISES.length} crises in place`)
}

// ─── per-report pipeline ─────────────────────────────────────────────────────
const webpCache = new Map()
async function toWebp(file) {
  if (webpCache.has(file)) return webpCache.get(file)
  let q = 72, buf
  do {
    buf = await sharp(path.join('data/demo-photos', file)).rotate()
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: q }).toBuffer()
    q -= 10
  } while (buf.length > 200_000 && q >= 32)
  webpCache.set(file, buf)
  return buf
}

async function classify(webp) {
  // One quick attempt. If the providers are throttled (degraded) we DON'T wait —
  // a no-AI report is a legitimate offline-client shape, and blocking 60s per
  // throttled photo would stretch the run to hours once the daily token budget
  // is spent.
  try {
    const fd = new FormData()
    fd.append('photo', new Blob([webp], { type: 'image/webp' }), 'photo.webp')
    const res = await fetch(`${TARGET_URL}/api/ai/classify`, { method: 'POST', body: fd })
    if (!res.ok) return null
    const ai = await res.json()
    return ai._meta?.provider !== 'degraded' ? ai : null
  } catch {
    return null
  }
}

const dbToUi = { negligible: 'minimal', moderate: 'partial', severe: 'complete', destroyed: 'complete' }
const UI_TIERS = ['minimal', 'partial', 'complete']
const shiftTier = (ui) => UI_TIERS[Math.max(0, Math.min(2, UI_TIERS.indexOf(ui) + (rng() < 0.5 ? -1 : 1)))]

function extendedFields(bucket) {
  const elec = bucket === 'flood' ? ['non-functional', 'partial', 'unknown'] : ['non-functional', 'partial', 'functional', 'unknown']
  return {
    electricity_status: pick(elec),
    health_status: pick(['operational', 'partial', 'down', 'unknown']),
    community_needs: [...new Set([pick(['water', 'food', 'shelter', 'medical', 'search']), pick(['water', 'food', 'shelter'])])],
    vulnerable_groups: rng() < 0.6 ? [pick(['elderly', 'children', 'disabled', 'pregnant', 'injured'])] : undefined,
    affected_population: pick(['<50', '50-200', '200-1000']),
  }
}

async function seedOne(r, idx, total) {
  const webp = await toWebp(r.photo.file)
  const ai = await classify(webp)
  const aiUi = ai ? dbToUi[ai.severity] ?? null : null
  const severity = aiUi ? (r.disagrees ? shiftTier(aiUi) : aiUi) : pick(UI_TIERS)

  const narrative = pick(NARRATIVES[r.crisis.bucket][r.infra] ?? NARRATIVES[r.crisis.bucket].other)
  const attribution = `[Demo imagery: ${r.photo.artist}, ${r.photo.license}, via Wikimedia Commons — ${r.photo.descriptionUrl}]`

  const body = {
    crisis_id: r.crisis.id,
    ...(r.persona && { device_id: r.persona.deviceId }),
    severity,
    infrastructure_type: r.infra,
    location: [r.lng, r.lat],
    location_method: 'gps',
    description: `${narrative} ${attribution}`.slice(0, 2000),
    ...(r.extended ? extendedFields(r.crisis.bucket) : {}),
    ...(ai && {
      ai_severity: ai.severity, ai_confidence: ai.confidence,
      ai_infrastructure_visible: ai.infrastructure_visible, ai_raw_response: ai,
    }),
  }

  const res = await fetch(`${TARGET_URL}/api/reports`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
  if (res.status !== 201) throw new Error(`report POST ${res.status}: ${await res.text()} (crisis ${r.crisis.name}, [${r.lng},${r.lat}])`)
  const { id: reportId } = await res.json()

  const fd = new FormData()
  fd.append('photo', new Blob([webp], { type: 'image/webp' }), 'photo.webp')
  fd.append('photo_hash', createHash('sha256').update(webp).digest('hex'))
  const photoRes = await fetch(`${TARGET_URL}/api/reports/${reportId}/photo`, { method: 'POST', body: fd })
  if (!photoRes.ok) console.warn(`  [${idx}] photo upload failed (${photoRes.status}) — report stands without photo`)

  console.log(`  [${idx + 1}/${total}] ${r.crisis.name.split('—')[0].trim()} · ${r.infra} · ${severity}${ai ? '' : ' · no-AI'}${r.dupeOf !== null ? ' · dupe' : ''}`)
  return reportId
}

// ─── backdate (DB-wide, resume-proof) ─────────────────────────────────────────
// Spreads submitted_at across the last 10 days (40% <24h incl. a few in the last
// hour, 35% 1–3d, 25% 3–10d) over EVERY report, independent of how/when it was
// inserted, then recomputes badges against the new timeline (the evaluator is
// idempotent; badges were first computed at insert-time "now").
async function backdate() {
  console.log('— backdating…')
  await db`
    UPDATE damage_reports d SET submitted_at = now() - (
      CASE
        WHEN s.r < 0.40 THEN (1  + random() * 23)  * interval '1 hour'
        WHEN s.r < 0.75 THEN (24 + random() * 48)  * interval '1 hour'
        ELSE                  (72 + random() * 168) * interval '1 hour'
      END)
    FROM (SELECT id, random() AS r FROM damage_reports) s WHERE d.id = s.id`
  // A handful in the last hour for a live-feed feel.
  await db`UPDATE damage_reports SET submitted_at = now() - (random() * 50) * interval '1 minute'
           WHERE id IN (SELECT id FROM damage_reports ORDER BY random() LIMIT 5)`
  await db`UPDATE reporters SET badges = evaluate_reporter_badges(id)`
  const [c] = await db`SELECT count(*)::int AS total, count(*) FILTER (WHERE is_duplicate)::int AS dupes,
                       count(photo_url)::int AS with_photo, count(ai_confidence)::int AS with_ai FROM damage_reports`
  console.log(`— done: ${c.total} reports (${c.dupes} dupes, ${c.with_photo} photos, ${c.with_ai} AI-classified)`)
}

// ─── main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (ARGS.has('--backdate-only')) { await backdate(); await db.end(); return }

  console.log(`target: ${TARGET_URL}`)
  const health = await fetch(`${TARGET_URL}/api/health`).then(r => r.json())
  if (!health.ok) throw new Error('target /api/health not ok')

  // Dry run inspects the plan WITHOUT touching storage/DB.
  if (ARGS.has('--dry-run')) {
    const plan = await buildPlan()
    const byCrisis = {}
    for (const r of plan) byCrisis[r.crisis.name] = (byCrisis[r.crisis.name] ?? 0) + 1
    console.log(`— plan: ${plan.length} reports across ${CRISES.length} crises`)
    console.table(byCrisis)
    await db.end(); return
  }

  if (!ARGS.has('--skip-wipe')) await wipe()
  if (ARGS.has('--wipe-only')) { await db.end(); return }

  const plan = await buildPlan()
  console.log(`— plan: ${plan.length} reports across ${CRISES.length} crises`)

  const ids = []
  for (const [i, r] of plan.entries()) {
    if (i < START_INDEX) { ids.push(null); continue }
    try {
      ids.push(await seedOne(r, i, plan.length))
    } catch (e) {
      console.error(`  [${i}] FAILED: ${e.message} — retrying once in 20s`)
      await sleep(20_000)
      ids.push(await seedOne(r, i, plan.length))
    }
    await sleep(3000 + rng() * 1500)
  }

  await backdate()
  await db.end()
}

main().catch(async (e) => { console.error(e); await db.end(); process.exit(1) })
