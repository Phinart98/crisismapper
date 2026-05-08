import { getDb } from '../utils/db'

export default defineEventHandler(async () => {
  const db = getDb()
  try {
    const [row] = await db`SELECT 1 AS ok, current_database() AS db, now() AS ts`
    return { ok: true, db: 'connected', database: row!.db, ts: row!.ts }
  } catch (err) {
    return { ok: false, db: 'error', error: err instanceof Error ? err.message : String(err) }
  }
  // Do NOT call db.end() — the pool is a module-scope singleton shared across
  // requests in the same Fluid Compute instance. Ending it kills future requests.
})
