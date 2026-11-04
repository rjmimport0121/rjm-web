// Carrito de la tienda. El visitante junta productos y envía el pedido por
// WhatsApp en un solo mensaje, con cantidades y subtotal (IGV incluido).
// Se guarda en este navegador (localStorage) y se mantiene igual entre pestañas.
// Este archivo también trae dos utilidades que usa js/sitio.js:
//   - RJM_VENTANA: abre y cierra las ventanas <dialog> (menú, carrito y ficha).
//   - RJM_AVISO: mensaje breve en la parte inferior, con un botón opcional.
(function () {
  'use strict';
  const cfg = window.RJM_CONFIG || {};
  const WA = cfg.WHATSAPP || '51956543522';
  const CLAVE = 'rjm_carrito_v1';
  const CLAVE_VIEJA = 'rjm_lista_v1'; // lista de consulta de la versión anterior de la web
  const MAX = 999;
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dinero = (n, m) => (m === 'USD' ? 'US$ ' : 'S/ ') + Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const icono = n => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const tope = n => Math.max(1, Math.min(MAX, Math.round(Number(n)) || 1));

  // ---------- Ventanas <dialog> ----------
  let focoPrevio = null;
  const abiertas = () => document.querySelectorAll('dialog[open]').length;
  function alCerrarTodo() {
    if (abiertas()) return;
    document.documentElement.classList.remove('sin-scroll');
    if (window.RJM_LENIS) window.RJM_LENIS.start();
  }
  const RJM_VENTANA = {
    abrir(d) {
      if (!d || d.open) return;
      const activo = document.activeElement;
      if (!abiertas() && !(activo && activo.closest && activo.closest('dialog'))) focoPrevio = activo;
      if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
      document.documentElement.classList.add('sin-scroll');
      if (window.RJM_LENIS) window.RJM_LENIS.stop();
    },
    cerrar(d) {
      if (!d || !d.open) return;
      if (typeof d.close === 'function') d.close(); else d.removeAttribute('open');
      alCerrarTodo();
    }
  };
  document.querySelectorAll('dialog').forEach(d => {
    d.setAttribute('data-lenis-prevent', ''); // la rueda del mouse desplaza la ventana, no la página
    d.addEventListener('close', () => {
      alCerrarTodo();
      if (!abiertas() && focoPrevio && document.contains(focoPrevio)) focoPrevio.focus({ preventScroll: true });
    });
    // Clic en el fondo oscuro: cierra.
    d.addEventListener('click', e => {
      if (e.target !== d) return;
      const r = d.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) RJM_VENTANA.cerrar(d);
    });
    d.querySelectorAll('[data-cerrar]').forEach(b => b.addEventListener('click', () => {
      RJM_VENTANA.cerrar(d);
      const destino = b.dataset.ir && document.querySelector(b.dataset.ir);
      if (destino) destino.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }));
  });
  window.RJM_VENTANA = RJM_VENTANA;

  // ---------- Aviso breve ----------
  const aviso = $('aviso'), avisoTxt = $('avisoTxt'), avisoAccion = $('avisoAccion');
  let tAviso, alAccionar = null;
  window.RJM_AVISO = (texto, accion) => {
    avisoTxt.textContent = texto;
    alAccionar = accion && accion.fn;
    avisoAccion.hidden = !accion;
    if (accion) avisoAccion.textContent = accion.texto;
    aviso.classList.add('visible');
    clearTimeout(tAviso);
    tAviso = setTimeout(() => aviso.classList.remove('visible'), accion ? 4200 : 2800);
  };
  avisoAccion.addEventListener('click', () => { aviso.classList.remove('visible'); if (alAccionar) alAccionar(); });

  // ---------- Estado del carrito ----------
  const valido = x => x && typeof x.id === 'string' && typeof x.nombre === 'string' && x.cant > 0;
  function leer() {
    try {
      const guardado = JSON.parse(localStorage.getItem(CLAVE) || 'null');
      if (Array.isArray(guardado)) return guardado.filter(valido);
      // Pasa al carrito lo que el visitante tenía en la "lista de consulta" anterior.
      const viejo = JSON.parse(localStorage.getItem(CLAVE_VIEJA) || '[]');
      if (Array.isArray(viejo) && viejo.length) {
        const migrado = viejo.filter(x => x && x.nombre).map(x => ({
          id: String(x.k || '').startsWith('p:') ? x.k.slice(2) : 'lista:' + x.k,
          nombre: String(x.nombre), precio: null, moneda: 'PEN', foto: null, sku: '', igv: true, cant: tope(x.cant)
        }));
        localStorage.removeItem(CLAVE_VIEJA);
        return migrado;
      }
    } catch (_) { /* navegador sin almacenamiento: el carrito vive solo en esta página */ }
    return [];
  }
  let items = leer();
  const oyentes = [];
  function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(items)); } catch (_) {} }
  function avisarCambio() { guardar(); pintar(); oyentes.forEach(f => f()); }

  const C = {
    items: () => items.slice(),
    cantidad: id => (items.find(x => x.id === id) || {}).cant || 0,
    unidades: () => items.reduce((n, x) => n + x.cant, 0),
    agregar(p, cant = 1) {
      const x = items.find(i => i.id === p.id);
      if (x) x.cant = tope(x.cant + cant);
      else items.push({ id: p.id, nombre: p.nombre, precio: p.precio ?? null, moneda: p.moneda || 'PEN', foto: p.foto_url || null,
        sku: p.sku || '', igv: p.precio_incluye_igv !== false, cant: tope(cant) });
      avisarCambio();
      document.querySelectorAll('.burbuja').forEach(b => { b.classList.remove('salta'); void b.offsetWidth; b.classList.add('salta'); });
    },
    fijar(id, cant) {
      const x = items.find(i => i.id === id); if (!x) return;
      if (cant <= 0) items = items.filter(i => i !== x); else x.cant = tope(cant);
      avisarCambio();
    },
    quitar(id) { items = items.filter(i => i.id !== id); avisarCambio(); },
    vaciar() { items = []; avisarCambio(); },
    // Al cargar el catálogo, actualiza nombre, precio y foto con lo publicado.
    actualizar(productos) {
      let cambio = false;
      items.forEach(x => {
        const p = productos.find(q => q.id === x.id); if (!p) return;
        const nuevo = { nombre: p.nombre, precio: p.precio ?? null, moneda: p.moneda || 'PEN', foto: p.foto_url || null, sku: p.sku || '', igv: p.precio_incluye_igv !== false };
        Object.keys(nuevo).forEach(k => { if (x[k] !== nuevo[k]) { x[k] = nuevo[k]; cambio = true; } });
      });
      if (cambio) avisarCambio();
    },
    totales() {
      const porMoneda = {}; let sinPrecio = 0, todoConIgv = true;
      items.forEach(x => {
        if (x.precio == null) { sinPrecio += 1; return; }
        porMoneda[x.moneda] = (porMoneda[x.moneda] || 0) + x.precio * x.cant;
        if (x.igv === false) todoConIgv = false;
      });
      return { texto: Object.entries(porMoneda).map(([m, v]) => dinero(v, m)).join(' + '), sinPrecio, todoConIgv };
    },
    alCambiar(f) { oyentes.push(f); },
    abrir() { RJM_VENTANA.abrir($('carrito')); }
  };
  window.RJM_CARRITO = C;
  addEventListener('storage', e => { if (e.key === CLAVE) { items = leer(); pintar(); oyentes.forEach(f => f()); } });

  // ---------- Cajón del carrito ----------
  function pintar() {
    const n = C.unidades();
    document.querySelectorAll('[data-cuenta]').forEach(b => { b.textContent = n > 99 ? '99+' : n; b.hidden = n === 0; });
    const etiqueta = n ? `Carrito, ${n} producto${n === 1 ? '' : 's'}` : 'Carrito, vacío';
    ['btnCarrito', 'bmCarrito'].forEach(id => $(id) && $(id).setAttribute('aria-label', etiqueta));
    $('carritoN').textContent = n ? `(${n})` : '';
    $('carritoVacio').hidden = items.length > 0;
    $('carritoPie').hidden = items.length === 0;

    // Recuerda qué control tenía el foco para devolverlo después de repintar.
    const activo = document.activeElement;
    const filaActiva = activo && activo.closest && activo.closest('#carritoItems li');
    const recordar = filaActiva ? { id: filaActiva.dataset.id, op: activo.dataset.op || (activo.tagName === 'INPUT' ? 'input' : '') } : null;

    $('carritoItems').innerHTML = items.map(x => `
      <li data-id="${esc(x.id)}">
        <span class="c-img">${x.foto ? `<img src="${esc(x.foto)}" alt="" loading="lazy" width="68" height="68"/>` : icono('package')}</span>
        <div>
          <p class="c-nombre">${esc(x.nombre)}</p>
          <p class="c-unit">${x.precio != null ? dinero(x.precio, x.moneda) + ' c/u' : 'Precio a consultar'}${x.sku ? ' · Cód. ' + esc(x.sku) : ''}</p>
          <div class="c-fila">
            <div class="cantidad" role="group" aria-label="Cantidad de ${esc(x.nombre)}">
              <button type="button" data-op="-1" aria-label="Quitar uno">${icono('minus')}</button>
              <input type="number" inputmode="numeric" min="1" max="${MAX}" value="${x.cant}" aria-label="Cantidad de ${esc(x.nombre)}"/>
              <button type="button" data-op="1" aria-label="Agregar uno">${icono('plus')}</button>
            </div>
            <span class="c-sub">${x.precio != null ? dinero(x.precio * x.cant, x.moneda) : '—'}</span>
          </div>
          <button type="button" class="c-quitar">${icono('trash-2')}Quitar<span class="sr"> ${esc(x.nombre)}</span></button>
        </div>
      </li>`).join('');

    if (recordar) {
      const fila = [...$('carritoItems').children].find(li => li.dataset.id === recordar.id);
      const destino = fila && (recordar.op === 'input' ? fila.querySelector('input') : fila.querySelector(`[data-op="${recordar.op}"]`));
      if (destino) destino.focus({ preventScroll: true });
    }

    const t = C.totales();
    $('carritoTotal').textContent = t.texto || '—';
    $('carritoTotal').previousElementSibling.querySelector('small').hidden = !t.todoConIgv;
    $('carritoNota').hidden = !t.sinPrecio;
    $('carritoNota').textContent = t.sinPrecio ? `+ ${t.sinPrecio} producto${t.sinPrecio === 1 ? '' : 's'} con precio a consultar` : '';
  }

  $('carritoItems').addEventListener('click', e => {
    const li = e.target.closest('li[data-id]'); if (!li) return;
    const id = li.dataset.id;
    const op = e.target.closest('[data-op]');
    if (op) { C.fijar(id, Math.max(1, C.cantidad(id) + Number(op.dataset.op))); return; }
    if (e.target.closest('.c-quitar')) {
      const pos = items.findIndex(i => i.id === id), x = items[pos];
      C.quitar(id);
      if (x) mostrarDeshacer(x, pos);
      const siguiente = $('carritoItems').querySelector('button, input') || $('cDeshacer') || $('carrito').querySelector('[data-cerrar]');
      if (siguiente) siguiente.focus({ preventScroll: true });
    }
  });
  // "Deshacer" dentro del carrito (un aviso de la página quedaría detrás de la ventana).
  let quitado = null, tDeshacer;
  function mostrarDeshacer(x, pos) {
    quitado = { x, pos };
    $('carritoDeshacer').innerHTML = `Quitaste <b>${esc(x.nombre)}</b>. <button type="button" class="enlace" id="cDeshacer">Deshacer</button>`;
    clearTimeout(tDeshacer);
    tDeshacer = setTimeout(() => { $('carritoDeshacer').textContent = ''; quitado = null; }, 8000);
  }
  $('carritoDeshacer').addEventListener('click', e => {
    if (!e.target.closest('#cDeshacer') || !quitado) return;
    items.splice(Math.min(quitado.pos, items.length), 0, quitado.x);
    quitado = null;
    $('carritoDeshacer').textContent = '';
    avisarCambio();
    const fila = $('carritoItems').querySelector('li button');
    if (fila) fila.focus({ preventScroll: true });
  });
  $('carritoItems').addEventListener('change', e => {
    const li = e.target.closest('li[data-id]');
    if (li && e.target.matches('input')) C.fijar(li.dataset.id, tope(e.target.value));
  });
  $('carritoVaciar').addEventListener('click', () => {
    if (confirm('¿Vaciar el carrito?')) { C.vaciar(); $('carrito').querySelector('[data-cerrar]').focus(); }
  });

  // Mensaje del pedido para WhatsApp.
  function mensajePedido() {
    let t = 'Hola RJM! Quiero hacer este pedido desde la web:\n';
    items.forEach(x => {
      t += `\n• ${x.cant} × ${x.nombre}`;
      if (x.sku) t += ` (Cód. ${x.sku})`;
      t += x.precio != null ? ` — ${dinero(x.precio, x.moneda)} c/u = ${dinero(x.precio * x.cant, x.moneda)}` : ' — precio a consultar';
    });
    const tot = C.totales();
    if (tot.texto) t += `\n\n*Subtotal: ${tot.texto}*${tot.todoConIgv ? ' (IGV incluido)' : ''}`;
    if (tot.sinPrecio) t += `\n+ ${tot.sinPrecio} producto${tot.sinPrecio === 1 ? '' : 's'} con precio a consultar`;
    const destino = $('carritoDestino').value.trim();
    if (envioElegido() === 'otra') t += `\n\n*Envío:* otra agencia${destino ? ` (${destino})` : ''}. ¿Pueden enviar con esa agencia y cuánto costaría?`;
    else t += `\n\n*Envío:* agencia Shalom${destino ? ` — destino: ${destino}` : ''}`;
    const nota = $('carritoComentario').value.trim();
    if (nota) t += `\n\nComentario: ${nota}`;
    return t + '\n\n¿Me confirman stock y costo de envío? Gracias.';
  }

  // Envío: agencia Shalom por defecto; otra agencia se consulta por WhatsApp.
  // La elección y la ciudad se recuerdan en este navegador para el próximo pedido.
  const CLAVE_ENVIO = 'rjm_envio_v1';
  const envioElegido = () => (document.querySelector('input[name="envio"]:checked') || {}).value || 'shalom';
  function pintarEnvio() {
    const otra = envioElegido() === 'otra';
    $('tDestino').textContent = otra ? 'Agencia y ciudad que prefieres' : 'Ciudad de destino';
    $('carritoDestino').placeholder = otra ? 'Ej.: Olva, a Arequipa' : 'Ej.: Lima, Cusco, Huancayo';
    $('envioNota').hidden = !otra;
  }
  function guardarEnvio() {
    try { localStorage.setItem(CLAVE_ENVIO, JSON.stringify({ via: envioElegido(), destino: $('carritoDestino').value.trim() })); } catch (_) {}
  }
  try {
    const previo = JSON.parse(localStorage.getItem(CLAVE_ENVIO) || 'null');
    if (previo && previo.via === 'otra') document.querySelector('input[name="envio"][value="otra"]').checked = true;
    if (previo && typeof previo.destino === 'string') $('carritoDestino').value = previo.destino.slice(0, 120);
  } catch (_) { /* sin almacenamiento */ }
  document.querySelectorAll('input[name="envio"]').forEach(r => r.addEventListener('change', () => { pintarEnvio(); guardarEnvio(); }));
  $('carritoDestino').addEventListener('change', guardarEnvio);
  pintarEnvio();
  $('carritoEnviar').addEventListener('click', () => {
    if (!items.length) return;
    window.open(`https://wa.me/${WA}?text=${encodeURIComponent(mensajePedido())}`, '_blank', 'noopener');
  });
  C.mensajePedido = mensajePedido;

  ['btnCarrito', 'bmCarrito'].forEach(id => $(id) && $(id).addEventListener('click', C.abrir));
  pintar();
})();
