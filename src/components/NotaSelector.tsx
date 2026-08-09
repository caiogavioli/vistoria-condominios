import { FAIXAS, faixaDaNota } from '../lib/score'

interface Props {
  valor: number | null
  onChange: (nota: number) => void
  desabilitado?: boolean
}

const NOTAS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

/** Seleção de nota 0–10 em botões grandes, pensada para uso com uma mão. */
export function NotaSelector({ valor, onChange, desabilitado }: Props) {
  return (
    <div className="nota-selector" role="radiogroup" aria-label="Nota da área">
      {NOTAS.map((n) => {
        const faixa = FAIXAS[faixaDaNota(n)]
        const ativo = valor === n
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={ativo}
            disabled={desabilitado}
            className={`nota-botao${ativo ? ' ativo' : ''}`}
            style={ativo ? { background: faixa.cor, borderColor: faixa.cor, color: '#fff' } : undefined}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        )
      })}
    </div>
  )
}
