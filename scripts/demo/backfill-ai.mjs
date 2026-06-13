#!/usr/bin/env node
// Backfills AI classification for seeded reports that have a photo but no AI result
// (the demo seed leaves these when the vision provider's daily token budget is spent;
// they are a legitimate "AI offline" shape). Re-runnable: it only touches reports
// where ai_confidence IS NULL, so running it once the budget resets fills the rest.
//
// Run:  TARGET_URL=https://crisismapper.vercel.app node scripts/demo/backfill-ai.mjs
//
// Downloads each report's stored photo, re-runs it through /api/ai/classify, and
// writes ai_severity / ai_confidence / ai_infrastructure_visible / ai_raw_response.
// The reporter-chosen `severity` is left untouched (the human's call stands).

import { readFile } from 'node:fs/promises'
import postgres from 'postgres'

const env = Object.fromEntries(
  (await readFile('.env', 'utf8')).split('\n')
    .map(l => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map(m => [m[1], m[2].trim()]),
)
const db = postgres(env.NUXT_DB_URL, { prepare: false, max: 2 })
const TARGET_URL = process.env.TARGET_URL ?? 'http://localhost:3000'
const sleep = ms => new Promise(r => setTimeout(r, ms))

const rows = await db`
  SELECT id, photo_url FROM damage_reports
  WHERE photo_url IS NOT NULL AND ai_confidence IS NULL
  ORDER BY submitted_at DESC`
console.log(`${rows.length} reports to backfill`)

let filled = 0, skipped = 0
for (const [i, row] of rows.entries()) {
  try {
    const img = await fetch(row.photo_url)
    if (!img.ok) { skipped++; continue }
    const fd = new FormData()
    fd.append('photo', new Blob([await img.arrayBuffer()], { type: 'image/webp' }), 'photo.webp')
    const res = await fetch(`${TARGET_URL}/api/ai/classify`, { method: 'POST', body: fd })
    const ai = res.ok ? await res.json() : null
    if (!ai || ai._meta?.provider === 'degraded') { skipped++; process.stdout.write('·'); continue }
    await db`UPDATE damage_reports SET
      ai_severity = ${ai.severity}, ai_confidence = ${ai.confidence},
      ai_infrastructure_visible = ${ai.infrastructure_visible},
      ai_raw_response = ${db.json(ai)} WHERE id = ${row.id}`
    filled++
    process.stdout.write('+')
  } catch {
    skipped++; process.stdout.write('!')
  }
  if ((i + 1) % 50 === 0) process.stdout.write(`\n[${i + 1}/${rows.length}] filled=${filled} skipped=${skipped}\n`)
  await sleep(2500)
}
console.log(`\ndone: filled=${filled} skipped=${skipped} (re-run after the provider budget resets to fill the rest)`)
await db.end()
