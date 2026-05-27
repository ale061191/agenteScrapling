let _supabase: any = null

export function getSupabase() {
  if (_supabase) return _supabase

  const { createClient } = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY')
  }

  _supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  })
  return _supabase
}
