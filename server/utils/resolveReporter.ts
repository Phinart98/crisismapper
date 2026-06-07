import { createHmac } from 'node:crypto'
import type { getDb } from './db'

type Db = ReturnType<typeof getDb>

// Local-demo fallback so the offline-first PWA works with zero setup. Production MUST set
// NUXT_REPORTER_SALT (mirrors the translate endpoint's dev-exemption posture).
const DEV_FALLBACK_SALT = 'cm-dev-reporter-salt'

// One-way HMAC of a client device id — the value actually stored in reporters.device_hash.
// Returns null when no salt is configured (→ reporter attribution disabled). Shared by the
// insert path (resolveReporter) and read-only lookups (the /me profile) so the hashing
// scheme lives in exactly one place.
export function hashDeviceId(deviceId: string): string | null {
  const { reporterSalt } = useRuntimeConfig()
  const salt = reporterSalt || (import.meta.dev ? DEV_FALLBACK_SALT : '')
  if (!salt) return null
  return createHmac('sha256', salt).update(deviceId).digest('hex')
}

// Map a client device id to a stable, pseudonymous reporter row. The device id is HMAC'd
// before storage — one-way, not reversible to the original UUID, and never stored raw.
// Returns the reporter UUID, or null (→ report stays anonymous) if no salt is configured.
export async function resolveReporter(db: Db, deviceId: string): Promise<string | null> {
  const hash = hashDeviceId(deviceId)
  if (!hash) return null

  const [row] = await db<{ id: string }[]>`
    INSERT INTO reporters (channel, device_hash)
    VALUES ('pwa', ${hash})
    ON CONFLICT (device_hash) DO UPDATE SET device_hash = EXCLUDED.device_hash
    RETURNING id
  `
  return row?.id ?? null
}
