import { createHmac, timingSafeEqual } from 'node:crypto'

const PREFIX = 'sha256='

export function verifySignature(
  rawBody: Buffer,
  headerValue: string | undefined,
  appSecret: string
): boolean {
  if (!headerValue || !headerValue.startsWith(PREFIX)) return false

  let received: Buffer
  try {
    received = Buffer.from(headerValue.slice(PREFIX.length), 'hex')
  } catch {
    return false
  }

  const expected = createHmac('sha256', appSecret).update(rawBody).digest()
  if (received.length !== expected.length) return false

  return timingSafeEqual(received, expected)
}
