#!/usr/bin/env node
// Local end-to-end test for the WhatsApp webhook + state machine.
// Phase 5 sections (1–10) cover handshake / signature / state machine.
// Phase 6 sections (11–16) cover media + AI + damage_reports insert,
// interactive list_reply, status command, more sub-flow, landmark + Plus Code.
//
// Usage:
//   1. Start dev with test-mode envs (PowerShell):
//        $env:NUXT_TEST_WA_MEDIA_FIXTURE_PATH = ".cache/wa-fixture.webp"
//        $env:NUXT_TEST_CAPTURE_SENDS = "1"
//        $env:NUXT_TEST_CAPTURE_PATH  = ".cache/wa-sends.jsonl"
//        npm run dev
//      Bash equivalent:
//        NUXT_TEST_WA_MEDIA_FIXTURE_PATH=.cache/wa-fixture.webp \
//        NUXT_TEST_CAPTURE_SENDS=1 NUXT_TEST_CAPTURE_PATH=.cache/wa-sends.jsonl \
//        npm run dev
//   2. node scripts/test-wa-webhook.mjs
//
// Cleans whatsapp_sessions + reporters rows + recent damage_reports for the
// test wa_id before and after the run. Storage uploads are NOT cleaned —
// dev bucket orphans are accepted.

import { createHmac } from 'node:crypto'
import { mkdir, readFile, stat, unlink } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import sharp from 'sharp'
import postgres from 'postgres'

const env = parseEnv(readFileSync('.env', 'utf-8'))
const APP_SECRET = env.NUXT_META_APP_SECRET
const HASH_SECRET = env.NUXT_WABA_HASH_SECRET
const VERIFY_TOKEN = env.NUXT_META_VERIFY_TOKEN
const DB_URL = env.NUXT_DB_URL
const BASE_URL = process.env.WEBHOOK_URL ?? 'http://localhost:3000'
const ENDPOINT = `${BASE_URL}/api/whatsapp/webhook`

if (!APP_SECRET || !HASH_SECRET || !VERIFY_TOKEN || !DB_URL) {
  console.error('Missing one of NUXT_META_APP_SECRET / NUXT_WABA_HASH_SECRET / NUXT_META_VERIFY_TOKEN / NUXT_DB_URL in .env')
  process.exit(1)
}

const TEST_WA_ID = '15558675309'  // fictional — not your real number
const TEST_WA_HASH = createHmac('sha256', HASH_SECRET).update(TEST_WA_ID).digest('hex')

// Demo crisis seeded in 20260507000000_seed_demo_crisis.sql — fixed UUID so
// the harness doesn't need to look it up.
const DEMO_CRISIS_ID = env.NUXT_PUBLIC_DEMO_CRISIS_ID || '018f3c2a-0001-7000-8000-000000000001'

const FIXTURE_PATH = '.cache/wa-fixture.webp'
const SENDS_PATH   = '.cache/wa-sends.jsonl'

const sql = postgres(DB_URL, { prepare: false })

let passed = 0
let failed = 0
const fails = []

