/**
 * Três aparelhos, um servidor.
 *
 * Cada contexto do navegador tem IndexedDB próprio, então são três aparelhos
 * de verdade — não três abas compartilhando o mesmo banco local. O app roda na
 * porta 3200 e a API na 3201, como em produção (Pages + Vercel), então o CORS
 * também é exercitado.
 */
import { chromium } from 'playwright'

const APP = 'http://localhost:3200'
const ok = []
const falhas = []
const checa = (n, c, extra = '') => {
  ;(c ? ok : falhas).push(`${n}${extra ? ' :: ' + extra : ''}`)
  console.log(`${c ? '✓' : '✗'} ${n}${extra ? '  (' + extra + ')' : ''}`)
}

const navegador = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

async function aparelho(nome) {
  const ctx = await navegador.newContext({ viewport: { width: 420, height: 900 } })
  const pagina = await ctx.newPage()
  pagina.on('pageerror', (e) => falhas.push(`ERRO JS em ${nome}: ${e.message}`))
  await pagina.goto(APP)
  await pagina.waitForLoadState('networkidle')
  return { nome, ctx, pagina }
}

/** Espera a sincronização automática terminar e devolve o estado local. */
async function sincronizar(ap) {
  await ap.pagina.goto(APP)
  await ap.pagina.waitForLoadState('networkidle')
  await ap.pagina.waitForTimeout(2500)
  return estado(ap)
}

async function estado(ap) {
  return ap.pagina.evaluate(async () => {
    const abrir = () =>
      new Promise((res, rej) => {
        const r = indexedDB.open('vistorias-condominios')
        r.onsuccess = () => res(r.result)
        r.onerror = () => rej(r.error)
      })
    const bd = await abrir()
    const ler = (loja) =>
      new Promise((res, rej) => {
        const t = bd.transaction(loja, 'readonly').objectStore(loja).getAll()
        t.onsuccess = () => res(t.result)
        t.onerror = () => rej(t.error)
      })
    const [condominios, vistorias, fotos, excluidos] = await Promise.all([
      ler('condominios'),
      ler('vistorias'),
      ler('fotos'),
      ler('excluidos'),
    ])
    return {
      condominios: condominios.map((c) => ({ id: c.id, nome: c.nome, _pendente: c._pendente })),
      vistorias: vistorias.map((v) => ({
        id: v.id,
        condominioNome: v.condominioNome,
        observacoesGerais: v.observacoesGerais,
        responsavel: v.responsavel,
        _pendente: v._pendente,
      })),
      fotos: fotos.map((f) => ({ id: f.id, temBlob: !!f.blob, tamanho: f.blob?.size ?? 0 })),
      excluidos: excluidos.length,
    }
  })
}

/** Escreve direto no IndexedDB, como o app faz — mas sem depender da UI. */
async function criarVistoria(ap, { condominioNome, observacoes, responsavel }) {
  return ap.pagina.evaluate(
    async ({ condominioNome, observacoes, responsavel }) => {
      const abrir = () =>
        new Promise((res, rej) => {
          const r = indexedDB.open('vistorias-condominios')
          r.onsuccess = () => res(r.result)
          r.onerror = () => rej(r.error)
        })
      const bd = await abrir()
      const gravar = (loja, valor) =>
        new Promise((res, rej) => {
          const t = bd.transaction(loja, 'readwrite').objectStore(loja).put(valor)
          t.onsuccess = () => res(t.result)
          t.onerror = () => rej(t.error)
        })

      const agora = new Date().toISOString()
      const condId = 'cond_' + crypto.randomUUID()
      const vistId = 'vist_' + crypto.randomUUID()
      const areaId = 'av_' + crypto.randomUUID()

      await gravar('condominios', {
        id: condId,
        nome: condominioNome,
        endereco: 'Rua de Teste, 100',
        vistoriador: responsavel,
        areasPadrao: [{ id: 'a1', nome: 'Recepção e Portaria', icone: '🏢', fotoObrigatoria: true }],
        criadoEm: agora,
        atualizadoEm: agora,
        _pendente: 1,
      })
      await gravar('vistorias', {
        id: vistId,
        condominioId: condId,
        condominioNome,
        endereco: 'Rua de Teste, 100',
        data: agora.slice(0, 10),
        responsavel,
        status: 'em_andamento',
        areas: [
          {
            id: areaId,
            nome: 'Recepção e Portaria',
            icone: '🏢',
            fotoObrigatoria: true,
            nota: 8,
            naoAplicavel: false,
            observacoes: 'Piso limpo.',
            fotoIds: [],
          },
        ],
        observacoesGerais: observacoes,
        criadoEm: agora,
        atualizadoEm: agora,
        _pendente: 1,
      })
      return { condId, vistId, areaId }
    },
    { condominioNome, observacoes, responsavel },
  )
}

