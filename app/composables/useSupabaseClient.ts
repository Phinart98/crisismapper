import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Browser-only Supabase client, used solely for Realtime Broadcast on the
// dashboard. Anon key + a public channel — no auth/session needed. Singleton so
// repeated calls reuse one WebSocket.
let _client: SupabaseClient | null = null

export function useSupabaseClient(): SupabaseClient {
  if (!_client) {
    const { public: { supabaseUrl, supabaseAnonKey } } = useRuntimeConfig()
    _client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return _client
}
