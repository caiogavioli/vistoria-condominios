import type { AreaVistoria, Vistoria } from '../types'
import { db } from './db'
import { slug } from './format'
import { notaGeral } from './score'

/**
 * Chave que identifica a mesma área entre vistorias diferentes. O `templateId`
 * vem do cadastro do condomínio e sobrevive a renomeações; o nome normalizado
 * é a reserva para áreas criadas antes de existir template.
 */
export function chaveArea(area: Pick<AreaVistoria, 'templateId' | 'nome'>): string {
  return area.templateId ?? `nome:${slug(area.nome)}`
}

/** Ordem cronológica: data da vistoria e, em empate, ordem de criação. */
export function ordenarCronologicamente(vistorias: Vistoria[]): Vistoria[] {
  return [...vistorias].sort((a, b) =>
    a.data === b.data ? a.criadoEm.localeCompare(b.criadoEm) : a.data.localeCompare(b.data),
  )
}

export async function vistoriasDoCondominio(condominioId: string): Promise<Vistoria[]> {
  const lista = await db.vistorias.where('condominioId').equals(condominioId).toArray()
  return ordenarCronologicamente(lista)
}

/**
 * Vistoria concluída imediatamente anterior à informada. Vistorias em andamento
 * não servem de base de comparação — só o que já foi fechado e entregue.
 */
export function vistoriaAnterior(atual: Vistoria, todas: Vistoria[]): Vistoria | null {
  const candidatas = ordenarCronologicamente(
    todas.filter(
      (v) =>
        v.id !== atual.id &&
        v.condominioId === atual.condominioId &&
        v.status === 'concluida' &&
        (v.data < atual.data || (v.data === atual.data && v.criadoEm < atual.criadoEm)),
    ),
  )
  return candidatas.at(-1) ?? null
}

export interface Variacao {
  notaAnterior: number | null
  /** Diferença de nota; `null` quando falta nota em uma das vistorias. */
  delta: number | null
  observacoesAnterior: string
  dataAnterior: string
}

/** Compara cada área da vistoria atual com a mesma área da vistoria anterior. */
export function variacoesPorArea(atual: Vistoria, anterior: Vistoria | null): Map<string, Variacao> {
  const mapa = new Map<string, Variacao>()
  if (!anterior) return mapa

  const antesPorChave = new Map(anterior.areas.map((a) => [chaveArea(a), a]))
  for (const area of atual.areas) {
    const antes = antesPorChave.get(chaveArea(area))
    if (!antes || antes.naoAplicavel) continue
    mapa.set(chaveArea(area), {
      notaAnterior: antes.nota,
      delta: area.nota !== null && antes.nota !== null ? area.nota - antes.nota : null,
      observacoesAnterior: antes.observacoes,
      dataAnterior: anterior.data,
    })
  }
  return mapa
}

export interface PontoSerie {
  vistoriaId: string
  data: string
  nota: number
}

/** Série da nota geral ao longo do tempo, apenas com vistorias que têm nota. */
export function serieNotaGeral(vistorias: Vistoria[]): PontoSerie[] {
  return ordenarCronologicamente(vistorias)
    .map((v) => ({ vistoriaId: v.id, data: v.data, nota: notaGeral(v) }))
    .filter((p): p is PontoSerie => p.nota !== null)
}

export interface LinhaEvolucao {
  chave: string
  nome: string
  icone: string
  /** Uma nota por vistoria da matriz, na mesma ordem das colunas. */
  notas: (number | null)[]
}

/**
 * Matriz área × vistoria. As áreas seguem a ordem da vistoria mais recente;
 * áreas que só existiram no passado vão para o fim, para não sumirem do histórico.
 */
export function matrizEvolucao(vistorias: Vistoria[]): LinhaEvolucao[] {
  const colunas = ordenarCronologicamente(vistorias)
  const linhas = new Map<string, LinhaEvolucao>()

  const ordemBase = [...colunas].reverse().flatMap((v) => v.areas)
  for (const area of ordemBase) {
    const chave = chaveArea(area)
    if (!linhas.has(chave)) {
      linhas.set(chave, {
        chave,
        nome: area.nome,
        icone: area.icone,
        notas: colunas.map(() => null),
      })
    }
  }

  colunas.forEach((vistoria, i) => {
    for (const area of vistoria.areas) {
      if (area.naoAplicavel) continue
      const linha = linhas.get(chaveArea(area))
      if (linha) linha.notas[i] = area.nota
    }
  })

  return [...linhas.values()]
}

/** Última variação de uma linha: compara as duas últimas notas preenchidas. */
export function tendencia(notas: (number | null)[]): number | null {
  const preenchidas = notas.filter((n): n is number => n !== null)
  if (preenchidas.length < 2) return null
  return preenchidas[preenchidas.length - 1] - preenchidas[preenchidas.length - 2]
}

export function formatarDelta(delta: number): string {
  const sinal = delta > 0 ? '+' : delta < 0 ? '−' : '±'
  return `${sinal}${Math.abs(delta).toFixed(1).replace('.', ',').replace(',0', '')}`
}
