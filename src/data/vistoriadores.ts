/**
 * Equipe que assina as vistorias, em ordem alfabética. Editar aqui muda a
 * lista em todas as telas de escolha.
 */
export const VISTORIADORES = [
  'Amanda Tigre',
  'Ana Paula Duarte',
  'André Ferreira',
  'Caio Gavioli',
  'Claudia De Santi',
  'Denise Tigre',
] as const

/**
 * Opções do seletor. Um nome gravado antes (ou fora da lista) continua
 * aparecendo, para nenhuma vistoria antiga perder o responsável.
 */
export function opcoesVistoriador(valorAtual?: string): string[] {
  const lista: string[] = [...VISTORIADORES]
  if (valorAtual && !lista.includes(valorAtual)) return [valorAtual, ...lista]
  return lista
}
