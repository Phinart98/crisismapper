import { createHash, randomBytes } from 'node:crypto'
import { waitUntil } from '@vercel/functions'
// pluscodes is CJS with Object.defineProperty(exports, ...) getters. Node's
// ESM loader can't statically detect those as named exports, and Nitro's
// runtime namespace-import lookup misses them too. Default-import + runtime
// destructure is the path that works in both dev (vite-node) and prod (esbuild).
import pluscodesCjs from 'pluscodes'
const { decode: plusDecode, expand: plusExpand } = pluscodesCjs as unknown as {
  decode: typeof import('pluscodes').decode
  expand: typeof import('pluscodes').expand
}
import { verifySignature } from '../../utils/waSignature'
import { hashWaId } from '../../utils/waHash'
import { loadOrInitSession, saveSession, upsertReporter } from '../../utils/waSession'
import { transition, buildConfirmList, type Effect } from '../../utils/waState'
import { sendList, sendText } from '../../utils/waSend'
import { downloadMedia } from '../../utils/waMedia'
import { stripExif } from '../../utils/sharpStrip'
import { classifyDamage } from '../../utils/aiVision'
import { getSupabaseAdmin } from '../../utils/supabaseAdmin'
import {
  awardFirstResponderIfEligible,
  getCrisisCentroid,
  getReporterIdByHash,
  getStatusDigest,
  insertWhatsappReport,
  setCommunityNeeds,
  setElectricityStatus,
  setHealthStatus,
  type ElectricityStatus,
  type HealthStatus,
} from '../../utils/waReport'
import type { WaInboundMessage, WaWebhookPayload } from '../../utils/waTypes'
import { getDb } from '../../utils/db'

const DEDUPE_KEEP = 5

export default defineEventHandler(async (event) => {
  const { metaAppSecret, wabaHashSecret } = useRuntimeConfig()

  const raw = await readRawBody(event, false)
  if (!raw || !Buffer.isBuffer(raw)) {
    throw createError({ statusCode: 400, statusMessage: 'No body' })
  }

  const sig = getHeader(event, 'x-hub-signature-256')
  if (!metaAppSecret || !verifySignature(raw, sig, metaAppSecret)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid signature' })
  }

  // Signature is valid — from here on, always 200 so Meta doesn't retry.
  let payload: WaWebhookPayload
  try {
    payload = JSON.parse(raw.toString('utf-8')) as WaWebhookPayload
  } catch {
    console.warn('[waWebhook] malformed JSON body')
    return { ok: true }
  }

  if (!wabaHashSecret) {
    console.warn('[waWebhook] missing wabaHashSecret; cannot derive wa_id_hash')
    return { ok: true }
  }

  try {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const msg of change.value?.messages ?? []) {
          await processMessage(msg, wabaHashSecret)
        }
        for (const s of change.value?.statuses ?? []) {
          const err = s.errors?.[0]
          console.log(`[waWebhook] status=${s.status}${err ? ` err=${err.code}:${err.title}` : ''}`)
        }
      }
    }
  } catch (e) {
    console.warn('[waWebhook] processing error:', e instanceof Error ? e.message : String(e))
  }

  return { ok: true }
})

async function processMessage(msg: WaInboundMessage, hashSecret: string): Promise<void> {
  if (!msg.from || !msg.id) return

  const waIdHash = hashWaId(msg.from, hashSecret)
  const session = await loadOrInitSession(waIdHash)

  const processed = Array.isArray(session.context.processed) ? session.context.processed : []
  if (processed.includes(msg.id)) {
    console.log(`[waWebhook] skip duplicate message ${msg.id.slice(0, 12)}…`)
    return
  }

  await upsertReporter(waIdHash)

  const next = transition(session, msg)

  const newProcessed = [...processed, msg.id].slice(-DEDUPE_KEEP)
  await saveSession(waIdHash, {
    state: next.state,
    currentReportId: next.currentReportId,
    context: { ...next.context, processed: newProcessed },
  })

  // Synchronous text reply (e.g. "📸 Analyzing your photo…"). Push to
  // waitUntil so the webhook ack stays under Meta's 5s retry threshold.
  if (next.reply) waitUntil(sendText(msg.from, next.reply))
  if (next.listReply) {
    const lr = next.listReply
    waitUntil(sendList(msg.from, lr.body, lr.button, lr.rows))
  }

  for (const effect of next.effects) {
    waitUntil(executeEffect(effect, msg.from, waIdHash))
  }
}

