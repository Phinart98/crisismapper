import type { CrisisDB, PendingReport } from './db'

const MAX_RETRIES = 10

let inFlight: Promise<DrainResult> | null = null

export interface DrainResult {
  drained: number
  failed: number
  remaining: number
  drainedIds: number[]
  // Rows whose metadata landed but whose photo upload failed — the report is
  // safe server-side, only the photo was lost. Surfaced so the UI can warn.
  photoFailedIds: number[]
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

  const drainedIds: number[] = []
  const photoFailedIds: number[] = []
  let failed = 0

  for (const row of pending) {
    try {
      const photoOk = await drainOne(db, row)
      drainedIds.push(row.id!)
      if (!photoOk) photoFailedIds.push(row.id!)
    } catch {
      await db.pending_reports
        .where('id').equals(row.id!)
        .modify(r => { r.retries = (r.retries ?? 0) + 1 })
      failed++
      // Stop on first failure: network is probably still down. Re-throw so
      // SW Background Sync keeps the registration alive for OS-driven retry.
      const remaining = await db.pending_reports.count()
      const err = new Error('drain_failed')
      ;(err as any).result = { drained: drainedIds.length, failed, remaining, drainedIds, photoFailedIds }
      throw err
    }
  }

  const remaining = await db.pending_reports.count()
  return { drained: drainedIds.length, failed, remaining, drainedIds, photoFailedIds }
}

async function drainOne(db: CrisisDB, row: PendingReport): Promise<boolean> {
  const metaRes = await fetch('/api/reports', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(row.payload),
  })
  // A validation-class rejection means the server will never accept this payload —
  // retrying forever would block every row queued behind it and leave a phantom
  // "pending" badge. Drop it and keep draining. Other 4xx (401/403/404/429…) can be
  // transient (deploy in flight, auth hiccup) and stay on the retry path.
  if ([400, 413, 422].includes(metaRes.status)) {
    console.warn('[drainQueue] dropping permanently rejected report', metaRes.status)
    await db.pending_reports.delete(row.id!)
    return true
  }
  if (!metaRes.ok) throw new Error(`metadata ${metaRes.status}`)
  const { id } = await metaRes.json() as { id: string }

  let photoOk = true
  if (row.photo) {
    const fd = new FormData()
    fd.append('photo', row.photo, 'photo.webp')
    if (row.photo_hash) fd.append('photo_hash', row.photo_hash)
    const photoRes = await fetch(`/api/reports/${id}/photo`, {
      method: 'POST',
      body: fd,
    })
    // Photo failure ≠ row failure: metadata already landed, so the row is
    // dropped either way — but report it so the confirm screen can warn.
    if (!photoRes.ok && photoRes.status !== 404) {
      console.warn('[drainQueue] photo upload failed', photoRes.status)
      photoOk = false
    }
  }

  await db.pending_reports.delete(row.id!)
  return photoOk
}
