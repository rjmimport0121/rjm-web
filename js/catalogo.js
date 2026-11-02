// Catálogo público con precios: lee los productos publicados desde Supabase y
// los coloca dentro de su tarjeta de subgrupo (Grupo → Subgrupo) de index.html.
// Si Supabase no está configurado o no hay productos, la web se ve como siempre.
(function () {
  if (!window.RJM || !RJM.configurado) return;
  const { sb, esc, precio, cfg } = RJM;
  const $ = id => document.getElementById(id);
  const norm = t => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim();
  let productos = [];
  const porSubgrupo = new Map(); // clave normalizada -> { nombre, grupo, items[] }

  // ---------- Mensaje de WhatsApp ----------
  function mensajeWa(p) {
    let t = `Hola RJM! Me interesa este producto:\n\n*${p.nombre}*`;
    if (p.sku) t += `\nCódigo: ${p.sku}`;
    if (p.precio != null) t += `\nPrecio: ${precio(p.precio, p.moneda)} (inc. IGV)`;
    t += `\n\nVer producto: ${cfg.SITIO_URL}#producto=${p.id}`;
    if (p.foto_url) t += `\nFoto: ${p.foto_url}`;
    t += `\n\n¿Tienen disponibilidad?`;
    return RJM.waLink(t);
  }

  function htmlPrecio(p) {
    if (p.precio == null) return '<div class="product-price">Precio a consultar</div>';
    return `<div class="product-price">${precio(p.precio, p.moneda)}<small>INC. IGV</small></div>`;
  }

  function tarjeta(p) {
    const img = p.foto_url
      ? `<img src="${esc(p.foto_url)}" alt="${esc(p.nombre)}" loading="lazy"/>`
      : `<div class="product-img-ph">📦<span>${esc(p.categoria)}</span></div>`;
    return `<div class="product-card" data-id="${p.id}">
      <div class="product-img">${img}${p.destacado ? '<span class="product-badge">Destacado</span>' : ''}</div>
      <div class="product-info">
        <div class="product-cat">${esc(p.categoria)}${p.marca ? ' · ' + esc(p.marca) : ''}</div>
        <div class="product-name">${esc(p.nombre)}</div>
        ${p.descripcion ? `<div class="product-desc">${esc(p.descripcion.length > 110 ? p.descripcion.slice(0, 107) + '…' : p.descripcion)}</div>` : ''}
        ${htmlPrecio(p)}
        <div class="product-btns">
          <a href="${mensajeWa(p)}" class="product-action wa" target="_blank" rel="noopener" data-wa>💬 Consultar por WhatsApp</a>
        </div>
      </div>
    </div>`;
  }

  // ---------- Ubicar cada subgrupo en las tarjetas existentes ----------
  function seccionDeGrupo(grupo) {
    if (!grupo) return null;
    return [...document.querySelectorAll('#productos .cat-section')]
      .find(sec => sec.id !== 'catalogoDinamico' && norm(sec.querySelector('.cat-section-title')?.textContent).includes(norm(grupo)));
  }
  function tarjetaDeSubgrupo(nombre) {
    return [...document.querySelectorAll('#productos .cat-section:not(#catalogoDinamico) .product-card')]
      .find(c => norm(c.querySelector('.product-name')?.textContent) === norm(nombre));
  }

  function botonVer(sg) {
    const n = sg.items.length;
    return `<button type="button" class="product-action ver-sub" data-sub="${esc(norm(sg.nombre))}">🛒 Ver ${n} producto${n === 1 ? '' : 's'} con precio</button>`;
  }

  function colocarSubgrupos() {
    const sueltos = [];
    for (const sg of porSubgrupo.values()) {
      let card = tarjetaDeSubgrupo(sg.nombre);
      if (!card) {
        const sec = seccionDeGrupo(sg.grupo);
        if (!sec) { sueltos.push(...sg.items); continue; }
        // Subgrupo nuevo creado desde el panel: se agrega como tarjeta en su grupo.
        const conFoto = sg.items.find(p => p.foto_url);
        sec.querySelector('.products-grid').insertAdjacentHTML('beforeend', `
          <div class="product-card">
            <div class="product-img">${conFoto ? `<img src="${esc(conFoto.foto_url)}" alt="${esc(sg.nombre)}" loading="lazy"/>` : `<div class="product-img-ph">📦<span>${esc(sg.nombre)}</span></div>`}<span class="product-badge">Nuevo</span></div>
            <div class="product-info">
              <div class="product-cat">${esc(sg.grupo)}</div>
              <div class="product-name">${esc(sg.nombre)}</div>
            </div>
          </div>`);
        card = tarjetaDeSubgrupo(sg.nombre);
      }
      card.dataset.buscar = sg.items.map(p => [p.nombre, p.marca, p.sku].filter(Boolean).join(' ')).join(' ');
      const info = card.querySelector('.product-info');
      info.querySelector('.ver-sub')?.remove();
      info.insertAdjacentHTML('beforeend', botonVer(sg));
    }
    return sueltos;
  }

  // ---------- Ventana con la lista de un subgrupo ----------
  function abrirLista(clave) {
    const sg = porSubgrupo.get(clave);
    if (!sg) return;
    $('lmTitulo').textContent = sg.nombre;
    $('lmGrupo').textContent = sg.grupo || '';
    $('lmGrid').innerHTML = sg.items.map(tarjeta).join('');
    $('lmodal').classList.add('abierto');
  }
  function cerrarLista() { $('lmodal').classList.remove('abierto'); }

  // ---------- Ficha de producto ----------
  function abrir(p) {
    $('pmImg').innerHTML = p.foto_url ? `<img src="${esc(p.foto_url)}" alt="${esc(p.nombre)}"/>` : '';
    $('pmCat').textContent = [p.grupo, p.categoria, p.marca, p.sku].filter(Boolean).join(' · ');
    $('pmTitulo').textContent = p.nombre;
    $('pmPrecio').innerHTML = htmlPrecio(p).replace(/^<div class="product-price">|<\/div>$/g, '');
    $('pmDesc').textContent = p.descripcion || '';
    $('pmCarac').innerHTML = (p.caracteristicas || []).map(c => `<li>${esc(c)}</li>`).join('');
    $('pmWa').href = mensajeWa(p);
    $('pmodal').classList.add('abierto');
    history.replaceState(null, '', '#producto=' + p.id);
  }
  function cerrar() {
    $('pmodal').classList.remove('abierto');
    if (location.hash.startsWith('#producto=')) history.replaceState(null, '', location.pathname + location.search);
  }

  // ---------- Eventos ----------
  document.getElementById('productos').addEventListener('click', e => {
    const ver = e.target.closest('.ver-sub');
    if (ver) { e.preventDefault(); abrirLista(ver.dataset.sub); }
  });
  function clicTarjeta(e) {
    if (e.target.closest('[data-wa]')) return; // el botón de WhatsApp abre directo
    const card = e.target.closest('[data-id]');
    if (card) abrir(productos.find(p => p.id === card.dataset.id));
  }
  $('dynGrid').addEventListener('click', clicTarjeta);
  $('lmGrid').addEventListener('click', clicTarjeta);
  $('pmCerrar').addEventListener('click', cerrar);
  $('lmCerrar').addEventListener('click', cerrarLista);
  $('pmodal').addEventListener('click', e => { if (e.target.id === 'pmodal') cerrar(); });
  $('lmodal').addEventListener('click', e => { if (e.target.id === 'lmodal') cerrarLista(); });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if ($('pmodal').classList.contains('abierto')) cerrar(); else cerrarLista();
  });

  // Enlace directo a un producto (el que se envía por WhatsApp): #producto=<id>
  function abrirDesdeHash() {
    const m = location.hash.match(/^#producto=([0-9a-f-]{36})$/);
    const p = m && productos.find(x => x.id === m[1]);
    if (p) { document.getElementById('productos').scrollIntoView(); abrir(p); }
  }

  (async () => {
    const { data, error } = await sb.from('productos')
      .select('*')
      .eq('publicado', true)
      .order('destacado', { ascending: false }).order('orden').order('nombre');
    if (error || !data || !data.length) return;
    productos = data;

    for (const p of productos) {
      const clave = norm(p.categoria);
      if (!clave) continue;
      if (!porSubgrupo.has(clave)) porSubgrupo.set(clave, { nombre: p.categoria, grupo: p.grupo, items: [] });
      const sg = porSubgrupo.get(clave);
      sg.items.push(p);
      if (!sg.grupo && p.grupo) sg.grupo = p.grupo;
    }
    const sueltos = colocarSubgrupos();

    // Arriba: destacados + productos que aún no tienen grupo válido.
    const arriba = productos.filter(p => p.destacado || sueltos.includes(p));
    if (arriba.length) {
      $('dynGrid').innerHTML = arriba.map(tarjeta).join('');
      $('catalogoDinamico').hidden = false;
    }
    document.dispatchEvent(new Event('rjm:catalogo'));
    abrirDesdeHash();
    window.addEventListener('hashchange', abrirDesdeHash);
  })();
})();
