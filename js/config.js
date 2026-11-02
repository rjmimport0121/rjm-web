// ============================================================
// Configuración pública de la web RJM.
// SUPABASE_URL y SUPABASE_ANON_KEY se copian de:
//   Supabase → Project Settings → API  (Project URL y "anon public").
// La clave "anon" es pública por diseño: la seguridad la dan las reglas RLS
// de supabase/schema.sql. NUNCA pongas aquí la clave "service_role".
// ============================================================
window.RJM_CONFIG = {
  SUPABASE_URL: 'https://zdlurhdnsgtllgfhixic.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkbHVyaGRuc2d0bGxnZmhpeGljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1ODY2NDcsImV4cCI6MjEwOTE2MjY0N30.13BCHmOsh7HH4m6G5MBtq5WxGa3DdRMHJP23F8_XDBM',
  WHATSAPP: '51956543522', // número que recibe las consultas (código país + número)
  SITIO_URL: 'https://www.rjmimport.com/',
  DOMINIO_USUARIOS: 'mayoristas.rjmimport.com' // debe coincidir con la Edge Function
};
