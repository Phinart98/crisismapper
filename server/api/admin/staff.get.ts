import { getDb } from '../../utils/db'
import { requireStaff } from '../../utils/requireStaff'
import { listAllAuthEmails } from '../../utils/supabaseAdmin'

// Staff list for the management console: the allowlist (authorization) joined with
// whether each email has a Supabase login account (so the operator knows who can
// actually sign in vs. who is allowlisted but not yet provisioned). The allowlist query
// and the Auth-user scan are independent reads, so run them concurrently.
export default defineEventHandler(async (event) => {
  await requireStaff(event)

  const db = getDb()
  const [rows, logins] = await Promise.all([
    db<{ email: string, created_at: string }[]>`SELECT email, created_at FROM staff_emails ORDER BY created_at`,
    listAllAuthEmails(),
  ])

  return rows.map(r => ({
    email: r.email,
    created_at: r.created_at,
    has_login: logins.has(r.email.toLowerCase()),
  }))
})
