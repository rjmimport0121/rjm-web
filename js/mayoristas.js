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

  // El portal es solo para clientes mayoristas; el administrador usa admin.html.
  function motivoRechazo(p) {
    if (p && p.rol === 'admin') return 'Esa es la cuenta de administrador. Este portal es para tus clientes: ingresa con un usuario mayorista (por ejemplo, el de prueba). Para publicar productos y precios usa el panel de administración.';
    return 'Tu acceso está desactivado. Comunícate con RJM.';
  }

  async function iniciar() {
    if (!RJM.configurado) {
      aviso('loginMsg', 'El portal aún no está configurado.', 'info');
      $('btnEntrar').disabled = true;
      return;
    }
    const p = await RJM.perfilActual();
    if (p && p.activo && p.rol === 'mayorista') return mostrar(p);
    if (p) { await RJM.salir(); aviso('loginMsg', motivoRechazo(p), p.rol === 'admin' ? 'info' : 'err'); }
  }

  $('formLogin').addEventListener('submit', async e => {
    e.preventDefault();
    $('btnEntrar').disabled = true; aviso('loginMsg', '');
    const { error } = await sb.auth.signInWithPassword({ email: RJM.aEmail($('lUsuario').value), password: $('lClave').value });
    $('btnEntrar').disabled = false;
    if (error) return aviso('loginMsg', RJM.errorLegible(error));
    const p = await RJM.perfilActual();
    if (!p || !p.activo || p.rol !== 'mayorista') {
      await RJM.salir();
      return aviso('loginMsg', motivoRechazo(p), p && p.rol === 'admin' ? 'info' : 'err');
    }
    $('lClave').value = '';
    mostrar(p);
  });

  $('btnSalir').addEventListener('click', async () => { await RJM.salir(); location.reload(); });

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
    $('notaIgv').textContent = 'Todos los precios incluyen IGV';
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
</td>
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
    $('btnPdf').disabled = !hay;
  }

  $('buscar').addEventListener('input', pintar);
  $('tbLista').addEventListener('change', e => {
    const id = e.target.dataset.id; if (!id) return;
    const v = Math.max(0, parseInt(e.target.value, 10) || 0);
    if (v) cantidades[id] = v; else delete cantidades[id];
    pintar();
  });

  // ---------- Proforma (precios con IGV incluido) ----------
  const EMPRESA = {
    nombre: 'RJM Import-Export E.I.R.L.',
    ruc: '20610045171',
    banco: 'BCP Soles N° 2207106419030 · CCI 00222000710641903020',
    lineas: ['RUC 20610045171', 'Mz. G Lt. 06 Asc. Basilio Auqui, Huamanga - Ayacucho', 'WhatsApp: +51 956 543 522', 'rjm.import.export@gmail.com', 'www.rjmimport.com'],
  };

  function datosProforma() {
    const ahora = new Date();
    const dos = n => String(n).padStart(2, '0');
    const numero = `PM-${String(ahora.getFullYear()).slice(2)}${dos(ahora.getMonth() + 1)}${dos(ahora.getDate())}-${dos(ahora.getHours())}${dos(ahora.getMinutes())}`;
    const items = [], porMoneda = {};
    for (const x of lista) {
      const c = cantidades[x.id]; if (!c) continue;
      const pu = precioPara(x, c); if (pu == null) continue;
      const importe = Math.round(pu * c * 100) / 100;
      porMoneda[x.moneda] = (porMoneda[x.moneda] || 0) + importe;
      items.push({ x, c, pu, importe });
    }
    const total = Object.entries(porMoneda).map(([m, v]) => precio(v, m)).join(' + ');
    return { numero, fecha: ahora.toLocaleDateString('es-PE'), items, total };
  }

  function textoProforma(d) {
    const linea = '------------------------------';
    let t = `*PROFORMA N° ${d.numero}*\n${EMPRESA.nombre}\nRUC ${EMPRESA.ruc}\nFecha: ${d.fecha}\n${linea}\n`;
    t += `*Cliente:* ${perfil.nombre || perfil.usuario}\n`;
    if (perfil.ruc) t += `*RUC/DNI:* ${perfil.ruc}\n`;
    if (perfil.telefono) t += `*Teléfono:* ${perfil.telefono}\n`;
    t += `*Usuario:* ${perfil.usuario}\n${linea}\n`;
    d.items.forEach(({ x, c, pu, importe }, n) => {
      t += `${n + 1}) ${x.nombre}\n`;
      if (x.sku) t += `   Cód. ${x.sku}\n`;
      t += `   ${c} ${x.unidad} x ${precio(pu, x.moneda)} = ${precio(importe, x.moneda)}\n`;
    });
    t += `${linea}\n*TOTAL (IGV incluido): ${d.total}*\n`;
    t += `${linea}\nPrecios con IGV incluido.\nSujeto a confirmación de stock.\n*Pago:* ${EMPRESA.banco}`;
    return t;
  }

  // Carga jsPDF sólo cuando se pide el PDF (está alojado en la propia web: js/vendor).
  let cargaPdf = null;
  function cargarScript(src) {
    return new Promise((ok, mal) => {
      const s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = () => mal(new Error('No se pudo cargar ' + src));
      document.head.append(s);
    });
  }
  function libreriaPdf() {
    if (!cargaPdf) cargaPdf = cargarScript('js/vendor/jspdf-4.2.1.umd.min.js')
      .then(() => cargarScript('js/vendor/jspdf.plugin.autotable-5.0.9.min.js'))
      .catch(e => { cargaPdf = null; throw e; });
    return cargaPdf;
  }
  async function logoDataUrl() {
    try {
      const r = await fetch('img/logo-192.png');
      const b = await r.blob();
      return await new Promise(ok => { const f = new FileReader(); f.onload = () => ok(f.result); f.readAsDataURL(b); });
    } catch (_) { return null; }
  }

  async function pdfProforma(d) {
    await libreriaPdf();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const ancho = doc.internal.pageSize.getWidth(), m = 15;
    const azul = [37, 99, 235], gris = [90, 100, 115];

    const logo = await logoDataUrl();
    if (logo) doc.addImage(logo, 'PNG', m, 12, 22, 22);
    const xEmp = logo ? m + 26 : m;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(20);
    doc.text(EMPRESA.nombre, xEmp, 18);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...gris);
    EMPRESA.lineas.forEach((l, n) => doc.text(l, xEmp, 23 + n * 4));

    // Recuadro del número de proforma
    doc.setDrawColor(...azul); doc.setLineWidth(0.5);
    doc.roundedRect(ancho - m - 62, 12, 62, 24, 2, 2);
    doc.setTextColor(...azul); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text('PROFORMA', ancho - m - 31, 20, { align: 'center' });
    doc.setFontSize(10.5); doc.text('N° ' + d.numero, ancho - m - 31, 26.5, { align: 'center' });
    doc.setTextColor(...gris); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    doc.text('Fecha: ' + d.fecha, ancho - m - 31, 32, { align: 'center' });

    // Cliente
    let y = 50;
    doc.setFillColor(243, 246, 251); doc.rect(m, y - 5, ancho - 2 * m, 20, 'F');
    doc.setTextColor(20); doc.setFontSize(9.5);
    const filaCli = (et, val, x, yy) => { doc.setFont('helvetica', 'bold'); doc.text(et, x, yy); doc.setFont('helvetica', 'normal'); doc.text(String(val || '—'), x + 22, yy); };
    filaCli('Cliente:', perfil.nombre || perfil.usuario, m + 3, y);
    filaCli('RUC/DNI:', perfil.ruc, m + 3, y + 6);
    filaCli('Teléfono:', perfil.telefono, ancho / 2 + 5, y + 6);
    filaCli('Usuario:', perfil.usuario, m + 3, y + 12);

    // Detalle
    doc.autoTable({
      startY: y + 20,
      margin: { left: m, right: m },
      head: [['#', 'Código', 'Descripción', 'Cant.', 'Und.', 'P. Unit.', 'Importe']],
      body: d.items.map(({ x, c, pu, importe }, n) => [n + 1, x.sku || '—', x.nombre, c, x.unidad, precio(pu, x.moneda), precio(importe, x.moneda)]),
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.2, textColor: 30 },
      headStyles: { fillColor: azul, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [247, 249, 252] },
      columnStyles: { 0: { halign: 'center', cellWidth: 8 }, 1: { cellWidth: 24 }, 3: { halign: 'right', cellWidth: 14 },
        4: { halign: 'center', cellWidth: 13 }, 5: { halign: 'right', cellWidth: 25 }, 6: { halign: 'right', cellWidth: 28 } },
      didParseCell: c => { if (c.section === 'head') c.cell.styles.halign = [0, 4].includes(c.column.index) ? 'center' : [3, 5, 6].includes(c.column.index) ? 'right' : 'left'; },
    });

    // Total
    y = doc.lastAutoTable.finalY + 6;
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFillColor(...azul); doc.rect(ancho - m - 80, y - 5, 80, 10, 'F');
    doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('TOTAL (IGV incluido): ' + d.total, ancho - m - 3, y + 1.5, { align: 'right' });

    doc.setTextColor(...gris); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    ['Precios con IGV incluido.', 'Sujeto a confirmación de stock.', 'Documento informativo: no es un comprobante de pago.']
      .forEach((l, n) => doc.text('• ' + l, m, y + 14 + n * 4.5));
    doc.setFont('helvetica', 'bold'); doc.setTextColor(20); doc.setFontSize(9);
    doc.text('Cuenta para el pago:', m, y + 32);
    doc.setFont('helvetica', 'normal'); doc.text(EMPRESA.banco, m + 34, y + 32);

    const nombre = `Proforma-${d.numero}.pdf`;
    return new File([doc.output('blob')], nombre, { type: 'application/pdf' });
  }

  $('btnPedido').addEventListener('click', () => {
    window.open(RJM.waLink(textoProforma(datosProforma())), '_blank', 'noopener');
  });

  // PDF: en el celular se comparte directo (WhatsApp aparece en la lista);
  // en la computadora se descarga para adjuntarlo en WhatsApp.
  $('btnPdf').addEventListener('click', async () => {
    const btn = $('btnPdf'), etiqueta = btn.textContent;
    btn.disabled = true; btn.textContent = 'Generando PDF…'; aviso('listaMsg', '');
    try {
      const d = datosProforma();
      const archivo = await pdfProforma(d);
      if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
        try {
          await navigator.share({ files: [archivo], title: 'Proforma ' + d.numero, text: `Proforma ${d.numero} – ${perfil.nombre || perfil.usuario}` });
          return;
        } catch (e) { if (e.name === 'AbortError') return; }
      }
      const url = URL.createObjectURL(archivo);
      const a = Object.assign(document.createElement('a'), { href: url, download: archivo.name });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      aviso('listaMsg', `PDF descargado (${archivo.name}). Adjúntalo en tu chat de WhatsApp con RJM.`, 'ok');
    } catch (e) {
      aviso('listaMsg', 'No se pudo generar el PDF: ' + e.message);
    } finally { btn.disabled = $('btnPedido').disabled; btn.textContent = etiqueta; }
  });

  iniciar();
})();
