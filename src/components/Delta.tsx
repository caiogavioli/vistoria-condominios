import { formatarDelta } from '../lib/historico'

interface Props {
  valor: number
}

/** Variação de nota entre vistorias. A seta carrega a direção junto da cor. */
export function Delta({ valor }: Props) {
  if (valor === 0) return <span className="delta delta-igual">±0</span>
  return (
    <span className={`delta delta-${valor > 0 ? 'sobe' : 'desce'}`}>
      {valor > 0 ? '▲' : '▼'} {formatarDelta(valor)}
    </span>
  )
}
