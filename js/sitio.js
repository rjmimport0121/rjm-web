// Web pública de RJM (versión 2): menú, categorías, catálogo con buscador y
// filtros, ficha de producto con enlace directo, marcas y formulario de contacto.
// Los productos con precio vienen de Supabase (los publica el panel o la app
// "RJM Publicar"). La lista de consulta la maneja js/interactivo.js.
(function () {
  const $ = id => document.getElementById(id);
  const cfg = window.RJM_CONFIG || {};
  const RJM = window.RJM || {};
  const WA = cfg.WHATSAPP || '51956543522';
  const SITIO = (cfg.SITIO_URL || 'https://www.rjmimport.com/').replace(/\/?$/, '/');
  const CATS = window.RJM_CATEGORIAS || [];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const soles = (n, m) => n == null ? '' : (m === 'USD' ? 'US$ ' : 'S/ ') + Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const waLink = t => `https://wa.me/${WA}?text=${encodeURIComponent(t)}`;
  const icono = n => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Íconos y descripciones de cada línea y subgrupo (antes eran tarjetas fijas).
  const LINEAS = {
    'Accesorios para Guitarra': { ic: 'guitar', corto: 'Accesorios', txt: 'Cuerdas, clavijeros, afinadores, correas, cables y más.' },
    'Componentes Electrónicos': { ic: 'cpu', corto: 'Electrónica', txt: 'Preamplificadores, pastillas, ecualizadores y repuestos.' },
    'Materiales de Luthiería': { ic: 'hammer', corto: 'Luthiería', txt: 'Maderas, trastes, cejuelas, herramientas y adhesivos.' },
  };
  const DESC = {
    'Cuerdas para Guitarra': 'Acústica, eléctrica y clásica. Nylon y acero, varias marcas y calibres disponibles.',
    'Clavijeros': 'Clavijeros estándar y premium para guitarra acústica, eléctrica y clásica. 3+3 y 6 en línea.',
    'Afinadores Digitales': 'Clip-on, cromáticos y de pedal para diferentes instrumentos. Precisión profesional.',
    'Correas para Guitarra': 'Cuero, nylon y tejido. Ajustables, con sistema de seguridad. Varios diseños.',
    'Cables de Audio': 'Instrumento y patch. Jack 6.3 mm TS/TRS, XLR, varios metrajes. Blindaje profesional.',
    'Capos / Cejillas': 'Para guitarra acústica y eléctrica. Modelos de palanca, tornillo y clips. Cromados y negros.',
    'Puentes, Selletas & Pines': 'Puentes para acústica y clásica, selletas de hueso y plástico, pines de varias maderas.',
    'Pickguards': 'Guardas para guitarra acústica y eléctrica. Tortoise, negro, blanco, perlado.',
    'Perillas (Knobs)': 'Para potenciómetros de guitarra eléctrica y bajo. Metal, plástico, varios diámetros.',
    'Jack & Conectores': 'Input jack mono y estéreo, conectores TRS, mini jack, RCA. Para instrumentos y amplificadores.',
    'Preamplificadores': 'Preamp para guitarra acústica con EQ integrado. Con y sin afinador incorporado.',
    'Pastillas Piezoeléctricas': 'Pastillas piezo de contacto y bajo el puente. Para guitarra, ukulele, charango y más.',
    'Micrófonos para Guitarra': 'Micrófonos de boca, soundhole y condensadores para guitarra acústica. Alta fidelidad.',
    'Ecualizadores': 'EQ de 3, 5 y 7 bandas para guitarra acústica. Con afinador y control de volumen.',
    'Potenciómetros': 'Pots de 250K, 500K y 1M. Alpha y otros, lineal y logarítmico. Para guitarra y bajo.',
    'Switches': 'Selectores de pastilla de 3 y 5 posiciones, toggle switches DPDT y mini switches.',
    'Placas Electrónicas': 'Placas PCB prearmadas para proyectos de guitarra, efectos y electrónica de instrumento.',
    'Maderas para Instrumentos': 'Tapas, fondos, aros y mástiles. Abeto, cedro, caoba y maderas locales peruanas.',
    'Trastes': 'Fretwire de níquel-plata en varios anchos y alturas. Por metro o tira completa.',
    'Cejuelas & Huesos': 'Cejuelas de hueso, TUSQ y plástico. Preformadas y en blanco para tallar.',
    'Herramientas de Luthier': 'Gubias, rasquetas, calibradores, curvímetros, prensas y kits especializados.',
    'Adhesivos Especiales': 'Cola de carpintero, hide glue, cianoacrilato y otros adhesivos para luthería.',
  };
  const lineaDe = sub => (CATS.find(c => c.subgrupos.some(s => norm(s) === norm(sub))) || {}).grupo || '';

  // ---------- Aviso breve (también lo usa la lista de consulta) ----------
  const aviso = $('aviso'); let tAviso;
  window.RJM_AVISO = texto => { aviso.textContent = texto; aviso.classList.add('visible'); clearTimeout(tAviso); tAviso = setTimeout(() => aviso.classList.remove('visible'), 2800); };

  // ---------- Menú ----------
  const menuBoton = $('menuBoton'), menuMovil = $('menuMovil');
  function cerrarMenu() { menuMovil.hidden = true; menuBoton.setAttribute('aria-expanded', 'false'); }
  menuBoton.addEventListener('click', () => { const abrir = menuMovil.hidden; menuMovil.hidden = !abrir; menuBoton.setAttribute('aria-expanded', String(abrir)); });
  menuMovil.addEventListener('click', e => { if (e.target.closest('a')) cerrarMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarMenu(); });
  const enlaces = [...document.querySelectorAll('.menu-enlaces a')];
  const vigia = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) enlaces.forEach(a => a.classList.toggle('activo', a.getAttribute('href') === '#' + e.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  ['productos', 'marcas', 'servicios', 'mayoristas', 'contacto'].forEach(id => $(id) && vigia.observe($(id)));

  // ---------- Estado del catálogo ----------
  let productos = [];
  const estado = { grupo: '', sub: '', q: '', limite: 0 };
  const paso = () => matchMedia('(min-width: 1080px)').matches ? 12 : 8;
  estado.limite = paso();

  function coincide(p) {
    const g = p.grupo || lineaDe(p.categoria);
    if (estado.grupo && g !== estado.grupo) return false;
    if (estado.sub && norm(p.categoria) !== norm(estado.sub)) return false;
    if (estado.q) {
      const texto = norm([p.nombre, p.marca, p.sku, p.categoria, g, p.descripcion].join(' '));
      if (!norm(estado.q).split(' ').every(w => texto.includes(w))) return false;
    }
    return true;
  }
  const cuenta = sub => productos.filter(p => norm(p.categoria) === norm(sub)).length;

  // ---------- Categorías (fichas con subgrupos) ----------
  function pintarCategorias() {
    $('categoriasLista').innerHTML = CATS.map(c => {
      const l = LINEAS[c.grupo] || { ic: 'package', txt: '' };
      return `<article class="categoria">
        <div class="categoria-cab"><span class="categoria-ic">${icono(l.ic)}</span>
          <div><h3>${esc(c.grupo)}</h3><small>${esc(l.txt)}</small></div></div>
        <div class="subgrupos">${c.subgrupos.map(s => { const n = cuenta(s);
          return `<button type="button" data-grupo="${esc(c.grupo)}" data-sub="${esc(s)}">${esc(s)}${n ? `<span class="n" aria-label="${n} con precio">${n}</span>` : ''}</button>`; }).join('')}</div>
        <button type="button" class="categoria-todo" data-grupo="${esc(c.grupo)}">Ver toda la línea ${icono('arrow-right')}</button>
      </article>`;
    }).join('');
  }
  $('categoriasLista').addEventListener('click', e => {
    const b = e.target.closest('button[data-grupo]'); if (!b) return;
    filtrar({ grupo: b.dataset.grupo, sub: b.dataset.sub || '', q: '' }, true);
  });

  // ---------- Filtros ----------
  function pintarChips() {
    $('chipsGrupo').innerHTML = [`<button type="button" data-grupo="" aria-pressed="${!estado.grupo}">Todos</button>`]
      .concat(CATS.map(c => { const l = LINEAS[c.grupo] || {};
        return `<button type="button" data-grupo="${esc(c.grupo)}" aria-pressed="${estado.grupo === c.grupo}">${icono(l.ic || 'package')}${esc(l.corto || c.grupo)}</button>`; })).join('');
    const linea = CATS.find(c => c.grupo === estado.grupo);
    $('chipsSub').hidden = !linea;
    $('chipsSub').innerHTML = linea ? [`<button type="button" data-sub="" aria-pressed="${!estado.sub}">Toda la línea</button>`]
      .concat(linea.subgrupos.map(s => `<button type="button" data-sub="${esc(s)}" aria-pressed="${norm(estado.sub) === norm(s)}">${esc(s)}</button>`)).join('') : '';
  }
  $('chipsGrupo').addEventListener('click', e => { const b = e.target.closest('button'); if (b) filtrar({ grupo: b.dataset.grupo, sub: '' }); });
  $('chipsSub').addEventListener('click', e => { const b = e.target.closest('button'); if (b) filtrar({ sub: b.dataset.sub }); });
  let tBusca;
  $('buscar').addEventListener('input', () => { clearTimeout(tBusca); tBusca = setTimeout(() => filtrar({ q: $('buscar').value.trim() }), 140); });
  $('buscarBorrar').addEventListener('click', () => { $('buscar').value = ''; filtrar({ q: '' }); $('buscar').focus(); });
  $('verMas').addEventListener('click', () => { estado.limite += paso(); pintarProductos(); });

  function filtrar(cambios, irAProductos) {
    Object.assign(estado, cambios); estado.limite = paso();
    if (cambios.q !== undefined && $('buscar').value.trim() !== cambios.q) $('buscar').value = cambios.q;
    pintarChips(); pintarProductos();
    if (irAProductos) $('productos').scrollIntoView({ behavior: reducido ? 'auto' : 'smooth' });
  }

  // ---------- Productos ----------
  function mensajeWa(p) {
    let t = `Hola RJM! Me interesa este producto:\n\n*${p.nombre}*`;
    if (p.sku) t += `\nCódigo: ${p.sku}`;
    if (p.precio != null) t += `\nPrecio: ${soles(p.precio, p.moneda)} (inc. IGV)`;
    t += `\n\nVer producto: ${SITIO}#producto=${p.id}\n\n¿Tienen disponibilidad?`;
    return waLink(t);
  }
  function tarjeta(p) {
    const g = p.grupo || lineaDe(p.categoria), l = LINEAS[g] || { ic: 'package' };
    const img = p.foto_url ? `<img src="${esc(p.foto_url)}" alt="${esc(p.nombre)}" loading="lazy" width="400" height="300"/>` : icono(l.ic);
    const precio = p.precio != null ? `<div class="product-price">${soles(p.precio, p.moneda)}<small>INC. IGV</small></div>` : '<div class="product-price consultar">Precio a consultar</div>';
    return `<article class="product-card" data-id="${esc(p.id)}" tabindex="0" aria-label="${esc(p.nombre)}">
      <div class="product-img">${img}${p.destacado ? '<span class="product-badge">Destacado</span>' : ''}</div>
      <div class="product-info">
        <div class="product-cat">${esc([p.categoria, p.marca].filter(Boolean).join(' · '))}</div>
        <h3 class="product-name">${esc(p.nombre)}</h3>
        ${p.descripcion ? `<p class="product-desc">${esc(p.descripcion)}</p>` : ''}
        ${precio}
        <div class="product-btns"><a class="product-action" href="${mensajeWa(p)}" target="_blank" rel="noopener" data-wa aria-label="Consultar ${esc(p.nombre)} por WhatsApp">${icono('whatsapp')}<span>Consultar</span></a></div>
      </div>
    </article>`;
  }
  function vacio() {
    const caja = $('vacio');
    let titulo, texto, consulta;
    if (!productos.length && !estado.q && !estado.sub) {
      titulo = 'Pronto publicaremos precios aquí';
      texto = 'Mientras tanto, cuéntanos qué buscas: tenemos stock de accesorios, electrónica y materiales de luthiería.';
      consulta = 'Hola RJM! Quisiera información sobre sus productos.';
    } else if (estado.q) {
      titulo = `No encontramos "${estado.q}"`;
      texto = 'Puede que lo tengamos en stock o que podamos importarlo. Pregúntanos por WhatsApp.';
      consulta = `Hola RJM! Busco: ${estado.q}. ¿Lo tienen?`;
    } else {
      const s = estado.sub || estado.grupo;
      titulo = s;
      texto = (DESC[estado.sub] || (LINEAS[estado.grupo] || {}).txt || '') + ' Todavía no publicamos precios de esta línea: te los damos por WhatsApp.';
      consulta = `Hola RJM! Quisiera precios de ${s}.`;
    }
    caja.innerHTML = `<h3>${esc(titulo)}</h3><p>${esc(texto)}</p><a class="boton boton-wa" href="${waLink(consulta)}" target="_blank" rel="noopener">${icono('whatsapp')}Consultar por WhatsApp</a>`;
  }
  function pintarProductos() {
    const lista = productos.filter(coincide);
    const visibles = lista.slice(0, estado.limite);
    $('gridProductos').innerHTML = visibles.map(tarjeta).join('');
    $('verMas').hidden = lista.length <= visibles.length;
    $('buscarBorrar').hidden = !estado.q;
    const partes = [estado.sub || estado.grupo, estado.q && `"${estado.q}"`].filter(Boolean).join(' · ');
    $('resultado').textContent = lista.length ? `${lista.length} producto${lista.length === 1 ? '' : 's'}${partes ? ' · ' + partes : ''}` : '';
    $('vacio').hidden = !!lista.length;
    if (!lista.length) vacio();
    document.dispatchEvent(new Event('rjm:catalogo')); // agrega los botones "+ Lista"
  }
  $('gridProductos').addEventListener('click', e => {
    if (e.target.closest('a,button')) return;
    const c = e.target.closest('.product-card'); if (c) abrirFicha(c.dataset.id);
  });
  $('gridProductos').addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.target.closest('a,button')) return;
    const c = e.target.closest('.product-card'); if (c) abrirFicha(c.dataset.id);
  });

  // ---------- Ficha de producto (con enlace directo #producto=…) ----------
  const fondo = $('pmodal'); let ultimoFoco = null;
  function abrirFicha(id) {
    const p = productos.find(x => x.id === id); if (!p) return;
    const g = p.grupo || lineaDe(p.categoria), l = LINEAS[g] || { ic: 'package' };
    $('pmImg').innerHTML = p.foto_url ? `<img src="${esc(p.foto_url)}" alt="${esc(p.nombre)}"/>` : icono(l.ic);
    $('pmCat').textContent = [g, p.categoria, p.marca, p.sku].filter(Boolean).join(' · ');
    $('pmTitulo').textContent = p.nombre;
    $('pmPrecio').innerHTML = p.precio != null ? `${soles(p.precio, p.moneda)}<small>INC. IGV</small>` : 'Precio a consultar';
    $('pmDesc').textContent = p.descripcion || '';
    $('pmCarac').innerHTML = (p.caracteristicas || []).map(c => `<li>${icono('check')}${esc(c)}</li>`).join('');
    $('pmWa').href = mensajeWa(p);
    history.replaceState(null, '', '#producto=' + p.id);
    ultimoFoco = document.activeElement;
    fondo.hidden = false; fondo.classList.add('abierto'); document.body.classList.add('sin-scroll');
    $('pmCerrar').focus();
  }
  function cerrarFicha() {
    if (fondo.hidden) return;
    fondo.hidden = true; fondo.classList.remove('abierto'); document.body.classList.remove('sin-scroll');
    if (location.hash.startsWith('#producto=')) history.replaceState(null, '', location.pathname + location.search);
    if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
  }
  $('pmCerrar').addEventListener('click', cerrarFicha);
  fondo.addEventListener('click', e => { if (e.target === fondo) cerrarFicha(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarFicha(); });
  function abrirDesdeEnlace() {
    const m = location.hash.match(/^#producto=([0-9a-f-]{36})$/i);
    if (m && productos.some(p => p.id === m[1])) { $('productos').scrollIntoView(); abrirFicha(m[1]); }
  }
  addEventListener('hashchange', abrirDesdeEnlace);

  // ---------- Atajos a una línea (portada y pie) ----------
  document.querySelectorAll('a[data-grupo]').forEach(a => a.addEventListener('click', () => filtrar({ grupo: a.dataset.grupo, sub: '', q: '' })));

  // ---------- Marcas: "Ver productos" busca la marca ----------
  document.querySelectorAll('.marca-card[data-marca]').forEach(card => {
    const ver = () => filtrar({ grupo: '', sub: '', q: card.dataset.marca }, true);
    card.querySelector('.marca-ver')?.addEventListener('click', e => { e.stopPropagation(); ver(); });
    card.addEventListener('click', e => { if (!e.target.closest('a,button')) ver(); });
  });

  // ---------- Formulario de contacto → WhatsApp ----------
  $('formContacto').addEventListener('submit', e => {
    e.preventDefault();
    const n = $('cNombre').value.trim();
    if (!n) { $('cError').textContent = 'Escribe tu nombre para que sepamos a quién respondemos.'; $('cNombre').focus(); return; }
    $('cError').textContent = '';
    let t = `Hola RJM! Mi nombre es *${n}*.`;
    const tel = $('cTel').value.trim(), cat = $('cCat').value, prod = $('cProd').value.trim(), msg = $('cMsg').value.trim();
    if (tel) t += `\nTeléfono: ${tel}`;
    if (cat) t += `\nCategoría: ${cat}`;
    if (prod) t += `\nProducto: ${prod}`;
    if (msg) t += `\n\n${msg}`;
    window.open(waLink(t), '_blank', 'noopener');
    window.RJM_AVISO('Abriendo WhatsApp con tu consulta…');
  });

  // ---------- Barra inferior: "Mi lista" ----------
  $('bmLista').addEventListener('click', () => {
    const fab = $('listaFab'), total = $('listaCuenta');
    if (fab && total && +total.textContent > 0) fab.click();
    else window.RJM_AVISO('Tu lista está vacía: agrega productos con "+ Lista".');
  });
  function sincronizarCuenta() {
    const total = $('listaCuenta'); if (!total) return;
    const c = $('bmCuenta'); c.textContent = total.textContent; c.hidden = !(+total.textContent > 0);
    new MutationObserver(() => { c.textContent = total.textContent; c.hidden = !(+total.textContent > 0); }).observe(total, { childList: true, characterData: true, subtree: true });
  }

  // ---------- Inicio ----------
  pintarCategorias(); pintarChips(); pintarProductos();
  addEventListener('load', sincronizarCuenta);
  (async () => {
    if (!RJM.configurado || !RJM.sb) return;
    const { data, error } = await RJM.sb.from('productos').select('*').eq('publicado', true)
      .order('destacado', { ascending: false }).order('orden').order('nombre');
    if (error || !data) return;
    productos = data;
    pintarCategorias(); pintarProductos(); abrirDesdeEnlace();
  })();
})();
