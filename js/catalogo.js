// Catálogo público con precios: lee los productos publicados desde Supabase.
// Si Supabase no está configurado o no hay productos, la sección queda oculta
// y la web sigue mostrando el catálogo de categorías de siempre.
(function () {
  if (!window.RJM || !RJM.configurado) return;
  const { sb, esc, precio, cfg } = RJM;
  const $ = id => document.getElementById(id);
  let productos = [], filtro = 'Todos';

  function linkProducto(p) { return `${cfg.SITIO_URL}#producto=${p.id}`; }

  function mensajeWa(p) {
    let t = `Hola RJM! Me interesa este producto:\n\n*${p.nombre}*`;
    if (p.sku) t += `\nCódigo: ${p.sku}`;
    if (p.precio != null) t += `\nPrecio: ${precio(p.precio, p.moneda)}${p.precio_incluye_igv ? ' (inc. IGV)' : ' + IGV'}`;
    t += `\n\nVer producto: ${linkProducto(p)}`;
    if (p.foto_url) t += `\nFoto: ${p.foto_url}`;
    t += `\n\n¿Tienen disponibilidad?`;
    return RJM.waLink(t);
  }

  function htmlPrecio(p) {
    if (p.precio == null) return '<div class="product-price">Precio a consultar</div>';
    return `<div class="product-price">${precio(p.precio, p.moneda)}<small>${p.precio_incluye_igv ? 'INC. IGV' : '+ IGV'}</small></div>`;
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

  function pintar() {
    const cats = ['Todos', ...new Set(productos.map(p => p.categoria))];
    $('dynFiltros').innerHTML = cats.length > 2
      ? cats.map(c => `<button class="dyn-filtro${c === filtro ? ' activo' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('') : '';
    $('dynGrid').innerHTML = productos.filter(p => filtro === 'Todos' || p.categoria === filtro).map(tarjeta).join('');
  }

  function abrir(p) {
    $('pmImg').innerHTML = p.foto_url ? `<img src="${esc(p.foto_url)}" alt="${esc(p.nombre)}"/>` : '';
    $('pmCat').textContent = p.categoria + (p.marca ? ' · ' + p.marca : '') + (p.sku ? ' · ' + p.sku : '');
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

  $('dynFiltros').addEventListener('click', e => {
    if (e.target.dataset.cat) { filtro = e.target.dataset.cat; pintar(); }
  });
  $('dynGrid').addEventListener('click', e => {
    if (e.target.closest('[data-wa]')) return; // el botón de WhatsApp abre directo
    const card = e.target.closest('[data-id]');
    if (card) abrir(productos.find(p => p.id === card.dataset.id));
  });
  $('pmCerrar').addEventListener('click', cerrar);
  $('pmodal').addEventListener('click', e => { if (e.target.id === 'pmodal') cerrar(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrar(); });

  (async () => {
    const { data, error } = await sb.from('productos')
      .select('id, sku, nombre, categoria, marca, descripcion, caracteristicas, precio, moneda, precio_incluye_igv, foto_url, destacado')
      .eq('publicado', true)
      .order('destacado', { ascending: false }).order('orden').order('nombre');
    if (error || !data || !data.length) return;
    productos = data;
    $('catalogoDinamico').hidden = false;
    pintar();
    abrirDesdeHash();
    window.addEventListener('hashchange', abrirDesdeHash);
  })();

  // Enlace directo a un producto (el que se envía por WhatsApp): #producto=<id>
  function abrirDesdeHash() {
    const m = location.hash.match(/^#producto=([0-9a-f-]{36})$/);
    const p = m && productos.find(x => x.id === m[1]);
    if (p) { document.getElementById('productos').scrollIntoView(); abrir(p); }
  }
})();