async function executeEffect(effect: Effect, to: string, waIdHash: string): Promise<void> {
  try {
    switch (effect.kind) {
      case 'process_image':
        await handleProcessImage(effect.mediaId, to, waIdHash)
        return
      case 'insert_report':
        await handleInsertReport(effect, to, waIdHash)
        return
      case 'status_digest':
        await handleStatusDigest(to, waIdHash)
        return
      case 'more_step':
        await handleMoreStep(effect, to)
        return
    }
  } catch (e) {
    console.warn(`[waWebhook.effect.${effect.kind}] failed:`, e instanceof Error ? e.message : String(e))
  }
}

async function handleProcessImage(mediaId: string, to: string, waIdHash: string): Promise<void> {
  const { buf: rawBuf } = await downloadMedia(mediaId)
  const photoHashHex = createHash('sha256').update(rawBuf).digest('hex')
  const cleaned = await stripExif(rawBuf)

  const supabase = getSupabaseAdmin()
  const path = `whatsapp/${waIdHash.slice(0, 16)}-${randomBytes(8).toString('hex')}.webp`

  // Storage upload + AI classify both operate on `cleaned` and don't depend
  // on each other. Running them in parallel shaves 1-2s off the photo →
  // confirm-prompt latency. Tradeoff: if AI throws after upload succeeds,
  // the photo is orphaned in the bucket — log the path for audit/cleanup.
  const [uploadResult, aiResult] = await Promise.allSettled([
    supabase.storage
      .from('damage-photos')
      .upload(path, cleaned, { contentType: 'image/webp', upsert: false }),
    classifyDamage(cleaned),
  ])
  if (uploadResult.status === 'rejected') throw new Error(`storage upload failed: ${uploadResult.reason}`)
  if (uploadResult.value.error) throw new Error(`storage upload failed: ${uploadResult.value.error.message}`)
  if (aiResult.status === 'rejected') {
    console.warn(`[waWebhook.handleProcessImage] AI threw after upload — orphan at ${path}: ${aiResult.reason}`)
    throw new Error(`AI classify failed: ${aiResult.reason}`)
  }
  const ai = aiResult.value

  const { data: { publicUrl } } = supabase.storage
    .from('damage-photos')
    .getPublicUrl(path)

  const session = await loadOrInitSession(waIdHash)
  const ctx = { ...session.context, ai, photo_url: publicUrl, photo_hash: photoHashHex }
  await saveSession(waIdHash, {
    state: session.state,
    currentReportId: session.current_report_id,
    context: ctx,
  })

  const list = buildConfirmList(ai.severity, ai.confidence)
  await sendList(to, list.body, list.button, list.rows)
}

async function handleInsertReport(
  effect: Extract<Effect, { kind: 'insert_report' }>,
  to: string,
  waIdHash: string
): Promise<void> {
  const { public: { demoCrisisId } } = useRuntimeConfig()
  if (!demoCrisisId) {
    console.warn('[waWebhook] demoCrisisId not configured; cannot insert report')
    await sendText(to, 'Our system is misconfigured — please try again later.')
    return
  }

  const reporterId = await getReporterIdByHash(waIdHash)
  if (!reporterId) {
    console.warn('[waWebhook] reporter not found for hash')
    return
  }

  // Race window: a user who fires photo → confirm → location while
  // process_image is still uploading + classifying can reach this point
  // before context.ai is saved. Poll the (read-only) context up to 10s so
  // we don't insert with ai_* null when the AI was actually running.
  // After 10s, accept whatever we have — losing the report is worse.
  let ctx = (await getSessionContext(waIdHash)) ?? {}
  const pollDeadline = Date.now() + 10000
  while (!ctx.ai && Date.now() < pollDeadline) {
    await new Promise(r => setTimeout(r, 500))
    ctx = (await getSessionContext(waIdHash)) ?? {}
  }
  const ai = ctx.ai ?? null
  const photoUrl = ctx.photo_url ?? null
  const photoHashHex = ctx.photo_hash ?? null

  let lng = effect.lng
  let lat = effect.lat
  let landmark = effect.landmark
  let qualityScore: number | null = null

  // Plus Code that decodes wins; anything else falls back to crisis centroid
  // with quality_score=0.2. Landmark text takes the same fallback directly.
  if (effect.locationMethod === 'plus_code' && effect.rawTextForDecode) {
    const decoded = await decodePlusCodeWithFallback(effect.rawTextForDecode, demoCrisisId)
    if (decoded) {
      lng = decoded.lng
      lat = decoded.lat
    } else {
      landmark = effect.rawTextForDecode
      const fb = await applyCentroidFallback(demoCrisisId, to)
      if (!fb) return
      lng = fb.lng; lat = fb.lat; qualityScore = 0.2
    }
  } else if (effect.locationMethod === 'landmark_text') {
    const fb = await applyCentroidFallback(demoCrisisId, to)
    if (!fb) return
    lng = fb.lng; lat = fb.lat; qualityScore = 0.2
  }

  if (lng === null || lat === null) {
    await sendText(to, 'I couldn\'t parse that location — try GPS or a Plus Code.')
    return
  }

  const reportId = await insertWhatsappReport({
    crisisId: demoCrisisId,
    reporterId,
    severity: effect.severity,
    infrastructureType: effect.infrastructureType,
    photoUrl,
    photoHashHex,
    ai,
    locationMethod: effect.locationMethod,
    lng,
    lat,
    plusCode: effect.plusCode,
    landmark,
    qualityScore,
  })

  // Wire current_report_id into the session so the 'more' sub-flow can target it.
  // Run in parallel with the badge / rank query — they're independent writes.
  const db = getDb()
  const [{ awarded, rank }] = await Promise.all([
    awardFirstResponderIfEligible(demoCrisisId, reporterId),
    db`UPDATE whatsapp_sessions SET current_report_id = ${reportId} WHERE wa_id_hash = ${waIdHash}`,
  ])
  const badgeLine = awarded ? '\n🚨 You earned the First Responder badge.' : ''

  await sendText(
    to,
    `✅ Report saved! You're reporter #${rank} in this area.${badgeLine}\n` +
    `Reply 'more' to add details (electricity, needs, etc.)\n` +
    `Reply 'status' to see the crisis-zone summary.`
  )
}

