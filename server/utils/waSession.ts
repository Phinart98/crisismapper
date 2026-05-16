import type postgres from 'postgres'
import { getDb } from './db'

export type WaState =
  | 'IDLE'
  | 'AWAITING_PHOTO'
  | 'AWAITING_CONFIRM'
  | 'AWAITING_LOCATION'
  | 'DONE'

export interface WaSession {
  wa_id_hash: string
  state: WaState
  current_report_id: string | null
  context: Record<string, unknown> & { processed?: string[] }
  last_message_at: Date
  expires_at: Date
}

export async function loadOrInitSession(waIdHash: string): Promise<WaSession> {
  const db = getDb()
  const [row] = await db<WaSession[]>`
    INSERT INTO whatsapp_sessions (wa_id_hash, state, last_message_at, expires_at, context)
    VALUES (${waIdHash}, 'IDLE', now(), now() + interval '1 hour', '{}'::jsonb)
    ON CONFLICT (wa_id_hash) DO UPDATE SET
      state = CASE
        WHEN whatsapp_sessions.last_message_at < now() - interval '1 hour' THEN 'IDLE'
        ELSE whatsapp_sessions.state
      END,
      current_report_id = CASE
        WHEN whatsapp_sessions.last_message_at < now() - interval '1 hour' THEN NULL
        ELSE whatsapp_sessions.current_report_id
      END,
      context = CASE
        WHEN whatsapp_sessions.last_message_at < now() - interval '1 hour' THEN '{}'::jsonb
        ELSE whatsapp_sessions.context
      END
    RETURNING wa_id_hash, state, current_report_id, context, last_message_at, expires_at
  `
  return row!
}

export async function saveSession(
  waIdHash: string,
  next: { state: WaState; currentReportId: string | null; context: Record<string, unknown> }
): Promise<void> {
  const db = getDb()
  await db`
    UPDATE whatsapp_sessions SET
      state             = ${next.state},
      current_report_id = ${next.currentReportId},
      context           = ${db.json(next.context as postgres.JSONValue)},
      last_message_at   = now(),
      expires_at        = now() + interval '1 hour'
    WHERE wa_id_hash = ${waIdHash}
  `
}

// Mirror the wa_id_hash into reporters so Phase 6 can FK-join when writing damage_reports.
// reporters.whatsapp_id_hash has a UNIQUE constraint, so ON CONFLICT DO NOTHING is safe.
export async function upsertReporter(waIdHash: string): Promise<void> {
  const db = getDb()
  await db`
    INSERT INTO reporters (channel, whatsapp_id_hash)
    VALUES ('whatsapp', ${waIdHash})
    ON CONFLICT (whatsapp_id_hash) DO NOTHING
  `
}
