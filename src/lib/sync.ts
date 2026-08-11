import { db } from './db'
import type { Condominio, Excluido, Foto, SyncMeta, Vistoria } from '../types'

/**
 * Sincronização com o PostgreSQL.
 *
 * O ciclo é sempre o mesmo: sobe o que este aparelho mudou, desce o que os
 * outros mudaram, aplica. Nada aqui bloqueia o preenchimento — se a rede
 * falhar, a vistoria continua salva localmente e sobe na próxima tentativa.
 *
 * Duas regras que valem entender antes de mexer:
 *
 * - **Conflito é resolvido por `atualizadoEm`**: vence a edição mais recente,
 *   e a comparação acontece no servidor. Uma vistoria é um documento inteiro;
 *   duas pessoas editando a MESMA vistoria ao mesmo tempo é raro (cada uma
 *   vistoria o seu prédio) e, quando acontece, perder a edição antiga é menos
 *   pior do que fundir dois checklists e criar uma terceira versão que ninguém
 *   preencheu.
 *
 * - **Exclusão viaja como lápide**, nunca como ausência. Ver `registrarExclusao`.
 */

const API =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export type ResultadoSync = {
  ok: boolean
  enviados: number
  recebidos: number
  fotosEnviadas: number
  fotosBaixadas: number
  erro?: string
}

export type EstadoSync = {
  configurado: boolean
  pendentes: number
  ultimoSucesso?: string
  ultimoErro?: string
  sincronizando: boolean
}

export function apiConfigurada(): boolean {
  return API.length > 0
}

/** Endereço do servidor embutido no build, ou vazio se não foi configurado. */
export function enderecoApi(): string {
  return API
}

async function meta(): Promise<SyncMeta> {
  return (await db.syncMeta.get('unica')) ?? { id: 'unica', cursor: 0 }
}

/** Quantos registros locais ainda não subiram. */
export async function contarPendentes(): Promise<number> {
  const [c, v, f, e] = await Promise.all([
    db.condominios.where('_pendente').equals(1).count(),
    db.vistorias.where('_pendente').equals(1).count(),
    db.fotos.where('_pendente').equals(1).count(),
    db.excluidos.count(),
  ])
  return c + v + f + e
}

export async function estadoSync(sincronizando = false): Promise<EstadoSync> {
  const m = await meta()
  return {
    configurado: apiConfigurada(),
    pendentes: await contarPendentes(),
    ultimoSucesso: m.ultimoSucesso,
    ultimoErro: m.ultimoErro,
    sincronizando,
  }
}

// Uma sincronização por vez: duas em paralelo subiriam o mesmo lote duas vezes
// e embaralhariam o cursor.
let emAndamento: Promise<ResultadoSync> | null = null

export function sincronizar(): Promise<ResultadoSync> {
  if (emAndamento) return emAndamento
  emAndamento = executarSync().finally(() => {
    emAndamento = null
  })
  return emAndamento
}

