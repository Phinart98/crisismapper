import { verifySignature } from '../../utils/waSignature'
import { hashWaId } from '../../utils/waHash'
import { loadOrInitSession, saveSession, upsertReporter } from '../../utils/waSession'
import { transition } from '../../utils/waState'
import { sendText } from '../../utils/waSend'
import type { WaInboundMessage, WaWebhookPayload } from '../../utils/waTypes'

// How many recent message IDs to keep in session.context.processed for retry-dedupe.
// Meta retries any non-2xx or >5s response; this prevents double-transition + double-reply.
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
  // Logic errors don't get fixed by retrying.
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
        // Phase 5 diagnostic: surface delivery status events so we can tell
        // whether outbound messages actually land. Phase 6 will either keep
        // this for monitoring or remove once delivery is proven stable.
        // Deliberately does not log recipient_id — it's the raw E.164 phone
        // number, and the privacy policy promises no raw numbers in logs.
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

  if (next.reply) {
    await sendText(msg.from, next.reply)
  }
}
