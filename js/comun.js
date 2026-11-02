// Utilidades compartidas: cliente Supabase, formato y seguridad básica.
(function () {
  const cfg = window.RJM_CONFIG || {};
  const listo = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);

  // Cada área guarda su propia sesión: entrar al panel de administración NO abre
  // el portal de clientes (y al revés). La web pública no usa sesión.
  const ruta = location.pathname.toLowerCase();
  const area = ruta.includes('admin') ? 'admin' : ruta.includes('mayorista') ? 'portal' : 'web';
  const opciones = { auth: { storageKey: 'rjm-sesion-' + area, persistSession: area !== 'web', autoRefreshToken: area !== 'web' } };
  // Limpia la sesión antigua, que antes compartían el panel y el portal.
  try { localStorage.removeItem('sb-' + new URL(cfg.SUPABASE_URL).hostname.split('.')[0] + '-auth-token'); } catch (_) {}

  window.RJM = {
    cfg,
    configurado: listo,
    area,
    sb: listo ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, opciones) : null,

    // Cierra la sesión solo en esta área y en este navegador.
    async salir() { if (this.sb) await this.sb.auth.signOut({ scope: 'local' }); },

    esc(v) {
      return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },

    precio(monto, moneda = 'PEN') {
      if (monto === null || monto === undefined || monto === '') return '';
      const n = Number(monto);
      const s = n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return (moneda === 'USD' ? 'US$ ' : 'S/ ') + s;
    },

    // "juanperez" -> "juanperez@mayoristas.rjmimport.com"; un correo se deja igual.
    aEmail(usuario) {
      const u = String(usuario || '').trim().toLowerCase();
      return u.includes('@') ? u : `${u}@${cfg.DOMINIO_USUARIOS}`;
    },

    waLink(texto) {
      return `https://wa.me/${cfg.WHATSAPP}?text=${encodeURIComponent(texto)}`;
    },

    async perfilActual() {
      if (!this.sb) return null;
      const { data: { session } } = await this.sb.auth.getSession();
      if (!session) return null;
      const { data } = await this.sb.from('perfiles').select('*').eq('id', session.user.id).single();
      return data ? { ...data, email: session.user.email } : null;
    },

    errorLegible(e) {
      const m = (e && (e.message || e.error_description || e.error)) || String(e);
      if (/Invalid login credentials/i.test(m)) return 'Usuario o contraseña incorrectos.';
      if (/banned/i.test(m)) return 'Este acceso está desactivado. Comunícate con RJM.';
      if (/Failed to fetch/i.test(m)) return 'Sin conexión con el servidor. Intenta de nuevo.';
      return m;
    }
  };
})();
