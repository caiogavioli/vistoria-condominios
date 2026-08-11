/** Faixas de desempenho — espelham a legenda do relatório modelo. */
export type Faixa = 'otimo' | 'regular' | 'critico'

export interface AreaTemplate {
  id: string
  nome: string
  /** Emoji exibido no relatório (ex.: 🏢). */
  icone: string
  /** Se true, a área precisa de ao menos 1 foto para o relatório ser validado. */
  fotoObrigatoria: boolean
}

export interface Condominio {
  id: string
  nome: string
  endereco: string
  /** Vistoriador padrão deste condomínio, escolhido da equipe. */
  vistoriador: string
  /** Checklist de áreas usado como base ao abrir uma nova vistoria. */
  areasPadrao: AreaTemplate[]
  criadoEm: string
}

export interface AreaVistoria {
  id: string
  templateId?: string
  nome: string
  icone: string
  fotoObrigatoria: boolean
  /** 0 a 10. `null` enquanto a área não foi avaliada. */
  nota: number | null
  /** Área não aplicável nesta vistoria — fica fora da média e do relatório. */
  naoAplicavel: boolean
  observacoes: string
  /** Ids das fotos na tabela `fotos`, na ordem de exibição. */
  fotoIds: string[]
}

export type StatusVistoria = 'em_andamento' | 'concluida'

export interface Vistoria {
  id: string
  condominioId: string
  /** Snapshot do nome — o relatório não muda se o cadastro for renomeado depois. */
  condominioNome: string
  endereco: string
  /** Data da vistoria no formato YYYY-MM-DD. */
  data: string
  responsavel: string
  status: StatusVistoria
  areas: AreaVistoria[]
  observacoesGerais: string
  criadoEm: string
  atualizadoEm: string
  /** Preenchido ao concluir; usado no rodapé do relatório. */
  concluidaEm?: string
}

export interface Foto {
  id: string
  vistoriaId: string
  areaId: string
  blob: Blob
  legenda: string
  criadoEm: string
}

export interface Config {
  id: 'unica'
  /** Marca exibida no cabeçalho e rodapé do relatório. */
  empresa: string
  /** Vistoriador sugerido quando o condomínio não tem um definido. */
  responsavelPadrao: string
  /** Nota mínima que dispara destaque de ação corretiva no resumo. */
  notaAlerta: number
}
