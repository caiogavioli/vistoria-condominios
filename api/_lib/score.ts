/**
 * Nota geral no servidor — espelho de src/lib/score.ts do app. Recalculada a
 * cada gravação para o cliente nunca conseguir gravar uma média inventada.
 */

interface AreaMinima {
  nota: number | null
  naoAplicavel: boolean
}

export function notaGeral(areas: unknown): number | null {
  if (!Array.isArray(areas)) return null
  const avaliadas = (areas as AreaMinima[]).filter(
    (a) => a && !a.naoAplicavel && typeof a.nota === 'number',
  )
  if (avaliadas.length === 0) return null
  const soma = avaliadas.reduce((acc, a) => acc + (a.nota as number), 0)
  return Math.round((soma / avaliadas.length) * 10) / 10
}
