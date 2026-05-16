// Outbound text reply via Meta Cloud API Graph endpoint.
// Errors are logged and swallowed so the webhook handler always returns 200 —
// Meta retries on non-2xx and a retry won't fix a permanent send failure.
export async function sendText(to: string, body: string): Promise<string | null> {
  const { metaWabaToken, metaPhoneNumberId } = useRuntimeConfig()
  if (!metaWabaToken || !metaPhoneNumberId) {
    console.warn('[waSend] missing META credentials; cannot send reply')
    return null
  }

  const url = `https://graph.facebook.com/v22.0/${metaPhoneNumberId}/messages`

  // Meta normally responds in <500ms but a hung connection would burn the
  // 5s webhook deadline. Cap at 3s — well above p99, well below the budget.
  let resp: Response
  try {
    resp = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(3000),
      headers: {
        Authorization: `Bearer ${metaWabaToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: false, body },
      }),
    })
  } catch (e) {
    console.warn('[waSend] network error:', e instanceof Error ? e.message : String(e))
    return null
  }

  if (!resp.ok) {
    // Meta error bodies routinely embed the recipient phone number (e.g.
    // error_data.details: "to: +12025551234 is not valid"). Pull only the
    // structured code/message, then strip any E.164-shaped digit run so we
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
