import { createServerClient, parseCookieHeader } from '@supabase/ssr'
import type { H3Event } from 'h3'

// Per-request Supabase client bound to the H3 event's cookies. Used ONLY for auth
// (getClaims, and signInWithPassword/signOut on the browser side) — every privileged DB
// read/write still goes through getDb() (postgres.js). Never singleton this: each request
// has its own cookie jar.
//
// The getAll/setAll cookie adapter is mandatory in @supabase/ssr — the deprecated
// get/set/remove triplet misses edge cases. setAll's second arg carries the no-cache
// headers that MUST ride along with any Set-Cookie so a CDN can't serve one user's
// refreshed session token to another.
export function getSupabaseServerClient(event: H3Event) {
  const { public: { supabaseUrl, supabaseAnonKey } } = useRuntimeConfig(event)
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        const header = getRequestHeader(event, 'cookie') ?? ''
        return parseCookieHeader(header).map(c => ({ name: c.name, value: c.value ?? '' }))
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value, options } of cookiesToSet) {
          setCookie(event, name, value, options)
        }
        for (const [k, val] of Object.entries(headers)) {
          setResponseHeader(event, k, val)
        }
      },
    },
  })
}
