// Utilidades compartidas: cliente Supabase, formato y seguridad básica.
(function () {
  const cfg = window.RJM_CONFIG || {};
  const listo = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);

  // Cada área guarda su propia sesión: entrar al panel de administración NO abre
  // el portal de clientes (y al revés). La web pública no usa sesión.
  const ruta = location.pathname.toLowerCase();
  const area = ruta.includes('admin') ? 'admin' : ruta.includes('mayorista') ? 'portal' : ruta.includes('publicar') ? 'app' : 'web';
  const opciones = { auth: { storageKey: 'rjm-sesion-' + area, persistSession: area !== 'web', autoRefreshToken: area !== 'web' } };
  // Panel de administración: la sesión vive solo mientras el navegador esté abierto
  // (sessionStorage). Al cerrarlo, la próxima vez pide la contraseña. La app del
  // celular y el portal de mayoristas sí la recuerdan.
  if (area === 'admin') {
    try { opciones.auth.storage = window.sessionStorage; localStorage.removeItem('rjm-sesion-admin'); } catch (_) {}
  }
  // Limpia la sesión antigua, que antes compartían el panel y el portal.
  try { localStorage.removeItem('sb-' + new URL(cfg.SUPABASE_URL).hostname.split('.')[0] + '-auth-token'); } catch (_) {}

  window.RJM = {
    cfg,
    configurado: listo,
    area,
    sb: listo ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, opciones) : null,

    // Cierra la sesión solo en esta área y en este navegador.
    async salir() { if (this.sb) await this.sb.auth.signOut({ scope: 'local' }); },

    // Lee un enlace de video de YouTube, TikTok o Facebook y devuelve cómo
    // mostrarlo: { red, embed, enlace, vertical } o null si no es de esas redes.
    // "embed" es null cuando el enlace es corto (vm.tiktok.com, fb.watch): en ese
    // caso solo se puede abrir en la red. Igual que videoDe() en worker.js.
    video(url) {
      let u; try { u = new URL(String(url || '').trim()); } catch (_) { return null; }
      if (u.protocol !== 'https:') return null;
      const h = u.hostname.toLowerCase().replace(/^(www|m|web)\./, '');
      if (h === 'youtu.be' || h === 'youtube.com' || h === 'music.youtube.com') {
        const id = h === 'youtu.be' ? u.pathname.slice(1).split('/')[0]
          : u.searchParams.get('v') || (u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/) || [])[1];
        if (!/^[\w-]{11}$/.test(id || '')) return null;
        return { red: 'YouTube', embed: `https://www.youtube-nocookie.com/embed/${id}`, enlace: `https://www.youtube.com/watch?v=${id}`, vertical: u.pathname.startsWith('/shorts/') };
      }
      if (h === 'tiktok.com' || h === 'vm.tiktok.com' || h === 'vt.tiktok.com') {
        const m = u.pathname.match(/\/video\/(\d{8,25})/);
        return { red: 'TikTok', embed: m ? `https://www.tiktok.com/embed/v2/${m[1]}` : null, enlace: u.href, vertical: true };
      }
      if (h === 'facebook.com' || h === 'fb.watch') {
        const largo = h === 'facebook.com' && /\/(videos|reel|watch)\b|[?&]v=\d/.test(u.pathname + u.search);
        return { red: 'Facebook', embed: largo ? `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(u.href)}&show_text=false` : null, enlace: u.href, vertical: /\/reel\b/.test(u.pathname) };
      }
      return null;
    },

    // Dirección de la página de un producto (igual que slug() en worker.js y js/sitio.js).
    rutaProducto(p) {
      const s = String(p.nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/&/g, ' y ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '') || 'producto';
      return `producto/${s}/${p.id}`;
    },

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
