import { timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

// Shared-secret gate (x-admin-key) for privileged endpoints — /api/translate and the
// /api/export data dump. Exact ground-truth coordinates are "staff" data per Webinar
// Q&A #18; this is the demo-scoped interim, replaced by Supabase staff RLS in Phase 10.
// Deny by default in production when no key is configured; local dev is exempt so the
// offline-first demo runs with zero setup (mirrors the original translate posture).
export function requireAdmin(event: H3Event) {
  const { adminKey } = useRuntimeConfig(event)
  if (!adminKey) {
    if (!import.meta.dev) {
      throw createError({ statusCode: 503, message: 'Endpoint disabled — set NUXT_ADMIN_KEY.' })
    }
    return
  }
  if (!safeEqual(getHeader(event, 'x-admin-key') ?? '', adminKey)) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
}
