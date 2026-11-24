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

  // ---------- Paso 2: datos de envío ----------
  // El cliente llena quién recoge y en qué agencia. Nada de esto se guarda en la
  // web ni en Supabase: va en el mensaje de WhatsApp (listo para copiar y pegar
  // en el facturador y en la guía de Shalom) y en el PDF que puede descargar.
  // En el navegador se recuerda la agencia elegida. Nombre, documento y celular
  // solo si el cliente marca "Recordar mis datos" (y nunca salen de su equipo).
  const CLAVE_ENVIO = 'rjm_envio_v1';
  const envioElegido = () => (document.querySelector('input[name="envio"]:checked') || {}).value || 'shalom';
  const soloDigitos = v => String(v || '').replace(/\D/g, '');
  const limpio = v => String(v || '').replace(/\s+/g, ' ').trim();

  function datosEnvio() {
    return {
      via: envioElegido(),
      nombre: limpio($('eNombre').value),
      docTipo: $('eDocTipo').value,
      doc: $('eDocTipo').value === 'DNI' ? soloDigitos($('eDoc').value) : limpio($('eDoc').value).toUpperCase(),
      cel: soloDigitos($('eCel').value).replace(/^51(?=9\d{8}$)/, ''),
      depto: $('eDepto').value,
      agencia: limpio($('eAgencia').value),
      comentario: limpio($('carritoComentario').value)
    };
  }
  // Devuelve { campo: mensaje } con los errores (vacío si todo está bien).
  function validarEnvio(d) {
    const e = {};
    if (d.nombre.length < 5 || !/\s/.test(d.nombre)) e.eNombre = 'Escribe nombres y apellidos como figuran en el documento.';
    if (d.docTipo === 'DNI' && !/^\d{8}$/.test(d.doc)) e.eDoc = 'El DNI tiene 8 números.';
    if (d.docTipo === 'CE' && !/^[A-Z0-9]{6,12}$/.test(d.doc)) e.eDoc = 'Revisa el número de tu carné de extranjería.';
    if (!/^9\d{8}$/.test(d.cel)) e.eCel = 'El celular tiene 9 números y empieza con 9.';
    if (!d.depto) e.eDepto = 'Elige el departamento.';
    if (d.agencia.length < 3) e.eAgencia = d.via === 'otra' ? 'Escribe la agencia y su dirección o ciudad.' : 'Escribe la agencia Shalom donde recogerás.';
    return e;
  }
  function pintarErrores(e) {
    ['eNombre', 'eDoc', 'eCel', 'eDepto', 'eAgencia'].forEach(id => {
      $(id).setAttribute('aria-invalid', e[id] ? 'true' : 'false');
      $(id + 'Err').textContent = e[id] || '';
    });
    const primero = ['eNombre', 'eDoc', 'eCel', 'eDepto', 'eAgencia'].find(id => e[id]);
    if (primero) { $(primero).focus(); $(primero).scrollIntoView({ block: 'center' }); }
    return !primero;
  }
  // Al corregir un campo, su error desaparece.
  ['eNombre', 'eDoc', 'eCel', 'eDepto', 'eAgencia'].forEach(id => $(id).addEventListener('input', () => {
    if ($(id).getAttribute('aria-invalid') !== 'true') return;
    const e = validarEnvio(datosEnvio());
    if (!e[id]) { $(id).setAttribute('aria-invalid', 'false'); $(id + 'Err').textContent = ''; }
  }));
  $('eDocTipo').addEventListener('change', () => {
    const dni = $('eDocTipo').value === 'DNI';
    $('eDoc').inputMode = dni ? 'numeric' : 'text';
    $('eDoc').maxLength = dni ? 8 : 12;
  });

  function pintarEnvio() {
    const otra = envioElegido() === 'otra';
    $('tAgencia').textContent = otra ? 'Agencia que prefieres y su dirección' : 'Agencia Shalom donde recogerás';
    $('eAgencia').placeholder = otra ? 'Ej.: Olva, Av. Ejército 101, Arequipa' : 'Nombre o dirección de la agencia';
    $('eAgenciaAyuda').hidden = otra;
    $('envioNota').hidden = !otra;
  }
  function guardarEnvio() {
    try { localStorage.setItem(CLAVE_ENVIO, JSON.stringify({ via: envioElegido(), depto: $('eDepto').value, agencia: limpio($('eAgencia').value) })); } catch (_) {}
  }
  try {
    const previo = JSON.parse(localStorage.getItem(CLAVE_ENVIO) || 'null');
    if (previo && previo.via === 'otra') document.querySelector('input[name="envio"][value="otra"]').checked = true;
    if (previo && typeof previo.depto === 'string' && [...$('eDepto').options].some(o => o.value === previo.depto)) $('eDepto').value = previo.depto;
    const ag = previo && (typeof previo.agencia === 'string' ? previo.agencia : previo.destino); // "destino" era el campo de la versión anterior
    if (typeof ag === 'string') $('eAgencia').value = ag.slice(0, 140);
  } catch (_) { /* sin almacenamiento */ }
  document.querySelectorAll('input[name="envio"]').forEach(r => r.addEventListener('change', () => { pintarEnvio(); guardarEnvio(); }));
  ['eDepto', 'eAgencia'].forEach(id => $(id).addEventListener('change', guardarEnvio));
  pintarEnvio();

  // "Recordar mis datos en este equipo": guarda nombre, documento y celular solo
  // en el navegador del cliente, con su permiso. Al desmarcar se borran.
  const CLAVE_DATOS = 'rjm_mis_datos_v1';
  const PERSONALES = ['eNombre', 'eDocTipo', 'eDoc', 'eCel'];
  function recordarDatos() {
    if (!$('eRecordar').checked) return;
    const d = datosEnvio();
    try { localStorage.setItem(CLAVE_DATOS, JSON.stringify({ nombre: d.nombre, docTipo: d.docTipo, doc: d.doc, cel: d.cel })); } catch (_) {}
    $('eOlvidar').hidden = false;
  }
  function olvidarDatos(limpiarCampos) {
    if (limpiarCampos) {
      $('eRecordar').checked = false; // primero, para que limpiar no vuelva a guardar
      ['eNombre', 'eDoc', 'eCel'].forEach(id => { $(id).value = ''; });
      $('eDocTipo').value = 'DNI'; $('eDocTipo').dispatchEvent(new Event('change'));
    }
    try { localStorage.removeItem(CLAVE_DATOS); } catch (_) {}
    $('eOlvidar').hidden = true;
  }
  try {
    const mios = JSON.parse(localStorage.getItem(CLAVE_DATOS) || 'null');
    if (mios && typeof mios === 'object') {
      if (typeof mios.nombre === 'string') $('eNombre').value = mios.nombre.slice(0, 80);
      if (mios.docTipo === 'CE' || mios.docTipo === 'DNI') { $('eDocTipo').value = mios.docTipo; $('eDocTipo').dispatchEvent(new Event('change')); }
      if (typeof mios.doc === 'string') $('eDoc').value = mios.doc.slice(0, 12);
      if (typeof mios.cel === 'string') $('eCel').value = mios.cel.slice(0, 16);
      $('eRecordar').checked = true; $('eOlvidar').hidden = false;
    }
  } catch (_) { /* sin almacenamiento */ }
  $('eRecordar').addEventListener('change', () => { if ($('eRecordar').checked) recordarDatos(); else olvidarDatos(false); });
  PERSONALES.forEach(id => $(id).addEventListener('change', recordarDatos));
  $('eOlvidar').addEventListener('click', () => {
    olvidarDatos(true);
    window.RJM_AVISO('Listo: borramos tus datos de este equipo.');
    $('eNombre').focus();
  });

  // Cambio de paso dentro del mismo carrito.
  let paso = 'carrito';
  function irAPaso(nuevo) {
    paso = items.length ? nuevo : 'carrito';
    const envio = paso === 'envio';
    $('pasoCarrito').hidden = envio;
    $('pasoEnvio').hidden = !envio;
    $('carritoContinuar').hidden = envio;
    $('carritoEnviar').hidden = !envio;
    $('carritoPdf').hidden = !envio;
    $('carritoOtros').hidden = envio;
    $('carritoAviso').textContent = envio ? 'Te confirmamos stock, costo del envío y forma de pago por WhatsApp.' : 'Te confirmamos stock, precio final y envío por WhatsApp.';
    $('tCarrito').firstChild.textContent = envio ? 'Datos de envío ' : 'Tu carrito ';
    $('carrito').querySelector('.cajon-cuerpo').scrollTop = 0;
  }
  $('carritoContinuar').addEventListener('click', () => { irAPaso('envio'); $('eNombre').focus({ preventScroll: true }); });
  $('volverCarrito').addEventListener('click', () => { irAPaso('carrito'); $('carritoContinuar').focus({ preventScroll: true }); });
  $('carrito').addEventListener('close', () => irAPaso('carrito'));
  C.alCambiar(() => { if (!items.length) irAPaso('carrito'); });

  // Número de referencia del pedido: el mismo en el mensaje y en el PDF.
  function referencia() {
    const f = new Date(), dd = n => String(n).padStart(2, '0');
    const azar = (crypto.getRandomValues ? crypto.getRandomValues(new Uint16Array(1))[0] % 9000 + 1000 : Math.floor(Math.random() * 9000) + 1000);
    return `W${String(f.getFullYear()).slice(2)}${dd(f.getMonth() + 1)}${dd(f.getDate())}-${azar}`;
  }
  // Un solo número por pedido: se renueva si cambian los productos.
  let refActual = null;
  const refPedido = () => refActual || (refActual = referencia());
  C.alCambiar(() => { refActual = null; });

  // Mensaje del pedido para WhatsApp: los datos de envío van en un bloque
  // fácil de copiar línea por línea.
  function mensajePedido(d, ref) {
    d = d || datosEnvio();
    let t = `Hola RJM! Quiero hacer este pedido desde la web${ref ? ` (*${ref}*)` : ''}:\n`;
    items.forEach(x => {
      t += `\n• ${x.cant} × ${x.nombre}`;
      if (x.sku) t += ` (Cód. ${x.sku})`;
      t += x.precio != null ? ` — ${dinero(x.precio, x.moneda)} c/u = ${dinero(x.precio * x.cant, x.moneda)}` : ' — precio a consultar';
    });
    const tot = C.totales();
    if (tot.texto) t += `\n\n*Subtotal: ${tot.texto}*${tot.todoConIgv ? ' (IGV incluido)' : ''}`;
    if (tot.sinPrecio) t += `\n+ ${tot.sinPrecio} producto${tot.sinPrecio === 1 ? '' : 's'} con precio a consultar`;
    t += '\n\n*DATOS DE ENVÍO*';
    t += `\nEnvío: ${d.via === 'otra' ? 'otra agencia (por confirmar)' : 'agencia Shalom'}`;
    if (d.nombre) t += `\nDestinatario: ${d.nombre}`;
    if (d.doc) t += `\n${d.docTipo === 'CE' ? 'Carné de extranjería' : 'DNI'}: ${d.doc}`;
    if (d.cel) t += `\nCelular: ${d.cel}`;
    if (d.depto) t += `\nDepartamento: ${d.depto}`;
    if (d.agencia) t += `\nAgencia de destino: ${d.agencia}`;
    if (d.comentario) t += `\n\nComentario: ${d.comentario}`;
    if (d.via === 'otra') t += '\n\n¿Pueden enviar con esa agencia y cuánto costaría?';
    return t + '\n\n¿Me confirman stock y costo de envío? Gracias.';
  }

  $('carritoEnviar').addEventListener('click', () => {
    if (!items.length) return;
    const d = datosEnvio();
    if (!pintarErrores(validarEnvio(d))) return;
    guardarEnvio(); recordarDatos();
    window.open(`https://wa.me/${WA}?text=${encodeURIComponent(mensajePedido(d, refPedido()))}`, '_blank', 'noopener');
  });
  C.mensajePedido = mensajePedido;
  C.validarEnvio = validarEnvio;
  C.datosEnvio = datosEnvio;

  // ---------- PDF del pedido (se genera en el navegador, no se sube a ningún lado) ----------
  const EMPRESA = { nombre: 'RJM Import-Export E.I.R.L.', ruc: '20610045171', lineas: ['RUC 20610045171', 'Mz. G Lt. 06 Asc. Basilio Auqui, Huamanga - Ayacucho', 'www.rjmimport.com · WhatsApp +51 956 543 522'] };
  let cargaPdf = null;
  const cargarScript = src => new Promise((ok, mal) => {
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = () => mal(new Error('No se pudo cargar ' + src));
    document.head.append(s);
  });
  function libreriaPdf() {
    if (!cargaPdf) cargaPdf = cargarScript('js/vendor/jspdf-4.2.1.umd.min.js')
      .then(() => cargarScript('js/vendor/jspdf.plugin.autotable-5.0.9.min.js'))
      .catch(e => { cargaPdf = null; throw e; });
    return cargaPdf;
  }
  async function logoDataUrl() {
    try {
      const b = await (await fetch('img/logo-192.png')).blob();
      return await new Promise(ok => { const f = new FileReader(); f.onload = () => ok(f.result); f.readAsDataURL(b); });
    } catch (_) { return null; }
  }
  // jsPDF con las fuentes básicas no dibuja "×", "•" ni "—": se usan equivalentes simples.
  const plano = v => String(v ?? '').replace(/[×]/g, 'x').replace(/[—–]/g, '-').replace(/[•]/g, '-');

  async function pdfPedido(d, ref) {
    await libreriaPdf();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const ancho = doc.internal.pageSize.getWidth(), m = 15;
    const marino = [11, 37, 69], naranja = [194, 65, 12], gris = [86, 97, 115];
    const f = new Date();
    const fecha = f.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + f.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

    const logo = await logoDataUrl();
    if (logo) doc.addImage(logo, 'PNG', m, 12, 22, 22);
    const xEmp = logo ? m + 26 : m;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(20);
    doc.text(EMPRESA.nombre, xEmp, 18);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...gris);
    EMPRESA.lineas.forEach((l, n) => doc.text(l, xEmp, 23 + n * 4));

    doc.setDrawColor(...naranja); doc.setLineWidth(0.5);
    doc.roundedRect(ancho - m - 62, 12, 62, 24, 2, 2);
    doc.setTextColor(...naranja); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text('PEDIDO WEB', ancho - m - 31, 20, { align: 'center' });
    doc.setFontSize(10.5); doc.text(ref, ancho - m - 31, 26.5, { align: 'center' });
    doc.setTextColor(...gris); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    doc.text(fecha, ancho - m - 31, 32, { align: 'center' });

    // Datos de envío: una línea por dato, para copiar y pegar.
    let y = 46;
    const filas = [
      ['Envío', d.via === 'otra' ? 'Otra agencia (por confirmar)' : 'Agencia Shalom'],
      ['Destinatario', d.nombre],
      [d.docTipo === 'CE' ? 'Carné de extranjería' : 'DNI', d.doc],
      ['Celular', d.cel],
      ['Departamento', d.depto],
      ['Agencia de destino', d.agencia]
    ];
    doc.autoTable({
      startY: y, margin: { left: m, right: m }, theme: 'grid',
      head: [[{ content: 'DATOS DE ENVÍO', colSpan: 2 }]],
      body: filas.map(([a, b]) => [a, plano(b || '-')]),
      styles: { font: 'helvetica', fontSize: 10, cellPadding: 2.4, textColor: 25, lineColor: [220, 226, 235] },
      headStyles: { fillColor: marino, textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 48, fontStyle: 'bold', fillColor: [244, 245, 247] } }
    });

    // Productos
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 8, margin: { left: m, right: m },
      head: [['#', 'Código', 'Producto', 'Cant.', 'P. Unit.', 'Importe']],
      body: items.map((x, n) => [n + 1, x.sku || '-', plano(x.nombre), x.cant,
        x.precio != null ? plano(dinero(x.precio, x.moneda)) : 'Consultar', x.precio != null ? plano(dinero(x.precio * x.cant, x.moneda)) : '-']),
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.2, textColor: 30 },
      headStyles: { fillColor: naranja, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 250, 251] },
      columnStyles: { 0: { halign: 'center', cellWidth: 8 }, 1: { cellWidth: 24 }, 3: { halign: 'right', cellWidth: 14 }, 4: { halign: 'right', cellWidth: 26 }, 5: { halign: 'right', cellWidth: 28 } }
    });

    y = doc.lastAutoTable.finalY + 7;
    if (y > 250) { doc.addPage(); y = 20; }
    const tot = C.totales();
    if (tot.texto) {
      doc.setFillColor(...marino); doc.rect(ancho - m - 90, y - 5, 90, 10, 'F');
      doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.text(plano(`SUBTOTAL${tot.todoConIgv ? ' (IGV incl.)' : ''}: ${tot.texto}`), ancho - m - 3, y + 1.5, { align: 'right' });
      y += 12;
    }
    doc.setTextColor(...gris); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    const notas = ['Costo de envío no incluido: se confirma por WhatsApp.', 'Sujeto a confirmación de stock y precio final.', 'Documento informativo: no es un comprobante de pago.'];
    if (tot.sinPrecio) notas.unshift(`${tot.sinPrecio} producto(s) con precio a consultar.`);
    if (d.comentario) notas.unshift('Comentario del cliente: ' + plano(d.comentario).slice(0, 180));
    notas.forEach((l, n) => doc.text(doc.splitTextToSize('- ' + l, ancho - 2 * m), m, y + 4 + n * 4.8));

    return new File([doc.output('blob')], `Pedido-${ref}.pdf`, { type: 'application/pdf' });
  }
  C.pdfPedido = pdfPedido;

  $('carritoPdf').addEventListener('click', async () => {
    if (!items.length) return;
    const d = datosEnvio();
    if (!pintarErrores(validarEnvio(d))) return;
    const btn = $('carritoPdf'), txt = btn.querySelector('span');
    btn.disabled = true; txt.textContent = 'Preparando PDF…';
    try {
      const archivo = await pdfPedido(d, refPedido());
      // En el celular se puede compartir directo a WhatsApp; en la computadora se descarga.
      if (navigator.canShare && navigator.canShare({ files: [archivo] }) && matchMedia('(pointer: coarse)').matches) {
        try { await navigator.share({ files: [archivo], title: archivo.name }); return; } catch (e) { if (e.name === 'AbortError') return; }
      }
      const url = URL.createObjectURL(archivo);
      const a = Object.assign(document.createElement('a'), { href: url, download: archivo.name });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      window.RJM_AVISO('PDF descargado. Puedes adjuntarlo en el chat de WhatsApp con RJM.');
    } catch (e) {
      window.RJM_AVISO('No se pudo generar el PDF. Envía tu pedido por WhatsApp: lleva todos los datos.');
    } finally { btn.disabled = false; txt.textContent = 'Descargar pedido en PDF'; }
  });

  ['btnCarrito', 'bmCarrito'].forEach(id => $(id) && $(id).addEventListener('click', C.abrir));
  pintar();
})();
