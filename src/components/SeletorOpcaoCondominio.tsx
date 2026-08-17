import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { opcoesAtivas } from '../lib/opcoesCondominio'
import type { OpcaoCondominio } from '../types'

interface Props {
  tipo: OpcaoCondominio['tipo']
  rotulo: string
  valor?: string
  onChange: (id: string | undefined) => void
}

export function SeletorOpcaoCondominio({ tipo, rotulo, valor, onChange }: Props) {
  const todas = useLiveQuery(() => db.opcoesCondominio.where('tipo').equals(tipo).toArray(), [tipo], [])
  const opcoes = opcoesAtivas(todas)

  return (
    <label className="campo">
      <span>{rotulo}</span>
      <select value={valor ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">Nenhum(a) selecionado(a)</option>
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nome}
          </option>
        ))}
      </select>
    </label>
  )
}
