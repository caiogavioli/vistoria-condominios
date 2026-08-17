import { AREAS_PADRAO } from '../data/areasPadrao'
import type { AreaTemplate, AreaVistoria, CategoriaArea, Condominio, Vistoria } from '../types'
import { hojeISO } from './format'
import { novoId } from './id'

const CATEGORIA_PADRAO_POR_NOME = new Map<string, CategoriaArea>(
  AREAS_PADRAO.map((a) => [a.nome, a.categoria ?? 'geral']),
)

/** Categoria de uma área sem o campo gravado, pelo nome — pelas 13 áreas-modelo, ou "geral". */
export function categoriaPorNome(nome: string): CategoriaArea {
  return CATEGORIA_PADRAO_POR_NOME.get(nome) ?? 'geral'
}

/** Categoria efetiva: o que foi gravado na área, ou o retroativo por nome. */
export function categoriaDaArea(area: { nome: string; categoria?: CategoriaArea }): CategoriaArea {
  return area.categoria ?? categoriaPorNome(area.nome)
}

export const GRUPOS_CATEGORIA: { chave: CategoriaArea; titulo: string }[] = [
  { chave: 'caminho_do_rei', titulo: '👑 Caminho do Rei' },
  { chave: 'geral', titulo: 'Geral' },
]

/** Agrupa áreas por categoria, Caminho do Rei primeiro, preservando a ordem original de cada grupo. */
export function agruparPorCategoria<T extends { nome: string; categoria?: CategoriaArea }>(
  areas: T[],
): { chave: CategoriaArea; titulo: string; areas: T[] }[] {
  return GRUPOS_CATEGORIA.map((g) => ({
    ...g,
    areas: areas.filter((a) => categoriaDaArea(a) === g.chave),
  }))
}

/**
 * Move uma área para a posição do seu vizinho dentro da MESMA categoria — não
 * do índice adjacente na lista inteira, que poderia ser de outra categoria.
 * Áreas de fora do grupo não mudam de posição relativa entre si.
 */
export function moverDentroDaCategoria(lista: AreaTemplate[], id: string, direcao: -1 | 1): AreaTemplate[] {
  const alvo = lista.find((a) => a.id === id)
  if (!alvo) return lista
  const categoria = categoriaDaArea(alvo)
  const doGrupo = lista.map((a, indice) => ({ a, indice })).filter(({ a }) => categoriaDaArea(a) === categoria)
  const posicao = doGrupo.findIndex(({ a }) => a.id === id)
  const vizinho = doGrupo[posicao + direcao]
  if (!vizinho) return lista
  const indiceAtual = lista.findIndex((a) => a.id === id)
  const copia = [...lista]
  const temp = copia[indiceAtual]
  copia[indiceAtual] = copia[vizinho.indice]
  copia[vizinho.indice] = temp
  return copia
}

export function templatesPadrao(): AreaTemplate[] {
  return AREAS_PADRAO.map((a) => ({ ...a, id: novoId('area') }))
}

export function criarCondominio(dados: Partial<Condominio> = {}): Condominio {
  return {
    id: novoId('cond'),
    nome: '',
    endereco: '',
    vistoriador: '',
    areasPadrao: templatesPadrao(),
    criadoEm: new Date().toISOString(),
    ...dados,
  }
}

export function areaDeTemplate(template: AreaTemplate): AreaVistoria {
  return {
    id: novoId('av'),
    templateId: template.id,
    nome: template.nome,
    icone: template.icone,
    fotoObrigatoria: template.fotoObrigatoria,
    categoria: template.categoria,
    nota: null,
    naoAplicavel: false,
    observacoes: '',
    fotoIds: [],
  }
}

export function criarVistoria(condominio: Condominio, responsavel: string): Vistoria {
  const agora = new Date().toISOString()
  return {
    id: novoId('vist'),
    condominioId: condominio.id,
    condominioNome: condominio.nome,
    endereco: condominio.endereco,
    data: hojeISO(),
    responsavel,
    status: 'em_andamento',
    areas: condominio.areasPadrao.map(areaDeTemplate),
    observacoesGerais: '',
    criadoEm: agora,
    atualizadoEm: agora,
  }
}

/** Substitui uma área da vistoria preservando a ordem. */
export function comArea(vistoria: Vistoria, area: AreaVistoria): Vistoria {
  return { ...vistoria, areas: vistoria.areas.map((a) => (a.id === area.id ? area : a)) }
}

export function moverItem<T>(lista: T[], de: number, para: number): T[] {
  if (para < 0 || para >= lista.length) return lista
  const copia = [...lista]
  const [item] = copia.splice(de, 1)
  copia.splice(para, 0, item)
  return copia
}
