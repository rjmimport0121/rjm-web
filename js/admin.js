// Panel de administración RJM: catálogo web, lista mayorista, usuarios mayoristas
// y respuestas del Libro de Reclamaciones.
(function () {
  const $ = id => document.getElementById(id);
  const { sb, esc, precio } = RJM;
  let productos = [], mayoristas = [], usuarios = [];
  let editProdId = null, editMayId = null;

  function aviso(el, texto, tipo = 'err') {
    $(el).innerHTML = texto ? `<div class="msg ${tipo}">${esc(texto)}</div>` : '';
  }
  function ocupado(btn, si) { $(btn).disabled = si; }

  // ---------------- GRUPO / SUBGRUPO ----------------
  const CATS = window.RJM_CATEGORIAS || [];
  const OTRO = '__otro__';
  const igual = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  function grupoDe(sub) { return (CATS.find(c => c.subgrupos.some(x => igual(x, sub))) || {}).grupo || null; }
  function selectorCategoria(idGrupo, idSub, idOtro, opcional) {
    const g = $(idGrupo), sub = $(idSub), otro = $(idOtro);
    g.innerHTML = (opcional ? '<option value="">— Sin grupo —</option>' : '<option value="" disabled>Elige un grupo…</option>') +
      CATS.map(c => `<option>${esc(c.grupo)}</option>`).join('');
    function llenarSub(valor) {
      const c = CATS.find(x => x.grupo === g.value);
      const lista = c ? c.subgrupos : [];
      valor = lista.find(x => igual(x, valor)) || valor;
      const esOtro = valor && !lista.includes(valor);
      sub.innerHTML = (opcional ? '<option value="">— Sin subgrupo —</option>' : '<option value="" disabled>Elige un subgrupo…</option>') +
        lista.map(x => `<option>${esc(x)}</option>`).join('') + `<option value="${OTRO}">Otro… (escribir)</option>`;
      sub.value = esOtro ? OTRO : (valor || '');
      otro.value = esOtro ? valor : '';
      otro.classList.toggle('oculto', !esOtro);
      otro.required = esOtro;
    }
    g.addEventListener('change', () => llenarSub(''));
    sub.addEventListener('change', () => { otro.classList.toggle('oculto', sub.value !== OTRO); otro.required = sub.value === OTRO; if (sub.value === OTRO) otro.focus(); });
    return {
      poner(grupo, subgrupo) { g.value = grupo || grupoDe(subgrupo) || ''; llenarSub(subgrupo || ''); },
      leer() {
        const s2 = sub.value === OTRO ? otro.value.trim() : sub.value;
        return { grupo: g.value || null, categoria: s2 || null };
      },
    };
  }
  const selProd = selectorCategoria('pGrupo', 'pSubgrupo', 'pSubOtro', false);
  const selMay = selectorCategoria('mGrupo', 'mCategoria', 'mSubOtro', true);

  // ---------------- SESIÓN ----------------
  async function iniciar() {
    if (!RJM.configurado) {
      aviso('loginMsg', 'Falta configurar Supabase en js/config.js (ver docs/CONFIGURACION.md).', 'info');
      $('btnEntrar').disabled = true;
      return;
    }
    const perfil = await RJM.perfilActual();
    if (perfil && perfil.rol === 'admin' && perfil.activo) return mostrarPanel(perfil);
    if (perfil) { await RJM.salir(); aviso('loginMsg', 'Esta cuenta no tiene permisos de administrador.'); }
  }

  $('formLogin').addEventListener('submit', async e => {
    e.preventDefault();
    ocupado('btnEntrar', true); aviso('loginMsg', '');
    const { error } = await sb.auth.signInWithPassword({ email: RJM.aEmail($('lUsuario').value), password: $('lClave').value });
    ocupado('btnEntrar', false);
    if (error) return aviso('loginMsg', RJM.errorLegible(error));
    const perfil = await RJM.perfilActual();
    if (!perfil || perfil.rol !== 'admin' || !perfil.activo) {
      await RJM.salir();
      return aviso('loginMsg', 'Esta cuenta no tiene permisos de administrador.');
    }
    $('lClave').value = '';
    mostrarPanel(perfil);
  });

  $('btnSalir').addEventListener('click', async () => { await RJM.salir(); location.reload(); });

  function mostrarPanel(perfil) {
    $('vistaLogin').classList.add('oculto');
    $('vistaPanel').classList.remove('oculto');
    $('btnSalir').classList.remove('oculto');
    $('quien').textContent = perfil.usuario || perfil.email;
    cargarCatalogo(); cargarMayorista(); cargarUsuarios(); cargarReclamos();
  }

  // ---------------- PESTAÑAS ----------------
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('activo', x === t));
    ['catalogo', 'mayorista', 'usuarios', 'reclamos'].forEach(n => $('tab-' + n).classList.toggle('oculto', n !== t.dataset.tab));
    aviso('panelMsg', '');
  }));
  document.querySelectorAll('[data-cerrar]').forEach(b => b.addEventListener('click', () => b.closest('.modal-fondo').classList.add('oculto')));

  // ---------------- CATÁLOGO WEB ----------------
  async function cargarCatalogo() {
    const { data, error } = await sb.from('productos').select('*').order('orden').order('nombre');
    if (error) return aviso('panelMsg', RJM.errorLegible(error));
    productos = data; pintarCatalogo();
  }
  function pintarCatalogo() {
    const q = $('buscarCat').value.trim().toLowerCase();
    const filas = productos.filter(p => !q || `${p.nombre} ${p.sku || ''} ${p.grupo || ''} ${p.categoria}`.toLowerCase().includes(q));
    $('tbCatalogo').innerHTML = filas.length ? filas.map(p => `
      <tr>
        <td>${p.foto_url ? `<img class="mini" src="${esc(p.foto_url)}" alt="">` : '<div class="mini"></div>'}</td>
        <td><b>${esc(p.nombre)}</b>${p.sku ? `<br><small>${esc(p.sku)}</small>` : ''}</td>
        <td>${p.grupo ? `<small>${esc(p.grupo)} ›</small><br>` : ''}${esc(p.categoria)}</td>
        <td class="num">${p.precio != null ? precio(p.precio, p.moneda) : '<small>Consultar</small>'}</td>
        <td>${p.publicado ? '<span class="pill ok">Visible</span>' : '<span class="pill off">Oculto</span>'}${p.destacado ? ' <span class="pill">★</span>' : ''}</td>
        <td><div class="acciones-fila">
          <button class="btn sec chico" data-editar-prod="${p.id}">Editar</button>
          <button class="btn sec chico" data-toggle-prod="${p.id}">${p.publicado ? 'Ocultar' : 'Publicar'}</button>
        </div></td>
      </tr>`).join('') : '<tr><td colspan="6">Aún no hay productos. Crea el primero con “+ Nuevo producto”.</td></tr>';
  }
  $('buscarCat').addEventListener('input', pintarCatalogo);

  $('tbCatalogo').addEventListener('click', async e => {
    const ed = e.target.dataset.editarProd, tg = e.target.dataset.toggleProd;
    if (ed) abrirProd(productos.find(p => p.id === ed));
    if (tg) {
      const p = productos.find(x => x.id === tg);
      const { error } = await sb.from('productos').update({ publicado: !p.publicado }).eq('id', tg);
      if (error) return aviso('panelMsg', RJM.errorLegible(error));
      cargarCatalogo();
    }
  });

  $('btnNuevoProd').addEventListener('click', () => abrirProd(null));

  function abrirProd(p) {
    editProdId = p ? p.id : null;
    $('tituloProd').textContent = p ? 'Editar producto' : 'Nuevo producto';
    aviso('prodMsg', '');
    $('pNombre').value = p?.nombre || '';
    $('pSku').value = p?.sku || '';
    selProd.poner(p?.grupo, p?.categoria);
    $('pMarca').value = p?.marca || '';
    $('pDesc').value = p?.descripcion || '';
    $('pCarac').value = (p?.caracteristicas || []).join('\n');
    $('pPrecio').value = p?.precio ?? '';
    $('pMoneda').value = p?.moneda || 'PEN';
    $('pOrden').value = p?.orden ?? 0;
    $('pPublicado').checked = p ? p.publicado : true;
    $('pDestacado').checked = p ? p.destacado : false;
    $('pFoto').value = '';
    $('pFotoPrev').src = p?.foto_url || '';
    $('pFotoPrev').classList.toggle('oculto', !p?.foto_url);
    $('modalProd').classList.remove('oculto');
    $('pNombre').focus();
  }

  $('pFoto').addEventListener('change', () => {
    const f = $('pFoto').files[0];
    if (!f) return;
    $('pFotoPrev').src = URL.createObjectURL(f);
    $('pFotoPrev').classList.remove('oculto');
  });

  // Reduce la foto a máx. 1200 px y la convierte a JPEG (ahorra espacio y carga rápido).
  function reducirImagen(file, max = 1200, calidad = 0.85) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(b => b ? resolve(b) : reject(new Error('No se pudo procesar la imagen')), 'image/jpeg', calidad);
      };
      img.onerror = () => reject(new Error('Archivo de imagen no válido'));
      img.src = URL.createObjectURL(file);
    });
  }

  $('formProd').addEventListener('submit', async e => {
    e.preventDefault();
    ocupado('btnGuardarProd', true); aviso('prodMsg', '');
    try {
      const anterior = productos.find(p => p.id === editProdId);
      const fila = {
        nombre: $('pNombre').value.trim(),
        sku: $('pSku').value.trim() || null,
        ...selProd.leer(),
        marca: $('pMarca').value.trim() || null,
        descripcion: $('pDesc').value.trim() || null,
        caracteristicas: $('pCarac').value.split('\n').map(s => s.trim()).filter(Boolean),
        precio: $('pPrecio').value === '' ? null : Number($('pPrecio').value),
        moneda: $('pMoneda').value,
        orden: Number($('pOrden').value) || 0,
        precio_incluye_igv: true, // todos los precios se registran con IGV incluido
        publicado: $('pPublicado').checked,
        destacado: $('pDestacado').checked,
      };
      const archivo = $('pFoto').files[0];
      if (archivo) {
        const blob = await reducirImagen(archivo);
        const ruta = `catalogo/${crypto.randomUUID()}.jpg`;
        const { error: eUp } = await sb.storage.from('productos').upload(ruta, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
        if (eUp) throw eUp;
        fila.foto_path = ruta;
        fila.foto_url = sb.storage.from('productos').getPublicUrl(ruta).data.publicUrl;
      }
      const q = editProdId ? sb.from('productos').update(fila).eq('id', editProdId) : sb.from('productos').insert(fila);
      const { error } = await q;
      if (error) throw error;
      // Si se reemplazó la foto, se borra la anterior del almacenamiento.
      if (archivo && anterior?.foto_path) await sb.storage.from('productos').remove([anterior.foto_path]);
      $('modalProd').classList.add('oculto');
      aviso('panelMsg', 'Producto guardado.', 'ok');
      cargarCatalogo();
    } catch (err) {
      aviso('prodMsg', /duplicate key.*sku/i.test(err.message) ? 'Ese SKU ya existe.' : RJM.errorLegible(err));
    } finally { ocupado('btnGuardarProd', false); }
  });

  // ---------------- LISTA MAYORISTA ----------------
  async function cargarMayorista() {
    const { data, error } = await sb.from('productos_mayoristas')
      .select('*, precios_mayoristas(cantidad_minima, precio)').order('orden').order('nombre');
    if (error) return aviso('panelMsg', RJM.errorLegible(error));
    mayoristas = data.map(p => ({ ...p, tramos: (p.precios_mayoristas || []).sort((a, b) => a.cantidad_minima - b.cantidad_minima) }));
    pintarMayorista();
  }
  function textoTramos(p) {
    return p.tramos.map(t => `${t.cantidad_minima}+ ${esc(p.unidad)}: ${precio(t.precio, p.moneda)}`).join('<br>') || '<small>Sin precios</small>';
  }
  function pintarMayorista() {
    const q = $('buscarMay').value.trim().toLowerCase();
    const filas = mayoristas.filter(p => !q || `${p.nombre} ${p.sku || ''} ${p.categoria || ''}`.toLowerCase().includes(q));
    $('tbMayorista').innerHTML = filas.length ? filas.map(p => `
      <tr>
        <td>${esc(p.sku || '—')}</td>
        <td><b>${esc(p.nombre)}</b>${p.categoria ? `<br><small>${p.grupo ? esc(p.grupo) + ' › ' : ''}${esc(p.categoria)}</small>` : ''}</td>
        <td class="num">${p.stock} ${esc(p.unidad)}</td>
        <td>${textoTramos(p)}</td>
        <td>${!p.activo ? '<span class="pill off">Inactivo</span>' : p.stock > 0 ? '<span class="pill ok">Visible</span>' : '<span class="pill off">Sin stock</span>'}</td>
        <td><button class="btn sec chico" data-editar-may="${p.id}">Editar</button></td>
      </tr>`).join('') : '<tr><td colspan="6">Aún no hay productos en la lista mayorista.</td></tr>';
  }
  $('buscarMay').addEventListener('input', pintarMayorista);
  $('tbMayorista').addEventListener('click', e => {
    const id = e.target.dataset.editarMay;
    if (id) abrirMay(mayoristas.find(p => p.id === id));
  });
  $('btnNuevoMay').addEventListener('click', () => abrirMay(null));

  function agregarTramo(cant = '', prec = '') {
    const div = document.createElement('div');
    div.className = 'tramo';
    div.innerHTML = `
      <div><label>Desde (cantidad)</label><input type="number" min="1" step="1" class="tCant" value="${esc(cant)}" required></div>
      <div><label>Precio unitario (inc. IGV)</label><input type="number" min="0" step="0.01" class="tPrecio" value="${esc(prec)}" required></div>
      <button type="button" class="btn peligro chico" title="Quitar">✕</button>`;
    div.querySelector('button').addEventListener('click', () => div.remove());
    $('tramos').appendChild(div);
  }
  $('btnAgregarTramo').addEventListener('click', () => agregarTramo());

  function abrirMay(p) {
    editMayId = p ? p.id : null;
    $('tituloMay').textContent = p ? 'Editar producto mayorista' : 'Nuevo producto mayorista';
    aviso('mayMsg', '');
    $('mNombre').value = p?.nombre || '';
    $('mSku').value = p?.sku || '';
    selMay.poner(p?.grupo, p?.categoria);
    $('mUnidad').value = p?.unidad || 'und';
    $('mStock').value = p?.stock ?? 0;
    $('mMoneda').value = p?.moneda || 'PEN';
    $('mOrden').value = p?.orden ?? 0;
    $('mNotas').value = p?.notas || '';
    $('mMostrarStock').checked = p ? p.mostrar_stock : true;
    $('mActivo').checked = p ? p.activo : true;
    $('tramos').innerHTML = '';
    (p?.tramos?.length ? p.tramos : [{ cantidad_minima: 1, precio: '' }, { cantidad_minima: 12, precio: '' }])
      .forEach(t => agregarTramo(t.cantidad_minima, t.precio));
    $('modalMay').classList.remove('oculto');
    $('mNombre').focus();
  }

  $('formMay').addEventListener('submit', async e => {
    e.preventDefault();
    aviso('mayMsg', '');
    const tramos = [...$('tramos').querySelectorAll('.tramo')].map(d => ({
      cantidad_minima: parseInt(d.querySelector('.tCant').value, 10),
      precio: Number(d.querySelector('.tPrecio').value),
    }));
    if (!tramos.length) return aviso('mayMsg', 'Agrega al menos un precio por cantidad.');
    const cantidades = tramos.map(t => t.cantidad_minima);
    if (new Set(cantidades).size !== cantidades.length) return aviso('mayMsg', 'Hay dos tramos con la misma cantidad.');
    tramos.sort((a, b) => a.cantidad_minima - b.cantidad_minima);

    ocupado('btnGuardarMay', true);
    try {
      const fila = {
        nombre: $('mNombre').value.trim(),
        sku: $('mSku').value.trim() || null,
        ...selMay.leer(),
        unidad: $('mUnidad').value.trim() || 'und',
        stock: parseInt($('mStock').value, 10) || 0,
        moneda: $('mMoneda').value,
        orden: Number($('mOrden').value) || 0,
        notas: $('mNotas').value.trim() || null,
        precio_incluye_igv: true, // todos los precios se registran con IGV incluido
        mostrar_stock: $('mMostrarStock').checked,
        activo: $('mActivo').checked,
      };
      let id = editMayId;
      if (id) {
        const { error } = await sb.from('productos_mayoristas').update(fila).eq('id', id);
        if (error) throw error;
      } else {
        const { data, error } = await sb.from('productos_mayoristas').insert(fila).select('id').single();
        if (error) throw error;
        id = data.id;
      }
      // Reemplaza la tabla de precios por cantidad de este producto.
      const { error: eDel } = await sb.from('precios_mayoristas').delete().eq('producto_id', id);
      if (eDel) throw eDel;
      const { error: eIns } = await sb.from('precios_mayoristas').insert(tramos.map(t => ({ ...t, producto_id: id })));
      if (eIns) throw eIns;
      $('modalMay').classList.add('oculto');
      aviso('panelMsg', 'Producto mayorista guardado.', 'ok');
      cargarMayorista();
    } catch (err) {
      aviso('mayMsg', /duplicate key.*sku/i.test(err.message) ? 'Ese SKU ya existe.' : RJM.errorLegible(err));
    } finally { ocupado('btnGuardarMay', false); }
  });

  // ---------------- USUARIOS MAYORISTAS ----------------
  async function funcion(body) {
    const { data, error } = await sb.functions.invoke('gestionar-mayoristas', { body });
    if (error) {
      let m = error.message;
      try { m = (await error.context.json()).error || m; } catch (_) {}
      throw new Error(/Failed to send|not found/i.test(m) ? 'La función "gestionar-mayoristas" no está desplegada en Supabase (ver docs/CONFIGURACION.md).' : m);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }

  async function cargarUsuarios() {
    const { data, error } = await sb.from('perfiles').select('*').eq('rol', 'mayorista').order('creado_en', { ascending: false });
    if (error) return aviso('panelMsg', RJM.errorLegible(error));
    usuarios = data; pintarUsuarios();
  }
  function pintarUsuarios() {
    $('tbUsuarios').innerHTML = usuarios.length ? usuarios.map(u => `
      <tr>
        <td><b>${esc(u.usuario)}</b></td>
        <td>${esc(u.nombre || '—')}</td>
        <td>${esc(u.ruc || '—')}</td>
        <td>${esc(u.telefono || '—')}</td>
        <td>${u.activo ? '<span class="pill ok">Activo</span>' : '<span class="pill off">Desactivado</span>'}</td>
        <td><div class="acciones-fila">
          <button class="btn sec chico" data-clave="${u.id}">Cambiar contraseña</button>
          <button class="btn ${u.activo ? 'peligro' : 'sec'} chico" data-estado="${u.id}">${u.activo ? 'Desactivar' : 'Activar'}</button>
        </div></td>
      </tr>`).join('') : '<tr><td colspan="6">Aún no hay usuarios mayoristas.</td></tr>';
  }

  function generarClave() {
    const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const r = crypto.getRandomValues(new Uint32Array(10));
    return [...r].map(n => abc[n % abc.length]).join('');
  }
  $('btnGenerarClave').addEventListener('click', () => { $('uClave').value = generarClave(); });

  $('formUsuario').addEventListener('submit', async e => {
    e.preventDefault();
    ocupado('btnCrearUsuario', true); aviso('panelMsg', '');
    const usuario = $('uUsuario').value.trim().toLowerCase(), clave = $('uClave').value;
    try {
      await funcion({ accion: 'crear', usuario, clave, nombre: $('uNombre').value.trim() || null,
        ruc: $('uRuc').value.trim() || null, telefono: $('uTel').value.trim() || null });
      aviso('panelMsg', `Acceso creado. Entrégale al cliente → Usuario: ${usuario} · Contraseña: ${clave} · Portal: ${RJM.cfg.SITIO_URL}mayoristas.html`, 'ok');
      $('formUsuario').reset();
      cargarUsuarios();
    } catch (err) { aviso('panelMsg', err.message); }
    finally { ocupado('btnCrearUsuario', false); }
  });

  $('tbUsuarios').addEventListener('click', async e => {
    const idClave = e.target.dataset.clave, idEstado = e.target.dataset.estado;
    try {
      if (idClave) {
        const nueva = prompt('Nueva contraseña (mínimo 8 caracteres):', generarClave());
        if (!nueva) return;
        await funcion({ accion: 'cambiar_clave', id: idClave, clave: nueva });
        const u = usuarios.find(x => x.id === idClave);
        aviso('panelMsg', `Contraseña actualizada para ${u.usuario}: ${nueva}`, 'ok');
      }
      if (idEstado) {
        const u = usuarios.find(x => x.id === idEstado);
        if (u.activo && !confirm(`¿Desactivar el acceso de ${u.usuario}? Podrás reactivarlo luego.`)) return;
        await funcion({ accion: u.activo ? 'desactivar' : 'activar', id: idEstado });
        cargarUsuarios();
      }
    } catch (err) { aviso('panelMsg', err.message); }
  });

  // ---------------- LIBRO DE RECLAMACIONES ----------------
  // Las hojas las registra la Edge Function "libro-reclamaciones". Aquí solo se
  // leen y se completa la sección 4 (respuesta). No se pueden borrar ni editar
  // los datos del consumidor (lo impide la base de datos).
  const HOJA = window.RJM_HOJA;
  let reclamos = [], reclamoActual = null;
  const hoyLima = () => new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
  const ESTADOS = { pendiente: ['Pendiente', 'off'], en_proceso: ['En proceso', ''], respondido: ['Respondido', 'ok'] };

  async function cargarReclamos() {
    const { data, error } = await sb.from('reclamaciones').select('*').order('creado_en', { ascending: false });
    if (error) {
      $('tbReclamos').innerHTML = '<tr><td colspan="7">No se pudo leer el libro.</td></tr>';
      return aviso('reclamosMsg', /does not exist|relation|schema cache/i.test(error.message)
        ? 'Falta crear el Libro de Reclamaciones en Supabase: ejecuta supabase/reclamaciones.sql en el SQL Editor.'
        : RJM.errorLegible(error), 'info');
    }
    reclamos = data; pintarReclamos();
  }
  function vence(r) { return HOJA.sumarDiasHabiles(r.creado_en, 15); }
  function pintarReclamos() {
    const filtro = $('filtroReclamos').value;
    const filas = reclamos.filter(r => filtro === 'todas' || (filtro === 'respondido' ? r.estado === 'respondido' : r.estado !== 'respondido'));
    const abiertas = reclamos.filter(r => r.estado !== 'respondido').length;
    $('reclamosPend').textContent = abiertas;
    $('reclamosPend').classList.toggle('oculto', !abiertas);
    const hoy = hoyLima();
    $('tbReclamos').innerHTML = filas.length ? filas.map(r => {
      const limite = vence(r), [txt, clase] = ESTADOS[r.estado] || [r.estado, ''];
      const dias = Math.round((Date.parse(limite) - Date.parse(hoy)) / 864e5);
      const marca = r.estado === 'respondido' ? '' : dias < 0 ? 'vencido' : dias <= 4 ? 'vence-pronto' : '';
      return `<tr>
        <td><b>${esc(r.codigo)}</b>${r.correo && !r.correo_enviado ? '<br><small class="vence-pronto">Copia por correo pendiente</small>' : ''}</td>
        <td>${esc(HOJA.fechaHora(r.creado_en))}</td>
        <td>${esc(r.nombre)}<br><small>${esc(r.tipo_documento)} ${esc(r.numero_documento)}</small></td>
        <td>${r.tipo === 'queja' ? 'Queja' : 'Reclamo'}</td>
        <td class="${marca}">${r.estado === 'respondido' ? '—' : esc(HOJA.fechaCorta(limite)) + (dias < 0 ? ' (vencido)' : '')}</td>
        <td><span class="pill ${clase}">${esc(txt)}</span></td>
        <td><button class="btn sec chico" data-reclamo="${r.id}">Ver y responder</button></td>
      </tr>`;
    }).join('') : `<tr><td colspan="7">${reclamos.length ? 'No hay hojas con este filtro.' : 'Aún no hay hojas de reclamación. ¡Bien!'}</td></tr>`;
  }
  $('filtroReclamos').addEventListener('change', pintarReclamos);
  $('tbReclamos').addEventListener('click', e => {
    const id = e.target.dataset.reclamo;
    if (id) abrirReclamo(reclamos.find(r => r.id === id));
  });

  function abrirReclamo(r) {
    reclamoActual = r;
    aviso('reclamoMsg', '');
    $('tituloReclamo').textContent = `Hoja de reclamación N.° ${r.codigo}`;
    $('hojaPanel').innerHTML = HOJA.secciones(r).slice(0, 4).map(([t, filas]) =>
      `<h3>${esc(t)}</h3><dl>${filas.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`).join('');
    $('rcObs').value = r.observaciones || '';
    $('rcEstado').value = r.estado;
    $('rcFecha').value = r.fecha_respuesta || '';
    $('rcVia').textContent = r.respuesta_por === 'carta'
      ? `El consumidor pidió la respuesta por CARTA a: ${r.domicilio}. Descarga el PDF, imprímelo y envíalo.`
      : `El consumidor pidió la respuesta por CORREO a: ${r.correo}. Responder antes de: ${HOJA.fechaCorta(vence(r))}.`;
    $('rcCorreo').classList.toggle('oculto', !r.correo);
    $('rcProponer').classList.toggle('oculto', !r.correo);
    const tel = String(r.telefono || '').replace(/\D/g, '');
    const telWa = tel.length === 9 && tel.startsWith('9') ? '51' + tel : tel;
    $('rcWhatsapp').classList.toggle('oculto', telWa.length < 9);
    $('rcWhatsapp').href = `https://wa.me/${telWa}?text=${encodeURIComponent(`Hola ${r.nombre}, le escribimos de ${HOJA.EMPRESA.razonSocial} por su ${r.tipo} N.° ${r.codigo}. Queremos ayudarle a solucionarlo lo antes posible.`)}`;
    $('rcCopia').classList.toggle('oculto', !(r.correo && !r.correo_enviado));
    $('modalReclamo').classList.remove('oculto');
    $('rcObs').focus();
  }
  $('rcEstado').addEventListener('change', () => { if ($('rcEstado').value === 'respondido' && !$('rcFecha').value) $('rcFecha').value = hoyLima(); });

  function cartaRespuesta(r, observaciones) {
    const E = HOJA.EMPRESA;
    return `Señor(a) ${r.nombre}:\n\nEn atención a su ${r.tipo} registrado(a) en nuestro Libro de Reclamaciones virtual con la Hoja de Reclamación N.° ${r.codigo}, ` +
      `presentada el ${HOJA.fechaHora(r.creado_en)}, le informamos lo siguiente:\n\n${observaciones || '[Escriba aquí la respuesta]'}\n\n` +
      `Atentamente,\n${E.razonSocial}\nRUC ${E.ruc}\n${E.correo} · WhatsApp ${E.whatsapp}\n${E.web}`;
  }
  const abrirCorreo = (para, asunto, cuerpo) => { location.href = `mailto:${encodeURIComponent(para)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`; };

  $('rcCorreo').addEventListener('click', () => {
    const r = reclamoActual; if (!r || !r.correo) return;
    abrirCorreo(r.correo, `Respuesta a su Hoja de Reclamación N.° ${r.codigo} — ${HOJA.EMPRESA.razonSocial}`, cartaRespuesta(r, $('rcObs').value.trim()));
    aviso('reclamoMsg', 'Se abrió tu programa de correo. Envía el mensaje y luego marca la hoja como "Respondido" y guarda.', 'info');
  });
  // Ofrecimiento de solución no presencial (Reglamento, art. 6-A.2 b): el cliente debe aceptarlo
  // expresamente con la frase indicada; mientras tanto, el plazo se suspende hasta 5 días hábiles.
  $('rcProponer').addEventListener('click', () => {
    const r = reclamoActual; if (!r || !r.correo) return;
    const E = HOJA.EMPRESA, propuesta = $('rcObs').value.trim();
    abrirCorreo(r.correo, `Propuesta de solución a su Hoja de Reclamación N.° ${r.codigo} — ${E.razonSocial}`,
      `Señor(a) ${r.nombre}:\n\nEn atención a su ${r.tipo} registrado(a) con la Hoja de Reclamación N.° ${r.codigo}, le proponemos la siguiente solución:\n\n` +
      `${propuesta || '[Escriba aquí la solución que ofrece]'}\n\nSi está de acuerdo, por favor responda este correo con la frase: ACUERDO ACEPTADO PARA SOLUCIONAR EL RECLAMO\n\n` +
      `Si no está de acuerdo, igual le enviaremos nuestra respuesta formal dentro del plazo legal.\n\nAtentamente,\n${E.razonSocial}\nRUC ${E.ruc}\n${E.correo} · WhatsApp ${E.whatsapp}`);
    if ($('rcEstado').value === 'pendiente') $('rcEstado').value = 'en_proceso';
    aviso('reclamoMsg', 'Envía la propuesta desde tu correo y guarda la hoja como "En proceso". Si el cliente acepta, copia su respuesta en el campo de respuesta y márcala como "Respondido".', 'info');
  });
  $('rcCopiar').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(cartaRespuesta(reclamoActual, $('rcObs').value.trim())); aviso('reclamoMsg', 'Respuesta copiada: pégala en tu correo o en la carta.', 'ok'); }
    catch (_) { aviso('reclamoMsg', 'No se pudo copiar. Selecciona el texto de la respuesta y cópialo a mano.'); }
  });
  $('rcCopia').addEventListener('click', () => {
    const r = reclamoActual; if (!r || !r.correo) return;
    abrirCorreo(r.correo, `Hoja de Reclamación N.° ${r.codigo} — ${HOJA.EMPRESA.razonSocial}`,
      `Hola ${r.nombre}: esta es la copia de su Hoja de Reclamación registrada en nuestro Libro de Reclamaciones virtual.\n\n${HOJA.texto({ ...r, observaciones: null, fecha_respuesta: null })}`);
    aviso('reclamoMsg', 'Después de enviar la copia, se marcará como enviada al guardar.', 'info');
    reclamoActual._copiaManual = true;
  });
  $('rcPdf').addEventListener('click', async () => {
    const r = reclamoActual; if (!r) return;
    try { HOJA.descargar(await HOJA.pdf({ ...r, observaciones: $('rcObs').value.trim() || r.observaciones, fecha_respuesta: $('rcFecha').value || r.fecha_respuesta })); }
    catch (err) { aviso('reclamoMsg', 'No se pudo crear el PDF: ' + err.message); }
  });

  $('formReclamo').addEventListener('submit', async e => {
    e.preventDefault();
    const r = reclamoActual; if (!r) return;
    const cambios = { observaciones: $('rcObs').value.trim() || null, estado: $('rcEstado').value, fecha_respuesta: $('rcFecha').value || null };
    if (cambios.estado === 'respondido' && !cambios.observaciones) return aviso('reclamoMsg', 'Escribe la respuesta antes de marcarla como "Respondido".');
    if (cambios.estado === 'respondido' && !cambios.fecha_respuesta) return aviso('reclamoMsg', 'Indica la fecha en que comunicaste la respuesta.');
    if (r._copiaManual) { cambios.correo_enviado = true; cambios.correo_error = null; }
    ocupado('rcGuardar', true);
    const { error } = await sb.from('reclamaciones').update(cambios).eq('id', r.id);
    ocupado('rcGuardar', false);
    if (error) return aviso('reclamoMsg', RJM.errorLegible(error));
    $('modalReclamo').classList.add('oculto');
    aviso('reclamosMsg', `Hoja ${r.codigo} guardada.`, 'ok');
    cargarReclamos();
  });

  iniciar();
})();
