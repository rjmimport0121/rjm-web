// Utilidades compartidas: cliente Supabase, formato y seguridad básica.
(function () {
  const cfg = window.RJM_CONFIG || {};
  const listo = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);

  window.RJM = {
    cfg,
    configurado: listo,
    sb: listo ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null,

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
