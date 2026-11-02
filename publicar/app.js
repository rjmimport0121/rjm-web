// RJM Publicar: publica productos en la web (y en la lista mayorista) desde el celular.
// Usa la misma base de datos que el panel de administración (Supabase) y solo
// acepta la cuenta de administrador. Funciona como app instalable (PWA) y dentro
// de la app de Android (que agrega window.RJMAndroid para compartir).
(function () {
  const $ = id => document.getElementById(id);
  const { sb, esc, precio, cfg } = RJM;
  const CATS = window.RJM_CATEGORIAS || [];
  const MARCAS = ['RJM Preamp', 'Neurasonic', 'Artec', 'RMC', 'L.R. Baggs', 'Graph Tech', 'Go Acoustic'];
  const OTRO = '__otro__';
  const SITIO = (cfg.SITIO_URL || 'https://www.rjmimport.com/').replace(/\/?$/, '/');
  const BORRADOR = 'rjm_publicar_borrador_v1';
  const CAMPOS = ['dNombre', 'dPrecio', 'dSku', 'dGrupo', 'dSub', 'dSubOtro', 'dMarca', 'dMarcaOtra', 'dDesc'];
  const VISTAS = {
    inicio: { el: 'vInicio', titulo: 'RJM Publicar', sub: '' },
    foto: { el: 'vFoto', titulo: 'Nuevo producto', sub: 'Paso 1 de 3 · Foto', n: 1, accion: 'Continuar' },
    datos: { el: 'vDatos', titulo: 'Nuevo producto', sub: 'Paso 2 de 3 · Datos', n: 2, accion: 'Continuar' },
    destino: { el: 'vDestino', titulo: 'Nuevo producto', sub: 'Paso 3 de 3 · Dónde publicar', n: 3, accion: 'Publicar' },
    listo: { el: 'vListo', titulo: 'Publicado', sub: '', accion: 'Publicar otro producto' },
  };
  let perfil = null, vista = null, foto = null, fotoUrl = null, publicado = null, avisoInstalar = null;

  // ---------- Avisos y vibración (solo en momentos importantes) ----------
  const vibrar = patron => { try { navigator.vibrate && navigator.vibrate(patron); } catch (_) {} };
  let tToast;
  function toast(texto, tipo) {
    const t = $('toast'); t.textContent = texto; t.className = 'toast visible' + (tipo === 'error' ? ' error' : '');
    if (tipo === 'error') vibrar([30, 40, 30]);
    clearTimeout(tToast); tToast = setTimeout(() => { t.className = 'toast'; }, 3200);
  }
  function msg(id, texto, tipo = 'err') { $(id).innerHTML = texto ? `<div class="msg ${tipo}">${esc(texto)}</div>` : ''; }
  function cubierta(texto) { $('cubierta').hidden = !texto; if (texto) $('cubiertaTexto').textContent = texto; }
  function errorCampo(id, texto) {
    const e = $(id); if (!e) return; e.textContent = texto || '';
    e.closest('.campo')?.classList.toggle('invalido', !!texto);
  }
  const textoError = e => {
    const m = RJM.errorLegible(e);
    return /duplicate key.*sku/i.test(m) ? 'Ese código ya existe. Cambia el código o déjalo vacío.' : m;
  };

  // ---------- Navegación (con soporte del botón "atrás" del teléfono) ----------
  function mostrar(v) {
    vista = v; const conf = VISTAS[v];
    Object.values(VISTAS).forEach(x => { $(x.el).hidden = x !== conf; });
    $('tituloVista').textContent = conf.titulo; $('subtituloVista').textContent = conf.sub;
    const enPasos = !!conf.n;
    $('btnAtras').hidden = !enPasos; $('barraLogo').hidden = enPasos;
    $('pasos').hidden = !enPasos;
    document.querySelectorAll('#pasos i').forEach((p, i) => p.classList.toggle('hecho', enPasos && i < conf.n));
    $('accion').hidden = !conf.accion;
    actualizarAccion();
    if (v === 'destino') actualizarPrevia();
    cerrarMenu(); scrollTo(0, 0);
  }
  function ir(v) { history.pushState({ v }, ''); mostrar(v); }
  addEventListener('popstate', e => { if (perfil) mostrar((e.state && e.state.v) || 'inicio'); });
  $('btnAtras').addEventListener('click', () => history.back());

  function actualizarAccion() {
    const b = $('btnSiguiente'), conf = VISTAS[vista];
    if (!conf || !conf.accion) return;
    b.textContent = vista === 'foto' && !foto ? 'Continuar sin foto' : conf.accion;
    b.disabled = vista === 'destino' && !$('xWeb').checked && !$('xMay').checked;
  }

  // ---------- Menú ----------
  function cerrarMenu() { $('menu').hidden = true; $('btnMenu').setAttribute('aria-expanded', 'false'); }
  $('btnMenu').addEventListener('click', e => {
    e.stopPropagation(); const abrir = $('menu').hidden;
    $('menu').hidden = !abrir; $('btnMenu').setAttribute('aria-expanded', String(abrir));
  });
  document.addEventListener('click', e => { if (!e.target.closest('#menu')) cerrarMenu(); });
  $('btnSalir').addEventListener('click', async () => { await RJM.salir(); location.replace(location.pathname); });

  // ---------- Ingreso (solo administrador) ----------
  async function iniciar() {
    if (!RJM.configurado) { $('vIngreso').hidden = false; msg('msgIngreso', 'La app aún no está conectada a la base de datos.'); $('btnIngresar').disabled = true; return; }
    const p = await RJM.perfilActual();
    if (p && p.rol === 'admin' && p.activo) return entrar(p);
    if (p) { await RJM.salir(); msg('msgIngreso', 'Esta cuenta no es de administrador. Los clientes usan el portal mayorista.'); }
    $('vIngreso').hidden = false;
  }
  $('formIngreso').addEventListener('submit', async e => {
    e.preventDefault(); msg('msgIngreso', ''); $('btnIngresar').disabled = true; $('btnIngresar').setAttribute('aria-busy', 'true'); $('btnIngresar').textContent = 'Ingresando…';
    try {
      const { error } = await sb.auth.signInWithPassword({ email: RJM.aEmail($('iCorreo').value), password: $('iClave').value });
      if (error) throw error;
      const p = await RJM.perfilActual();
      if (!p || p.rol !== 'admin' || !p.activo) { await RJM.salir(); throw new Error('Esta cuenta no es de administrador. Los clientes usan el portal mayorista.'); }
      $('iClave').value = ''; entrar(p);
    } catch (err) { msg('msgIngreso', RJM.errorLegible(err)); }
    finally { $('btnIngresar').disabled = false; $('btnIngresar').removeAttribute('aria-busy'); $('btnIngresar').textContent = 'Ingresar'; }
  });
  function entrar(p) {
    perfil = p;
    $('vIngreso').hidden = true; $('barra').hidden = false; $('principal').hidden = false;
    $('nombreAdmin').textContent = p.nombre && !/E\.?I\.?R\.?L/i.test(p.nombre) ? p.nombre.split(' ')[0] : (p.usuario || 'Rafa').replace(/^./, c => c.toUpperCase());
    history.replaceState({ v: 'inicio' }, ''); mostrar('inicio');
    cargarRecientes(); restaurarBorrador();
  }

  // ---------- Inicio: últimas publicaciones ----------
  const enlaceProducto = id => SITIO + '#producto=' + id;
  async function cargarRecientes() {
    const { data, error } = await sb.from('productos').select('id, nombre, precio, moneda, foto_url, publicado, creado_en')
      .order('creado_en', { ascending: false }).limit(8);
    const ul = $('recientes');
    if (error) { ul.innerHTML = `<li class="vacio">${esc(RJM.errorLegible(error))}</li>`; return; }
    ul.innerHTML = data && data.length ? data.map(p => `
      <li>
        ${p.foto_url ? `<img class="mini" src="${esc(p.foto_url)}" alt="" loading="lazy" width="60" height="60"/>` : '<span class="mini" aria-hidden="true"></span>'}
        <div style="min-width:0">
          <div class="rec-nom">${esc(p.nombre)}</div>
          <div class="rec-sub">${p.precio != null ? esc(precio(p.precio, p.moneda)) : 'A consultar'}
            <span class="pill ${p.publicado ? 'ok' : 'off'}">${p.publicado ? 'Visible' : 'Oculto'}</span></div>
        </div>
        ${p.publicado ? `<a class="rec-ver" href="${esc(enlaceProducto(p.id))}" target="_blank" rel="noopener" aria-label="Ver ${esc(p.nombre)} en la web">Ver</a>` : '<span></span>'}
      </li>`).join('') : '<li class="vacio">Aún no publicaste productos. Empieza con "Nuevo producto".</li>';
  }
  $('btnNuevo').addEventListener('click', () => { if (!borradorTieneDatos()) limpiarFormulario(); ir('foto'); });

  // ---------- Paso 1: foto ----------
  function reducirImagen(file, max = 1200, calidad = 0.85) {
    return new Promise((resolve, reject) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob(b => b ? resolve(b) : reject(new Error('No se pudo procesar la foto')), 'image/jpeg', calidad);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Ese archivo no es una imagen válida')); };
      img.src = url;
    });
  }
  async function elegirFoto(input) {
    const f = input.files && input.files[0]; input.value = '';
    if (!f) return;
    try {
      cubierta('Preparando la foto…');
      foto = await reducirImagen(f);
      if (fotoUrl) URL.revokeObjectURL(fotoUrl);
      fotoUrl = URL.createObjectURL(foto);
      $('fotoVista').src = fotoUrl; $('fotoVista').hidden = false; $('fotoVacia').hidden = true;
      actualizarAccion();
    } catch (e) { toast(e.message, 'error'); }
    finally { cubierta(''); }
  }
  $('fCamara').addEventListener('change', e => elegirFoto(e.target));
  $('fGaleria').addEventListener('change', e => elegirFoto(e.target));

  // ---------- Paso 2: datos ----------
  $('dGrupo').innerHTML = '<option value="" disabled selected>Elige un grupo…</option>' + CATS.map(c => `<option>${esc(c.grupo)}</option>`).join('');
  function llenarSub(valor) {
    const c = CATS.find(x => x.grupo === $('dGrupo').value), lista = c ? c.subgrupos : [];
    $('dSub').innerHTML = '<option value="" disabled selected>Elige un subgrupo…</option>' + lista.map(s => `<option>${esc(s)}</option>`).join('') + `<option value="${OTRO}">Otro… (escribir)</option>`;
    if (valor) $('dSub').value = valor;
    $('dSubOtro').hidden = $('dSub').value !== OTRO;
  }
  $('dGrupo').addEventListener('change', () => { llenarSub(); errorCampo('eSub', ''); });
  $('dSub').addEventListener('change', () => { $('dSubOtro').hidden = $('dSub').value !== OTRO; if (!$('dSubOtro').hidden) $('dSubOtro').focus(); errorCampo('eSub', ''); });
  $('dMarca').innerHTML = '<option value="">Sin marca</option>' + MARCAS.map(m => `<option>${esc(m)}</option>`).join('') + `<option value="${OTRO}">Otra… (escribir)</option>`;
  $('dMarca').addEventListener('change', () => { $('dMarcaOtra').hidden = $('dMarca').value !== OTRO; if (!$('dMarcaOtra').hidden) $('dMarcaOtra').focus(); });
  document.querySelectorAll('[data-frase]').forEach(b => b.addEventListener('click', () => {
    const d = $('dDesc'); d.value = (d.value.trim() + ' ' + b.dataset.frase).trim(); guardarBorrador();
  }));
  $('dNombre').addEventListener('input', () => errorCampo('eNombre', ''));

  function datos() {
    const sub = $('dSub').value === OTRO ? $('dSubOtro').value.trim() : $('dSub').value;
    const marca = $('dMarca').value === OTRO ? $('dMarcaOtra').value.trim() : $('dMarca').value;
    const p = $('dPrecio').value.trim();
    return {
      nombre: $('dNombre').value.trim(), sku: $('dSku').value.trim() || null,
      grupo: $('dGrupo').value || null, categoria: sub || null, marca: marca || null,
      descripcion: $('dDesc').value.trim() || null, precio: p === '' ? null : Math.round(Number(p) * 100) / 100,
      destacado: $('dDestacado').checked,
    };
  }
  function validarDatos() {
    const d = datos(); let ok = true;
    if (!d.nombre) { errorCampo('eNombre', 'Escribe el nombre del producto.'); ok = false; }
    if (!d.grupo || !d.categoria) { errorCampo('eSub', 'Elige el grupo y el subgrupo (o escribe uno nuevo).'); ok = false; }
    if (d.precio != null && (isNaN(d.precio) || d.precio < 0)) { toast('Revisa el precio.', 'error'); ok = false; }
    if (!ok) { const primero = document.querySelector('#vDatos .invalido input, #vDatos .invalido select'); primero?.focus(); }
    return ok;
  }

  // Borrador: si la app se cierra a mitad, los textos se recuperan (la foto no).
  function guardarBorrador() {
    try { const b = {}; CAMPOS.forEach(id => { b[id] = $(id).value; }); b.dDestacado = $('dDestacado').checked; localStorage.setItem(BORRADOR, JSON.stringify(b)); } catch (_) {}
  }
  function borradorTieneDatos() { return !!($('dNombre').value.trim() || $('dDesc').value.trim()); }
  function restaurarBorrador() {
    let b = null; try { b = JSON.parse(localStorage.getItem(BORRADOR) || 'null'); } catch (_) {}
    llenarSub();
    if (!b) return;
    if (b.dGrupo) { $('dGrupo').value = b.dGrupo; llenarSub(b.dSub); }
    ['dNombre', 'dPrecio', 'dSku', 'dSubOtro', 'dMarca', 'dMarcaOtra', 'dDesc'].forEach(id => { if (b[id] != null) $(id).value = b[id]; });
    $('dSubOtro').hidden = $('dSub').value !== OTRO; $('dMarcaOtra').hidden = $('dMarca').value !== OTRO;
    $('dDestacado').checked = !!b.dDestacado;
    if (borradorTieneDatos()) toast('Recuperamos el producto que dejaste a medias.');
  }
  function limpiarFormulario() {
    $('formDatos').reset(); $('dGrupo').value = ''; llenarSub(); $('dSubOtro').hidden = true; $('dMarcaOtra').hidden = true;
    ['eNombre', 'eSub'].forEach(id => errorCampo(id, ''));
    foto = null; if (fotoUrl) URL.revokeObjectURL(fotoUrl); fotoUrl = null;
    $('fotoVista').hidden = true; $('fotoVista').removeAttribute('src'); $('fotoVacia').hidden = false;
    $('xWeb').checked = true; $('xMay').checked = false; $('bloqueMay').hidden = true;
    $('mStock').value = '10'; $('mUnidad').value = 'und'; $('mP1').value = ''; $('mP12').value = ''; $('eMay').textContent = '';
    try { localStorage.removeItem(BORRADOR); } catch (_) {}
  }
  CAMPOS.concat('dDestacado').forEach(id => $(id).addEventListener('input', guardarBorrador));
  CAMPOS.concat('dDestacado').forEach(id => $(id).addEventListener('change', guardarBorrador));

  // ---------- Paso 3: dónde publicar ----------
  $('xWeb').addEventListener('change', actualizarAccion);
  $('xMay').addEventListener('change', () => {
    $('bloqueMay').hidden = !$('xMay').checked;
    if ($('xMay').checked && !$('mP1').value && $('dPrecio').value) $('mP1').value = $('dPrecio').value;
    actualizarAccion();
  });
  function actualizarPrevia() {
    const d = datos();
    $('previaImg').innerHTML = fotoUrl ? `<img src="${fotoUrl}" alt=""/>` : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.6"/></svg>';
    $('previaCat').textContent = [d.categoria, d.marca].filter(Boolean).join(' · ');
    $('previaNom').textContent = d.nombre;
    $('previaPrecio').innerHTML = d.precio != null ? esc(precio(d.precio, 'PEN')) + '<small>INC. IGV</small>' : 'Precio a consultar';
  }

  // ---------- Publicar ----------
  function telefonoLegible() {
    const n = String(cfg.WHATSAPP || '51956543522');
    return '+' + n.slice(0, 2) + ' ' + n.slice(2).replace(/(\d{3})(?=\d)/g, '$1 ');
  }
  function textoPublicacion(d, enlace) {
    const l = ['🎸 ' + d.nombre];
    if (d.precio != null) l.push('💰 ' + precio(d.precio, 'PEN') + ' (IGV incluido)');
    if (d.descripcion) l.push('', d.descripcion);
    l.push('');
    if (!/env[ií]os a todo el per[uú]/i.test(d.descripcion || '')) l.push('📦 Envíos a todo el Perú');
    if (enlace) l.push('👉 Ver en la web: ' + enlace);
    l.push('💬 WhatsApp: ' + telefonoLegible());
    return l.join('\n');
  }
  async function publicar() {
    const d = datos(), web = $('xWeb').checked, may = $('xMay').checked;
    $('eMay').textContent = '';
    let stock = 0, p1 = null, p12 = null;
    if (may) {
      stock = parseInt($('mStock').value, 10); p1 = Number($('mP1').value); p12 = $('mP12').value === '' ? null : Number($('mP12').value);
      if (!(stock >= 0) || !(p1 > 0) || (p12 != null && !(p12 > 0))) { $('eMay').textContent = 'Revisa el stock y el precio desde 1 (mayor a 0).'; return; }
    }
    const hechos = []; let subida = null, idWeb = null;
    try {
      if (web && foto) {
        cubierta('Subiendo la foto…');
        const ruta = `catalogo/${crypto.randomUUID()}.jpg`;
        const { error } = await sb.storage.from('productos').upload(ruta, foto, { contentType: 'image/jpeg', cacheControl: '31536000' });
        if (error) throw error;
        subida = { ruta, url: sb.storage.from('productos').getPublicUrl(ruta).data.publicUrl };
      }
      if (web) {
        cubierta('Publicando en la web…');
        const fila = { ...d, caracteristicas: [], moneda: 'PEN', precio_incluye_igv: true, publicado: true, orden: 0,
          foto_url: subida ? subida.url : null, foto_path: subida ? subida.ruta : null };
        const { data, error } = await sb.from('productos').insert(fila).select('id').single();
        if (error) throw error;
        idWeb = data.id; hechos.push('Catálogo de la web' + (d.destacado ? ' (destacado)' : ''));
      }
    } catch (e) {
      cubierta('');
      if (subida) await sb.storage.from('productos').remove([subida.ruta]).catch(() => {});
      toast('No se pudo publicar: ' + textoError(e), 'error'); return;
    }
    let avisoMay = '';
    if (may) {
      try {
        cubierta('Agregando a la lista mayorista…');
        const { data, error } = await sb.from('productos_mayoristas').insert({
          sku: d.sku, nombre: d.nombre, grupo: d.grupo, categoria: d.categoria, unidad: $('mUnidad').value, stock,
          mostrar_stock: true, moneda: 'PEN', precio_incluye_igv: true, notas: null, activo: true, orden: 0,
        }).select('id').single();
        if (error) throw error;
        const tramos = [{ producto_id: data.id, cantidad_minima: 1, precio: p1 }];
        if (p12 != null) tramos.push({ producto_id: data.id, cantidad_minima: 12, precio: p12 });
        const { error: e2 } = await sb.from('precios_mayoristas').insert(tramos);
        if (e2) throw e2;
        hechos.push(`Lista mayorista (stock: ${stock} ${$('mUnidad').value})`);
      } catch (e) { avisoMay = 'No se agregó a la lista mayorista: ' + textoError(e); }
    }
    cubierta('');
    if (!hechos.length) { toast(avisoMay || 'No se publicó nada.', 'error'); return; }
    const enlace = idWeb ? enlaceProducto(idWeb) : '';
    publicado = { nombre: d.nombre, texto: textoPublicacion(d, enlace), enlace, foto };
    $('listoLista').innerHTML = hechos.map(h => `<li>${esc(h)}</li>`).join('');
    $('textoPub').textContent = publicado.texto;
    $('btnVer').hidden = !enlace; if (enlace) $('btnVer').href = enlace;
    $('btnCompartir').hidden = !web;
    try { localStorage.removeItem(BORRADOR); } catch (_) {}
    history.replaceState({ v: 'listo' }, ''); mostrar('listo'); vibrar(25);
    if (avisoMay) toast(avisoMay, 'error');
    cargarRecientes();
  }

  // ---------- Compartir (Facebook, WhatsApp…) ----------
  async function copiar(texto) {
    try { await navigator.clipboard.writeText(texto); return true; }
    catch (_) {
      try { const t = Object.assign(document.createElement('textarea'), { value: texto }); document.body.append(t); t.select(); const ok = document.execCommand('copy'); t.remove(); return ok; }
      catch (__) { return false; }
    }
  }
  const aBase64 = blob => new Promise((ok, mal) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = mal; r.readAsDataURL(blob); });
  $('btnCompartir').addEventListener('click', async () => {
    if (!publicado) return;
    const copiado = await copiar(publicado.texto);
    try {
      if (window.RJMAndroid && typeof window.RJMAndroid.compartir === 'function') {
        window.RJMAndroid.compartir(publicado.texto, publicado.foto ? await aBase64(publicado.foto) : '');
      } else {
        const archivo = publicado.foto ? new File([publicado.foto], 'producto-rjm.jpg', { type: 'image/jpeg' }) : null;
        if (archivo && navigator.canShare && navigator.canShare({ files: [archivo] })) await navigator.share({ files: [archivo], text: publicado.texto, title: publicado.nombre });
        else if (navigator.share) await navigator.share({ text: publicado.texto, url: publicado.enlace || undefined, title: publicado.nombre });
        else { toast(copiado ? 'Texto copiado. Abre Facebook y pégalo en una publicación nueva.' : 'Copia el texto de abajo y pégalo en Facebook.'); return; }
      }
      if (copiado) toast('El texto también quedó copiado: si Facebook no lo muestra, pégalo.');
    } catch (e) { if (e && e.name !== 'AbortError') toast('No se pudo abrir el menú de compartir. Usa "Copiar texto".', 'error'); }
  });
  $('btnCopiar').addEventListener('click', async () => {
    if (!publicado) return;
    const ok = await copiar(publicado.texto);
    toast(ok ? 'Texto copiado.' : 'No se pudo copiar. Mantén presionado el texto de abajo.', ok ? undefined : 'error');
  });

  // ---------- Botón de acción inferior ----------
  $('btnSiguiente').addEventListener('click', () => {
    if (vista === 'foto') return ir('datos');
    if (vista === 'datos') { if (validarDatos()) ir('destino'); return; }
    if (vista === 'destino') return publicar();
    if (vista === 'listo') { limpiarFormulario(); publicado = null; history.replaceState({ v: 'inicio' }, ''); mostrar('inicio'); ir('foto'); }
  });

  // ---------- Instalar como app ----------
  const instalada = matchMedia('(display-mode: standalone)').matches || !!window.RJMAndroid;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); if (instalada) return; avisoInstalar = e; $('btnInstalar').hidden = false; });
  $('btnInstalar').addEventListener('click', async () => {
    if (!avisoInstalar) return; avisoInstalar.prompt();
    const r = await avisoInstalar.userChoice.catch(() => null); avisoInstalar = null; $('btnInstalar').hidden = true;
    if (r && r.outcome === 'accepted') toast('Listo: busca "RJM Publicar" en tu pantalla de inicio.');
  });
  addEventListener('appinstalled', () => { $('btnInstalar').hidden = true; });
  // Service worker: permite instalar la app y abrirla aunque la señal sea débil.
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // Sin animación en la primera pantalla; desde la segunda, las vistas entran suaves.
  iniciar().finally(() => requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.remove('sin-animacion'))));
})();