function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  ✓ ${name}`)
    passed++
  } else {
    console.log(`  ✗ ${name} ${detail}`)
    failed++
    fails.push(`${name} ${detail}`)
  }
}

function sign(body) {
  return 'sha256=' + createHmac('sha256', APP_SECRET).update(body).digest('hex')
}

function envelope(messageObj) {
  return JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{
      id: 'TEST_ENTRY',
      changes: [{
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          metadata: { display_phone_number: '15556408390', phone_number_id: '1080445738483303' },
          contacts: [{ profile: { name: 'Test' }, wa_id: TEST_WA_ID }],
          messages: [messageObj],
        },
      }],
    }],
  })
}

async function postWebhook(messageObj) {
  const body = envelope(messageObj)
  return fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': sign(body),
    },
    body,
  })
}

const now = () => String(Date.now())
const textMsg = (id, body) => ({ from: TEST_WA_ID, id, timestamp: now(), type: 'text', text: { body } })
// imageMsg defaults to a fixture_-prefixed id so waMedia takes the fixture path.
// Pass a custom id (e.g. 'media_real_abc') if you ever want to test against Meta.
const imageMsg = (id, mediaId = `fixture_${id}`) => ({ from: TEST_WA_ID, id, timestamp: now(), type: 'image', image: { id: mediaId, mime_type: 'image/webp', sha256: 'deadbeef' } })
const locationMsg = (id, lat = 5.5, lng = -0.2) => ({ from: TEST_WA_ID, id, timestamp: now(), type: 'location', location: { latitude: lat, longitude: lng } })
const listReplyMsg = (id, replyId) => ({
  from: TEST_WA_ID, id, timestamp: now(), type: 'interactive',
  interactive: { type: 'list_reply', list_reply: { id: replyId, title: replyId } },
})

async function getSession() {
  const [row] = await sql`SELECT state, current_report_id, context, last_message_at FROM whatsapp_sessions WHERE wa_id_hash = ${TEST_WA_HASH}`
  return row
}

async function getReporter() {
  const [row] = await sql`SELECT id, report_count, badges FROM reporters WHERE whatsapp_id_hash = ${TEST_WA_HASH}`
  return row
}

async function getLatestReport() {
  // ::text cast on the array column sidesteps postgres.js TEXT[] deserialization
  // quirks under prepare:false. We get back the raw '{water,food}' literal and
  // parse braces + quotes off in the harness.
  const [row] = await sql`
    SELECT id, channel, severity, infrastructure_type, location_method, plus_code,
           location_landmark, ai_severity, photo_url IS NOT NULL AS has_photo,
           electricity_status, health_status,
           community_needs::text AS community_needs_raw,
           ST_X(location)::float AS lng, ST_Y(location)::float AS lat,
           quality_score, submitted_at
    FROM damage_reports
    WHERE reporter_id = (SELECT id FROM reporters WHERE whatsapp_id_hash = ${TEST_WA_HASH})
    ORDER BY submitted_at DESC
    LIMIT 1
  `
  if (row) {
    const raw = row.community_needs_raw ?? ''
    row.community_needs = raw
      .replace(/^\{|\}$/g, '')
      .split(',')
      .map(s => s.replace(/^"|"$/g, '').trim())
      .filter(Boolean)
  }
  return row
}

async function reset() {
  // Order matters: whatsapp_sessions.current_report_id → damage_reports.id, and
  // damage_reports.reporter_id → reporters.id. Drop sessions first to release
  // the FK on damage_reports, then reports, then the reporter row itself.
  await sql`DELETE FROM whatsapp_sessions WHERE wa_id_hash = ${TEST_WA_HASH}`
  await sql`DELETE FROM damage_reports WHERE reporter_id IN (SELECT id FROM reporters WHERE whatsapp_id_hash = ${TEST_WA_HASH})`
  await sql`DELETE FROM reporters WHERE whatsapp_id_hash = ${TEST_WA_HASH}`
}

async function pollUntil(predicate, { timeoutMs = 8000, intervalMs = 200, what = 'condition' } = {}) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return true
    await new Promise(r => setTimeout(r, intervalMs))
  }
  console.log(`  ! pollUntil timed out waiting for ${what}`)
  return false
}

async function ensureFixture() {
  try { await stat(FIXTURE_PATH) } catch {
    await mkdir(dirname(FIXTURE_PATH), { recursive: true })
    await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 120, g: 80, b: 60 } } })
      .webp({ quality: 60 }).toFile(FIXTURE_PATH)
  }
}

async function clearSendsLog() {
  try { await unlink(SENDS_PATH) } catch {}
}

async function readSends() {
  try {
    const text = await readFile(SENDS_PATH, 'utf8')
    return text.trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
  } catch { return [] }
}

async function main() {
  console.log(`Testing ${ENDPOINT}`)
  console.log(`Test wa_id_hash: ${TEST_WA_HASH.slice(0, 16)}...`)
  await ensureFixture() // every image POST uses fixture_-prefixed ids; create the file once up front
  await reset()
  console.log('Clean slate.\n')

  // --- 1. GET verify handshake ---
  console.log('1. GET verify handshake (correct token)')
  const r1 = await fetch(`${ENDPOINT}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(VERIFY_TOKEN)}&hub.challenge=12345`)
  check('returns 200', r1.status === 200, `(got ${r1.status})`)
  const c1 = await r1.text()
  check('echoes challenge as plaintext', c1 === '12345', `(got "${c1}")`)

  console.log('1b. GET with wrong verify token')
  const r1bad = await fetch(`${ENDPOINT}?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345`)
  check('returns 403', r1bad.status === 403, `(got ${r1bad.status})`)

  // --- 2. POST with bad signature ---
  console.log('\n2. POST with bad signature')
  const r2 = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': 'sha256=deadbeefdeadbeef' },
    body: '{}',
  })
  check('returns 401', r2.status === 401, `(got ${r2.status})`)

  console.log('2b. POST with no signature header')
  const r2b = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
  check('returns 401', r2b.status === 401, `(got ${r2b.status})`)

  console.log('2c. POST with malformed signature (no sha256= prefix)')
  const r2c = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': 'deadbeef' },
    body: '{}',
  })
  check('returns 401', r2c.status === 401, `(got ${r2c.status})`)

  // --- 3. POST "hi" — fresh session ---
  console.log('\n3. POST "hi" (fresh session)')
  const r3 = await postWebhook(textMsg('msg_1', 'hi'))
  check('returns 200', r3.status === 200, `(got ${r3.status})`)
  let s = await getSession()
  check('session row created', !!s)
  check('state = AWAITING_PHOTO', s?.state === 'AWAITING_PHOTO', `(got ${s?.state})`)
  check('msg_1 in processed', Array.isArray(s?.context?.processed) && s.context.processed.includes('msg_1'))
  const [reporter] = await sql`SELECT id, channel, whatsapp_id_hash FROM reporters WHERE whatsapp_id_hash = ${TEST_WA_HASH}`
  check('reporter row created', !!reporter)
  check('reporter.channel = whatsapp', reporter?.channel === 'whatsapp')
  check('reporter.whatsapp_id_hash matches', reporter?.whatsapp_id_hash === TEST_WA_HASH)
  const reporterDump = JSON.stringify(reporter)
  check('no raw phone leaked into reporter row', !reporterDump.includes(TEST_WA_ID))

  // --- 4. POST image — AWAITING_PHOTO → AWAITING_CONFIRM ---
  console.log('\n4. POST image')
  const r4 = await postWebhook(imageMsg('msg_2'))
  check('returns 200', r4.status === 200, `(got ${r4.status})`)
  s = await getSession()
  check('state = AWAITING_CONFIRM', s?.state === 'AWAITING_CONFIRM', `(got ${s?.state})`)

  // --- 5. POST "1" — AWAITING_CONFIRM → AWAITING_LOCATION ---
  console.log('\n5. POST "1" (confirm)')
  const r5 = await postWebhook(textMsg('msg_3', '1'))
  check('returns 200', r5.status === 200, `(got ${r5.status})`)
  s = await getSession()
  check('state = AWAITING_LOCATION', s?.state === 'AWAITING_LOCATION', `(got ${s?.state})`)
  check('confirmed_severity set in context', typeof s?.context?.confirmed_severity === 'string')

  // --- 6. POST location — AWAITING_LOCATION → DONE ---
  console.log('\n6. POST location')
  const r6 = await postWebhook(locationMsg('msg_4'))
  check('returns 200', r6.status === 200, `(got ${r6.status})`)
  s = await getSession()
  check('state = DONE', s?.state === 'DONE', `(got ${s?.state})`)

  // --- 7. Dedupe: replay msg_4 ---
  console.log('\n7. Dedupe: replay msg_4 (same id)')
  const lastAtBefore = (await getSession()).last_message_at
  await new Promise(r => setTimeout(r, 50))  // ensure clock would advance if save happened
  const r7 = await postWebhook(locationMsg('msg_4'))
  check('returns 200', r7.status === 200)
  s = await getSession()
  check('last_message_at unchanged (no transition)', s.last_message_at.getTime() === lastAtBefore.getTime(),
    `(before=${lastAtBefore.toISOString()} after=${s.last_message_at.toISOString()})`)

  // --- 8. Restart keyword from DONE ---
  console.log('\n8. POST "report" from DONE (restart)')
  const r8 = await postWebhook(textMsg('msg_5', 'report'))
  check('returns 200', r8.status === 200)
  s = await getSession()
  check('state = AWAITING_PHOTO', s?.state === 'AWAITING_PHOTO', `(got ${s?.state})`)
  // After restart, context resets to just the dedupe array — confirmed_severity gone.
  check('context.confirmed_severity cleared', !s?.context?.confirmed_severity)

  // --- 9. Bad confirm input stays in AWAITING_CONFIRM ---
  console.log('\n9. AWAITING_CONFIRM: invalid reply does not transition')
  // Non-fixture mediaId — process_image will fail fast (no Meta token validity)
  // so its late saveSession doesn't race Section 10's manual last_message_at
  // rollback. Section 9 only cares about the synchronous state transition.
  await postWebhook(imageMsg('msg_6', 'no_fixture_msg_6'))  // → AWAITING_CONFIRM
  const r9 = await postWebhook(textMsg('msg_7', 'wat'))  // gibberish
  check('returns 200', r9.status === 200)
  s = await getSession()
  check('state still AWAITING_CONFIRM', s?.state === 'AWAITING_CONFIRM', `(got ${s?.state})`)

  // --- 10. 60-min timeout ---
  console.log('\n10. 60-min timeout (manual age last_message_at 70 min)')
  await sql`UPDATE whatsapp_sessions
    SET last_message_at = now() - interval '70 minutes',
        state = 'AWAITING_LOCATION',
        context = '{"foo":"bar"}'::jsonb
    WHERE wa_id_hash = ${TEST_WA_HASH}`
  const r10 = await postWebhook(textMsg('msg_8', 'anything'))
  check('returns 200', r10.status === 200)
  s = await getSession()
  check('state reset → AWAITING_PHOTO', s?.state === 'AWAITING_PHOTO', `(got ${s?.state})`)
  check('stale context cleared', !s?.context?.foo)

  // =========================================================================
  // Phase 6 sections — full effect pipeline (media → AI → DB insert).
  // Each section calls reset() first so flows don't interfere.
  // =========================================================================

  await ensureFixture()
  console.log(`\nFixture ready at ${FIXTURE_PATH}`)

  // --- 11. Happy path: photo → AI → confirm → location → damage_reports row ---
  console.log('\n11. Happy path (photo → AI → confirm → location → DB)')
  await reset()
  await clearSendsLog()
  await postWebhook(textMsg('p6_msg1', 'hi'))
  await postWebhook(imageMsg('p6_msg2'))
  // Wait for process_image effect (download fixture + strip + storage + AI + send list)
  const aiReady = await pollUntil(async () => {
    const sx = await getSession()
    return sx?.context?.ai && sx?.context?.photo_url
  }, { timeoutMs: 15000, what: 'process_image effect (AI + photo_url)' })
  check('process_image populated context.ai + photo_url', aiReady)

  await postWebhook(textMsg('p6_msg3', '1'))
  s = await getSession()
  check('state = AWAITING_LOCATION after confirm', s?.state === 'AWAITING_LOCATION', `(got ${s?.state})`)

  await postWebhook(locationMsg('p6_msg4', 21.95, 96.15)) // inside Myanmar EQ bbox
  s = await getSession()
  check('state = DONE after location', s?.state === 'DONE', `(got ${s?.state})`)

  const reportReady = await pollUntil(
    async () => (await getLatestReport()) !== undefined,
    { timeoutMs: 8000, what: 'insert_report effect' }
  )
  check('damage_reports row inserted', reportReady)
  const rep = await getLatestReport()
  check('channel = whatsapp', rep?.channel === 'whatsapp', `(got ${rep?.channel})`)
  check('location_method = whatsapp_share', rep?.location_method === 'whatsapp_share', `(got ${rep?.location_method})`)
  check('photo_url set', rep?.has_photo === true)
  check('lat/lng round-trip', Math.abs((rep?.lat ?? 0) - 21.95) < 0.0001 && Math.abs((rep?.lng ?? 0) - 96.15) < 0.0001,
        `(got lat=${rep?.lat} lng=${rep?.lng})`)
  // ai_severity is null when classifyDamage runs in degraded mode (no AI keys);
  // either outcome is acceptable as long as the pipeline completed.
  const aiCol = rep?.ai_severity
  check('ai_severity is null or a valid bucket', aiCol === null || ['negligible','moderate','severe','destroyed','unknown'].includes(aiCol),
        `(got ${aiCol})`)
  // session.current_report_id wired to the new row
  s = await getSession()
  check('session.current_report_id wired', s?.current_report_id === rep?.id)

  // Outbound capture: at least one sendText for "Report saved!" and one sendList for confirm prompt.
  // The "Report saved" send fires AFTER the INSERT inside handleInsertReport (await order:
  // insert → wire current_report_id → award badge → COUNT → sendText). The pollUntil for
  // the row above can catch the INSERT before the sendText writes; poll for the text too.
  await pollUntil(async () => {
    const ss = await readSends()
    return ss.some(x => x.payload?.text?.body?.includes('Report saved'))
  }, { timeoutMs: 3000, what: '"Report saved" send' })
  const sends11 = await readSends()
  const sentTexts11 = sends11.filter(x => x.payload?.type === 'text').map(x => x.payload.text.body)
  const sentLists11 = sends11.filter(x => x.payload?.type === 'interactive')
  check('confirmation list message captured', sentLists11.length >= 1)
  check('"Report saved" text captured', sentTexts11.some(t => t.includes('Report saved')), `(texts: ${JSON.stringify(sentTexts11).slice(0, 300)})`)

  // --- 12. Interactive list_reply confirms severity ---
  console.log('\n12. Interactive list_reply (sev_complete)')
  await reset()
  await clearSendsLog()
  await postWebhook(textMsg('p6_msg10', 'hi'))
  await postWebhook(imageMsg('p6_msg11'))
  await pollUntil(async () => {
    const sx = await getSession()
    return sx?.state === 'AWAITING_CONFIRM' && sx?.context?.ai
  }, { timeoutMs: 15000, what: 'process_image' })
  await postWebhook(listReplyMsg('p6_msg12', 'sev_complete'))
  s = await getSession()
  check('list_reply advanced to AWAITING_LOCATION', s?.state === 'AWAITING_LOCATION', `(got ${s?.state})`)
  // sev_complete maps to 'destroyed' (4-tier internal); both 'severe' and
  // 'destroyed' export as 'complete' (3-tier) per CLAUDE.md severity table.
  check('confirmed_severity = destroyed', s?.context?.confirmed_severity === 'destroyed', `(got ${s?.context?.confirmed_severity})`)

  // --- 13. "status" command (any state) ---
  console.log('\n13. "status" command')
  await reset()
  await clearSendsLog()
  // Seed a few non-test reports for the demo crisis so the digest has data.
  // The TEST reporter (reset()'d above) is separate; we just need ANY rows.
  const seedReporterId = await sql`
    INSERT INTO reporters (channel, whatsapp_id_hash)
    VALUES ('whatsapp', ${'seed_' + Date.now()})
    RETURNING id
  `.then(r => r[0].id)
  for (const sev of ['negligible', 'moderate', 'severe']) {
    await sql`
      INSERT INTO damage_reports (crisis_id, reporter_id, channel, severity, infrastructure_type,
        location, location_method)
      VALUES (${DEMO_CRISIS_ID}, ${seedReporterId}, 'whatsapp', ${sev}, 'building',
        ST_SetSRID(ST_MakePoint(96.15, 21.95), 4326), 'whatsapp_share')
    `
  }

  await postWebhook(textMsg('p6_msg20', 'hi'))      // session must exist for status to run
  await clearSendsLog()
  await postWebhook(textMsg('p6_msg21', 'status'))
  s = await getSession()
  check('status: state unchanged', s?.state === 'AWAITING_PHOTO', `(got ${s?.state})`)
  await pollUntil(async () => (await readSends()).some(x => x.payload?.text?.body?.includes('Crisis-zone update')),
    { timeoutMs: 4000, what: 'status digest send' })
  const sends13 = await readSends()
  const digest = sends13.find(x => x.payload?.text?.body?.includes('Crisis-zone update'))
  check('digest message captured', !!digest)
  check('digest under 400 chars', (digest?.payload.text.body.length ?? 999) < 400, `(len=${digest?.payload.text.body.length})`)
  check('digest mentions report count', /\d+ reports received/.test(digest?.payload.text.body ?? ''))

  // Cleanup seed rows
  await sql`DELETE FROM damage_reports WHERE reporter_id = ${seedReporterId}`
  await sql`DELETE FROM reporters WHERE id = ${seedReporterId}`

  // --- 14. "more" sub-flow: electricity → health → needs ---
  console.log('\n14. "more" sub-flow extended fields')
  await reset()
  await clearSendsLog()
  await postWebhook(textMsg('p6_msg30', 'hi'))
  await postWebhook(imageMsg('p6_msg31'))
  await pollUntil(async () => (await getSession())?.context?.ai, { timeoutMs: 15000, what: 'process_image' })
  await postWebhook(textMsg('p6_msg32', '1'))
  await postWebhook(locationMsg('p6_msg33', 21.95, 96.15))
  await pollUntil(async () => (await getLatestReport()) !== undefined, { timeoutMs: 8000, what: 'insert_report' })

  await postWebhook(textMsg('p6_msg34', 'more'))
  s = await getSession()
  check('more: context.more_step = electricity', s?.context?.more_step === 'electricity', `(got ${s?.context?.more_step})`)

  await postWebhook(textMsg('p6_msg35', '3'))   // Electricity: Out
  await pollUntil(async () => (await getLatestReport())?.electricity_status === 'non-functional',
    { timeoutMs: 4000, what: 'electricity update' })
  s = await getSession()
  check('more: advanced to health', s?.context?.more_step === 'health', `(got ${s?.context?.more_step})`)
  let r14 = await getLatestReport()
  check('electricity_status = non-functional', r14?.electricity_status === 'non-functional', `(got ${r14?.electricity_status})`)

  await postWebhook(textMsg('p6_msg36', '4'))   // Health: Unknown
  await pollUntil(async () => (await getLatestReport())?.health_status === 'unknown',
    { timeoutMs: 4000, what: 'health update' })
  s = await getSession()
  check('more: advanced to needs', s?.context?.more_step === 'needs', `(got ${s?.context?.more_step})`)

  await postWebhook(textMsg('p6_msg37', 'water food'))
  await pollUntil(async () => {
    const r = await getLatestReport()
    return Array.isArray(r?.community_needs) && r.community_needs.includes('water') && r.community_needs.includes('food')
  }, { timeoutMs: 4000, what: 'needs update' })
  s = await getSession()
  check('more: sub-flow closed (more_step = null)', s?.context?.more_step === null || s?.context?.more_step === undefined,
        `(got ${s?.context?.more_step})`)
  r14 = await getLatestReport()
  check('community_needs has water + food', Array.isArray(r14?.community_needs) && r14.community_needs.includes('water') && r14.community_needs.includes('food'),
        `(got ${JSON.stringify(r14?.community_needs)})`)

  // --- 15. Landmark text fallback (no GPS, no Plus Code) ---
  console.log('\n15. Landmark text fallback')
  await reset()
  await clearSendsLog()
  await postWebhook(textMsg('p6_msg40', 'hi'))
  await postWebhook(imageMsg('p6_msg41'))
  await pollUntil(async () => (await getSession())?.context?.ai, { timeoutMs: 15000, what: 'process_image' })
  await postWebhook(textMsg('p6_msg42', '1'))
  await postWebhook(textMsg('p6_msg43', 'Near Kantamanto market, Accra'))
  await pollUntil(async () => (await getLatestReport()) !== undefined, { timeoutMs: 8000, what: 'insert_report (landmark)' })
  const r15 = await getLatestReport()
  check('landmark: location_method = landmark_text', r15?.location_method === 'landmark_text', `(got ${r15?.location_method})`)
  check('landmark: location_landmark populated', (r15?.location_landmark ?? '').includes('Kantamanto'))
  check('landmark: quality_score = 0.2', Number(r15?.quality_score) === 0.2, `(got ${r15?.quality_score})`)
  // Crisis bbox: ST_MakeEnvelope(95.8, 21.5, 96.5, 22.2) → centroid (96.15, 21.85)
  check('landmark: location = crisis centroid', Math.abs((r15?.lng ?? 0) - 96.15) < 0.01 && Math.abs((r15?.lat ?? 0) - 21.85) < 0.01,
        `(got lng=${r15?.lng} lat=${r15?.lat})`)

  // --- 16. Plus Code (full code) ---
  console.log('\n16. Plus Code location')
  await reset()
  await clearSendsLog()
  await postWebhook(textMsg('p6_msg50', 'hi'))
  await postWebhook(imageMsg('p6_msg51'))
  await pollUntil(async () => (await getSession())?.context?.ai, { timeoutMs: 15000, what: 'process_image' })
  await postWebhook(textMsg('p6_msg52', '1'))
  // 9FFW84J9+XG — a full 8+2 Plus Code near Myanmar; pluscodes.decode should
  // resolve it directly (no need for short-code expansion against centroid).
  await postWebhook(textMsg('p6_msg53', '9FFW84J9+XG'))
  await pollUntil(async () => (await getLatestReport()) !== undefined, { timeoutMs: 8000, what: 'insert_report (pluscode)' })
  const r16 = await getLatestReport()
  check('pluscode: location_method = plus_code', r16?.location_method === 'plus_code', `(got ${r16?.location_method})`)
  check('pluscode: plus_code column populated', r16?.plus_code === '9FFW84J9+XG', `(got ${r16?.plus_code})`)
  // 9FFW84J9+XG decodes to lat=59.332438, lng=18.118813 (Stockholm). The
  // crisis bbox centroid is at lat≈21.85, lng≈96.15 (Myanmar) — completely
  // different region — so a silent fallback to centroid would fail this check.
  check('pluscode: decoded near 59.33N/18.12E (Stockholm)',
        Math.abs((r16?.lat ?? 0) - 59.3324) < 0.001 && Math.abs((r16?.lng ?? 0) - 18.1188) < 0.001,
        `(got lat=${r16?.lat} lng=${r16?.lng})`)

  // Cleanup
  await reset()
  console.log('\nCleanup done.')

  console.log(`\n=== ${passed} passed, ${failed} failed ===`)
  if (fails.length) {
    console.log('Failures:')
    fails.forEach(f => console.log(`  - ${f}`))
  }
  await sql.end()
  process.exit(failed > 0 ? 1 : 0)
}

function parseEnv(text) {
  const out = {}
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) out[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2')
  }
  return out
}

main().catch(e => {
  console.error('\n!!! Test runner crashed:', e)
  sql.end().catch(() => {})
  process.exit(1)
})
