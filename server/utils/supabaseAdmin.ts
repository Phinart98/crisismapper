import { createClient } from '@supabase/supabase-js'

let _admin: ReturnType<typeof createClient> | null = null

export function getSupabaseAdmin() {
  if (!_admin) {
    const { supabaseServiceKey, public: { supabaseUrl } } = useRuntimeConfig()
    _admin = createClient(supabaseUrl, supabaseServiceKey)
  }
  return _admin
}

// Walk the paginated Auth user list (the staff set is tiny — there's no lookup-by-email
// primitive, so listUsers is the only option). `onPage` inspects each page and returns a
// non-undefined value to stop early; otherwise the whole list is exhausted.
async function paginateAuthUsers<T>(onPage: (users: Awaited<ReturnType<ReturnType<typeof getSupabaseAdmin>['auth']['admin']['listUsers']>>['data']['users']) => T | undefined): Promise<T | undefined> {
  const admin = getSupabaseAdmin()
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const result = onPage(data.users)
    if (result !== undefined) return result
    if (data.users.length < 200) break
  }
  return undefined
}

// Look up an auth user by email. Returns the user record or null.
export async function findAuthUserByEmail(email: string) {
  const target = email.toLowerCase()
  const found = await paginateAuthUsers(users => users.find(u => u.email?.toLowerCase() === target))
  return found ?? null
}

// Set of all auth-account emails (lowercased) — for flagging which allowlisted staff have
// a login. Exhausts the list (no early stop) in a single pass.
export async function listAllAuthEmails(): Promise<Set<string>> {
  const emails = new Set<string>()
  await paginateAuthUsers((users) => {
    for (const u of users) if (u.email) emails.add(u.email.toLowerCase())
    return undefined // never stop early — collect every page
  })
  return emails
}
