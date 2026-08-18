import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { criarOpcao } from '../lib/opcoesCondominio'
import type { OpcaoCondominio } from '../types'

interface Props {
  tipo: OpcaoCondominio['tipo']
  rotulo: string
}

/** Lista de administração: renomear e ativar/desativar gravam direto, como no checklist de áreas do condomínio. */
export function ListaOpcoes({ tipo, rotulo }: Props) {
  const opcoes = useLiveQuery(
    async () =>
      (await db.opcoesCondominio.where('tipo').equals(tipo).toArray()).sort((a, b) =>
        a.nome.localeCompare(b.nome, 'pt-BR'),
      ),
    [tipo],
    [],
  )
  const [novoNome, setNovoNome] = useState('')

  async function adicionar() {
    await criarOpcao(tipo, novoNome)
    setNovoNome('')
  }

  /**
   * Grava direto, com `_pendente`/`atualizadoEm` explícitos.
   *
   * A marcação automática de `db.ts` só entra quando o registro chega sem
   * `_pendente` nenhum — e um registro já sincronizado uma vez carrega
   * `_pendente: 0` gravado nele. Reenviar esse valor num `put` (por exemplo
   * `{ ...o, nome: novoNome }`) faria essa edição passar batida, sem nunca
   * subir. `salvarVistoria` (`src/lib/db.ts`) evita isso do mesmo jeito.
   */
  function gravar(opcao: OpcaoCondominio) {
    return db.opcoesCondominio.put({ ...opcao, _pendente: 1, atualizadoEm: new Date().toISOString() })
  }

  return (
    <div>
      <h3 className="secao">{rotulo}</h3>
      {opcoes.map((o) => (
        <div key={o.id} className={`cartao cartao-linha${o.ativo ? '' : ' desativado'}`}>
          <div className="cartao-conteudo">
            <input value={o.nome} onChange={(e) => gravar({ ...o, nome: e.target.value })} />
          </div>
          <button type="button" className="btn" onClick={() => gravar({ ...o, ativo: !o.ativo })}>
            {o.ativo ? 'Desativar' : 'Reativar'}
          </button>
        </div>
      ))}
      <div className="linha-dupla">
        <input
          value={novoNome}
          placeholder={`Novo(a) ${rotulo.toLowerCase().replace(/s$/, '')}`}
          onChange={(e) => setNovoNome(e.target.value)}
        />
        <button type="button" className="btn" onClick={adicionar}>
          ➕ Adicionar
        </button>
      </div>
    </div>
  )
}
