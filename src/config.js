const required = (name) => {
  const value = import.meta?.env?.[name];
  if (!value || value.includes('your-')) throw new Error(`Missing ${name}. Copy .env.example to .env.local.`);
  return value;
};

export function createSupabaseConfig() {
  return { url: required('VITE_SUPABASE_URL'), anonKey: required('VITE_SUPABASE_ANON_KEY') };
}
