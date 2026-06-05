import type { H3Event } from 'h3'
import { getDb } from './db'
import { getSupabaseServerClient } from './supabaseServer'

export interface StaffUser {
  id: string
  email: string
}

// Is this email on the staff allowlist? Queried via the privileged pooler (getDb),
// which bypasses RLS — staff_emails is locked to direct anon/authenticated access.
// Plain equality on the lowercased input hits the `email` PRIMARY KEY index; the
// `staff_emails_email_lowercase` CHECK guarantees every stored row is already lowercase,
// so this is equivalent to (and cheaper than) a `lower(email) = …` functional comparison.
export async function isStaffEmail(email: string): Promise<boolean> {
  const db = getDb()
  const [row] = await db<{ one: number }[]>`
    SELECT 1 AS one FROM staff_emails WHERE email = ${email.toLowerCase()} LIMIT 1
  `
  return !!row
}

// The single server-side security boundary for privileged routes. Verifies the
// Supabase session JWT with getClaims() — the recommended check: it validates the
// signature locally against the cached JWKS (our project uses asymmetric ES256 keys),
// avoiding a network round-trip to the Auth server on every request, unlike getUser().
// (Never trust getSession server-side — it doesn't verify.) Asserts the email is
// allowlisted staff. Throws 401/403.
//
// Local verification requires `crypto.subtle` (present in the Nitro/Node 18+ runtime on
// Vercel) + the JWKS for the token's kid; the first call per instance fetches the JWKS
// once, then it's cached. Without asymmetric keys / crypto.subtle, getClaims falls back to
// a getUser-style round-trip — still correct, just not local. Both paths are secure.
export async function requireStaff(event: H3Event): Promise<StaffUser> {
  const supabase = getSupabaseServerClient(event)
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims
  const claimEmail = typeof claims?.email === 'string' ? claims.email : null
  if (error || !claims || !claimEmail) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }
  const email = claimEmail.toLowerCase()
  if (!(await isStaffEmail(email))) {
    throw createError({ statusCode: 403, message: 'Not authorized — staff only' })
  }
  return { id: String(claims.sub), email }
}
