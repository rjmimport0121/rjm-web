// Mejoras de interactividad de la portada: buscador del catálogo, contadores,
// efectos al pasar el mouse, barra de progreso, menú activo y botón "arriba".
// Todo es opcional: si algo falla, la página sigue funcionando como antes.
(function () {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mouse = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const sinTildes = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

  // ---------- Barra de progreso, menú activo y botón arriba ----------
  const barra = document.createElement('div');
  barra.id = 'progreso';
  document.body.prepend(barra);

  const arriba = document.createElement('button');
  arriba.className = 'arriba';
  arriba.type = 'button';
  arriba.setAttribute('aria-label', 'Volver arriba');
  arriba.textContent = '↑';
  arriba.addEventListener('click', () => scrollTo({ top: 0, behavior: quieto ? 'auto' : 'smooth' }));
  document.body.append(arriba);

  let pendiente = false;
  function alDesplazar() {
    pendiente = false;
    const alto = document.documentElement.scrollHeight - innerHeight;
    barra.style.transform = `scaleX(${alto > 0 ? Math.min(1, scrollY / alto) : 0})`;
    arriba.classList.toggle('visible', scrollY > innerHeight * 0.9);
  }
  addEventListener('scroll', () => { if (!pendiente) { pendiente = true; requestAnimationFrame(alDesplazar); } }, { passive: true });
  alDesplazar();

  const enlaces = $$('.nav-links a[href^="#"]:not(.nav-cta)');
  const vigia = new IntersectionObserver(entradas => {
    entradas.forEach(e => {
      if (!e.isIntersecting) return;
      enlaces.forEach(a => a.classList.toggle('activo', a.getAttribute('href') === '#' + e.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  ['hero', 'productos', 'marcas', 'servicios', 'sobre', 'comprar', 'contacto'].forEach(id => { const s = document.getElementById(id); if (s) vigia.observe(s); });

  // ---------- Contadores animados (300+, 24h, 100%...) ----------
  function contar(el) {
    const m = el.textContent.trim().match(/^(\d+)(.*)$/);
    if (!m || quieto) return;
    const fin = +m[1], resto = m[2], t0 = performance.now(), dur = 1400;
    const paso = t => {
      const p = Math.min(1, (t - t0) / dur), suave = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(fin * suave) + resto;
      if (p < 1) requestAnimationFrame(paso);
    };
    el.textContent = '0' + resto;
    requestAnimationFrame(paso);
  }
  const vigiaNum = new IntersectionObserver(entradas => {
    entradas.forEach(e => { if (e.isIntersecting) { contar(e.target); vigiaNum.unobserve(e.target); } });
  }, { threshold: 0.6 });
  $$('.stat-n, .metric-val').forEach(el => vigiaNum.observe(el));

  // ---------- Hero: luz que sigue al mouse e indicador de scroll ----------
  const hero = $('#hero');
  if (hero) {
    const ind = document.createElement('a');
    ind.href = '#productos'; ind.className = 'hero-scroll'; ind.setAttribute('aria-label', 'Bajar al catálogo');
    hero.append(ind);
    if (mouse && !quieto) hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect();
      hero.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
      hero.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
    });
  }

  // ---------- Tarjetas: inclinación 3D, brillo y aparición escalonada ----------
  const vigiaTarjetas = new IntersectionObserver(entradas => {
    entradas.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); vigiaTarjetas.unobserve(e.target); } });
  }, { threshold: 0.1 });

  function prepararTarjeta(card) {
    if (card.dataset.listo) return;
    card.dataset.listo = '1';
    if (!quieto) {
      const hermanos = [...card.parentNode.children];
      card.style.setProperty('--d', (hermanos.indexOf(card) % 5) * 0.07 + 's');
      card.classList.add('entra');
      vigiaTarjetas.observe(card);
    }
    if (!mouse || quieto) return;
    const brillo = document.createElement('span');
    brillo.className = 'brillo';
    card.append(brillo);
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.style.setProperty('--gx', x * 100 + '%');
      card.style.setProperty('--gy', y * 100 + '%');
      card.style.transform = `translateY(-4px) rotateX(${(0.5 - y) * 6}deg) rotateY(${(x - 0.5) * 8}deg)`;
    });
    card.addEventListener('pointerleave', () => { card.style.transform = ''; });
  }
  function prepararTodas(raiz) { (raiz || document).querySelectorAll('.product-card').forEach(prepararTarjeta); }
  prepararTodas();

  if (mouse && !quieto) $$('.service-card').forEach(c => c.addEventListener('pointermove', e => {
    const r = c.getBoundingClientRect();
    c.style.setProperty('--gx', (e.clientX - r.left) + 'px');
    c.style.setProperty('--gy', (e.clientY - r.top) + 'px');
  }));

  // ---------- Buscador y filtros del catálogo ----------
  const productos = $('#productos .container');
  const cabecera = productos && productos.querySelector('.products-header');
  const secciones = () => $$('#productos .cat-section');
  const tituloDe = sec => sec.querySelector('.cat-section-title')?.textContent.trim() || '';

  if (cabecera) {
    const grupos = secciones().filter(s => s.id !== 'catalogoDinamico').map(tituloDe);
    const corto = t => t.replace('Accesorios para Guitarra', 'Accesorios').replace('Componentes Electrónicos', 'Electrónica').replace('Materiales de Luthiería', 'Luthiería');
    cabecera.insertAdjacentHTML('afterend', `
      <div class="buscador" role="search">
        <div class="buscador-caja">
          <input type="search" id="buscar" placeholder="Buscar: cuerdas, preamp, trastes…" aria-label="Buscar productos" autocomplete="off"/>
          <button type="button" class="buscador-limpiar" aria-label="Borrar búsqueda">✕</button>
        </div>
        <div class="chips" role="group" aria-label="Filtrar por grupo">
          <button type="button" class="chip activo" data-grupo="">Todos</button>
          ${grupos.map(g => `<button type="button" class="chip" data-grupo="${g.replace(/"/g, '&quot;')}">${corto(g)}</button>`).join('')}
        </div>
        <div class="buscador-info" id="buscarInfo" aria-live="polite"></div>
      </div>
      <div class="sin-resultados" id="sinResultados">
        <p>No encontramos <strong id="sinTexto"></strong> en el catálogo, pero puede que lo tengamos o lo importemos.</p>
        <a class="btn btn-primary" id="sinWa" target="_blank" rel="noopener">💬 Preguntar por WhatsApp</a>
      </div>`);

    const input = $('#buscar'), caja = input.parentNode, info = $('#buscarInfo');
    let grupo = '';

    function filtrar() {
      const q = sinTildes(input.value);
      const palabras = q.split(/\s+/).filter(Boolean);
      caja.classList.toggle('con-texto', !!q);
      let total = 0;
      secciones().forEach(sec => {
        if (sec.id === 'catalogoDinamico' && sec.hidden) return;
        const enGrupo = !grupo || tituloDe(sec) === grupo || (sec.id === 'catalogoDinamico' && !!q);
        let visibles = 0;
        sec.querySelectorAll('.product-card').forEach(card => {
          const texto = sinTildes(card.textContent + ' ' + (card.dataset.buscar || ''));
          const ok = enGrupo && palabras.every(p => texto.includes(p));
          card.classList.toggle('oculto', !ok);
          if (ok) visibles++;
        });
        sec.classList.toggle('oculto', visibles === 0);
        if (sec.id !== 'catalogoDinamico') total += visibles;
        else if (q) total += visibles;
      });
      const vacio = total === 0;
      $('#sinResultados').classList.toggle('visible', vacio);
      if (vacio) {
        $('#sinTexto').textContent = '"' + input.value.trim() + '"';
        $('#sinWa').href = 'https://wa.me/' + ((window.RJM_CONFIG && RJM_CONFIG.WHATSAPP) || '51956543522') +
          '?text=' + encodeURIComponent('Hola RJM! Busco: ' + input.value.trim() + '. ¿Lo tienen?');
      }
      info.textContent = (q || grupo) ? (vacio ? '' : `${total} resultado${total === 1 ? '' : 's'}`) : '';
    }

    let espera;
    input.addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(filtrar, 120); });
    caja.querySelector('.buscador-limpiar').addEventListener('click', () => { input.value = ''; filtrar(); input.focus(); });
    $$('.chip').forEach(ch => ch.addEventListener('click', () => {
      grupo = ch.dataset.grupo;
      $$('.chip').forEach(c => c.classList.toggle('activo', c === ch));
      filtrar();
      const y = $('.buscador').getBoundingClientRect().top + scrollY - 70;
      if (scrollY > y + 10) scrollTo({ top: y, behavior: quieto ? 'auto' : 'smooth' });
    }));

    // El catálogo con precios llega después desde Supabase: volver a preparar y filtrar.
    document.addEventListener('rjm:catalogo', () => { prepararTodas($('#productos')); filtrar(); });
  }

  // ---------- Ventanas: bloquear el scroll de fondo mientras están abiertas ----------
  const modales = $$('.lmodal-fondo, .pmodal-fondo');
  const revisar = () => document.body.classList.toggle('sin-scroll', modales.some(m => m.classList.contains('abierto')));
  modales.forEach(m => new MutationObserver(() => { revisar(); prepararTodas(m); }).observe(m, { attributes: true, attributeFilter: ['class'] }));

  // ---------- WhatsApp: saludo breve y aviso al enviar el formulario ----------
  const wa = $('.wa-float');
  if (wa && !quieto) setTimeout(() => { wa.classList.add('saluda'); setTimeout(() => wa.classList.remove('saluda'), 4000); }, 6000);

  const aviso = document.createElement('div');
  aviso.className = 'aviso'; aviso.setAttribute('role', 'status');
  document.body.append(aviso);
  window.RJM_AVISO = texto => {
    aviso.textContent = texto; aviso.classList.add('visible');
    clearTimeout(aviso._t); aviso._t = setTimeout(() => aviso.classList.remove('visible'), 2800);
  };
  document.querySelector('#contacto form')?.addEventListener('submit', () => window.RJM_AVISO('Abriendo WhatsApp con tu consulta…'));
})();
