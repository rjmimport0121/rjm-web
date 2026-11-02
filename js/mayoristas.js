// Portal mayorista: lista sin fotos, precios por cantidad y pedido por WhatsApp.
(function () {
  const $ = id => document.getElementById(id);
  const { sb, esc, precio } = RJM;
  let lista = [], perfil = null;
  const cantidades = {}; // id -> cantidad

  $('linkWa').href = RJM.waLink('Hola RJM! Quisiera información para comprar al por mayor.');

  function aviso(el, texto, tipo = 'err') {
    $(el).innerHTML = texto ? `<div class="msg ${tipo}">${esc(texto)}</div>` : '';
  }

  async function iniciar() {
    if (!RJM.configurado) {
      aviso('loginMsg', 'El portal aún no está configurado.', 'info');
      $('btnEntrar').disabled = true;
      return;
    }
    const p = await RJM.perfilActual();
    if (p && p.activo) return mostrar(p);
    if (p) { await sb.auth.signOut(); aviso('loginMsg', 'Tu acceso está desactivado. Comunícate con RJM.'); }
  }

  $('formLogin').addEventListener('submit', async e => {
    e.preventDefault();
    $('btnEntrar').disabled = true; aviso('loginMsg', '');
    const { error } = await sb.auth.signInWithPassword({ email: RJM.aEmail($('lUsuario').value), password: $('lClave').value });
    $('btnEntrar').disabled = false;
    if (error) return aviso('loginMsg', RJM.errorLegible(error));
    const p = await RJM.perfilActual();
    if (!p || !p.activo) { await sb.auth.signOut(); return aviso('loginMsg', 'Tu acceso está desactivado. Comunícate con RJM.'); }
    $('lClave').value = '';
    mostrar(p);
  });

  $('btnSalir').addEventListener('click', async () => { await sb.auth.signOut(); location.reload(); });

  async function mostrar(p) {
    perfil = p;
    $('vistaLogin').classList.add('oculto');
    $('vistaLista').classList.remove('oculto');
    $('btnSalir').classList.remove('oculto');
    $('quien').textContent = p.usuario || '';
    $('saludo').textContent = `Hola${p.nombre ? ' ' + p.nombre : ''}. Estos son los productos disponibles en stock y su precio según la cantidad que compres.`;

    const { data, error } = await sb.from('productos_mayoristas')
      .select('id, sku, nombre, categoria, unidad, stock, mostrar_stock, moneda, precio_incluye_igv, notas, activo, actualizado_en, precios_mayoristas(cantidad_minima, precio)')
      .eq('activo', true).gt('stock', 0).order('orden').order('nombre');
    if (error) return aviso('listaMsg', RJM.errorLegible(error));
    lista = data.map(x => ({ ...x, tramos: (x.precios_mayoristas || []).sort((a, b) => a.cantidad_minima - b.cantidad_minima) }));
    const ult = lista.reduce((m, x) => (x.actualizado_en > m ? x.actualizado_en : m), '');
    $('actualizado').textContent = ult ? 'Actualizado: ' + new Date(ult).toLocaleDateString('es-PE') : '';
    const todosIgv = lista.every(x => x.precio_incluye_igv), ningunoIgv = lista.every(x => !x.precio_incluye_igv);
    $('notaIgv').textContent = todosIgv ? 'Precios incluyen IGV' : ningunoIgv ? 'Precios no incluyen IGV' : 'Ver IGV en cada producto';
    pintar();
  }

  // Precio unitario que corresponde a una cantidad: el tramo más alto alcanzado.
  function precioPara(item, cant) {
    let t = null;
    for (const tr of item.tramos) if (cant >= tr.cantidad_minima) t = tr;
    return t ? Number(t.precio) : null;
  }

  function pintar() {
    const q = $('buscar').value.trim().toLowerCase();
    const filas = lista.filter(x => !q || `${x.nombre} ${x.sku || ''} ${x.categoria || ''}`.toLowerCase().includes(q));
    $('tbLista').innerHTML = filas.length ? filas.map(x => {
      const c = cantidades[x.id] || '';
      const pu = c ? precioPara(x, c) : null;
      return `<tr>
        <td>${esc(x.sku || '—')}</td>
        <td><b>${esc(x.nombre)}</b>${x.categoria ? `<br><small>${esc(x.categoria)}</small>` : ''}${x.notas ? `<br><small>${esc(x.notas)}</small>` : ''}</td>
        <td class="num">${x.mostrar_stock ? `${x.stock} ${esc(x.unidad)}` : 'Disponible'}</td>
        <td class="tramos-txt">${x.tramos.map(t => `Desde ${t.cantidad_minima} ${esc(x.unidad)}: <b>${precio(t.precio, x.moneda)}</b>`).join('<br>') || 'Consultar'}
          ${x.precio_incluye_igv ? '' : '<br><small>+ IGV</small>'}</td>
        <td class="num"><input class="cant" type="number" min="0" ${x.mostrar_stock ? `max="${x.stock}"` : ''} step="1" data-id="${x.id}" value="${c}" aria-label="Cantidad"></td>
        <td class="num">${pu != null ? precio(pu * c, x.moneda) : (c ? '<small>Mín. ' + (x.tramos[0]?.cantidad_minima ?? '') + '</small>' : '')}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="6">No hay productos disponibles en este momento.</td></tr>';
    totales();
  }

  function totales() {
    const porMoneda = {};
    let hay = false;
    for (const x of lista) {
      const c = cantidades[x.id]; if (!c) continue;
      const pu = precioPara(x, c); if (pu == null) continue;
      porMoneda[x.moneda] = (porMoneda[x.moneda] || 0) + pu * c; hay = true;
    }
    $('total').textContent = Object.keys(porMoneda).length
      ? Object.entries(porMoneda).map(([m, v]) => precio(v, m)).join(' + ') : 'S/ 0.00';
    $('btnPedido').disabled = !hay;
  }

  $('buscar').addEventListener('input', pintar);
  $('tbLista').addEventListener('change', e => {
    const id = e.target.dataset.id; if (!id) return;
    const v = Math.max(0, parseInt(e.target.value, 10) || 0);
    if (v) cantidades[id] = v; else delete cantidades[id];
    pintar();
  });

  $('btnPedido').addEventListener('click', () => {
    let txt = `Hola RJM! Pedido mayorista de *${perfil.nombre || perfil.usuario}* (usuario: ${perfil.usuario}${perfil.ruc ? ', RUC/DNI ' + perfil.ruc : ''}):\n`;
    const porMoneda = {};
    for (const x of lista) {
      const c = cantidades[x.id]; if (!c) continue;
      const pu = precioPara(x, c); if (pu == null) continue;
      porMoneda[x.moneda] = (porMoneda[x.moneda] || 0) + pu * c;
      txt += `\n• ${c} ${x.unidad} × ${x.nombre}${x.sku ? ' [' + x.sku + ']' : ''} @ ${precio(pu, x.moneda)} = ${precio(pu * c, x.moneda)}`;
    }
    txt += `\n\nTotal estimado: ${Object.entries(porMoneda).map(([m, v]) => precio(v, m)).join(' + ')}`;
    txt += '\nQuedo atento a la confirmación de stock y forma de pago.';
    window.open(RJM.waLink(txt), '_blank', 'noopener');
  });

  iniciar();
})();
