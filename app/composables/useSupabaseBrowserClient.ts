import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// Auth browser client — persists the staff session in COOKIES (createBrowserClient's
// default), so server routes can read the same session via getSupabaseServerClient.
// Singleton. This is distinct from useSupabaseClient() (the realtime-only anon client,
// persistSession:false): two separate instances with separate storage, no conflict.
// Used by /login, the admin console, and the dashboard staff indicator.
let _client: SupabaseClient | null = null

export function useSupabaseBrowserClient(): SupabaseClient {
  if (!_client) {
    const { public: { supabaseUrl, supabaseAnonKey } } = useRuntimeConfig()
    _client = createBrowserClient(supabaseUrl, supabaseAnonKey)
  }
  return _client
}
