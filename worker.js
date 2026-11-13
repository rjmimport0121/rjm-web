// Worker de Cloudflare para que Google y las redes vean cada producto.
//
// La tienda (index.html) es estática y abre las fichas dentro de la misma
// página (#producto=…), algo que los buscadores no indexan. Cloudflare sirve
// directo los archivos del repositorio y solo llama a este Worker cuando la
// dirección no es un archivo. Atiende dos rutas; el resto responde 404:
//
//   /producto/<nombre>/<id>  Página propia del producto, generada al momento
//                            con los datos de Supabase: título, precio, foto,
//                            datos estructurados (schema.org/Product) y vista
//                            previa para WhatsApp/Facebook.
//   /sitemap.xml             Lista de páginas para Google, siempre al día con
//                            lo publicado desde el panel o la app.
//
// Lee solo productos publicados, con la clave pública "anon" (las reglas RLS de
// supabase/schema.sql ya limitan qué puede ver). Nunca uses aquí la service_role.

const SITIO = 'https://www.rjmimport.com';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CAMPOS = 'id,sku,nombre,categoria,marca,descripcion,caracteristicas,precio,moneda,precio_incluye_igv,foto_url,destacado,actualizado_en';
const CACHE_SEG = 300;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method !== 'GET' && request.method !== 'HEAD') return env.ASSETS.fetch(request);
    try {
      if (url.pathname === '/sitemap.xml') return await conCache(request, ctx, () => sitemap(env));
      if (url.pathname.startsWith('/producto/')) return await conCache(request, ctx, () => paginaProducto(url, env));
    } catch (err) {
      console.error(err);
      return errorTemporal();
    }
    return env.ASSETS.fetch(request);
  }
};

// ---------- Utilidades ----------
export function slug(texto) {
  const s = String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/&/g, ' y ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');
  return s || 'producto';
}
export const rutaProducto = p => `/producto/${slug(p.nombre)}/${p.id}`;
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const xml = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
export function dinero(n, moneda) {
  const [ent, dec] = Number(n).toFixed(2).split('.');
  return (moneda === 'USD' ? 'US$ ' : 'S/ ') + ent.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + dec;
}
function recortar(texto, max) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const corte = t.slice(0, max - 1);
  return corte.slice(0, Math.max(corte.lastIndexOf(' '), max - 20)).replace(/[\s,.;:]+$/, '') + '…';
}
// JSON dentro de <script>: evita que un texto cierre la etiqueta.
const jsonLd = obj => JSON.stringify(obj).replace(/</g, '\\u003c');

async function supabase(env, consulta) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${consulta}`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`, Accept: 'application/json' }
  });
  if (!r.ok) throw new Error(`Supabase respondió ${r.status} a ${consulta.split('?')[0]}`);
  return r.json();
}

async function conCache(request, ctx, generar) {
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const clave = new Request(new URL(request.url).toString(), { method: 'GET' });
  const guardada = cache && await cache.match(clave);
  if (guardada) return request.method === 'HEAD' ? new Response(null, guardada) : guardada;
  const resp = await generar();
  if (cache && resp.status === 200) ctx.waitUntil(cache.put(clave, resp.clone()));
  return request.method === 'HEAD' ? new Response(null, resp) : resp;
}

const cabeceras = tipo => ({
  'Content-Type': tipo,
  'Cache-Control': `public, max-age=${CACHE_SEG}`,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
});

function errorTemporal() {
  return new Response(pagina({
    titulo: 'Volvemos en un momento | RJM Import-Export', descripcion: '', canonica: SITIO + '/', robots: 'noindex',
    cuerpo: `<main class="aviso"><h1>No pudimos cargar este producto</h1><p>Intenta de nuevo en unos segundos o mira el catálogo completo.</p><a class="btn btn-naranja" href="/#catalogo">Ver el catálogo</a></main>`
  }), { status: 503, headers: { ...cabeceras('text/html; charset=utf-8'), 'Cache-Control': 'no-store', 'Retry-After': '60' } });
}

