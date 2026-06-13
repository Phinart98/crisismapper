// Fills AI classifications for demo reports that have a photo but no AI result,
// using the model-authored generator (scripts/demo/classify.mjs) — NO live API,
// so it's instant and immune to the Groq/Gemini daily cap. Re-runnable: only
// touches reports where ai_confidence IS NULL. The reporter-chosen `severity`
// stays untouched; ai_severity is generated to match it.

import { readFile } from 'node:fs/promises'
import postgres from 'postgres'
import { generate, bucketForHazard } from './classify.mjs'

const env = Object.fromEntries(
  (await readFile('.env', 'utf8')).split('\n')
    .map(l => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map(m => [m[1], m[2].trim()]),
)
const db = postgres(env.NUXT_DB_URL, { prepare: false, max: 2 })

const rows = await db`
  SELECT d.id, d.severity, d.infrastructure_type, c.crisis_type
  FROM damage_reports d JOIN crises c ON c.id = d.crisis_id
  WHERE d.photo_url IS NOT NULL AND d.ai_confidence IS NULL`
console.log(`${rows.length} reports to classify`)

let n = 0
for (const r of rows) {
  const ai = generate(bucketForHazard(r.crisis_type), r.infrastructure_type ?? 'other', r.severity)
  await db`UPDATE damage_reports SET
    ai_severity = ${ai.severity}, ai_confidence = ${ai.confidence},
    ai_infrastructure_visible = ${ai.infrastructure_visible}, ai_raw_response = ${db.json(ai)}
    WHERE id = ${r.id}`
  if (++n % 25 === 0) process.stdout.write(`${n} `)
}

const [c] = await db`SELECT count(*)::int AS total, count(ai_confidence)::int AS with_ai FROM damage_reports WHERE photo_url IS NOT NULL`
console.log(`\ndone: ${n} classified; AI coverage now ${c.with_ai}/${c.total}`)
await db.end()
