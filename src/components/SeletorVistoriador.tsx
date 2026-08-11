import { opcoesVistoriador } from '../data/vistoriadores'

interface Props {
  rotulo: string
  valor: string
  onChange: (valor: string) => void
  /** Texto da opção vazia; omita para exigir uma escolha. */
  vazio?: string
}

/** Escolha do vistoriador por lista — evita digitar o nome a cada vistoria. */
export function SeletorVistoriador({ rotulo, valor, onChange, vazio }: Props) {
  return (
    <label className="campo">
      <span>{rotulo}</span>
      <select value={valor} onChange={(e) => onChange(e.target.value)}>
        <option value="">{vazio ?? 'Selecione…'}</option>
        {opcoesVistoriador(valor).map((nome) => (
          <option key={nome} value={nome}>
            {nome}
          </option>
        ))}
      </select>
    </label>
  )
}
