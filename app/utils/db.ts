import Dexie, { type Table } from 'dexie'

export interface PendingReport {
  id?: number
  created_at: number
  retries: number
  payload: {
    crisis_id: string
    severity: string
    infrastructure_type: string
    location: [number, number]
    location_method: string
    plus_code?: string
    description?: string
    electricity_status?: string
    health_status?: string
    community_needs?: string
    vulnerable_groups?: string
  }
  photo?: Blob
  photo_hash?: string
}

export class CrisisDB extends Dexie {
  pending_reports!: Table<PendingReport, number>
  constructor() {
    super('crisismapper')
    this.version(1).stores({
      pending_reports: '++id, created_at, retries',
    })
  }
}

let _db: CrisisDB | null = null
export function getDb(): CrisisDB {
  if (!_db) _db = new CrisisDB()
  return _db
}