async function executarSync(): Promise<ResultadoSync> {
  const vazio: ResultadoSync = {
    ok: false,
    enviados: 0,
    recebidos: 0,
    fotosEnviadas: 0,
    fotosBaixadas: 0,
  }

  if (!apiConfigurada()) {
    return { ...vazio, erro: 'Servidor não configurado neste build.' }
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ...vazio, erro: 'Sem conexão. As vistorias continuam salvas no aparelho.' }
  }

  try {
    /*
     * Os DOCUMENTOS vão primeiro, e as fotos depois.
     *
     * A ordem inversa custava caro: uma única foto que falhasse — arquivo
     * grande demais, rede caindo no meio — lançava erro e abortava a rodada
     * inteira, então as vistorias nunca subiam. E como o app tenta de novo
     * sempre a partir da mesma foto, o bloqueio era permanente e silencioso.
     *
     * O texto da vistoria é o que não pode faltar; a imagem sobe na sequência,
     * e uma falha nela não impede o resto de chegar.
     */

    // Vistorias de demonstração não viajam: são dados fictícios de um aparelho
    // e poluiriam a lista de todo mundo.
    const condominios = await db.condominios.where('_pendente').equals(1).toArray()
    const vistorias = (await db.vistorias.where('_pendente').equals(1).toArray()).filter(
      (v) => !v.demo,
    )
    const fotos = await db.fotos.where('_pendente').equals(1).toArray()
    const excluidos = await db.excluidos.toArray()

    let recebidos = 0
    let fotosBaixadas = 0
    let completo = false
    let primeiraRodada = true

    // Repete enquanto o servidor indicar que sobrou coisa para descer.
    while (!completo) {
      const m = await meta()
      const resposta = await fetch(`${API}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cursor: m.cursor,
          // O lote de subida vai só na primeira rodada; as seguintes são
          // paginação de descida e reenviar seria trabalho perdido.
          condominios: primeiraRodada ? condominios.map(limpar) : [],
          vistorias: primeiraRodada ? vistorias.map(limpar) : [],
          fotos: primeiraRodada
            ? fotos.map((f) => ({
                id: f.id,
                legenda: f.legenda,
                atualizadoEm: f.atualizadoEm ?? f.criadoEm,
              }))
            : [],
          excluidos: primeiraRodada
            ? excluidos.map((e) => ({ tipo: e.tipo, id: e.id, excluidoEm: e.excluidoEm }))
            : [],
        }),
      })

      if (!resposta.ok) {
        throw new Error(`Servidor respondeu ${resposta.status}.`)
      }
      const dados = (await resposta.json()) as {
        cursor: number
        completo: boolean
        condominios: Condominio[]
        vistorias: Vistoria[]
        fotos: (Omit<Foto, 'blob'> & { mime?: string })[]
        excluidos: { tipo: Excluido['tipo']; id: string; excluidoEm: string }[]
      }

      if (primeiraRodada) {
        await limparPendencias(condominios, vistorias, fotos, excluidos)
        primeiraRodada = false
      }

      recebidos += await aplicarDoServidor(dados)
      await db.syncMeta.put({ ...(await meta()), id: 'unica', cursor: dados.cursor })
      completo = dados.completo
    }

    const { enviadas: fotosEnviadas, falhas: falhasEnvio } = await subirFotos()
    const { baixadas, falhas: falhasBaixa } = await baixarFotosFaltantes()
    fotosBaixadas = baixadas

    await db.syncMeta.put({
      ...(await meta()),
      id: 'unica',
      ultimoSucesso: new Date().toISOString(),
      ultimoErro: undefined,
    })

    const problemasComFotos = falhasEnvio + falhasBaixa
    return {
      ok: true,
      enviados: condominios.length + vistorias.length + fotos.length,
      recebidos,
      fotosEnviadas,
      fotosBaixadas,
      erro:
        problemasComFotos > 0
          ? `${problemasComFotos} foto(s) não transferiram; serão tentadas de novo. As vistorias subiram.`
          : undefined,
    }
  } catch (e) {
    const mensagem = (e as Error).message ?? 'Falha desconhecida.'
    await db.syncMeta.put({ ...(await meta()), id: 'unica', ultimoErro: mensagem })
    return { ...vazio, erro: mensagem }
  }
}

/** Tira os campos de controle antes de mandar para o servidor. */
function limpar(registro: object): Record<string, unknown> {
  const copia = { ...registro } as Record<string, unknown>
  delete copia._pendente
  delete copia._enviada
  return copia
}

/**
 * Desmarca o que subiu — mas só o que não mudou nesse meio-tempo.
 *
 * Entre montar o lote e receber a confirmação, a pessoa pode ter continuado
 * preenchendo. Desmarcar em bloco perderia essas edições: elas ficariam sem
 * pendência e nunca subiriam. Por isso a comparação por `atualizadoEm`.
 */
async function limparPendencias(
  condominios: Condominio[],
  vistorias: Vistoria[],
  fotos: Foto[],
  excluidos: Excluido[],
): Promise<void> {
  await db.transaction(
    'rw',
    db.condominios,
    db.vistorias,
    db.fotos,
    db.excluidos,
    async () => {
      for (const c of condominios) {
        const atual = await db.condominios.get(c.id)
        if (atual && atual.atualizadoEm === c.atualizadoEm) {
          await db.condominios.put({ ...atual, _pendente: 0 })
        }
      }
      for (const v of vistorias) {
        const atual = await db.vistorias.get(v.id)
        if (atual && atual.atualizadoEm === v.atualizadoEm) {
          await db.vistorias.put({ ...atual, _pendente: 0 })
        }
      }
      for (const f of fotos) {
        const atual = await db.fotos.get(f.id)
        if (atual && atual.legenda === f.legenda) {
          await db.fotos.put({ ...atual, _pendente: 0 })
        }
      }
      // A lápide já cumpriu o papel quando o servidor a registrou.
      await db.excluidos.bulkDelete(excluidos.map((e) => e.chave))
    },
  )
}

/** Aplica o que desceu. Retorna quantos registros foram gravados. */
async function aplicarDoServidor(dados: {
  condominios: Condominio[]
  vistorias: Vistoria[]
  fotos: (Omit<Foto, 'blob'> & { mime?: string })[]
  excluidos: { tipo: Excluido['tipo']; id: string; excluidoEm: string }[]
}): Promise<number> {
  let gravados = 0

  await db.transaction('rw', db.condominios, db.vistorias, db.fotos, async () => {
    for (const c of dados.condominios) {
      const local = await db.condominios.get(c.id)
      // O que está mais novo aqui não é sobrescrito pelo que desceu; ainda está
      // pendente e vai subir na próxima rodada, quando então vence.
      if (local && (local.atualizadoEm ?? '') > (c.atualizadoEm ?? '')) continue
      await db.condominios.put({ ...c, _pendente: 0 })
      gravados++
    }

    for (const v of dados.vistorias) {
      const local = await db.vistorias.get(v.id)
      if (local && local.atualizadoEm > v.atualizadoEm) continue
      await db.vistorias.put({ ...v, _pendente: 0 })
      gravados++
    }

    for (const f of dados.fotos) {
      const local = await db.fotos.get(f.id)
      // Preserva o blob que já existe aqui: o catálogo desce sem os bytes.
      await db.fotos.put({
        ...f,
        blob: local?.blob,
        _pendente: 0,
        _enviada: 1,
      } as Foto)
      gravados++
    }
  })

  // Exclusões fora da transação acima porque `excluirVistoria` abre a sua.
  for (const e of dados.excluidos) {
    if (e.tipo === 'vistoria') {
      await db.transaction('rw', db.vistorias, db.fotos, async () => {
        await db.fotos.where('vistoriaId').equals(e.id).delete()
        await db.vistorias.delete(e.id)
      })
    } else if (e.tipo === 'condominio') {
      await db.condominios.delete(e.id)
    } else {
      await db.fotos.delete(e.id)
    }
  }

  return gravados
}

/**
 * Sobe os bytes das fotos que ainda não chegaram ao servidor.
 *
 * Uma foto que falha é contada e a próxima segue. Nada de interromper: a foto
 * continua marcada como não enviada e volta na rodada seguinte, enquanto as
 * demais — e as vistorias — chegam ao servidor normalmente.
 */
async function subirFotos(): Promise<{ enviadas: number; falhas: number }> {
  const candidatas = await db.fotos.toArray()
  const pendentes = candidatas.filter((f) => f._enviada !== 1 && f.blob)

  let enviadas = 0
  let falhas = 0
  for (const foto of pendentes) {
    try {
      const params = new URLSearchParams({
        id: foto.id,
        vistoria: foto.vistoriaId,
        area: foto.areaId,
        legenda: foto.legenda ?? '',
      })
      const resposta = await fetch(`${API}/api/foto?${params}`, {
        method: 'POST',
        headers: { 'Content-Type': foto.blob!.type || 'image/jpeg' },
        body: foto.blob,
      })
      if (!resposta.ok) throw new Error(`servidor respondeu ${resposta.status}`)
      await db.fotos.put({ ...foto, _enviada: 1 })
      enviadas++
    } catch (e) {
      console.warn(`Foto ${foto.id} não subiu; será tentada de novo.`, e)
      falhas++
    }
  }
  return { enviadas, falhas }
}

/** Baixa os bytes das fotos cujo catálogo desceu mas a imagem não veio. */
async function baixarFotosFaltantes(): Promise<{ baixadas: number; falhas: number }> {
  const semBlob = (await db.fotos.toArray()).filter((f) => !f.blob)

  let baixadas = 0
  let falhas = 0
  for (const foto of semBlob) {
    try {
      const resposta = await fetch(`${API}/api/foto?id=${encodeURIComponent(foto.id)}`)
      if (resposta.status === 404) continue // ainda não subiu do outro aparelho
      if (!resposta.ok) throw new Error(`servidor respondeu ${resposta.status}`)
      const blob = await resposta.blob()
      await db.fotos.put({ ...foto, blob, _pendente: 0, _enviada: 1 })
      baixadas++
    } catch (e) {
      console.warn(`Foto ${foto.id} não baixou; será tentada de novo.`, e)
      falhas++
    }
  }
  return { baixadas, falhas }
}

/**
 * Liga a sincronização automática: ao abrir o app, ao voltar o sinal e a cada
 * poucos minutos enquanto a aba estiver aberta.
 *
 * O disparo ao reconectar é o que importa de verdade: é o momento em que o
 * vistoriador sai do subsolo com o celular cheio de vistorias.
 */
export function iniciarSyncAutomatico(aoTerminar?: (r: ResultadoSync) => void): () => void {
  if (!apiConfigurada()) return () => {}

  const tentar = () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    void sincronizar().then((r) => aoTerminar?.(r))
  }

  tentar()
  const intervalo = window.setInterval(tentar, 5 * 60 * 1000)
  window.addEventListener('online', tentar)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tentar()
  })

  return () => {
    window.clearInterval(intervalo)
    window.removeEventListener('online', tentar)
  }
}
