import type { CrisisDB, PendingReport } from './db'

const MAX_RETRIES = 10

let inFlight: Promise<DrainResult> | null = null

export interface DrainResult {
  drained: number
  failed: number
  remaining: number
}

export function drainQueue(db: CrisisDB): Promise<DrainResult> {
  if (inFlight) return inFlight
  inFlight = runDrain(db).finally(() => { inFlight = null })
  return inFlight
}

async function runDrain(db: CrisisDB): Promise<DrainResult> {
  const pending = await db.pending_reports
    .orderBy('created_at')
    .filter(r => (r.retries ?? 0) < MAX_RETRIES)
    .toArray()

  let drained = 0
  let failed = 0

  for (const row of pending) {
    try {
      await drainOne(db, row)
      drained++
    } catch {
      await db.pending_reports
        .where('id').equals(row.id!)
        .modify(r => { r.retries = (r.retries ?? 0) + 1 })
      failed++
      // Stop on first failure: network is probably still down. Re-throw so
      // SW Background Sync keeps the registration alive for OS-driven retry.
      const remaining = await db.pending_reports.count()
      const err = new Error('drain_failed')
      ;(err as any).result = { drained, failed, remaining }
      throw err
    }
  }

  const remaining = await db.pending_reports.count()
  return { drained, failed, remaining }
}

async function drainOne(db: CrisisDB, row: PendingReport): Promise<void> {
  const metaRes = await fetch('/api/reports', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(row.payload),
  })
  if (!metaRes.ok) throw new Error(`metadata ${metaRes.status}`)
  const { id } = await metaRes.json() as { id: string }

  if (row.photo) {
    const fd = new FormData()
    fd.append('photo', row.photo, 'photo.webp')
    if (row.photo_hash) fd.append('photo_hash', row.photo_hash)
    const photoRes = await fetch(`/api/reports/${id}/photo`, {
      method: 'POST',
      body: fd,
    })
    // Photo failure ≠ row failure: metadata already landed. Drop the row;
    // user can retry via the existing retryPhoto UI on the confirm screen.
    if (!photoRes.ok && photoRes.status !== 404) {
      console.warn('[drainQueue] photo upload failed', photoRes.status)
    }
  }

  await db.pending_reports.delete(row.id!)
}
