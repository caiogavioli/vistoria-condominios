/** Faixas de desempenho — espelham a legenda do relatório modelo. */
export type Faixa = 'otimo' | 'regular' | 'critico'

/** 'caminho_do_rei' = trajeto do visitante (cartilha de boas práticas), destaque prioritário. 'geral' = as demais. */
export type CategoriaArea = 'caminho_do_rei' | 'geral'

export interface AreaTemplate {
  id: string
  nome: string
  /** Emoji exibido no relatório (ex.: 🏢). */
  icone: string
  /** Se true, a área precisa de ao menos 1 foto para o relatório ser validado. */
  fotoObrigatoria: boolean
  /** Ausente em áreas gravadas antes desta categoria existir — ver `categoriaDaArea`. */
  categoria?: CategoriaArea
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
  /** Usado para decidir quem vence quando dois aparelhos editam o mesmo cadastro. */
  atualizadoEm?: string
  _pendente?: 0 | 1
}

export interface AreaVistoria {
  id: string
  templateId?: string
  nome: string
  icone: string
  fotoObrigatoria: boolean
  categoria?: CategoriaArea
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
  /** Vistoria fictícia de demonstração — pode ser apagada em bloco. */
  demo?: boolean
  /** 1 enquanto a gravação ainda não subiu para o servidor. */
  _pendente?: 0 | 1
}

export interface Foto {
  id: string
  vistoriaId: string
  areaId: string
  /** Ausente quando só o catálogo desceu do servidor e os bytes ainda não. */
  blob?: Blob
  legenda: string
  criadoEm: string
  atualizadoEm?: string
  mime?: string
  _pendente?: 0 | 1
  /** 1 depois que os bytes da imagem chegaram ao servidor. */
  _enviada?: 0 | 1
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

/** Lápide de exclusão, à espera de ser comunicada ao servidor. */
export interface Excluido {
  /** `tipo:id` — chave primária composta. */
  chave: string
  tipo: 'condominio' | 'vistoria' | 'foto'
  id: string
  excluidoEm: string
}

/** Estado da sincronização deste aparelho. */
export interface SyncMeta {
  id: 'unica'
  /** Cursor do servidor: tudo até aqui já foi baixado. */
  cursor: number
  ultimoSucesso?: string
  ultimoErro?: string
}
