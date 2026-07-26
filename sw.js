const CACHE_NAME = 'hr-os-1785049829215'; // build.js replaces this with hr-os-<timestamp>

const APP_SHELL = [
  '/FCA---web/',
  '/FCA---web/index.html',
  '/FCA---web/js/app.js',
];

// Install: cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        APP_SHELL.map((url) => cache.add(url).catch(() => {}))
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate: delete old caches, claim clients, then reload them so they
// immediately get fresh content from the new SW (bypasses stale HTTP cache).
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .then((clients) => {
        // Navigate each open tab to itself so new SW serves fresh content.
        clients.forEach((client) => {
          client.navigate(client.url).catch(() => {});
        });
      })
  );
});

// Fetch strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  const ext = url.pathname.split('.').pop().toLowerCase();
  const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'ico'].includes(ext);
  const isFont = ['woff', 'woff2', 'ttf', 'otf'].includes(ext);

  // Cache-first for images and fonts (truly immutable assets)
  if (isImage || isFont) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached || fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
      )
    );
    return;
  }

  // Navigation (index.html): always bypass HTTP cache so iOS Safari never
  // serves a stale page even when max-age has not expired yet.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(new Request(request, { cache: 'no-cache' })).catch(() =>
        caches.match('/FCA---web/index.html')
      )
    );
    return;
  }

  // JS / HTML: bypass HTTP cache so code changes are picked up immediately.
  if (['js', 'html'].includes(ext) || request.destination === 'script') {
    event.respondWith(
      fetch(new Request(request, { cache: 'no-cache' }))
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Default: network-first with cache fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