async function editarVistoria(ap, vistId, novasObservacoes) {
  await ap.pagina.evaluate(
    async ({ vistId, novasObservacoes }) => {
      const bd = await new Promise((res) => {
        const r = indexedDB.open('vistorias-condominios')
        r.onsuccess = () => res(r.result)
      })
      const atual = await new Promise((res) => {
        const t = bd.transaction('vistorias', 'readonly').objectStore('vistorias').get(vistId)
        t.onsuccess = () => res(t.result)
      })
      await new Promise((res) => {
        const t = bd
          .transaction('vistorias', 'readwrite')
          .objectStore('vistorias')
          .put({
            ...atual,
            observacoesGerais: novasObservacoes,
            atualizadoEm: new Date().toISOString(),
            _pendente: 1,
          })
        t.onsuccess = () => res()
      })
    },
    { vistId, novasObservacoes },
  )
}

async function excluirVistoria(ap, vistId) {
  await ap.pagina.evaluate(async (vistId) => {
    const bd = await new Promise((res) => {
      const r = indexedDB.open('vistorias-condominios')
      r.onsuccess = () => res(r.result)
    })
    await new Promise((res) => {
      const t = bd.transaction('vistorias', 'readwrite').objectStore('vistorias').delete(vistId)
      t.onsuccess = () => res()
    })
    await new Promise((res) => {
      const t = bd
        .transaction('excluidos', 'readwrite')
        .objectStore('excluidos')
        .put({
          chave: `vistoria:${vistId}`,
          tipo: 'vistoria',
          id: vistId,
          excluidoEm: new Date().toISOString(),
        })
      t.onsuccess = () => res()
    })
  }, vistId)
}

async function adicionarFoto(ap, vistId, areaId) {
  return ap.pagina.evaluate(
    async ({ vistId, areaId }) => {
      // Gera um JPEG de verdade, para o teste exercitar bytes reais.
      const canvas = document.createElement('canvas')
      canvas.width = 200
      canvas.height = 150
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#2a78d6'
      ctx.fillRect(0, 0, 200, 150)
      ctx.fillStyle = '#fff'
      ctx.font = '20px sans-serif'
      ctx.fillText('vistoria', 20, 80)
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.8))

      const bd = await new Promise((res) => {
        const r = indexedDB.open('vistorias-condominios')
        r.onsuccess = () => res(r.result)
      })
      const agora = new Date().toISOString()
      const fotoId = 'foto_' + crypto.randomUUID()
      await new Promise((res) => {
        const t = bd
          .transaction('fotos', 'readwrite')
          .objectStore('fotos')
          .put({
            id: fotoId,
            vistoriaId: vistId,
            areaId,
            blob,
            legenda: 'Hall principal',
            criadoEm: agora,
            atualizadoEm: agora,
            mime: 'image/jpeg',
            _pendente: 1,
          })
        t.onsuccess = () => res()
      })
      return { fotoId, tamanho: blob.size }
    },
    { vistId, areaId },
  )
}

// ---------------------------------------------------------------------------

const A = await aparelho('A')
const B = await aparelho('B')
const C = await aparelho('C')

console.log('\n— A cria condomínio + vistoria e envia —')
const criado = await criarVistoria(A, {
  condominioNome: 'Edifício Atrium Office',
  observacoes: 'Vistoria da manhã.',
  responsavel: 'André Ferreira',
})
const foto = await adicionarFoto(A, criado.vistId, criado.areaId)
console.log(`  foto de ${foto.tamanho} bytes`)
const eA1 = await sincronizar(A)
checa('A não tem mais pendências após enviar', eA1.vistorias.every((v) => v._pendente === 0))

console.log('\n— B e C recebem —')
const eB1 = await sincronizar(B)
const eC1 = await sincronizar(C)
checa('B recebeu a vistoria de A', eB1.vistorias.some((v) => v.id === criado.vistId))
checa('C recebeu a vistoria de A', eC1.vistorias.some((v) => v.id === criado.vistId))
checa('B recebeu o condomínio', eB1.condominios.some((c) => c.id === criado.condId))
checa(
  'B baixou os BYTES da foto tirada por A',
  eB1.fotos.some((f) => f.id === foto.fotoId && f.temBlob && f.tamanho > 0),
  `${eB1.fotos.length} foto(s), ${eB1.fotos[0]?.tamanho ?? 0} bytes`,
)
checa(
  'o que B recebeu não vira pendência de subida',
  eB1.vistorias.every((v) => v._pendente === 0),
)

