import * as v from 'valibot'
import { getDb } from '../../utils/db'
import { requireStaff } from '../../utils/requireStaff'
import { getSupabaseAdmin, findAuthUserByEmail } from '../../utils/supabaseAdmin'

// Add a staff member through the UI (no SQL): allowlist the email + provision a Supabase
// login with an initial password the admin sets. Reliable email isn't available, so the
// admin relays the credentials out-of-band; the new member can change the password later.
// Flat model — any staff can manage staff; role tiers are a future enhancement.
const Schema = v.object({
  email: v.pipe(v.string(), v.trim(), v.email(), v.maxLength(200)),
  // Mirror the recommended Supabase password policy (≥8, mixed) so provisioned accounts
  // are never weaker than self-set ones.
  password: v.pipe(v.string(), v.minLength(8), v.maxLength(72)),
})

export default defineEventHandler(async (event) => {
  await requireStaff(event)

  const parsed = v.safeParse(Schema, await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Enter a valid email and a password of at least 8 characters.' })
  }
  const email = parsed.output.email.toLowerCase()
  const { password } = parsed.output

  // 1) Authorization: add to the allowlist (idempotent).
  const db = getDb()
  await db`INSERT INTO staff_emails (email) VALUES (${email}) ON CONFLICT (email) DO NOTHING`

  // 2) Authentication: create the login, or reset the password if an account already
  //    exists. `existed` is returned so the UI can warn that an existing account's
  //    password was reset (rather than a brand-new login being created) — relevant if the
  //    operator typed an email that already had an account.
  const admin = getSupabaseAdmin()
  const existing = await findAuthUserByEmail(email)
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, { password })
    if (error) throw createError({ statusCode: 502, message: `Could not update the account: ${error.message}` })
  } else {
    const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (error) throw createError({ statusCode: 502, message: `Could not create the account: ${error.message}` })
  }

  setResponseStatus(event, 201)
  return { email, has_login: true, existed: !!existing }
})
