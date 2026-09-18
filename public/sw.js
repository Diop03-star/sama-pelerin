const CACHE = 'sama-pelerin-v1'

const PRECACHE = ['/', '/pwa-icon-192.png', '/pwa-icon-512.png', '/pwa-icon-maskable-512.png', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((cle) => cle !== CACHE).map((cle) => caches.delete(cle))))
      .then(() => self.clientsClaim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((reponse) => {
          const copie = reponse.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copie))
          return reponse
        })
        .catch(() => caches.match(request).then((cache) => cache || caches.match('/'))),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cache) => {
      if (cache) return cache
      return fetch(request).then((reponse) => {
        if (reponse.ok && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/pwa-icon-'))) {
          const copie = reponse.clone()
          caches.open(CACHE).then((c) => c.put(request, copie))
        }
        return reponse
      })
    }),
  )
})
