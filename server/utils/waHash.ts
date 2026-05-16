import { createHmac } from 'node:crypto'

export function hashWaId(waId: string, secret: string): string {
  return createHmac('sha256', secret).update(waId).digest('hex')
}
