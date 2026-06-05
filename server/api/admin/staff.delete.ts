import * as v from 'valibot'
import { getDb } from '../../utils/db'
import { requireStaff } from '../../utils/requireStaff'
import { getSupabaseAdmin, findAuthUserByEmail } from '../../utils/supabaseAdmin'

// Revoke a staff member: remove from the allowlist (authoritative — requireStaff/is_staff
// bounce them immediately) and delete their login account. Guards prevent self-lockout
// and removing the last remaining staffer.
const Schema = v.object({ email: v.pipe(v.string(), v.trim(), v.email(), v.maxLength(200)) })

export default defineEventHandler(async (event) => {
  const me = await requireStaff(event)

  const parsed = v.safeParse(Schema, await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid email' })
  }
  const email = parsed.output.email.toLowerCase()

  if (email === me.email.toLowerCase()) {
    throw createError({ statusCode: 400, message: 'You can’t remove your own access.' })
  }

  // Atomic last-staffer guard: the DELETE only fires if more than one row remains, in a
  // single statement (one snapshot) — no separate SELECT-then-DELETE race window.
  const db = getDb()
  const deleted = await db<{ email: string }[]>`
    DELETE FROM staff_emails
    WHERE lower(email) = ${email}
      AND (SELECT count(*) FROM staff_emails) > 1
    RETURNING email
  `
  if (deleted.length === 0) {
    // Nothing deleted — distinguish "would be the last staffer" from "not a staffer".
    const [exists] = await db`SELECT 1 AS one FROM staff_emails WHERE lower(email) = ${email} LIMIT 1`
    throw createError({
      statusCode: 400,
      message: exists ? 'Can’t remove the last staff member.' : 'That email isn’t a staff member.',
    })
  }

  // Best-effort: also delete the login so revocation is complete. The allowlist removal
  // above is the authoritative revoke (requireStaff bounces them regardless), so a failure
  // here must NOT fail the request. Staff auth users hold no app data (reporters are
  // pseudonymous + separate), so deletion is safe.
  try {
    const existing = await findAuthUserByEmail(email)
    if (existing) await getSupabaseAdmin().auth.admin.deleteUser(existing.id)
  } catch { /* access already revoked via the allowlist; orphaned login is harmless */ }

  return { email, removed: true }
})
