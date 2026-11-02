// Libro de Reclamaciones virtual: valida la hoja, la envía a la Edge Function
// "libro-reclamaciones" (la registra con número, fecha y hora, y manda la copia
// automática al correo) y muestra la constancia para imprimir o descargar en PDF.
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const RJM = window.RJM || {};
  const H = window.RJM_HOJA;
  const form = $('formLibro');
  const abiertoEn = Date.now();
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  $('anio').textContent = new Date().getFullYear();

  $('rMenor').addEventListener('change', () => {
    $('cajaApoderado').hidden = !$('rMenor').checked;
    if ($('rMenor').checked) $('rApoderado').focus();
  });
  $('rTipoDoc').addEventListener('change', () => {
    const t = $('rTipoDoc').value, numerico = t === 'DNI' || t === 'RUC';
    $('rNumDoc').inputMode = numerico ? 'numeric' : 'text';
    $('rNumDoc').maxLength = t === 'DNI' ? 8 : t === 'RUC' ? 11 : 20;
  });
  $('rDetalle').addEventListener('input', () => { $('cuentaDetalle').textContent = `${$('rDetalle').value.length} / 3000`; });

  function leer() {
    const v = n => String(form.elements[n].value || '').trim();
    const menor = $('rMenor').checked;
    return {
      nombre: v('nombre').replace(/\s+/g, ' '),
      tipo_documento: v('tipo_documento'),
      numero_documento: v('numero_documento').replace(/\s/g, ''),
      correo: v('correo').toLowerCase() || null,
      telefono: v('telefono') || null,
      domicilio: v('domicilio') || null,
      menor_de_edad: menor,
      apoderado: menor ? (v('apoderado') || null) : null,
      bien_tipo: form.elements.bien_tipo.value,
      moneda: v('moneda'),
      monto_reclamado: v('monto_reclamado') === '' ? null : Math.round(Number(v('monto_reclamado')) * 100) / 100,
      bien_descripcion: v('bien_descripcion'),
      pedido_referencia: v('pedido_referencia') || null,
      tipo: form.elements.tipo.value,
      detalle: v('detalle'),
      pedido: v('pedido'),
      respuesta_por: form.elements.respuesta_por.value,
      sitio_web: v('sitio_web'),
    };
  }

  // Las mismas reglas que revisa el servidor; aquí solo ayudan a corregir rápido.
  function revisar(d) {
    if (d.nombre.length < 3) return ['Escribe tu nombre completo.', 'rNombre'];
    if (d.tipo_documento === 'DNI' && !/^\d{8}$/.test(d.numero_documento)) return ['El DNI debe tener 8 dígitos.', 'rNumDoc'];
    if (d.tipo_documento === 'RUC' && !/^\d{11}$/.test(d.numero_documento)) return ['El RUC debe tener 11 dígitos.', 'rNumDoc'];
    if (!/^[A-Za-z0-9-]{4,20}$/.test(d.numero_documento)) return ['Revisa el número de documento.', 'rNumDoc'];
    if (d.correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.correo)) return ['Revisa tu correo electrónico.', 'rCorreo'];
    if (!d.correo && !d.domicilio) return ['Escribe tu correo electrónico o tu domicilio para poder responderte.', 'rCorreo'];
    if (d.telefono && !/^[0-9 +()-]{6,30}$/.test(d.telefono)) return ['Revisa tu teléfono.', 'rTel'];
    if (d.menor_de_edad && (!d.apoderado || d.apoderado.length < 3)) return ['Escribe el nombre del padre o la madre.', 'rApoderado'];
    if (d.monto_reclamado != null && !(d.monto_reclamado >= 0)) return ['Revisa el monto reclamado.', 'rMonto'];
    if (d.bien_descripcion.length < 3) return ['Describe el producto o servicio.', 'rBien'];
    if (d.detalle.length < 10) return ['Cuéntanos con más detalle qué pasó (mínimo 10 caracteres).', 'rDetalle'];
    if (d.pedido.length < 3) return ['Escribe qué solicitas.', 'rPedido'];
    if (d.respuesta_por === 'correo' && !d.correo) return ['Para recibir la respuesta por correo, escribe tu correo electrónico.', 'rCorreo'];
    if (d.respuesta_por === 'carta' && !d.domicilio) return ['Para recibir la respuesta por carta, escribe tu domicilio.', 'rDomicilio'];
    return null;
  }

  function mostrarError(mensaje, idCampo) {
    $('rError').textContent = mensaje;
    if (idCampo) {
      const campo = $(idCampo);
      campo.setAttribute('aria-invalid', 'true');
      campo.focus();
    }
  }

  let hoja = null;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    form.querySelectorAll('[aria-invalid]').forEach(x => x.removeAttribute('aria-invalid'));
    $('rError').textContent = '';
    const d = leer();
    const problema = revisar(d);
    if (problema) { mostrarError(problema[0], problema[1]); return; }
    if (!RJM.sb) {
      mostrarError(`No hay conexión con el sistema en este momento. Escríbenos a ${H.EMPRESA.correo} o por WhatsApp al ${H.EMPRESA.whatsapp}.`);
      return;
    }
    const boton = $('rEnviar'), etiqueta = boton.lastChild;
    boton.disabled = true; etiqueta.textContent = 'Enviando…';
    try {
      const { data, error } = await RJM.sb.functions.invoke('libro-reclamaciones', { body: { ...d, ms_llenado: Date.now() - abiertoEn } });
      if (error) {
        let m = '';
        try { m = (await error.context.json()).error; } catch (_) { /* sin detalle */ }
        throw new Error(m || 'No pudimos registrar la hoja.');
      }
      if (!data || !data.codigo) throw new Error((data && data.error) || 'No pudimos registrar la hoja.');
      delete d.sitio_web;
      hoja = { ...d, codigo: data.codigo, creado_en: data.creado_en };
      mostrarConstancia(hoja, data);
    } catch (err) {
      mostrarError(`${err.message} Si el problema continúa, escríbenos a ${H.EMPRESA.correo} o por WhatsApp al ${H.EMPRESA.whatsapp}.`);
    } finally {
      boton.disabled = false; etiqueta.textContent = 'Enviar hoja de reclamación';
    }
  });

  function mostrarConstancia(h, r) {
    $('cResumen').innerHTML = `N.° de hoja <b>${esc(h.codigo)}</b> · Presentada el ${esc(H.fechaHora(h.creado_en))}`;
    $('cCorreo').textContent = r.correo_enviado
      ? `Te enviamos una copia a ${h.correo}. Si no la ves, revisa la carpeta de spam o promociones.`
      : h.correo
        ? 'No pudimos enviar la copia a tu correo en este momento. Descárgala o imprímela ahora; RJM también te la hará llegar.'
        : 'Como no indicaste un correo, descarga o imprime tu copia ahora.';
    $('cHoja').innerHTML = H.secciones(h).map(([titulo, filas]) => `
      <h3>${esc(titulo)}</h3>
      <dl>${filas.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`).join('')
      + `<ul class="notas">${H.NOTAS.map(n => `<li>${esc(n)}</li>`).join('')}</ul>`;
    form.hidden = true;
    const caja = $('constancia');
    caja.hidden = false;
    caja.focus({ preventScroll: true });
    caja.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }

  $('cPdf').addEventListener('click', async () => {
    if (!hoja) return;
    const b = $('cPdf'); b.disabled = true;
    try { H.descargar(await H.pdf(hoja)); }
    catch (_) { $('cCorreo').textContent = 'No se pudo crear el PDF. Usa el botón Imprimir y elige "Guardar como PDF".'; }
    finally { b.disabled = false; }
  });
  $('cImprimir').addEventListener('click', () => window.print());
})();
