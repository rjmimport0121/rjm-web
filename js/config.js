// ============================================================
// Configuración pública de la web RJM.
// SUPABASE_URL y SUPABASE_ANON_KEY se copian de:
//   Supabase → Project Settings → API  (Project URL y "anon public").
// La clave "anon" es pública por diseño: la seguridad la dan las reglas RLS
// de supabase/schema.sql. NUNCA pongas aquí la clave "service_role".
// ============================================================
window.RJM_CONFIG = {
  SUPABASE_URL: '',        // ej: 'https://abcdefgh.supabase.co'
  SUPABASE_ANON_KEY: '',   // ej: 'eyJhbGciOi...'
  WHATSAPP: '51956543522', // número que recibe las consultas (código país + número)
  SITIO_URL: 'https://www.rjmimport.com/',
  DOMINIO_USUARIOS: 'mayoristas.rjmimport.com' // debe coincidir con la Edge Function
};
