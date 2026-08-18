import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Layout, Vazio } from '../components/Layout'
import { db, excluirCondominio } from '../lib/db'
import { criarCondominio } from '../lib/vistoria'

export function Condominios() {
  const navigate = useNavigate()
  const condominios = useLiveQuery(async () => await db.condominios.orderBy('nome').toArray(), [], [])

  async function novo() {
    const cond = criarCondominio({ nome: 'Novo condomínio' })
    await db.condominios.put(cond)
    navigate(`/condominios/${cond.id}`)
  }

  async function remover(id: string, nome: string) {
    if (!confirm(`Excluir "${nome}"? As vistorias já feitas continuam salvas.`)) return
    await excluirCondominio(id)
  }

  return (
    <Layout titulo="Condomínios" subtitulo="Cada um com seu checklist de áreas" voltarPara="/">
      <button type="button" className="btn btn-primario btn-bloco" onClick={novo}>
        ➕ Cadastrar condomínio
      </button>

      {condominios.length === 0 && (
        <Vazio>
          <p>Nenhum condomínio cadastrado.</p>
          <p className="muted">
            Ao cadastrar, o checklist já vem com as 10 áreas do relatório modelo — depois é só ajustar.
          </p>
        </Vazio>
      )}

      {condominios.map((c) => (
        <div key={c.id} className="cartao cartao-linha">
          <Link to={`/condominios/${c.id}`} className="cartao-conteudo">
            <div className="cartao-topo">
              <strong>{c.nome || 'Sem nome'}</strong>
            </div>
            <span className="muted">
              {c.areasPadrao.length} áreas{c.endereco ? ` · ${c.endereco}` : ''}
            </span>
          </Link>
          <Link to={`/condominios/${c.id}/historico`} className="acao-icone" aria-label={`Histórico de ${c.nome}`}>
            📈
          </Link>
          <button
            type="button"
            className="excluir"
            aria-label={`Excluir ${c.nome}`}
            onClick={() => remover(c.id, c.nome)}
          >
            🗑
          </button>
        </div>
      ))}
    </Layout>
  )
}
