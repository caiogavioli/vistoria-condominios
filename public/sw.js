/* Service worker mínimo: mantém o app utilizável sem rede (subsolo, garagem). */

/*
 * O nome do cache é versionado de propósito.
 *
 * O `activate` apaga todo cache com nome diferente do atual, então trocar este
 * número é o que expulsa o conteúdo antigo do aparelho. Sem a troca, um app
 * atualizado no servidor podia continuar sendo servido da versão velha no
 * celular por tempo indefinido — e um app velho é indistinguível de um app com
 * defeito para quem olha a tela.
 */
const CACHE = 'vistorias-v2'
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
  //
  // `cache: 'no-store'` pula o cache HTTP do navegador. O index.html é quem
  // aponta para o JS com hash no nome; se ele vier velho, o app inteiro fica
  // velho, mesmo com o servidor já atualizado.
  if (requisicao.mode === 'navigate') {
    evento.respondWith(
      fetch(requisicao, { cache: 'no-store' })
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
