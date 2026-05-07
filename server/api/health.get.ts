import { getDb } from '../utils/db'

export default defineEventHandler(async () => {
  const db = getDb()
  try {
    const [row] = await db`SELECT 1 AS ok, current_database() AS db, now() AS ts`
    return { ok: true, db: 'connected', database: row!.db, ts: row!.ts }
  } catch (err) {
    return { ok: false, db: 'error', error: err instanceof Error ? err.message : String(err) }
  } finally {
    await db.end()
  }
})
