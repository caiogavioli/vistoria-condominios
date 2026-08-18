import type { Condominio, Faixa, StatusVistoria, Vistoria } from '../types'
import { faixaDaNota, notaGeral } from './score'

export interface FiltrosRelatorio {
  condominioId?: string
  proprietarioId?: string
  administradoraId?: string
  /** YYYY-MM-DD, inclusive. */
  dataDe?: string
  /** YYYY-MM-DD, inclusive. */
  dataAte?: string
  status?: StatusVistoria
  faixa?: Faixa
}

export interface LinhaRelatorio {
  vistoria: Vistoria
  condominio: Condominio | null
  nota: number | null
  faixa: Faixa | null
}

/**
 * Filtra vistorias da carteira inteira. Proprietário/Administradora são
 * atributos do CONDOMÍNIO, não da vistoria — por isso o cruzamento por
 * `condominioId`. Nota geral usa sempre todas as áreas juntas, sem separar
 * por categoria.
 */
export function filtrarVistorias(
  vistorias: Vistoria[],
  condominios: Condominio[],
  filtros: FiltrosRelatorio,
): LinhaRelatorio[] {
  const condominioPorId = new Map(condominios.map((c) => [c.id, c]))

  return vistorias
    .filter((v) => !filtros.condominioId || v.condominioId === filtros.condominioId)
    .filter((v) => !filtros.status || v.status === filtros.status)
    .filter((v) => !filtros.dataDe || v.data >= filtros.dataDe)
    .filter((v) => !filtros.dataAte || v.data <= filtros.dataAte)
    .filter((v) => !filtros.proprietarioId || condominioPorId.get(v.condominioId)?.proprietarioId === filtros.proprietarioId)
    .filter(
      (v) => !filtros.administradoraId || condominioPorId.get(v.condominioId)?.administradoraId === filtros.administradoraId,
    )
    .map((v) => {
      const nota = notaGeral(v)
      return {
        vistoria: v,
        condominio: condominioPorId.get(v.condominioId) ?? null,
        nota,
        faixa: nota === null ? null : faixaDaNota(nota),
      }
    })
    .filter((linha) => !filtros.faixa || linha.faixa === filtros.faixa)
    .sort(
      (a, b) =>
        b.vistoria.data.localeCompare(a.vistoria.data) || b.vistoria.criadoEm.localeCompare(a.vistoria.criadoEm),
    )
}
