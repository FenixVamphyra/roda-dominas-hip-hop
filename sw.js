/* Service worker complementar: preserva o HTML do aplicativo e melhora atualização/offline. */
const CACHE_NAME = 'roda-dominas-pwa-v5';
const SCOPE_URL = self.registration.scope;
const APP_URL = new URL('index.html', SCOPE_URL).href;
const ROOT_URL = new URL('./', SCOPE_URL).href;
const CORE = [
  ROOT_URL,
  APP_URL,
  new URL('projecao.html', SCOPE_URL).href,
  new URL('manifest.webmanifest', SCOPE_URL).href,
  new URL('icon-192.png', SCOPE_URL).href,
  new URL('icon-512.png', SCOPE_URL).href
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith('roda-dominas-pwa-') && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navegação: tenta entregar a versão atualizada e usa o HTML guardado se estiver offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      }).catch(async () => {
        return (await caches.match(request)) ||
          (await caches.match(APP_URL)) ||
          (await caches.match(ROOT_URL)) ||
          new Response('O aplicativo ainda não foi armazenado neste dispositivo. Conecte-se à internet e abra-o uma vez.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
      })
    );
    return;
  }

  // Arquivos locais: cache primeiro, com atualização em segundo plano quando online.
  if (url.origin === self.location.origin && url.href.startsWith(SCOPE_URL)) {
    event.respondWith(
      caches.match(request).then(cached => {
        const update = fetch(request).then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        }).catch(() => null);
        return cached || update.then(response => response || caches.match(APP_URL));
      })
    );
  }
});
