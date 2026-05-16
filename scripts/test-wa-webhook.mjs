#!/usr/bin/env node
// Local end-to-end test for Phase 5 WhatsApp webhook + state machine.
//
// Usage:
//   1. npm run dev                  (in another shell — keeps :3000 alive)
//   2. node scripts/test-wa-webhook.mjs
//
// Reads secrets from .env, fires HMAC-signed POSTs at the local handler,
// asserts state transitions against Supabase. No real WhatsApp messages
// are sent inbound; outbound replies to Meta WILL be attempted but failure
// is tolerated (the state machine doesn't depend on send success).
//
// Idempotent: cleans whatsapp_sessions + reporters rows for the test wa_id
// before and after the run.

import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
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
const imageMsg = (id) => ({ from: TEST_WA_ID, id, timestamp: now(), type: 'image', image: { id: `media_${id}`, mime_type: 'image/jpeg', sha256: 'deadbeef' } })
const locationMsg = (id) => ({ from: TEST_WA_ID, id, timestamp: now(), type: 'location', location: { latitude: 5.5, longitude: -0.2 } })

async function getSession() {
  const [row] = await sql`SELECT state, current_report_id, context, last_message_at FROM whatsapp_sessions WHERE wa_id_hash = ${TEST_WA_HASH}`
  return row
}

async function reset() {
  await sql`DELETE FROM whatsapp_sessions WHERE wa_id_hash = ${TEST_WA_HASH}`
  await sql`DELETE FROM reporters WHERE whatsapp_id_hash = ${TEST_WA_HASH}`
}

async function main() {
  console.log(`Testing ${ENDPOINT}`)
  console.log(`Test wa_id_hash: ${TEST_WA_HASH.slice(0, 16)}...`)
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
  check('last_media_id stored in context', s?.context?.last_media_id === 'media_msg_2', `(got ${s?.context?.last_media_id})`)

  // --- 5. POST "1" — AWAITING_CONFIRM → AWAITING_LOCATION ---
  console.log('\n5. POST "1" (confirm)')
  const r5 = await postWebhook(textMsg('msg_3', '1'))
  check('returns 200', r5.status === 200, `(got ${r5.status})`)
  s = await getSession()
  check('state = AWAITING_LOCATION', s?.state === 'AWAITING_LOCATION', `(got ${s?.state})`)
  check('severity_confirmed in context', s?.context?.severity_confirmed === true)

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
  check('context.severity_confirmed cleared', !s?.context?.severity_confirmed)

  // --- 9. Bad confirm input stays in AWAITING_CONFIRM ---
  console.log('\n9. AWAITING_CONFIRM: invalid reply does not transition')
  await postWebhook(imageMsg('msg_6'))  // → AWAITING_CONFIRM
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
