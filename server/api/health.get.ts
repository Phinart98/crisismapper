import postgres from 'postgres'

let sql: ReturnType<typeof postgres> | null = null

function getDb() {
  if (sql) return sql
  const { dbUrl } = useRuntimeConfig()
  sql = postgres(dbUrl, {
    prepare: false,  // belt-and-braces: Supavisor transaction mode requires no prepared statements
    max: 1,          // single connection — Vercel serverless is per-request anyway
    idle_timeout: 20,
    connect_timeout: 10
  })
  return sql
}

export default defineEventHandler(async () => {
  try {
    const db = getDb()
    const [row] = await db`SELECT 1 AS ok, current_database() AS db, now() AS ts`
    return { ok: true, db: 'connected', database: row.db, ts: row.ts }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, db: 'error', error: message }
  }
})
