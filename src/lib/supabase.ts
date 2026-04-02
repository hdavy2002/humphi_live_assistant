import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Note: We use VITE_ prefix for client-side access
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
