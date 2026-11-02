// Tienda pública de RJM: buscador con sugerencias, menú de categorías, portada
// con producto destacado, estante de destacados, catálogo con filtros y orden,
// ficha de producto con enlace directo (#producto=…) y formulario de contacto.
// Los productos vienen de Supabase (tabla productos, solo publicado = true); los
// publica el panel de administración o la app "RJM Publicar".
// El carrito y las ventanas viven en js/carrito.js (se carga antes que este).
//
// Efectos visuales: scroll suave con Lenis (MIT, darkroom.engineering) solo en
// computadora, y efectos inspirados en React Bits (MIT + Commons Clause,
// David Haz) reescritos sin React: ClickSpark, SpotlightCard, FadeContent,
// LogoLoop, GlareHover y ShinyText. Todos se apagan si el sistema pide
// reducir el movimiento.
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const cfg = window.RJM_CONFIG || {};
  const RJM = window.RJM || {};
  const C = window.RJM_CARRITO;
  const V = window.RJM_VENTANA;
  const WA = cfg.WHATSAPP || '51956543522';
  const SITIO = (cfg.SITIO_URL || 'https://www.rjmimport.com/').replace(/\/?$/, '/');
  const CATS = window.RJM_CATEGORIAS || [];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const dinero = (n, m) => (m === 'USD' ? 'US$ ' : 'S/ ') + Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const waLink = t => `https://wa.me/${WA}?text=${encodeURIComponent(t)}`;
  const icono = n => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const punteroFino = matchMedia('(pointer: fine)').matches;
  const comportamiento = reducido ? 'auto' : 'smooth';

  // ---------- Scroll suave (Lenis) solo con mouse o trackpad ----------
  let lenis = null;
  if (window.Lenis && !reducido && punteroFino) {
    try { lenis = new window.Lenis({ autoRaf: true, allowNestedScroll: true }); window.RJM_LENIS = lenis; } catch (_) { lenis = null; }
  }
  function irA(el) {
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { force: true });
    else el.scrollIntoView({ behavior: comportamiento, block: 'start' });
  }
  function irArriba() {
    if (lenis) lenis.scrollTo(0, { force: true }); else scrollTo({ top: 0, behavior: comportamiento });
  }

  // Líneas del catálogo: ícono, nombre corto, color y descripción.
  const LINEAS = {
    'Accesorios para Guitarra': { ic: 'guitar', corto: 'Accesorios', clase: 'acc', txt: 'Cuerdas, clavijeros, afinadores, correas, cables y más.' },
    'Componentes Electrónicos': { ic: 'cpu', corto: 'Electrónica', clase: 'ele', txt: 'Preamplificadores, pastillas, ecualizadores y repuestos.' },
    'Materiales de Luthiería': { ic: 'hammer', corto: 'Luthiería', clase: 'lut', txt: 'Maderas, trastes, cejuelas, herramientas y adhesivos.' },
  };
  const OTRA = { ic: 'package', corto: 'Otros', clase: 'acc', txt: '' };
  const DESC = {
    'Cuerdas para Guitarra': 'Acústica, eléctrica y clásica. Nylon y acero, varias marcas y calibres disponibles.',
    'Clavijeros': 'Clavijeros estándar y premium para guitarra acústica, eléctrica y clásica. 3+3 y 6 en línea.',
    'Afinadores Digitales': 'Clip-on, cromáticos y de pedal para diferentes instrumentos.',
    'Correas para Guitarra': 'Cuero, nylon y tejido. Ajustables, con sistema de seguridad. Varios diseños.',
    'Cables de Audio': 'Instrumento y patch. Jack 6.3 mm TS/TRS, XLR, varios metrajes.',
    'Capos / Cejillas': 'Para guitarra acústica y eléctrica. Modelos de palanca, tornillo y clips.',
    'Puentes, Selletas & Pines': 'Puentes para acústica y clásica, selletas de hueso y plástico, pines de varias maderas.',
    'Pickguards': 'Guardas para guitarra acústica y eléctrica. Tortoise, negro, blanco, perlado.',
    'Perillas (Knobs)': 'Para potenciómetros de guitarra eléctrica y bajo. Metal, plástico, varios diámetros.',
    'Jack & Conectores': 'Input jack mono y estéreo, conectores TRS, mini jack, RCA.',
    'Preamplificadores': 'Preamp para guitarra acústica con EQ integrado. Con y sin afinador incorporado.',
    'Pastillas Piezoeléctricas': 'Pastillas piezo de contacto y bajo el puente. Para guitarra, ukulele, charango y más.',
    'Micrófonos para Guitarra': 'Micrófonos de boca, soundhole y condensadores para guitarra acústica.',
    'Ecualizadores': 'EQ de 3, 5 y 7 bandas para guitarra acústica. Con afinador y control de volumen.',
    'Potenciómetros': 'Pots de 250K, 500K y 1M. Lineal y logarítmico. Para guitarra y bajo.',
    'Switches': 'Selectores de pastilla de 3 y 5 posiciones, toggle switches DPDT y mini switches.',
    'Placas Electrónicas': 'Placas PCB prearmadas para proyectos de guitarra, efectos y electrónica de instrumento.',
    'Maderas para Instrumentos': 'Tapas, fondos, aros y mástiles. Abeto, cedro, caoba y maderas locales peruanas.',
    'Trastes': 'Fretwire de níquel-plata en varios anchos y alturas. Por metro o tira completa.',
    'Cejuelas & Huesos': 'Cejuelas de hueso, TUSQ y plástico. Preformadas y en blanco para tallar.',
    'Herramientas de Luthier': 'Gubias, rasquetas, calibradores, curvímetros, prensas y kits especializados.',
    'Adhesivos Especiales': 'Cola de carpintero, hide glue, cianoacrilato y otros adhesivos para luthería.',
  };

  // ---------- Datos y estado ----------
  let productos = [];
  let cargando = true;
  let nuevos = new Set();
  const estado = { linea: '', sub: '', marca: '', q: '', orden: 'destacados', limite: 0 };
  const paso = () => matchMedia('(min-width: 1240px)').matches ? 12 : matchMedia('(min-width: 640px)').matches ? 9 : 8;
  estado.limite = paso();

  const lineaDe = p => p.grupo || (CATS.find(c => c.subgrupos.some(s => norm(s) === norm(p.categoria))) || {}).grupo || '';
  const datosLinea = g => LINEAS[g] || OTRA;
  const buscarP = id => productos.find(p => p.id === id);
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

  function calcularNuevos() {
    const limite = Date.now() - 30 * 864e5;
    const ids = productos.filter(p => p.creado_en && Date.parse(p.creado_en) > limite).map(p => p.id);
    // Si casi todo es nuevo (por ejemplo, recién se publicó el catálogo), la etiqueta no ayuda.
    nuevos = new Set(ids.length <= productos.length * 0.5 ? ids : []);
  }

  function coincide(p, ignorar) {
    if (ignorar !== 'linea' && estado.linea && lineaDe(p) !== estado.linea) return false;
    if (ignorar !== 'sub' && estado.sub && norm(p.categoria) !== norm(estado.sub)) return false;
    if (ignorar !== 'marca' && estado.marca && norm(p.marca) !== norm(estado.marca)) return false;
    if (estado.q) {
      const texto = norm([p.nombre, p.marca, p.sku, p.categoria, lineaDe(p), p.descripcion].join(' '));
      if (!norm(estado.q).split(' ').every(w => texto.includes(w))) return false;
    }
    return true;
  }
  function ordenar(lista) {
    const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, 'es');
    switch (estado.orden) {
      case 'precio-asc':
      case 'precio-desc': {
        const s = estado.orden === 'precio-asc' ? 1 : -1;
        return lista.slice().sort((a, b) => (a.precio == null) - (b.precio == null) || s * (a.precio - b.precio) || porNombre(a, b));
      }
      case 'nombre': return lista.slice().sort(porNombre);
      case 'nuevos': return lista.slice().sort((a, b) => String(b.creado_en || '').localeCompare(String(a.creado_en || '')) || porNombre(a, b));
      default: return lista; // ya vienen ordenados: destacados primero, luego "orden" y nombre
    }
  }
  const cuentaSub = s => productos.filter(p => norm(p.categoria) === norm(s)).length;

  // ---------- Piezas de la tarjeta de producto ----------
  function mensajeWa(p) {
    let t = `Hola RJM! Quiero comprar este producto:\n\n*${p.nombre}*`;
    if (p.sku) t += `\nCódigo: ${p.sku}`;
    if (p.precio != null) t += `\nPrecio: ${dinero(p.precio, p.moneda)}${p.precio_incluye_igv === false ? '' : ' (IGV incluido)'}`;
    t += `\n\nVer producto: ${SITIO}#producto=${p.id}\n\n¿Tienen disponibilidad?`;
    return waLink(t);
  }
  function imagenHTML(p) {
    const l = datosLinea(lineaDe(p));
    return p.foto_url
      ? `<img src="${esc(p.foto_url)}" alt="" loading="lazy" decoding="async" width="400" height="400"/>`
      : `<div class="sinfoto ${l.clase}">${icono(l.ic)}<span>${esc(p.categoria || l.corto)}</span></div>`;
  }
  function insigniasHTML(p) {
    const ins = (p.destacado ? '<span class="insignia insignia-dest">Destacado</span>' : '') + (nuevos.has(p.id) ? '<span class="insignia insignia-nuevo">Nuevo</span>' : '');
    return ins ? `<div class="insignias">${ins}</div>` : '';
  }
  function precioHTML(p) {
    if (p.precio == null) return '<p class="t-precio"><span class="t-consultar">Precio a consultar</span></p>';
    return `<p class="t-precio"><span class="monto">${dinero(p.precio, p.moneda)}</span><small>${p.precio_incluye_igv === false ? '+ IGV' : 'IGV incluido'}</small></p>`;
  }
  function pasoCantHTML(p, n) {
    return `<div class="paso-cant" role="group" aria-label="Cantidad de ${esc(p.nombre)} en el carrito">
        <button type="button" data-cant="-1" aria-label="${n === 1 ? 'Quitar del carrito' : 'Quitar uno'}">${icono(n === 1 ? 'trash-2' : 'minus')}</button>
        <span class="paso-n" aria-live="polite">${n}</span>
        <button type="button" data-cant="1" aria-label="Agregar uno más">${icono('plus')}</button></div>`;
  }
  function accionesHTML(p, n) {
    const izquierda = n ? pasoCantHTML(p, n)
      : `<button type="button" class="btn-agregar" data-agregar="${esc(p.id)}" aria-label="Agregar ${esc(p.nombre)} al carrito">${icono('shopping-cart')}Agregar</button>`;
    return `<div class="t-acciones" data-acciones="${esc(p.id)}" data-n="${n}">${izquierda}
      <a class="btn-wa-ic" href="${mensajeWa(p)}" target="_blank" rel="noopener" aria-label="Comprar ${esc(p.nombre)} por WhatsApp">${icono('whatsapp')}</a></div>`;
  }
  function tarjeta(p) {
    return `<article class="tarjeta">
      <div class="t-img">${imagenHTML(p)}${insigniasHTML(p)}</div>
      <div class="t-info">
        <p class="t-marca">${esc(p.marca || p.categoria || '')}</p>
        <h3 class="t-nombre"><a href="#producto=${esc(p.id)}">${esc(p.nombre)}</a></h3>
        ${precioHTML(p)}
        ${accionesHTML(p, C.cantidad(p.id))}
      </div>
    </article>`;
  }
  const esqueleto = n => Array.from({ length: n }, () => `<div class="tarjeta esqueleto" aria-hidden="true"><div class="t-img"></div>
      <div class="t-info"><div class="esq-linea corta"></div><div class="esq-linea"></div><div class="esq-linea corta"></div></div></div>`).join('');

  // Cuando cambia el carrito, cada tarjeta muestra "Agregar" o el selector de cantidad.
  function refrescarAcciones() {
    document.querySelectorAll('[data-acciones]').forEach(el => {
      const id = el.dataset.acciones, n = C.cantidad(id), antes = Number(el.dataset.n);
      if (n === antes) return;
      const p = buscarP(id); if (!p) return;
      if (n && antes) { // solo cambia el número
        el.dataset.n = n;
        el.querySelector('.paso-n').textContent = n;
        const menos = el.querySelector('[data-cant="-1"]');
        menos.setAttribute('aria-label', n === 1 ? 'Quitar del carrito' : 'Quitar uno');
        menos.innerHTML = icono(n === 1 ? 'trash-2' : 'minus');
        return;
      }
      const tenia = el.contains(document.activeElement);
      const caja = document.createElement('div');
      caja.innerHTML = accionesHTML(p, n);
      const nuevo = caja.firstElementChild;
      el.replaceWith(nuevo);
      if (tenia) (nuevo.querySelector(n ? '[data-cant="1"]' : '[data-agregar]') || nuevo).focus({ preventScroll: true });
    });
    pintarFichaCarrito();
  }
  C.alCambiar(refrescarAcciones);

  // ---------- Compra por categoría, menú grande y menú del celular ----------
  function pintarLineas() {
    $('lineas').innerHTML = CATS.map(c => {
      const l = datosLinea(c.grupo);
      const total = productos.filter(p => lineaDe(p) === c.grupo).length;
      return `<article class="linea linea-${l.clase} foco">
        <div class="linea-cab"><span class="linea-ic">${icono(l.ic)}</span>
          <div><h3><a href="#catalogo" data-linea="${esc(c.grupo)}">${esc(c.grupo)}</a></h3><p>${esc(l.txt)}</p></div></div>
        <ul class="linea-subs">${c.subgrupos.map(s => {
          const n = cuentaSub(s);
          return `<li><a href="#catalogo" data-linea="${esc(c.grupo)}" data-sub="${esc(s)}">${esc(s)}${n ? `<span class="n-pill">${n}<span class="sr"> ${n === 1 ? 'producto' : 'productos'}</span></span>` : ''}</a></li>`;
        }).join('')}${c.subgrupos.length > 6 ? `<li class="mas-subs"><a href="#catalogo" data-linea="${esc(c.grupo)}">+${c.subgrupos.length - 6} más</a></li>` : ''}</ul>
        <a class="linea-todo" href="#catalogo" data-linea="${esc(c.grupo)}">${total === 1 ? 'Ver el producto' : total ? `Ver los ${total} productos` : 'Ver la categoría'}${icono('arrow-right')}</a>
      </article>`;
    }).join('');
  }
  function pintarMenus() {
    $('megaIn').innerHTML = CATS.map(c => {
      const l = datosLinea(c.grupo);
      return `<div class="mega-col"><h3><a href="#catalogo" data-linea="${esc(c.grupo)}">${icono(l.ic)}${esc(c.grupo)}</a></h3>
        <ul>${c.subgrupos.map(s => { const n = cuentaSub(s);
          return `<li><a href="#catalogo" data-linea="${esc(c.grupo)}" data-sub="${esc(s)}">${esc(s)}${n ? `<span class="n">${n}</span>` : ''}</a></li>`; }).join('')}</ul></div>`;
    }).join('');
    $('menuCats').innerHTML = CATS.map(c => {
      const l = datosLinea(c.grupo);
      return `<details><summary><span class="linea-ic ${l.clase}">${icono(l.ic)}</span>${esc(c.grupo)}<svg class="ic flecha-abajo" aria-hidden="true"><use href="#i-chevron-down"/></svg></summary>
        <ul><li><a href="#catalogo" data-linea="${esc(c.grupo)}"><b>Ver toda la categoría</b></a></li>${c.subgrupos.map(s => { const n = cuentaSub(s);
          return `<li><a href="#catalogo" data-linea="${esc(c.grupo)}" data-sub="${esc(s)}">${esc(s)}${n ? `<span class="n">${n}</span>` : ''}</a></li>`; }).join('')}</ul></details>`;
    }).join('');
  }

  // Menú grande de categorías (computadora).
  const btnCats = $('btnCategorias'), mega = $('mega');
  const megaAbrir = abrir => { mega.hidden = !abrir; btnCats.setAttribute('aria-expanded', String(abrir)); };
  btnCats.addEventListener('click', () => megaAbrir(mega.hidden));
  document.addEventListener('click', e => { if (!mega.hidden && !e.target.closest('#mega, #btnCategorias')) megaAbrir(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !mega.hidden) { megaAbrir(false); btnCats.focus(); } });

  // Menú del celular.
  $('btnMenu').addEventListener('click', () => V.abrir($('menuMovil')));
  $('bmCategorias').addEventListener('click', () => {
    V.abrir($('menuMovil'));
    const primero = $('menuCats').querySelector('details');
    if (primero) primero.open = true;
  });

  // ---------- Filtros del catálogo ----------
  function botonFiltro(valor, texto, n, pulsado, ic) {
    return `<button type="button" data-valor="${esc(valor)}" aria-pressed="${pulsado}"><span class="lbl">${ic ? icono(ic) : ''}${esc(texto)}</span>${productos.length ? `<span class="n">${n}</span>` : ''}</button>`;
  }
  function marcasDisponibles() {
    const mapa = new Map();
    productos.filter(p => p.marca && coincide(p, 'marca')).forEach(p => {
      const k = norm(p.marca);
      const m = mapa.get(k) || { nombre: p.marca.trim(), n: 0 };
      m.n += 1; mapa.set(k, m);
    });
    return [...mapa.values()].sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre, 'es'));
  }
  function pintarFiltros() {
    const base = productos.filter(p => coincide(p, 'linea'));
    $('fLinea').innerHTML = [botonFiltro('', 'Todo', base.length, !estado.linea, 'layout-grid')]
      .concat(CATS.map(c => { const l = datosLinea(c.grupo);
        return botonFiltro(c.grupo, l.corto, base.filter(p => lineaDe(p) === c.grupo).length, estado.linea === c.grupo, l.ic); })).join('');

    const linea = CATS.find(c => c.grupo === estado.linea);
    $('fSubCaja').hidden = !linea;
    if (linea) {
      const enLinea = productos.filter(p => coincide(p, 'sub'));
      $('fSub').innerHTML = [botonFiltro('', 'Toda la categoría', enLinea.length, !estado.sub)]
        .concat(linea.subgrupos.map(s => botonFiltro(s, s, enLinea.filter(p => norm(p.categoria) === norm(s)).length, norm(estado.sub) === norm(s)))).join('');
    } else $('fSub').innerHTML = '';

    const marcas = marcasDisponibles();
    const hayMarcas = marcas.length > 0 || !!estado.marca;
    $('fMarcaCaja').hidden = !hayMarcas;
    $('selMarcaCaja').hidden = !hayMarcas;
    $('fMarca').innerHTML = [botonFiltro('', 'Todas las marcas', productos.filter(p => coincide(p, 'marca')).length, !estado.marca)]
      .concat(marcas.map(m => botonFiltro(m.nombre, m.nombre, m.n, norm(estado.marca) === norm(m.nombre)))).join('');
    $('selMarca').innerHTML = ['<option value="">Todas las marcas</option>']
      .concat(marcas.map(m => `<option value="${esc(m.nombre)}"${norm(estado.marca) === norm(m.nombre) ? ' selected' : ''}>${esc(m.nombre)} (${m.n})</option>`)).join('');
    pintarActivos();
  }
  function pintarActivos() {
    const pills = [];
    if (estado.linea) pills.push(['linea', datosLinea(estado.linea).corto]);
    if (estado.sub) pills.push(['sub', estado.sub]);
    if (estado.marca) pills.push(['marca', estado.marca]);
    if (estado.q) pills.push(['q', `“${estado.q}”`]);
    $('activos').hidden = !pills.length;
    $('activos').innerHTML = pills.map(([k, t]) => `<button type="button" class="activo" data-quitar="${k}" aria-label="Quitar filtro: ${esc(t)}">${esc(t)}${icono('x')}</button>`).join('')
      + (pills.length > 1 ? '<button type="button" class="limpiar" data-quitar="todo">Limpiar filtros</button>' : '');
  }
  $('fLinea').addEventListener('click', e => { const b = e.target.closest('button'); if (b) filtrar({ linea: b.dataset.valor, sub: '' }); });
  $('fSub').addEventListener('click', e => { const b = e.target.closest('button'); if (b) filtrar({ sub: b.dataset.valor }); });
  $('fMarca').addEventListener('click', e => { const b = e.target.closest('button'); if (b) filtrar({ marca: b.dataset.valor }); });
  $('selMarca').addEventListener('change', e => filtrar({ marca: e.target.value }));
  $('selOrden').addEventListener('change', e => filtrar({ orden: e.target.value }));
  $('activos').addEventListener('click', e => {
    const b = e.target.closest('[data-quitar]'); if (!b) return;
    const k = b.dataset.quitar;
    filtrar(k === 'todo' ? { linea: '', sub: '', marca: '', q: '' } : k === 'linea' ? { linea: '', sub: '' } : { [k]: '' });
    const siguiente = $('activos').querySelector('button') || $('fLinea').querySelector('button');
    if (siguiente) siguiente.focus({ preventScroll: true });
  });
  $('verMas').addEventListener('click', () => {
    const antes = estado.limite;
    estado.limite += paso();
    pintarProductos();
    const enlace = $('gridProductos').querySelectorAll('.t-nombre a')[antes];
    if (enlace) enlace.focus({ preventScroll: true });
  });

  function filtrar(cambios, irAlCatalogo) {
    if (cambios.linea !== undefined && cambios.linea !== estado.linea && cambios.sub === undefined) cambios.sub = '';
    Object.assign(estado, cambios);
    estado.limite = paso();
    if ($('buscar').value.trim() !== estado.q) $('buscar').value = estado.q;
    $('buscarBorrar').hidden = !$('buscar').value;
    $('selOrden').value = estado.orden;
    pintarFiltros();
    pintarProductos();
    if (irAlCatalogo) irA($('catalogo'));
  }

  // ---------- Productos ----------
  function vacio() {
    const caja = $('vacio');
    let titulo, texto, consulta;
    if (!productos.length) {
      titulo = 'Pronto publicaremos precios aquí';
      texto = 'Mientras tanto, cuéntanos qué buscas: tenemos accesorios, electrónica y materiales de luthiería.';
      consulta = 'Hola RJM! Quisiera información sobre sus productos.';
    } else if (estado.q) {
      titulo = `No encontramos “${estado.q}”`;
      texto = 'Puede que lo tengamos en stock o que podamos importarlo. Pregúntanos por WhatsApp.';
      consulta = `Hola RJM! Busco: ${estado.q}. ¿Lo tienen?`;
    } else {
      const s = estado.sub || estado.marca || estado.linea;
      titulo = `Aún no publicamos ${s}`;
      texto = (DESC[estado.sub] ? DESC[estado.sub] + ' ' : '') + 'Te damos precios y disponibilidad por WhatsApp.';
      consulta = `Hola RJM! Quisiera precios de ${s}.`;
    }
    const hayFiltros = estado.linea || estado.sub || estado.marca || estado.q;
    caja.innerHTML = `<h3>${esc(titulo)}</h3><p>${esc(texto)}</p>
      <a class="btn btn-wa" href="${waLink(consulta)}" target="_blank" rel="noopener">${icono('whatsapp')}Consultar por WhatsApp</a>
      ${hayFiltros && productos.length ? '<button type="button" class="enlace" data-quitar-todo>Ver todos los productos</button>' : ''}`;
  }
  $('vacio').addEventListener('click', e => { if (e.target.closest('[data-quitar-todo]')) filtrar({ linea: '', sub: '', marca: '', q: '' }); });

  function pintarProductos() {
    if (cargando) {
      $('gridProductos').innerHTML = esqueleto(paso());
      $('gridProductos').setAttribute('aria-busy', 'true');
      return;
    }
    $('gridProductos').removeAttribute('aria-busy');
    const lista = ordenar(productos.filter(p => coincide(p)));
    const visibles = lista.slice(0, estado.limite);
    $('gridProductos').innerHTML = visibles.map(tarjeta).join('');
    const faltan = lista.length - visibles.length;
    $('verMas').hidden = faltan <= 0;
    $('verMas').textContent = `Ver más productos (${faltan})`;
    const filtrado = estado.linea || estado.sub || estado.marca || estado.q;
    $('resultado').textContent = lista.length ? plural(lista.length, 'producto', 'productos') + (filtrado ? (lista.length === 1 ? ' encontrado' : ' encontrados') : '') : (productos.length ? 'Sin resultados' : '');
    $('vacio').hidden = !!lista.length;
    if (!lista.length) vacio();
  }

  // Delegado: "Agregar" y selector de cantidad en cualquier tarjeta.
  document.addEventListener('click', e => {
    const ag = e.target.closest('[data-agregar]');
    if (ag) {
      const p = buscarP(ag.dataset.agregar); if (!p) return;
      chispasEn(ag, e);
      C.agregar(p, 1);
      window.RJM_AVISO(`Agregado al carrito: ${p.nombre}`, { texto: 'Ver carrito', fn: C.abrir });
      return;
    }
    const op = e.target.closest('[data-cant]');
    if (op) {
      const id = op.closest('[data-acciones]').dataset.acciones;
      C.fijar(id, C.cantidad(id) + Number(op.dataset.cant));
      if (Number(op.dataset.cant) > 0) chispasEn(op, e);
    }
  });

  // ---------- Destacados y producto de la portada ----------
  function seleccionDestacados() {
    const dest = productos.filter(p => p.destacado);
    const extra = productos.filter(p => !p.destacado && nuevos.has(p.id));
    return dest.concat(extra).slice(0, 12);
  }
  function pintarEstante() {
    const lista = seleccionDestacados();
    const mostrar = lista.length >= 2 && productos.length > 4;
    $('destacados').hidden = !mostrar;
    $('estante').innerHTML = mostrar ? lista.map(tarjeta).join('') : '';
    actualizarFlechas();
  }
  function actualizarFlechas() {
    const e = $('estante');
    $('estAnt').disabled = e.scrollLeft <= 4;
    $('estSig').disabled = e.scrollLeft + e.clientWidth >= e.scrollWidth - 4;
  }
  $('estante').addEventListener('scroll', actualizarFlechas, { passive: true });
  $('estAnt').addEventListener('click', () => $('estante').scrollBy({ left: -$('estante').clientWidth * 0.9, behavior: comportamiento }));
  $('estSig').addEventListener('click', () => $('estante').scrollBy({ left: $('estante').clientWidth * 0.9, behavior: comportamiento }));

  function pintarBanner() {
    const p = productos.find(x => x.destacado && x.foto_url) || productos.find(x => x.foto_url);
    const vitrina = $('bannerVisual').querySelector('.escaparate, .spot');
    if (!p || !vitrina) return;
    const spot = document.createElement('a');
    spot.className = 'spot';
    spot.href = '#producto=' + p.id;
    spot.innerHTML = `<span class="etq">${p.destacado ? 'Destacado' : 'Nuevo en la tienda'}</span>
      <span class="spot-img"><img src="${esc(p.foto_url)}" alt="" width="400" height="400"/></span>
      <b>${esc(p.nombre)}</b><span class="precio">${p.precio != null ? dinero(p.precio, p.moneda) : 'Precio a consultar'}</span>`;
    vitrina.replaceWith(spot);
    $('bannerVisual').classList.add('con-producto');
  }

  // ---------- Buscador con sugerencias ----------
  const inp = $('buscar'), sug = $('sugerencias');
  let opciones = [], activo = -1, tBusca;
  function resultadosDe(q) {
    const palabras = norm(q).split(' ').filter(Boolean);
    return productos.map(p => {
      const nombre = norm(p.nombre), resto = norm([p.marca, p.sku, p.categoria, lineaDe(p), p.descripcion].join(' '));
      if (!palabras.every(w => nombre.includes(w) || resto.includes(w))) return null;
      const puntos = palabras.reduce((s, w) => s + (nombre.startsWith(w) ? 3 : nombre.includes(w) ? 2 : 1), 0) + (p.destacado ? 0.5 : 0);
      return { p, puntos };
    }).filter(Boolean).sort((a, b) => b.puntos - a.puntos).map(x => x.p);
  }
  function cerrarSug() {
    sug.hidden = true; inp.setAttribute('aria-expanded', 'false'); inp.removeAttribute('aria-activedescendant');
    opciones = []; activo = -1;
  }
  function pintarSug() {
    const q = inp.value.trim();
    if (q.length < 2 || cargando) { cerrarSug(); return; }
    const lista = resultadosDe(q);
    let html = lista.slice(0, 6).map((p, i) => {
      const l = datosLinea(lineaDe(p));
      return `<div class="sug" role="option" id="sug-${i}" aria-selected="false" data-id="${esc(p.id)}">
        <span class="sug-img">${p.foto_url ? `<img src="${esc(p.foto_url)}" alt="" width="44" height="44" loading="lazy"/>` : icono(l.ic)}</span>
        <span class="sug-txt"><b>${esc(p.nombre)}</b><small>${esc([p.categoria, p.marca].filter(Boolean).join(' · '))}</small></span>
        <span class="sug-precio">${p.precio != null ? dinero(p.precio, p.moneda) : ''}</span></div>`;
    }).join('');
    html += lista.length
      ? `<div class="sug sug-todos" role="option" id="sug-todos" aria-selected="false" data-todos="1">${lista.length === 1 ? 'Ver el resultado en el catálogo' : `Ver los ${lista.length} resultados`}</div>`
      : `<div class="sug sug-wa" role="option" id="sug-wa" aria-selected="false" data-wa="1">${icono('whatsapp')}<span>No lo encontramos. Consultar “${esc(q)}” por WhatsApp</span></div>`;
    sug.innerHTML = html;
    opciones = [...sug.querySelectorAll('[role=option]')];
    activo = -1;
    sug.hidden = false;
    inp.setAttribute('aria-expanded', 'true');
    inp.removeAttribute('aria-activedescendant');
  }
  function marcar(i) {
    if (!opciones.length) return;
    activo = (i + opciones.length) % opciones.length;
    opciones.forEach((o, k) => o.setAttribute('aria-selected', String(k === activo)));
    inp.setAttribute('aria-activedescendant', opciones[activo].id);
    opciones[activo].scrollIntoView({ block: 'nearest' });
  }
  function buscarAhora() {
    cerrarSug();
    filtrar({ q: inp.value.trim(), linea: '', sub: '', marca: '' }, true);
    if (!punteroFino) inp.blur(); // cierra el teclado del celular
  }
  function elegir(o) {
    if (o.dataset.id) { cerrarSug(); inp.blur(); location.hash = 'producto=' + o.dataset.id; }
    else if (o.dataset.todos) buscarAhora();
    else if (o.dataset.wa) { cerrarSug(); window.open(waLink(`Hola RJM! Busco: ${inp.value.trim()}. ¿Lo tienen?`), '_blank', 'noopener'); }
  }
  inp.addEventListener('input', () => {
    $('buscarBorrar').hidden = !inp.value;
    clearTimeout(tBusca);
    tBusca = setTimeout(() => { pintarSug(); filtrar({ q: inp.value.trim(), linea: '', sub: '', marca: '' }); }, 140);
  });
  inp.addEventListener('focus', () => { if (inp.value.trim().length >= 2) pintarSug(); });
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (sug.hidden) pintarSug(); marcar(activo + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); marcar(activo - 1); }
    else if (e.key === 'Enter' && activo >= 0 && !sug.hidden) { e.preventDefault(); elegir(opciones[activo]); }
    else if (e.key === 'Escape') { if (!sug.hidden) { e.preventDefault(); cerrarSug(); } }
  });
  sug.addEventListener('mousedown', e => e.preventDefault()); // no quitar el foco del buscador
  sug.addEventListener('click', e => { const o = e.target.closest('[role=option]'); if (o) elegir(o); });
  document.addEventListener('click', e => { if (!sug.hidden && !e.target.closest('#formBuscar')) cerrarSug(); });
  $('formBuscar').addEventListener('submit', e => { e.preventDefault(); clearTimeout(tBusca); buscarAhora(); });
  $('buscarBorrar').addEventListener('click', () => { inp.value = ''; cerrarSug(); filtrar({ q: '' }); inp.focus(); });

  // ---------- Enlaces a categorías, marcas y secciones ----------
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-linea]');
    if (a) {
      const ventana = a.closest('dialog');
      if (ventana) V.cerrar(ventana);
      if (!mega.hidden) megaAbrir(false);
      filtrar({ linea: a.dataset.linea, sub: a.dataset.sub || '', marca: '', q: '' });
      return;
    }
    const enMenu = e.target.closest('#menuMovil a');
    if (enMenu) V.cerrar($('menuMovil'));
  });
  document.querySelectorAll('.marca[data-marca]').forEach(b => b.addEventListener('click', () => filtrar({ linea: '', sub: '', marca: '', q: b.dataset.marca }, true)));

  // Enlaces internos (#seccion): con Lenis se desplazan suave; "#inicio" vuelve arriba.
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href^="#"]'); if (!a) return;
    const id = decodeURIComponent(a.getAttribute('href').slice(1));
    if (id === 'inicio') { e.preventDefault(); history.pushState(null, '', '#inicio'); irArriba(); return; }
    if (!lenis) return;
    const destino = id && !id.startsWith('producto=') ? document.getElementById(id) : null;
    if (!destino) return;
    e.preventDefault();
    if (location.hash !== '#' + id) history.pushState(null, '', '#' + id);
    irA(destino);
  });

  // ---------- Ficha de producto (con enlace directo #producto=…) ----------
  const ficha = $('ficha');
  let fichaId = null, fichaPorEnlace = false;
  function abrirFicha(id, porEnlace) {
    const p = buscarP(id); if (!p) return false;
    fichaId = id; fichaPorEnlace = !!porEnlace;
    const g = lineaDe(p), l = datosLinea(g);
    $('fImg').innerHTML = (p.foto_url ? `<img src="${esc(p.foto_url)}" alt="${esc(p.nombre)}" width="800" height="800"/>`
      : `<div class="sinfoto ${l.clase}">${icono(l.ic)}<span>${esc(p.categoria || l.corto)}</span></div>`) + insigniasHTML(p);
    $('fRuta').textContent = [g, p.categoria].filter(Boolean).join(' › ');
    $('fTitulo').textContent = p.nombre;
    $('fMeta').innerHTML = [p.marca && `Marca: <b>${esc(p.marca)}</b>`, p.sku && `Código: <b>${esc(p.sku)}</b>`].filter(Boolean).join(' · ');
    $('fMeta').hidden = !p.marca && !p.sku;
    const precio = $('fPrecio');
    precio.className = 'ficha-precio' + (p.precio == null ? ' consultar' : '');
    precio.innerHTML = p.precio != null ? `<span class="monto">${dinero(p.precio, p.moneda)}</span><small>${p.precio_incluye_igv === false ? '+ IGV' : 'IGV incluido'}</small>` : 'Precio a consultar';
    $('fDesc').textContent = p.descripcion || '';
    $('fDesc').hidden = !p.descripcion;
    const carac = (p.caracteristicas || []).filter(Boolean);
    $('fCarac').innerHTML = carac.map(c => `<li>${icono('check')}${esc(c)}</li>`).join('');
    $('fCarac').hidden = !carac.length;
    $('fCant').value = 1;
    $('fWa').href = mensajeWa(p);
    $('fAgregar').querySelector('span').textContent = 'Agregar al carrito';
    pintarFichaCarrito();
    V.abrir(ficha);
    ficha.querySelector('.ficha-scroll').scrollTop = 0;
    return true;
  }
  function pintarFichaCarrito() {
    const caja = $('fEnCarrito');
    const n = fichaId ? C.cantidad(fichaId) : 0;
    caja.hidden = !n;
    caja.innerHTML = n ? `Tienes <b>${n}</b> en tu carrito · <button type="button" class="enlace" id="fVerCarrito">Ver carrito</button>` : '';
  }
  ficha.addEventListener('click', e => {
    if (e.target.closest('#fVerCarrito')) { V.cerrar(ficha); C.abrir(); return; }
    const op = e.target.closest('.cantidad [data-op]');
    if (op) $('fCant').value = Math.max(1, Math.min(999, (Number($('fCant').value) || 1) + Number(op.dataset.op)));
  });
  $('fAgregar').addEventListener('click', e => {
    const p = buscarP(fichaId); if (!p) return;
    const n = Math.max(1, Math.min(999, Math.round(Number($('fCant').value)) || 1));
    chispasEn($('fAgregar'), e);
    C.agregar(p, n);
    const txt = $('fAgregar').querySelector('span');
    txt.textContent = '¡Agregado!';
    setTimeout(() => { txt.textContent = 'Agregar al carrito'; }, 1600);
  });
  $('fCompartir').addEventListener('click', async () => {
    const p = buscarP(fichaId); if (!p) return;
    const url = `${SITIO}#producto=${p.id}`;
    try {
      if (navigator.share) { await navigator.share({ title: p.nombre, text: `${p.nombre} — RJM Import-Export`, url }); return; }
      await navigator.clipboard.writeText(url);
      $('fCompartir').lastChild.textContent = 'Enlace copiado';
      setTimeout(() => { $('fCompartir').lastChild.textContent = 'Compartir este producto'; }, 1800);
    } catch (_) { /* el visitante canceló */ }
  });
  ficha.addEventListener('close', () => {
    const conHash = location.hash.startsWith('#producto=');
    if (conHash && fichaPorEnlace) history.back();
    else if (conHash) history.replaceState(null, '', location.pathname + location.search);
    fichaPorEnlace = false;
    fichaId = null;
  });
  function abrirDesdeEnlace(porEnlace) {
    const m = location.hash.match(/^#producto=([0-9a-f-]{36})$/i);
    if (m) {
      if (!abrirFicha(m[1], porEnlace) && !cargando) history.replaceState(null, '', location.pathname + location.search);
    } else if (ficha.open) {
      fichaPorEnlace = false;
      V.cerrar(ficha);
    }
  }
  addEventListener('hashchange', () => abrirDesdeEnlace(true));

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

  // ---------- Detalles ----------
  $('anio').textContent = new Date().getFullYear();
  document.querySelectorAll('.faq-wa[data-texto]').forEach(a => { a.href = waLink(a.dataset.texto); });
  const cab = $('cabecera'); let conSombra = false;
  addEventListener('scroll', () => { const s = scrollY > 40; if (s !== conSombra) { conSombra = s; cab.classList.toggle('con-sombra', s); } }, { passive: true });

  // Carrusel de marcas: botón para pausar (además se pausa al pasar el mouse).
  const carrusel = $('carrusel');
  if (carrusel) {
    const pista = carrusel.querySelector('.carrusel-pista');
    pista.appendChild(pista.firstElementChild.cloneNode(true)); // copia para que el giro no tenga saltos
    const copia = pista.lastElementChild;
    copia.setAttribute('aria-hidden', 'true');
    copia.removeAttribute('aria-labelledby');
    copia.querySelectorAll('img').forEach(i => { i.alt = ''; });
    $('carruselPausa').addEventListener('click', e => {
      const pausado = carrusel.classList.toggle('pausado');
      e.currentTarget.setAttribute('aria-pressed', String(pausado));
      e.currentTarget.innerHTML = icono(pausado ? 'play' : 'pause');
    });
  }

  // Chispas al agregar al carrito (inspirado en ClickSpark de React Bits).
  const chispas = (() => {
    if (reducido) return () => {};
    const COLORES = ['#ea580c', '#f59e0b', '#fbbf24'];
    const DURA = 520, RADIO = 30, LARGO = 13, CANT = 8;
    let lienzo = null, ctx = null, cuadro = 0;
    const rafagas = [];
    function preparar() {
      if (!lienzo) { lienzo = document.createElement('canvas'); lienzo.className = 'chispas'; lienzo.setAttribute('aria-hidden', 'true'); ctx = lienzo.getContext('2d'); }
      const padre = document.querySelector('dialog[open]') || document.body; // encima de una ventana abierta
      if (lienzo.parentNode !== padre) padre.appendChild(lienzo);
      const dpr = Math.min(window.devicePixelRatio || 1, 2), w = innerWidth, h = innerHeight;
      if (lienzo.width !== Math.round(w * dpr) || lienzo.height !== Math.round(h * dpr)) {
        lienzo.width = Math.round(w * dpr); lienzo.height = Math.round(h * dpr);
        lienzo.style.width = w + 'px'; lienzo.style.height = h + 'px';
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function dibujar(ahora) {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (let i = rafagas.length - 1; i >= 0; i--) {
        const r = rafagas[i], t = (ahora - r.inicio) / DURA;
        if (t >= 1) { rafagas.splice(i, 1); continue; }
        const avance = 1 - Math.pow(1 - Math.max(0, t), 3);
        const dist = RADIO * avance, largo = LARGO * Math.pow(1 - Math.max(0, t), 1.6);
        ctx.globalAlpha = 1 - Math.max(0, (t - 0.55) / 0.45);
        ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        r.chispas.forEach(c => {
          ctx.strokeStyle = c.color;
          ctx.beginPath();
          ctx.moveTo(r.x + Math.cos(c.angulo) * dist, r.y + Math.sin(c.angulo) * dist);
          ctx.lineTo(r.x + Math.cos(c.angulo) * (dist + largo), r.y + Math.sin(c.angulo) * (dist + largo));
          ctx.stroke();
        });
      }
      ctx.globalAlpha = 1;
      if (rafagas.length) cuadro = requestAnimationFrame(dibujar);
      else { cuadro = 0; lienzo.remove(); }
    }
    return (x, y) => {
      preparar();
      rafagas.push({ x, y, inicio: performance.now(), chispas: Array.from({ length: CANT }, (_, i) => ({ angulo: (Math.PI * 2 * i) / CANT + (Math.random() - 0.5) * 0.35, color: COLORES[i % COLORES.length] })) });
      if (!cuadro) cuadro = requestAnimationFrame(dibujar);
    };
  })();
  function chispasEn(el, e) {
    if (e && (e.clientX || e.clientY)) { chispas(e.clientX, e.clientY); return; }
    const r = el.getBoundingClientRect(); // con teclado: desde el centro del botón
    chispas(r.left + r.width / 2, r.top + r.height / 2);
  }

  // Luz que sigue al cursor en tarjetas (inspirado en SpotlightCard de React Bits).
  if (punteroFino && !reducido) {
    document.addEventListener('pointermove', e => {
      const el = e.target.closest && e.target.closest('.foco'); if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--x', (e.clientX - r.left) + 'px');
      el.style.setProperty('--y', (e.clientY - r.top) + 'px');
    }, { passive: true });
  }

  // Aparición suave de secciones (inspirado en FadeContent de React Bits).
  if ('IntersectionObserver' in window && !reducido) {
    document.documentElement.classList.add('js-revelar');
    const vigia = new IntersectionObserver(es => es.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('visible'); vigia.unobserve(en.target); }
    }), { rootMargin: '0px 0px -6% 0px' });
    document.querySelectorAll('.revelar').forEach(el => vigia.observe(el));
  }

  // ---------- Carga ----------
  function pintarTodo() {
    calcularNuevos();
    pintarLineas(); pintarMenus(); pintarFiltros(); pintarProductos(); pintarEstante(); pintarBanner();
  }
  pintarTodo();
  (async () => {
    if (RJM.configurado && RJM.sb) {
      try {
        const consulta = RJM.sb.from('productos').select('*').eq('publicado', true)
          .order('destacado', { ascending: false }).order('orden').order('nombre');
        const espera = new Promise(r => setTimeout(() => r({ data: null, error: 'tiempo' }), 12000));
        const { data, error } = await Promise.race([consulta, espera]);
        if (!error && Array.isArray(data)) productos = data;
      } catch (_) { /* sin conexión: se muestra el aviso con WhatsApp */ }
    }
    cargando = false;
    C.actualizar(productos);
    pintarTodo();
    abrirDesdeEnlace(false);
  })();
})();