// ---------- /sitemap.xml ----------
async function sitemap(env) {
  const productos = await supabase(env, `productos?select=id,nombre,actualizado_en&publicado=eq.true&order=actualizado_en.desc&limit=5000`);
  const ultima = productos[0] ? productos[0].actualizado_en.slice(0, 10) : null;
  const urls = [
    { loc: SITIO + '/', lastmod: ultima },
    { loc: SITIO + '/libro-reclamaciones.html' },
    ...productos.map(p => ({ loc: SITIO + rutaProducto(p), lastmod: String(p.actualizado_en || '').slice(0, 10) || null }))
  ];
  const cuerpo = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls.map(u => `  <url><loc>${xml(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')
    + '\n</urlset>\n';
  return new Response(cuerpo, { headers: cabeceras('application/xml; charset=utf-8') });
}

// ---------- /producto/<nombre>/<id> ----------
async function paginaProducto(url, env) {
  const partes = url.pathname.split('/').filter(Boolean); // ['producto', nombre?, id]
  const id = partes[partes.length - 1];
  if (!UUID.test(id) || partes.length > 3) return noEncontrado();

  const [p] = await supabase(env, `productos?select=${CAMPOS}&id=eq.${id}&publicado=eq.true&limit=1`);
  if (!p) return noEncontrado();

  // Una sola dirección por producto: si el nombre cambió, redirige a la nueva.
  const canonica = rutaProducto(p);
  if (url.pathname !== canonica) return Response.redirect(SITIO + canonica, 301);

  const relacionados = await supabase(env,
    `productos?select=id,nombre,marca,precio,moneda,foto_url&publicado=eq.true&categoria=eq.${encodeURIComponent(p.categoria)}&id=neq.${p.id}&order=destacado.desc,orden.asc,nombre.asc&limit=4`
  ).catch(() => []);

  return new Response(htmlProducto(p, relacionados, env), { headers: cabeceras('text/html; charset=utf-8') });
}

function noEncontrado() {
  return new Response(pagina({
    titulo: 'Producto no disponible | RJM Import-Export', descripcion: '', canonica: SITIO + '/', robots: 'noindex',
    cuerpo: `<main class="aviso"><h1>Este producto ya no está disponible</h1><p>Puede que lo hayamos retirado del catálogo. Mira lo que tenemos ahora o escríbenos por WhatsApp.</p><a class="btn btn-naranja" href="/#catalogo">Ver el catálogo</a></main>`
  }), { status: 404, headers: { ...cabeceras('text/html; charset=utf-8'), 'Cache-Control': 'public, max-age=60' } });
}

export function htmlProducto(p, relacionados, env) {
  const WA = (env && env.WHATSAPP) || '51956543522';
  const url = SITIO + rutaProducto(p);
  const conPrecio = p.precio != null;
  const precioTxt = conPrecio ? dinero(p.precio, p.moneda) : 'Precio a consultar';
  const igvTxt = conPrecio ? (p.precio_incluye_igv === false ? '+ IGV' : 'IGV incluido') : '';
  const carac = (p.caracteristicas || []).filter(Boolean);
  const titulo = recortar(`${p.nombre}${p.marca && !p.nombre.toLowerCase().includes(p.marca.toLowerCase()) ? ' ' + p.marca : ''}`, 58) + ' | RJM';
  const descripcion = recortar(p.descripcion
    ? `${p.descripcion} ${conPrecio ? precioTxt + ' ' + igvTxt + '.' : ''} Envíos a todo el Perú.`
    : `Compra ${p.nombre}${p.marca ? ' de ' + p.marca : ''} en RJM Import-Export${conPrecio ? ' a ' + precioTxt + ' (' + igvTxt + ')' : ''}. ${p.categoria}. Envíos a todo el Perú por agencia Shalom.`, 158);

  let msj = `Hola RJM! Quiero comprar este producto:\n\n*${p.nombre}*`;
  if (p.sku) msj += `\nCódigo: ${p.sku}`;
  if (conPrecio) msj += `\nPrecio: ${precioTxt}${p.precio_incluye_igv === false ? '' : ' (IGV incluido)'}`;
  msj += `\n\nVer producto: ${url}\n\n¿Tienen disponibilidad?`;
  const wa = `https://wa.me/${WA}?text=${encodeURIComponent(msj)}`;

  // Datos para Google (schema.org). Solo lo que consta en el catálogo:
  // no se declara stock ni estado porque el catálogo no los registra.
  // Sin precio no se envía Product: Google lo exige (offers) y marcaría error.
  const producto = {
    '@context': 'https://schema.org', '@type': 'Product',
    name: p.nombre, url, category: p.categoria,
    ...(p.foto_url && { image: [p.foto_url] }),
    ...(p.descripcion && { description: p.descripcion }),
    ...(p.sku && { sku: p.sku }),
    ...(p.marca && { brand: { '@type': 'Brand', name: p.marca } }),
    ...(conPrecio && {
      offers: {
        '@type': 'Offer', url, price: Number(p.precio).toFixed(2), priceCurrency: p.moneda === 'USD' ? 'USD' : 'PEN',
        seller: { '@type': 'Organization', name: 'RJM Import-Export EIRL' }
      }
    })
  };
  const migas = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Tienda', item: SITIO + '/' },
      { '@type': 'ListItem', position: 2, name: p.nombre, item: url }
    ]
  };

  const foto = p.foto_url
    ? `<img src="${esc(p.foto_url)}" alt="${esc(p.nombre)}" width="800" height="800" fetchpriority="high"/>`
    : `<div class="sinfoto">${esc(p.categoria || 'RJM Import-Export')}</div>`;

  const otros = relacionados && relacionados.length ? `
    <section class="otros" aria-labelledby="tOtros">
      <h2 id="tOtros">Más en ${esc(p.categoria)}</h2>
      <ul>${relacionados.map(r => `
        <li><a href="${esc(rutaProducto(r))}">
          <span class="o-img">${r.foto_url ? `<img src="${esc(r.foto_url)}" alt="" width="300" height="300" loading="lazy"/>` : `<span class="o-sin" aria-hidden="true">RJM</span>`}</span>
          <span class="o-marca">${esc(r.marca || '')}</span>
          <b>${esc(r.nombre)}</b>
          <span class="o-precio">${r.precio != null ? dinero(r.precio, r.moneda) : 'Precio a consultar'}</span>
        </a></li>`).join('')}
      </ul>
    </section>` : '';

  const cuerpo = `
  <main class="cont">
    <nav class="migas" aria-label="Ruta"><a href="/">Tienda</a><span aria-hidden="true">›</span><a href="/#catalogo">${esc(p.categoria)}</a></nav>
    <article class="prod">
      <div class="prod-img">${foto}</div>
      <div class="prod-info">
        ${p.marca ? `<p class="marca">${esc(p.marca)}</p>` : ''}
        <h1>${esc(p.nombre)}</h1>
        ${p.sku ? `<p class="meta">Código: <b>${esc(p.sku)}</b></p>` : ''}
        <p class="precio${conPrecio ? '' : ' consultar'}">${esc(precioTxt)}${igvTxt ? ` <small>${igvTxt}</small>` : ''}</p>
        <div class="acciones">
          <a class="btn btn-naranja" href="/#producto=${esc(p.id)}">Agregar al carrito</a>
          <a class="btn btn-wa" href="${esc(wa)}" target="_blank" rel="noopener">Pedir por WhatsApp</a>
        </div>
        <ul class="sellos">
          <li><b>Envíos a todo el Perú</b> por agencia Shalom</li>
          <li><b>Empresa formal</b> · RUC 20610045171</li>
        </ul>
        ${p.descripcion ? `<h2>Descripción</h2><p class="desc">${esc(p.descripcion)}</p>` : ''}
        ${carac.length ? `<h2>Características</h2><ul class="carac">${carac.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
      </div>
    </article>
    ${otros}
  </main>`;

  return pagina({
    titulo, descripcion, canonica: url, robots: 'index, follow',
    og: { tipo: 'product', imagen: p.foto_url, titulo: p.nombre, precio: conPrecio ? Number(p.precio).toFixed(2) : null, moneda: p.moneda === 'USD' ? 'USD' : 'PEN' },
    jsonld: conPrecio ? [producto, migas] : [migas], cuerpo
  });
}

// ---------- Plantilla común ----------
function pagina({ titulo, descripcion, canonica, robots, og, jsonld = [], cuerpo }) {
  const ogTags = og ? `
<meta property="og:type" content="${og.tipo}"/>
<meta property="og:locale" content="es_PE"/>
<meta property="og:site_name" content="RJM Import-Export"/>
<meta property="og:title" content="${esc(og.titulo)}"/>
<meta property="og:description" content="${esc(descripcion)}"/>
<meta property="og:url" content="${esc(canonica)}"/>
<meta property="og:image" content="${esc(og.imagen || SITIO + '/img/og-rjm.jpg')}"/>
${og.precio ? `<meta property="product:price:amount" content="${og.precio}"/>\n<meta property="product:price:currency" content="${og.moneda}"/>` : ''}
<meta name="twitter:card" content="${og.imagen ? 'summary_large_image' : 'summary'}"/>` : '';
  return `<!DOCTYPE html>
<html lang="es-PE">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"/>
<title>${esc(titulo)}</title>
${descripcion ? `<meta name="description" content="${esc(descripcion)}"/>` : ''}
<meta name="robots" content="${robots}"/>
<link rel="canonical" href="${esc(canonica)}"/>
<meta name="theme-color" content="#0b2545"/>
<link rel="icon" type="image/png" sizes="32x32" href="/img/favicon-32.png"/>
<link rel="apple-touch-icon" href="/img/apple-touch-icon.png"/>${ogTags}
${jsonld.map(o => `<script type="application/ld+json">${jsonLd(o)}</script>`).join('\n')}
<link rel="stylesheet" href="/css/fuentes.css"/>
<style>${CSS}</style>
</head>
<body>
<header class="cab"><div class="cab-in">
  <a class="logo" href="/"><img src="/img/logo-96.png" alt="" width="40" height="40"/><span>RJM<b>Import-Export</b></span></a>
  <a class="volver" href="/#catalogo"><span class="solo-pc">Ver todo el catálogo</span><span class="solo-movil">Catálogo</span></a>
</div></header>
${cuerpo}
<footer class="pie"><div class="pie-in">
  <span>© RJM Import-Export E.I.R.L. · RUC 20610045171 · Huamanga, Ayacucho</span>
  <a href="/libro-reclamaciones.html">Libro de Reclamaciones</a>
</div></footer>
</body>
</html>`;
}

const CSS = `
:root{--fondo:#f4f5f7;--blanco:#fff;--tinta:#0f172a;--tinta-2:#334155;--tenue:#566173;--linea:#e3e7ee;--marino:#0b2545;--naranja-txt:#c2410c;--verde:#15803d;
--grad:linear-gradient(135deg,#e2560b 0%,#f59e0b 60%,#fbbf24 100%);--sobre-naranja:#1c0d02;--r:12px;--r-l:16px;
--f-tit:'Plus Jakarta Sans',ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;--f-txt:'Inter',ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--fondo);color:var(--tinta);font:16px/1.6 var(--f-txt)}
a{color:inherit}img{max-width:100%;height:auto;display:block}
h1,h2{font-family:var(--f-tit);line-height:1.2;text-wrap:balance}
.cab{background:var(--marino);color:#fff}.cab-in,.pie-in,.cont{max-width:1180px;margin:0 auto;padding:0 16px}
.cab-in{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:64px}
.logo{display:flex;align-items:center;gap:10px;text-decoration:none;font:800 18px var(--f-tit)}.logo b{font-weight:600;margin-left:4px;opacity:.85}
.volver{white-space:nowrap;font-size:14px;font-weight:600;text-decoration:none;border:1px solid rgba(255,255,255,.35);border-radius:999px;padding:8px 14px}
.volver:hover{background:rgba(255,255,255,.1)}.solo-movil{display:none}
@media(max-width:479px){.solo-pc{display:none}.solo-movil{display:inline}.logo{font-size:16px}}
.migas{display:flex;gap:8px;flex-wrap:wrap;font-size:14px;color:var(--tenue);margin:20px 0}.migas a{text-decoration:none}.migas a:hover{text-decoration:underline}
.prod{display:grid;gap:24px;background:var(--blanco);border:1px solid var(--linea);border-radius:var(--r-l);padding:16px}
@media(min-width:820px){.prod{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:40px;padding:28px}}
.prod-img{border-radius:var(--r);overflow:hidden;background:#fff;border:1px solid var(--linea);aspect-ratio:1;display:grid;place-items:center}
.prod-img img{width:100%;height:100%;object-fit:contain}
.sinfoto{font:700 18px var(--f-tit);color:var(--tenue);padding:24px;text-align:center}
.marca{margin:0;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--naranja-txt)}
.prod-info h1{font-size:clamp(24px,4vw,34px);margin:6px 0 8px}
.meta{margin:0 0 8px;color:var(--tenue);font-size:14px}
.precio{font:800 30px var(--f-tit);margin:12px 0;font-variant-numeric:tabular-nums}.precio small{font:600 14px var(--f-txt);color:var(--verde)}
.precio.consultar{font-size:22px;color:var(--tinta-2)}
.acciones{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 22px;border-radius:999px;font-weight:700;text-decoration:none;flex:1 1 200px}
.btn-naranja{background:var(--grad);color:var(--sobre-naranja)}.btn-wa{background:#15803d;color:#fff}
.btn:hover{filter:brightness(.96)}.btn:focus-visible,a:focus-visible{outline:3px solid #1d4ed8;outline-offset:2px}
.sellos{list-style:none;padding:12px 14px;margin:0 0 8px;background:var(--fondo);border-radius:var(--r);font-size:14px;color:var(--tinta-2);display:grid;gap:4px}
.prod-info h2{font-size:18px;margin:22px 0 6px}.desc{margin:0;white-space:pre-line;color:var(--tinta-2)}
.carac{margin:0;padding-left:20px;color:var(--tinta-2)}.carac li{margin:4px 0}
.otros{margin:32px 0}.otros h2{font-size:22px}
.otros ul{list-style:none;padding:0;margin:0;display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(160px,1fr))}
.otros a{display:flex;flex-direction:column;gap:4px;height:100%;background:var(--blanco);border:1px solid var(--linea);border-radius:var(--r);padding:10px;text-decoration:none}
.otros a:hover{border-color:#cfd6e1;box-shadow:0 10px 24px -8px rgba(15,23,42,.16)}
.o-sin{font:800 22px var(--f-tit);color:var(--tenue)}
.o-img{aspect-ratio:1;display:grid;place-items:center;background:var(--fondo);border-radius:8px;overflow:hidden}.o-img img{width:100%;height:100%;object-fit:contain}
.o-marca{font-size:12px;color:var(--tenue)}.otros b{font-size:14px;line-height:1.35}.o-precio{font-weight:700;font-variant-numeric:tabular-nums}
.aviso{max-width:640px;margin:48px auto;padding:0 16px;text-align:center}.aviso .btn{display:inline-flex;flex:none}
.pie{border-top:1px solid var(--linea);background:var(--blanco);margin-top:40px}
.pie-in{display:flex;flex-wrap:wrap;gap:8px 20px;justify-content:space-between;padding-top:18px;padding-bottom:18px;font-size:14px;color:var(--tenue)}
`;
