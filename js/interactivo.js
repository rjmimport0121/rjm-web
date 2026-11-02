// Lista de consulta: el visitante junta varios productos y los envía en un solo
// mensaje de WhatsApp. Se guarda en este navegador (si el navegador lo permite).
// También completa detalles de la portada (año del pie, enlaces de WhatsApp).
(function () {
  const $ = s => document.querySelector(s);
  const WA = (window.RJM_CONFIG && RJM_CONFIG.WHATSAPP) || '51956543522';
  const CLAVE = 'rjm_lista_v1';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const waLink = texto => `https://wa.me/${WA}?text=${encodeURIComponent(texto)}`;

  // ---------- Detalles de la portada ----------
  const anio = $('#anio');
  if (anio) anio.textContent = new Date().getFullYear();
  document.querySelectorAll('.faq-wa[data-texto]').forEach(a => { a.href = waLink(a.dataset.texto); });

  // ---------- Estado de la lista ----------
  let lista = [];
  try { lista = JSON.parse(localStorage.getItem(CLAVE) || '[]'); if (!Array.isArray(lista)) lista = []; } catch (_) { lista = []; }
  function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(lista)); } catch (_) {} }
  const buscar = k => lista.find(x => x.k === k);

  // Datos de una tarjeta: productos con precio (data-id) o subgrupos del catálogo fijo.
  function datosDe(card) {
    const nombre = card.querySelector('.product-name')?.textContent.trim();
    if (!nombre) return null;
    const cat = card.querySelector('.product-cat')?.textContent.trim() || '';
    const precio = card.querySelector('.product-price')?.childNodes[0]?.textContent.trim() || '';
    const id = card.dataset.id;
    return { k: id ? 'p:' + id : 's:' + norm(nombre), nombre, detalle: [cat, precio].filter(Boolean).join(' · ') };
  }

  // ---------- Panel ----------
  document.body.insertAdjacentHTML('beforeend', `
    <button type="button" class="lista-fab" id="listaFab" aria-haspopup="dialog" aria-controls="listaFondo">
      🧾 Mi lista <span class="cuenta" id="listaCuenta">0</span>
    </button>
    <div class="lista-fondo" id="listaFondo" role="dialog" aria-modal="true" aria-labelledby="listaTitulo">
      <aside class="lista-panel">
        <div class="lista-cab">
          <h3 id="listaTitulo">Mi lista de consulta</h3>
          <button type="button" class="lista-cerrar" id="listaCerrar" aria-label="Cerrar">✕</button>
        </div>
        <ul class="lista-items" id="listaItems"></ul>
        <div class="lista-pie">
          <label for="listaNota" class="contact-label">Comentario (opcional)</label>
          <textarea id="listaNota" placeholder="Ej: para guitarra acústica, envío a Lima…" maxlength="400"></textarea>
          <button type="button" class="lista-enviar" id="listaEnviar">💬 Enviar consulta por WhatsApp</button>
          <button type="button" class="lista-vaciar" id="listaVaciar">Vaciar lista</button>
        </div>
      </aside>
    </div>`);

  const fab = $('#listaFab'), fondo = $('#listaFondo');

  function pintar() {
    const total = lista.reduce((n, x) => n + x.cant, 0);
    $('#listaCuenta').textContent = total;
    fab.classList.toggle('visible', lista.length > 0);
    $('#listaEnviar').disabled = !lista.length;
    $('#listaVaciar').hidden = !lista.length;
    $('#listaItems').innerHTML = lista.length ? lista.map(x => `
      <li class="lista-item" data-k="${esc(x.k)}">
        <strong>${esc(x.nombre)}</strong>
        <div class="lista-cant">
          <button type="button" data-op="-1" aria-label="Menos">−</button>
          <input type="number" min="1" max="9999" value="${x.cant}" aria-label="Cantidad de ${esc(x.nombre)}"/>
          <button type="button" data-op="1" aria-label="Más">+</button>
        </div>
        ${x.detalle ? `<small>${esc(x.detalle)}</small>` : ''}
        <button type="button" class="lista-quitar">Quitar</button>
      </li>`).join('')
      : '<li class="lista-vacia">Tu lista está vacía.<br><small>Agrega productos con el botón “+ Lista”.</small></li>';
    document.querySelectorAll('.btn-lista').forEach(b => {
      const dentro = !!buscar(b.dataset.k);
      b.classList.toggle('en-lista', dentro);
      b.textContent = dentro ? '✓ En lista' : '+ Lista';
      b.setAttribute('aria-pressed', dentro);
    });
    const pm = $('#pmLista');
    if (pm) { const d = pm.dataset.k && buscar(pm.dataset.k); pm.textContent = d ? '✓ En tu lista' : '+ Agregar a mi lista'; }
  }

  function alternar(item) {
    const i = lista.findIndex(x => x.k === item.k);
    if (i >= 0) { lista.splice(i, 1); }
    else {
      lista.push({ ...item, cant: 1 });
      if (window.RJM_AVISO) RJM_AVISO(`“${item.nombre}” agregado a tu lista`);
      fab.classList.remove('salta'); void fab.offsetWidth; fab.classList.add('salta');
    }
    guardar(); pintar();
  }

  function abrir() { fondo.classList.add('abierto'); document.body.classList.add('sin-scroll'); $('#listaCerrar').focus(); }
  function cerrar() { fondo.classList.remove('abierto'); document.body.classList.remove('sin-scroll'); fab.focus({ preventScroll: true }); }
  fab.addEventListener('click', abrir);
  $('#listaCerrar').addEventListener('click', cerrar);
  fondo.addEventListener('click', e => { if (e.target === fondo) cerrar(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && fondo.classList.contains('abierto')) cerrar(); });

  $('#listaItems').addEventListener('click', e => {
    const li = e.target.closest('.lista-item'); if (!li) return;
    const x = buscar(li.dataset.k); if (!x) return;
    if (e.target.classList.contains('lista-quitar')) { lista = lista.filter(y => y !== x); }
    else if (e.target.dataset.op) { x.cant = Math.max(1, Math.min(9999, x.cant + Number(e.target.dataset.op))); }
    else return;
    guardar(); pintar();
  });
  $('#listaItems').addEventListener('change', e => {
    const li = e.target.closest('.lista-item'); const x = li && buscar(li.dataset.k); if (!x) return;
    x.cant = Math.max(1, Math.min(9999, parseInt(e.target.value, 10) || 1));
    guardar(); pintar();
  });
  $('#listaVaciar').addEventListener('click', () => { if (confirm('¿Vaciar tu lista de consulta?')) { lista = []; guardar(); pintar(); } });
  $('#listaEnviar').addEventListener('click', () => {
    if (!lista.length) return;
    let t = 'Hola RJM! Quisiera consultar por estos productos:\n';
    lista.forEach(x => { t += `\n• ${x.cant} × ${x.nombre}${x.detalle ? ' (' + x.detalle + ')' : ''}`; });
    const nota = $('#listaNota').value.trim();
    if (nota) t += `\n\nComentario: ${nota}`;
    t += '\n\n¿Tienen disponibilidad? Gracias.';
    window.open(waLink(t), '_blank', 'noopener');
  });

  // ---------- Botón "+ Lista" en las tarjetas ----------
  function prepararTarjeta(card) {
    if (card.querySelector('.btn-lista')) return;
    const d = datosDe(card); if (!d) return;
    const info = card.querySelector('.product-info'); if (!info) return;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'btn-lista'; btn.dataset.k = d.k;
    btn.setAttribute('aria-label', 'Agregar ' + d.nombre + ' a mi lista de consulta');
    btn.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); alternar(datosDe(card)); });
    const acciones = info.querySelector('.product-btns');
    if (acciones) { acciones.append(btn); return; }
    let fila = info.querySelector('.product-btns-lista');
    if (!fila) {
      fila = document.createElement('div'); fila.className = 'product-btns-lista';
      const consultar = info.querySelector(':scope > .product-action:not(.ver-sub)');
      if (consultar) { consultar.before(fila); fila.append(consultar); } else info.append(fila);
    }
    fila.append(btn);
  }
  function prepararTodas(raiz) { (raiz || document).querySelectorAll('.product-card').forEach(prepararTarjeta); pintar(); }
  prepararTodas();
  document.addEventListener('rjm:catalogo', () => prepararTodas());
  const lmGrid = $('#lmGrid');
  if (lmGrid) new MutationObserver(() => prepararTodas(lmGrid)).observe(lmGrid, { childList: true });

  // ---------- Ficha de producto (ventana) ----------
  const pmWa = $('#pmWa');
  if (pmWa) {
    const b = document.createElement('button');
    b.type = 'button'; b.id = 'pmLista'; b.className = 'btn btn-ghost'; b.style.marginLeft = '.6rem';
    pmWa.after(b);
    const actual = () => {
      const m = location.hash.match(/^#producto=([0-9a-f-]{36})$/);
      return m ? { k: 'p:' + m[1], nombre: $('#pmTitulo').textContent.trim(),
        detalle: [$('#pmCat').textContent.trim(), $('#pmPrecio').childNodes[0]?.textContent.trim()].filter(Boolean).join(' · ') } : null;
    };
    b.addEventListener('click', () => { const it = actual(); if (it) { b.dataset.k = it.k; alternar(it); } });
    new MutationObserver(() => { const it = actual(); b.hidden = !it; b.dataset.k = it ? it.k : ''; pintar(); })
      .observe($('#pmodal'), { attributes: true, attributeFilter: ['class'] });
  }

  pintar();
})();
