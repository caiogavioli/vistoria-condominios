/* Service worker mínimo: mantém o app utilizável sem rede (subsolo, garagem). */
const CACHE = 'vistorias-v1'
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg']

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (evento) => {
  const requisicao = evento.request
  if (requisicao.method !== 'GET' || new URL(requisicao.url).origin !== self.location.origin) return

  // Navegação: rede primeiro, com o index.html em cache como reserva offline.
  if (requisicao.mode === 'navigate') {
    evento.respondWith(
      fetch(requisicao)
        .then((resposta) => {
          const copia = resposta.clone()
          caches.open(CACHE).then((cache) => cache.put('./index.html', copia))
          return resposta
        })
        .catch(() => caches.match('./index.html').then((r) => r ?? Response.error())),
    )
    return
  }

  // Demais recursos (JS/CSS com hash no nome): cache primeiro.
  evento.respondWith(
    caches.match(requisicao).then((emCache) => {
      if (emCache) return emCache
      return fetch(requisicao).then((resposta) => {
        if (resposta.ok && resposta.type === 'basic') {
          const copia = resposta.clone()
          caches.open(CACHE).then((cache) => cache.put(requisicao, copia))
        }
        return resposta
      })
    }),
  )
})
