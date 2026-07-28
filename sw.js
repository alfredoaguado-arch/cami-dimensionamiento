/* CAMI · Dimensionamiento en campo — Service Worker mínimo (app shell).
 *
 * Estrategia: cache-first SOLO para el app shell del MISMO ORIGEN.
 * TODO lo que no sea same-origin (en particular script.google.com, el endpoint
 * QC-03: listaProyectos / listaItemsPorProyecto) se deja pasar a la RED sin
 * interceptar — el catálogo debe jalarse fresco; la app ya lo cachea en
 * localStorage. Bump CACHE_NAME en cada release para invalidar el shell viejo.
 */
const CACHE_NAME = 'cami-dim-v3';
const SCOPE_PATH = '/cami-dimensionamiento/';
const SHELL = [
  SCOPE_PATH,
  SCOPE_PATH + 'index.html',
  SCOPE_PATH + 'manifest.json',
  SCOPE_PATH + 'icon.svg',
  SCOPE_PATH + 'icon-192.png',
  SCOPE_PATH + 'icon-512.png',
  SCOPE_PATH + 'icon-192-maskable.png',
  SCOPE_PATH + 'icon-512-maskable.png',
  SCOPE_PATH + 'apple-touch-icon-180.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Solo tocamos GET del MISMO origen. Cross-origin (fuentes Google, y sobre
  // todo script.google.com del endpoint QC-03) pasa directo a la red: el SW ni
  // lo intercepta, así el catálogo siempre llega fresco.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // App shell: cache-first, con relleno del caché en segundo plano.
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(SCOPE_PATH + 'index.html'));
    })
  );
});
