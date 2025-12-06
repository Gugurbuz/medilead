import { createClient } from '@supabase/supabase-js';

// Supabase kullanılmadığı zaman uygulamanın çökmemesi için
// varsayılan (dummy) değerler atıyoruz.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);