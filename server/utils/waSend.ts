import { appendFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

// Outbound text / interactive replies via Meta Cloud API Graph endpoint.
// Errors are logged and swallowed so the webhook handler always returns 200 —
// Meta retries on non-2xx and a retry won't fix a permanent send failure.

const GRAPH_VERSION = 'v22.0'
const SEND_TIMEOUT_MS = 3000

// Test-only path: when set, sends are appended to .cache/wa-sends.jsonl
// instead of POSTing to Meta. Lets the test harness assert outbound content
// without depending on a working WABA (which is BLOCKED until Phase 11).
const CAPTURE_PATH = process.env.NUXT_TEST_CAPTURE_SENDS === '1'
  ? (process.env.NUXT_TEST_CAPTURE_PATH ?? '.cache/wa-sends.jsonl')
  : null

export async function sendText(to: string, body: string): Promise<string | null> {
  return await send({ type: 'text', text: { preview_url: false, body } }, to)
}

export interface ListRow {
  id: string
  title: string
  description?: string
}

// Interactive list message — used for >3 choice prompts (Meta reply buttons cap at 3).
// `button` is the label on the call-to-action that opens the list (max 20 chars).
// Each row title is capped at 24 chars by Meta; we slice defensively here.
export async function sendList(
  to: string,
  body: string,
  button: string,
  rows: ListRow[]
): Promise<string | null> {
  return await send(
    {
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: body },
        action: {
          button: button.slice(0, 20),
          sections: [
            {
              rows: rows.map(r => ({
                id: r.id,
                title: r.title.slice(0, 24),
                ...(r.description ? { description: r.description.slice(0, 72) } : {}),
              })),
            },
          ],
        },
      },
    },
    to
  )
}

type OutboundPayload =
  | { type: 'text'; text: { preview_url: boolean; body: string } }
  | { type: 'interactive'; interactive: unknown }

async function send(payload: OutboundPayload, to: string): Promise<string | null> {
  if (CAPTURE_PATH) {
    await capture(to, payload)
    return `captured_${Date.now()}`
  }

  const { metaWabaToken, metaPhoneNumberId } = useRuntimeConfig()
  if (!metaWabaToken || !metaPhoneNumberId) {
    console.warn('[waSend] missing META credentials; cannot send reply')
    return null
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${metaPhoneNumberId}/messages`

  let resp: Response
  try {
    resp = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${metaWabaToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        ...payload,
      }),
    })
  } catch (e) {
    console.warn('[waSend] network error:', e instanceof Error ? e.message : String(e))
    return null
  }

  if (!resp.ok) {
    // Meta error bodies routinely embed the recipient phone number. Pull only
    // the structured code/message, then strip any E.164-shaped digit run so we
    // never write a raw wa_id to Vercel logs.
    const errText = await resp.text().catch(() => '')
    let code: number | string = 'unknown'
    let msg = ''
    try {
      const parsed = JSON.parse(errText) as { error?: { code?: number; message?: string } }
      code = parsed.error?.code ?? 'unknown'
      msg = (parsed.error?.message ?? '').slice(0, 200)
    } catch {
      // body wasn't JSON; leave msg empty
    }
    const scrubbed = msg.replace(/\+?\d{7,15}/g, '[redacted]')
    console.warn(`[waSend] send failed ${resp.status}: code=${code} msg="${scrubbed}"`)
    return null
  }

  const json = (await resp.json().catch(() => null)) as { messages?: Array<{ id?: string }> } | null
  return json?.messages?.[0]?.id ?? null
}

async function capture(to: string, payload: OutboundPayload): Promise<void> {
  if (!CAPTURE_PATH) return
  try {
    await mkdir(dirname(CAPTURE_PATH), { recursive: true })
    // Scrub recipient — the harness identifies messages by ordering, not phone.
    const line = JSON.stringify({ ts: Date.now(), to: '[redacted]', payload }) + '\n'
    await appendFile(CAPTURE_PATH, line, 'utf8')
  } catch (e) {
    console.warn('[waSend.capture] failed:', e instanceof Error ? e.message : String(e))
  }
}
