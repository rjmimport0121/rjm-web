// Service worker de RJM Publicar.
// - Guarda la "carcasa" de la app para que abra rápido y sin señal.
// - Siempre intenta primero la red (así ves la última versión) y usa la copia
//   guardada solo si no hay conexión.
// - Nunca guarda las llamadas a la base de datos (Supabase): pasan directo.
const VERSION = 'rjm-publicar-v2';
const CARCASA = [
  './', './index.html', './app.css', './app.js', './manifest.webmanifest', './icon-192.png',
  '../css/fuentes.css', '../fonts/inter-latin-wght-normal.woff2', '../fonts/plus-jakarta-sans-latin-wght-normal.woff2',
  '../js/config.js', '../js/comun.js', '../js/categorias.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.allSettled(CARCASA.map(u => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;                       // subidas y guardados: directo a la red
  const mismo = url.origin === self.location.origin;
  const libreria = url.href.startsWith('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/');
  if (!mismo && !libreria) return;                         // Supabase y otros: sin tocar
  e.respondWith(
    fetch(req).then(r => {
      if (r.ok && (mismo || libreria)) { const copia = r.clone(); caches.open(VERSION).then(c => c.put(req, copia)); }
      return r;
    }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});
