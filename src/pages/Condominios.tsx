import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Layout, Vazio } from '../components/Layout'
import { db } from '../lib/db'
import { criarCondominio } from '../lib/vistoria'

export function Condominios() {
  const navigate = useNavigate()
  const condominios = useLiveQuery(async () => await db.condominios.orderBy('nome').toArray(), [], [])

  async function novo() {
    const cond = criarCondominio({ nome: 'Novo condomínio' })
    await db.condominios.put(cond)
    navigate(`/condominios/${cond.id}`)
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
        <Link key={c.id} to={`/condominios/${c.id}`} className="cartao">
          <div className="cartao-topo">
            <strong>{c.nome || 'Sem nome'}</strong>
            <span className="chevron">›</span>
          </div>
          <span className="muted">
            {c.areasPadrao.length} áreas{c.endereco ? ` · ${c.endereco}` : ''}
          </span>
        </Link>
      ))}
    </Layout>
  )
}
