import { db } from './db'
import { slug } from './format'
import { type PontoSerie, ordenarCronologicamente, serieNotaGeral, vistoriaAnterior } from './historico'
import { notaGeral } from './score'
import type { Vistoria } from '../types'

/** Nota a partir da qual a área é tratada como crítica (faixa vermelha). */
const LIMITE_CRITICO = 4

export interface ResumoCondominio {
  id: string
  nome: string
  /** Nota da última vistoria concluída. */
  nota: number | null
  /** Variação em relação à vistoria concluída anterior. */
  delta: number | null
  dataUltima: string | null
  serie: PontoSerie[]
  /** Áreas em faixa vermelha na última vistoria. */
  criticas: number
  totalVistorias: number
}

export interface ResumoArea {
  chave: string
  nome: string
  icone: string
  /** Média da nota desta área na última vistoria de cada condomínio. */
  media: number
  /** Em quantos condomínios a área foi avaliada. */
  condominios: number
  /** Condomínios em que a área está em faixa vermelha. */
  criticos: string[]
}

export interface PainelDados {
  condominios: ResumoCondominio[]
  /** Média das notas atuais — uma nota por condomínio, não por vistoria. */
  notaCarteira: number | null
  /** Média das variações dos condomínios que têm base de comparação. */
  deltaCarteira: number | null
  totalVistorias: number
  totalCriticas: number
  areas: ResumoArea[]
}

/**
 * Agrega a carteira inteira: uma leitura por condomínio (a última vistoria
 * concluída) e o cruzamento das áreas entre todos eles.
 */
export async function carregarPainel(): Promise<PainelDados> {
  const [cadastros, todasVistorias] = await Promise.all([
    db.condominios.toArray(),
    db.vistorias.toArray(),
  ])

  const concluidas = todasVistorias.filter((v) => v.status === 'concluida')
  const porCondominio = new Map<string, Vistoria[]>()
  for (const v of concluidas) {
    const lista = porCondominio.get(v.condominioId) ?? []
    lista.push(v)
    porCondominio.set(v.condominioId, lista)
  }

  const condominios: ResumoCondominio[] = []
  const acumuladoAreas = new Map<string, { nome: string; icone: string; notas: number[]; criticos: string[] }>()

  for (const cadastro of cadastros) {
    const lista = ordenarCronologicamente(porCondominio.get(cadastro.id) ?? [])
    const ultima = lista.at(-1) ?? null
    if (!ultima) continue

    const anterior = vistoriaAnterior(ultima, lista)
    const nota = notaGeral(ultima)
    const notaAnterior = anterior ? notaGeral(anterior) : null

    const avaliadas = ultima.areas.filter((a) => !a.naoAplicavel && a.nota !== null)

    condominios.push({
      id: cadastro.id,
      nome: cadastro.nome || 'Sem nome',
      nota,
      delta: nota !== null && notaAnterior !== null ? nota - notaAnterior : null,
      dataUltima: ultima.data,
      serie: serieNotaGeral(lista),
      criticas: avaliadas.filter((a) => (a.nota as number) <= LIMITE_CRITICO).length,
      totalVistorias: lista.length,
    })

    // Entre condomínios diferentes o templateId não serve de chave — cada
    // cadastro tem os seus. O nome normalizado é o que junta "Estacionamento"
    // de um prédio com o de outro.
    for (const area of avaliadas) {
      const chave = slug(area.nome)
      const atual = acumuladoAreas.get(chave) ?? { nome: area.nome, icone: area.icone, notas: [], criticos: [] }
      atual.notas.push(area.nota as number)
      if ((area.nota as number) <= LIMITE_CRITICO) atual.criticos.push(cadastro.nome || 'Sem nome')
      acumuladoAreas.set(chave, atual)
    }
  }

  const comNota = condominios.filter((c) => c.nota !== null)
  const comDelta = condominios.filter((c) => c.delta !== null)

  const areas: ResumoArea[] = [...acumuladoAreas.entries()]
    .map(([chave, a]) => ({
      chave,
      nome: a.nome,
      icone: a.icone,
      media: Math.round((a.notas.reduce((s, n) => s + n, 0) / a.notas.length) * 10) / 10,
      condominios: a.notas.length,
      criticos: a.criticos,
    }))
    .sort((a, b) => a.media - b.media)

  return {
    condominios: condominios.sort((a, b) => (a.nota ?? 99) - (b.nota ?? 99)),
    notaCarteira: comNota.length
      ? Math.round((comNota.reduce((s, c) => s + (c.nota as number), 0) / comNota.length) * 10) / 10
      : null,
    deltaCarteira: comDelta.length
      ? Math.round((comDelta.reduce((s, c) => s + (c.delta as number), 0) / comDelta.length) * 10) / 10
      : null,
    totalVistorias: concluidas.length,
    totalCriticas: condominios.reduce((s, c) => s + c.criticas, 0),
    areas,
  }
}
