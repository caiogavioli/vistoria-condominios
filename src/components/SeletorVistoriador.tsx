import { useId } from 'react'

import { opcoesVistoriador } from '../data/vistoriadores'

interface Props {
  rotulo: string
  valor: string
  onChange: (valor: string) => void
  /** Texto de apoio quando o campo está vazio. */
  vazio?: string
}

/**
 * Quem assina a vistoria.
 *
 * Campo aberto com sugestões, e não lista fechada: a equipe fixa aparece ao
 * toque para quem é dela, mas um terceirizado, um novo contratado ou alguém
 * cobrindo uma folga consegue registrar a vistoria digitando o próprio nome.
 *
 * Uma lista fechada obrigaria a mexer no código a cada pessoa nova — e, em
 * campo, a saída seria assinar com o nome de outro, o que é pior do que um nome
 * digitado fora do padrão.
 */
export function SeletorVistoriador({ rotulo, valor, onChange, vazio }: Props) {
  const idLista = useId()

  return (
    <label className="campo">
      <span>{rotulo}</span>
      <input
        type="text"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        list={idLista}
        placeholder={vazio ?? 'Nome de quem está vistoriando'}
        autoComplete="off"
        autoCapitalize="words"
      />
      <datalist id={idLista}>
        {opcoesVistoriador(valor).map((nome) => (
          <option key={nome} value={nome} />
        ))}
      </datalist>
    </label>
  )
}