async function handleStatusDigest(to: string, waIdHash: string): Promise<void> {
  const { public: { demoCrisisId } } = useRuntimeConfig()
  if (!demoCrisisId) {
    await sendText(to, 'No active crisis is configured. Please try again later.')
    return
  }
  const reporterId = await getReporterIdByHash(waIdHash)
  const d = await getStatusDigest({ crisisId: demoCrisisId, reporterId })

  const total = d.total
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0)
  const own = reporterId
    ? `\n• Your reports: ${d.ownCount}${d.ownVerified > 0 ? ` (${d.ownVerified} verified ✅)` : ''}`
    : ''

  const body =
    `📊 Crisis-zone update\n` +
    `• ${total} reports received\n` +
    `• 🔴 ${pct(d.byClass.complete)}% complete · 🟠 ${pct(d.byClass.partial)}% partial · 🟡 ${pct(d.byClass.minimal)}% minimal${own}`

  // < 400 chars keeps us inside the free user-initiated window per plan.
  await sendText(to, body.slice(0, 400))
}

async function handleMoreStep(
  effect: Extract<Effect, { kind: 'more_step' }>,
  to: string
): Promise<void> {
  const choiceNum = Number(effect.choice)
  if (effect.step === 'electricity') {
    const map: Record<number, ElectricityStatus> = {
      1: 'functional', 2: 'partial', 3: 'non-functional', 4: 'unknown',
    }
    const v = map[choiceNum]
    if (v) await setElectricityStatus(effect.reportId, v)
    return
  }
  if (effect.step === 'health') {
    const map: Record<number, HealthStatus> = {
      1: 'operational', 2: 'partial', 3: 'down', 4: 'unknown',
    }
    const v = map[choiceNum]
    if (v) await setHealthStatus(effect.reportId, v)
    return
  }
  // step === 'needs'
  const tokens = effect.choice
    .split(/[\s,]+/)
    .map(s => s.toLowerCase())
    .filter(s => ['water', 'food', 'shelter', 'medical', 'search'].includes(s))
  if (tokens.length > 0) await setCommunityNeeds(effect.reportId, tokens)
}

async function decodePlusCodeWithFallback(
  raw: string,
  crisisId: string
): Promise<{ lng: number; lat: number } | null> {
  const direct = plusDecode(raw)
  if (direct) return { lng: direct.longitude, lat: direct.latitude }

  // Short code — needs a reference. Use the crisis bbox centroid.
  const centroid = await getCrisisCentroid(crisisId)
  if (!centroid) return null
  const full = plusExpand(raw, { latitude: centroid.lat, longitude: centroid.lng })
  if (!full) return null
  const decoded = plusDecode(full)
  if (!decoded) return null
  return { lng: decoded.longitude, lat: decoded.latitude }
}

// Crisis bbox centroid as a last-resort location. Notifies the user + returns
// null if no centroid is available (e.g. crisis row missing or bbox null).
async function applyCentroidFallback(
  crisisId: string,
  to: string
): Promise<{ lng: number; lat: number } | null> {
  const centroid = await getCrisisCentroid(crisisId)
  if (centroid) return centroid
  await sendText(to, 'I couldn\'t place that location — try sharing GPS instead.')
  return null
}

