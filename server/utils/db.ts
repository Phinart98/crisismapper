import postgres from 'postgres'

let _db: ReturnType<typeof postgres> | null = null

export function getDb() {
  if (!_db) {
    const { dbUrl } = useRuntimeConfig()
    _db = postgres(dbUrl, { prepare: false, max: 10, connect_timeout: 10 })
  }
  return _db
}
