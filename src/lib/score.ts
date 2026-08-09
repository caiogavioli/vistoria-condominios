import type { AreaVistoria, Faixa, Vistoria } from '../types'

/** Faixas conforme a legenda do relatório: 8–10 ótimo, 5–7 regular, 0–4 crítico. */
export function faixaDaNota(nota: number): Faixa {
  if (nota >= 8) return 'otimo'
  if (nota >= 5) return 'regular'
  return 'critico'
}

export const FAIXAS: Record<Faixa, { rotulo: string; simbolo: string; cor: string; corFraca: string }> = {
  otimo: { rotulo: 'Ótimo', simbolo: '✔', cor: '#1f9254', corFraca: '#e4f5eb' },
  regular: { rotulo: 'Regular', simbolo: '⚡', cor: '#c98a00', corFraca: '#fdf3dd' },
  critico: { rotulo: 'Crítico', simbolo: '✖', cor: '#c2352b', corFraca: '#fbe6e4' },
}

/** Áreas que entram na média: avaliadas e não marcadas como N/A. */
export function areasAvaliadas(vistoria: Vistoria): AreaVistoria[] {
  return vistoria.areas.filter((a) => !a.naoAplicavel && a.nota !== null)
}

/** Média aritmética das áreas avaliadas, ou `null` se nenhuma foi avaliada. */
export function notaGeral(vistoria: Vistoria): number | null {
  const avaliadas = areasAvaliadas(vistoria)
  if (avaliadas.length === 0) return null
  const soma = avaliadas.reduce((acc, a) => acc + (a.nota ?? 0), 0)
  return Math.round((soma / avaliadas.length) * 10) / 10
}

export function textoDaFaixa(faixa: Faixa): string {
  switch (faixa) {
    case 'otimo':
      return 'Faixa Verde (8–10): condomínio em conformidade, sem pendências relevantes.'
    case 'regular':
      return 'Faixa Amarela (5–7): conformidade parcial, requer atenção em pontos específicos.'
    case 'critico':
      return 'Faixa Vermelha (0–4): não conformidade grave, exige ação corretiva imediata.'
  }
}

/** Áreas ativas que exigem foto e ainda não têm nenhuma — bloqueiam a validação. */
export function areasSemFotoObrigatoria(vistoria: Vistoria): AreaVistoria[] {
  return vistoria.areas.filter((a) => !a.naoAplicavel && a.fotoObrigatoria && a.fotoIds.length === 0)
}

export function areasPendentes(vistoria: Vistoria): AreaVistoria[] {
  return vistoria.areas.filter((a) => !a.naoAplicavel && a.nota === null)
}

export function progresso(vistoria: Vistoria): { feitas: number; total: number; pct: number } {
  const ativas = vistoria.areas.filter((a) => !a.naoAplicavel)
  const feitas = ativas.filter((a) => a.nota !== null).length
  const total = ativas.length
  return { feitas, total, pct: total === 0 ? 0 : Math.round((feitas / total) * 100) }
}
