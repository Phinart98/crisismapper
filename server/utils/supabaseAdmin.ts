import { createClient } from '@supabase/supabase-js'

let _admin: ReturnType<typeof createClient> | null = null

export function getSupabaseAdmin() {
  if (!_admin) {
    const { supabaseServiceKey, public: { supabaseUrl } } = useRuntimeConfig()
    _admin = createClient(supabaseUrl, supabaseServiceKey)
  }
  return _admin
}
