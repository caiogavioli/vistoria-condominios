import { AREAS_PADRAO } from '../data/areasPadrao'
import type { AreaTemplate, AreaVistoria, Condominio, Vistoria } from '../types'
import { hojeISO } from './format'
import { novoId } from './id'

export function templatesPadrao(): AreaTemplate[] {
  return AREAS_PADRAO.map((a) => ({ ...a, id: novoId('area'), itens: [...a.itens] }))
}

export function criarCondominio(dados: Partial<Condominio> = {}): Condominio {
  return {
    id: novoId('cond'),
    nome: '',
    endereco: '',
    sindico: '',
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
    nota: null,
    naoAplicavel: false,
    observacoes: '',
    itens: template.itens.map((texto) => ({ texto, status: 'na' as const })),
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
