import { createClient } from '@supabase/supabase-js'

// Get variables but don't force them to be present yet
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// If they are missing (like during build), use a dummy string 
// so the build can finish. They will be replaced by real values in the browser.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
)