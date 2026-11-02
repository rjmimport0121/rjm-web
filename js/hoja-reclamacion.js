// Hoja de Reclamación (formato del Anexo I del Reglamento del Libro de Reclamaciones).
// La usan la página pública (libro-reclamaciones.html) y el panel de administración.
// Debe coincidir con supabase/functions/libro-reclamaciones/hoja.ts (texto del correo).
(function () {
  const EMPRESA = {
    razonSocial: 'RJM Import-Export E.I.R.L.',
    ruc: '20610045171',
    domicilio: 'Mz. G Lt. 06 Asc. Basilio Auqui, Huamanga - Ayacucho',
    web: 'www.rjmimport.com',
    correo: 'rjm.import.export@gmail.com',
    whatsapp: '+51 956 543 522',
  };
  const NOTAS = [
    'RECLAMO: disconformidad relacionada a los productos o servicios.',
    'QUEJA: disconformidad no relacionada a los productos o servicios; o, malestar o descontento respecto a la atención al público.',
    'La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito previo para interponer una denuncia ante el INDECOPI.',
    'El proveedor debe dar respuesta al reclamo o queja en un plazo no mayor a quince (15) días hábiles, el cual es improrrogable.',
  ];
  const dinero = (n, m) => (m === 'USD' ? 'US$ ' : 'S/ ') + Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fechaHora = iso => new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(iso));
  const fechaCorta = valor => valor ? new Intl.DateTimeFormat('es-PE', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(valor + 'T00:00:00Z')) : '';

  // Secciones de la hoja en el orden del formato oficial.
  function secciones(h) {
    return [
      ['Hoja de Reclamación', [
        ['N.° de hoja', h.codigo],
        ['Fecha y hora de presentación', fechaHora(h.creado_en)],
        ['Proveedor', `${EMPRESA.razonSocial} · RUC ${EMPRESA.ruc}`],
        ['Domicilio del proveedor', `${EMPRESA.domicilio} · Tienda virtual ${EMPRESA.web}`],
      ]],
      ['1. Identificación del consumidor reclamante', [
        ['Nombre', h.nombre],
        ['Documento', `${h.tipo_documento} ${h.numero_documento}`],
        ['Domicilio', h.domicilio || '—'],
        ['Teléfono', h.telefono || '—'],
        ['Correo electrónico', h.correo || '—'],
        ...(h.menor_de_edad ? [['Padre o madre (menor de edad)', h.apoderado || '—']] : []),
      ]],
      ['2. Identificación del bien contratado', [
        ['Tipo', h.bien_tipo === 'servicio' ? 'Servicio' : 'Producto'],
        ['Monto reclamado', h.monto_reclamado != null ? dinero(h.monto_reclamado, h.moneda) : '—'],
        ['Descripción', h.bien_descripcion],
        ...(h.pedido_referencia ? [['N.° de pedido, boleta o proforma', h.pedido_referencia]] : []),
      ]],
      ['3. Detalle de la reclamación y pedido del consumidor', [
        ['Tipo', h.tipo === 'queja' ? 'Queja' : 'Reclamo'],
        ['Detalle', h.detalle],
        ['Pedido', h.pedido],
        ['Respuesta solicitada por', h.respuesta_por === 'carta' ? 'Carta al domicilio' : 'Correo electrónico'],
      ]],
      ['4. Observaciones y acciones adoptadas por el proveedor', [
        ['Observaciones y acciones', h.observaciones || 'Pendiente de respuesta.'],
        ['Fecha de comunicación de la respuesta', h.fecha_respuesta ? fechaCorta(h.fecha_respuesta) : '—'],
      ]],
    ];
  }

  // Texto plano (para correos escritos desde el panel).
  function texto(h) {
    return secciones(h).map(([t, filas]) => [t.toUpperCase(), ...filas.map(([k, v]) => `${k}: ${v}`)].join('\n')).join('\n\n')
      + '\n\n' + NOTAS.map(n => '* ' + n).join('\n');
  }

  function cargarScript(src) {
    return new Promise((ok, mal) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => mal(new Error('No se pudo cargar ' + src)); document.head.appendChild(s); });
  }
  let cargaPdf = null;
  async function libreria(base) {
    if (window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API.autoTable) return;
    if (!cargaPdf) cargaPdf = cargarScript(base + 'js/vendor/jspdf-4.2.1.umd.min.js').then(() => cargarScript(base + 'js/vendor/jspdf.plugin.autotable-5.0.9.min.js'));
    await cargaPdf;
  }
  async function logo(base) {
    try {
      const r = await fetch(base + 'img/logo-192.png'); const b = await r.blob();
      return await new Promise(ok => { const f = new FileReader(); f.onload = () => ok(f.result); f.onerror = () => ok(null); f.readAsDataURL(b); });
    } catch (_) { return null; }
  }

  // PDF A4 de la hoja. "base" es la ruta a la raíz de la web ('' o '../').
  async function pdf(h, base = '') {
    await libreria(base);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const ancho = doc.internal.pageSize.getWidth(), m = 15;
    const marino = [11, 37, 69], gris = [86, 97, 115];
    const imagen = await logo(base);
    if (imagen) doc.addImage(imagen, 'PNG', m, 12, 20, 20);
    const x = imagen ? m + 24 : m;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.setTextColor(20);
    doc.text(EMPRESA.razonSocial, x, 17);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...gris);
    [`RUC ${EMPRESA.ruc}`, EMPRESA.domicilio, `${EMPRESA.correo} · WhatsApp ${EMPRESA.whatsapp}`, EMPRESA.web].forEach((l, n) => doc.text(l, x, 22 + n * 4));

    doc.setDrawColor(...marino); doc.setLineWidth(0.5); doc.roundedRect(ancho - m - 66, 11, 66, 25, 2, 2);
    doc.setTextColor(...marino); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('LIBRO DE RECLAMACIONES', ancho - m - 33, 17, { align: 'center' });
    doc.setFontSize(9); doc.text('HOJA DE RECLAMACIÓN', ancho - m - 33, 22, { align: 'center' });
    doc.setFontSize(11); doc.text('N.° ' + h.codigo, ancho - m - 33, 28.5, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...gris);
    doc.text(fechaHora(h.creado_en), ancho - m - 33, 33, { align: 'center' });

    let y = 44;
    secciones(h).slice(1).forEach(([titulo, filas]) => {
      doc.autoTable({
        startY: y, margin: { left: m, right: m },
        head: [[{ content: titulo, colSpan: 2 }]],
        body: filas,
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.2, textColor: 30, lineColor: [220, 225, 232], valign: 'top' },
        headStyles: { fillColor: marino, textColor: 255, fontStyle: 'bold', fontSize: 9.5 },
        columnStyles: { 0: { cellWidth: 55, fontStyle: 'bold', textColor: gris } },
      });
      y = doc.lastAutoTable.finalY + 5;
    });
    if (y > 255) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8); doc.setTextColor(...gris);
    NOTAS.forEach(n => { const lineas = doc.splitTextToSize('* ' + n, ancho - 2 * m); doc.text(lineas, m, y); y += lineas.length * 3.6 + 1; });
    return new File([doc.output('blob')], `Hoja-de-Reclamacion-${h.codigo}.pdf`, { type: 'application/pdf' });
  }

  function descargar(archivo) {
    const url = URL.createObjectURL(archivo);
    const a = document.createElement('a'); a.href = url; a.download = archivo.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  // Suma días hábiles (sin sábados, domingos ni feriados nacionales del Perú).
  // Es un cálculo de ayuda: conviene responder antes del límite.
  function pascua(anio) {
    const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
      g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
      l = (32 + 2 * e + 2 * i - h - k) % 7, mm = Math.floor((a + 11 * h + 22 * l) / 451), mes = Math.floor((h + l - 7 * mm + 114) / 31), dia = ((h + l - 7 * mm + 114) % 31) + 1;
    return new Date(Date.UTC(anio, mes - 1, dia));
  }
  function feriados(anio) {
    const fijos = ['01-01', '05-01', '06-07', '06-29', '07-23', '07-28', '07-29', '08-06', '08-30', '10-08', '11-01', '12-08', '12-09', '12-25'].map(md => `${anio}-${md}`);
    const p = pascua(anio);
    const menos = n => new Date(p.getTime() - n * 864e5).toISOString().slice(0, 10);
    return new Set(fijos.concat([menos(3), menos(2)])); // Jueves y Viernes Santo
  }
  function sumarDiasHabiles(iso, dias) {
    const lima = new Date(new Date(iso).getTime() - 5 * 3600e3); // hora de Lima (UTC-5, sin horario de verano)
    let d = new Date(Date.UTC(lima.getUTCFullYear(), lima.getUTCMonth(), lima.getUTCDate()));
    let cuenta = 0;
    while (cuenta < dias) {
      d = new Date(d.getTime() + 864e5);
      const dia = d.getUTCDay(), clave = d.toISOString().slice(0, 10);
      if (dia !== 0 && dia !== 6 && !feriados(d.getUTCFullYear()).has(clave)) cuenta += 1;
    }
    return d.toISOString().slice(0, 10);
  }

  window.RJM_HOJA = { EMPRESA, NOTAS, secciones, texto, pdf, descargar, fechaHora, fechaCorta, sumarDiasHabiles, feriados };
})();