console.log('\n— B edita a mesma vistoria e envia; A recebe a edição —')
await editarVistoria(B, criado.vistId, 'Reinspeção à tarde: piso trocado.')
await sincronizar(B)
const eA2 = await sincronizar(A)
checa(
  'A recebeu a edição feita por B',
  eA2.vistorias.find((v) => v.id === criado.vistId)?.observacoesGerais ===
    'Reinspeção à tarde: piso trocado.',
  eA2.vistorias.find((v) => v.id === criado.vistId)?.observacoesGerais,
)

console.log('\n— conflito: A e C editam offline e sincronizam em sequência —')
await editarVistoria(A, criado.vistId, 'Edição de A (mais antiga).')
await A.pagina.waitForTimeout(1100)
await editarVistoria(C, criado.vistId, 'Edição de C (mais recente).')
await sincronizar(A)
await sincronizar(C)
const eB2 = await sincronizar(B)
checa(
  'vence a edição mais recente',
  eB2.vistorias.find((v) => v.id === criado.vistId)?.observacoesGerais ===
    'Edição de C (mais recente).',
  eB2.vistorias.find((v) => v.id === criado.vistId)?.observacoesGerais,
)

console.log('\n— C exclui a vistoria; a exclusão precisa alcançar A e B —')
await excluirVistoria(C, criado.vistId)
await sincronizar(C)
const eA3 = await sincronizar(A)
const eB3 = await sincronizar(B)
checa('A perdeu a vistoria excluída por C', !eA3.vistorias.some((v) => v.id === criado.vistId))
checa('B perdeu a vistoria excluída por C', !eB3.vistorias.some((v) => v.id === criado.vistId))

console.log('\n— a vistoria excluída não pode ressuscitar —')
// A sincroniza de novo: se algum aparelho reenviasse o registro, ele voltaria.
const eA4 = await sincronizar(A)
const eB4 = await sincronizar(B)
checa('a vistoria continua apagada em A', !eA4.vistorias.some((v) => v.id === criado.vistId))
checa('a vistoria continua apagada em B', !eB4.vistorias.some((v) => v.id === criado.vistId))

console.log('\n— offline: A preenche sem rede e sobe ao reconectar —')
await A.ctx.setOffline(true)
const offline = await criarVistoria(A, {
  condominioNome: 'Edifício Centenário',
  observacoes: 'Preenchida no subsolo, sem sinal.',
  responsavel: 'Amanda Tigre',
})
await A.pagina.reload()
await A.pagina.waitForTimeout(1500)
const eAoff = await estado(A)
checa(
  'offline, a vistoria fica salva no aparelho e pendente',
  eAoff.vistorias.find((v) => v.id === offline.vistId)?._pendente === 1,
)
const faixa = await A.pagina.locator('.sync').innerText().catch(() => '')
checa('a interface avisa que está sem conexão', /sem conex/i.test(faixa), faixa.slice(0, 60))

await A.ctx.setOffline(false)
await sincronizar(A)
const eB5 = await sincronizar(B)
checa(
  'ao voltar o sinal, a vistoria do subsolo chega em B',
  eB5.vistorias.some((v) => v.id === offline.vistId),
)

console.log('\n— uma foto que falha nao pode bloquear as vistorias —')
// Bloqueia só o envio de fotos; o resto da API continua respondendo.
await A.pagina.route('**/api/foto**', (rota) =>
  rota.request().method() === 'POST' ? rota.fulfill({ status: 500, body: 'erro' }) : rota.continue(),
)
const comFotoRuim = await criarVistoria(A, {
  condominioNome: 'Edificio Paulista',
  observacoes: 'Vistoria com foto que nao sobe.',
  responsavel: 'Denise Tigre',
})
await adicionarFoto(A, comFotoRuim.vistId, comFotoRuim.areaId)
await sincronizar(A)
await A.pagina.unroute('**/api/foto**')

const eB6 = await sincronizar(B)
checa(
  'a VISTORIA sobe mesmo com a foto falhando',
  eB6.vistorias.some((v) => v.id === comFotoRuim.vistId),
)

await navegador.close()
console.log(`\n=== OK (${ok.length}) | FALHAS (${falhas.length}) ===`)
falhas.forEach((f) => console.log('  ✗ ' + f))
process.exit(falhas.length ? 1 : 0)
