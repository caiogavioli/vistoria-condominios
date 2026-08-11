import type { PontoSerie } from '../lib/historico'
import { FAIXAS } from '../lib/score'

interface Props {
  pontos: PontoSerie[]
}

const L = 2
const LARG = 120
const ALT = 42

/**
 * Mini-gráfico de um condomínio, usado como pequeno múltiplo no painel. Todos
 * compartilham a escala 0–10, então dá para comparar um card com o outro; as
 * faixas ao fundo dizem em que patamar a linha está sem depender de cor de série.
 */
export function Sparkline({ pontos }: Props) {
  if (pontos.length === 0) return null

  const y = (nota: number) => 3 + (1 - nota / 10) * (ALT - 6)
  const x = (i: number) =>
    pontos.length === 1 ? LARG / 2 : L + (i / (pontos.length - 1)) * (LARG - L * 2)

  const caminho = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)} ${y(p.nota)}`).join(' ')
  const ultimo = pontos.at(-1)!

  const bandas = [
    { de: 0, ate: 4.5, cor: FAIXAS.critico.cor },
    { de: 4.5, ate: 7.5, cor: FAIXAS.regular.cor },
    { de: 7.5, ate: 10, cor: FAIXAS.otimo.cor },
  ]

  return (
    <svg viewBox={`0 0 ${LARG} ${ALT}`} className="sparkline" aria-hidden="true" focusable="false">
      {bandas.map((b) => (
        <rect key={b.de} x={0} y={y(b.ate)} width={LARG} height={y(b.de) - y(b.ate)} fill={b.cor} opacity={0.1} />
      ))}
      {pontos.length > 1 && <path d={caminho} className="sparkline-linha" fill="none" />}
      <circle cx={x(pontos.length - 1)} cy={y(ultimo.nota)} r={3.5} className="sparkline-ponto" />
    </svg>
  )
}
