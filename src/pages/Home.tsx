import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Layout, Vazio } from '../components/Layout'
import { db, excluirVistoria } from '../lib/db'
import { dataBR } from '../lib/format'
import { FAIXAS, faixaDaNota, notaGeral, progresso } from '../lib/score'

export function Home() {
  const navigate = useNavigate()
  const vistorias = useLiveQuery(
    async () => (await db.vistorias.orderBy('atualizadoEm').reverse().toArray()),
    [],
    [],
  )

  const emAndamento = vistorias.filter((v) => v.status === 'em_andamento')
  const concluidas = vistorias.filter((v) => v.status === 'concluida')

  async function remover(id: string, nome: string) {
    if (!confirm(`Excluir a vistoria de "${nome}"? As fotos também serão apagadas.`)) return
    await excluirVistoria(id)
  }

  return (
    <Layout
      titulo="Vistorias"
      subtitulo="Checklist, fotos e relatório em um só lugar"
      acao={
        <Link to="/ajustes" className="topbar-icone" aria-label="Ajustes">
          ⚙️
        </Link>
      }
    >
      <button type="button" className="btn btn-primario btn-bloco" onClick={() => navigate('/vistorias/nova')}>
        ➕ Nova vistoria
      </button>

      <Link to="/condominios" className="linha-link">
        🏢 Meus condomínios
        <span className="chevron">›</span>
      </Link>

      {vistorias.length === 0 && (
        <Vazio>
          <p>Nenhuma vistoria ainda.</p>
          <p className="muted">
            Cadastre um condomínio, abra uma vistoria e vá marcando as áreas conforme percorre o prédio.
          </p>
        </Vazio>
      )}

      {emAndamento.length > 0 && (
        <section>
          <h2 className="secao">Em andamento</h2>
          {emAndamento.map((v) => {
            const p = progresso(v)
            return (
              <Link key={v.id} to={`/vistorias/${v.id}`} className="cartao">
                <div className="cartao-topo">
                  <strong>{v.condominioNome}</strong>
                  <span className="muted">{dataBR(v.data)}</span>
                </div>
                <div className="barra">
                  <div className="barra-preenchida" style={{ width: `${p.pct}%` }} />
                </div>
                <span className="muted">
                  {p.feitas} de {p.total} áreas avaliadas
                </span>
              </Link>
            )
          })}
        </section>
      )}

      {concluidas.length > 0 && (
        <section>
          <h2 className="secao">Concluídas</h2>
          {concluidas.map((v) => {
            const nota = notaGeral(v)
            const faixa = nota === null ? null : FAIXAS[faixaDaNota(nota)]
            return (
              <div key={v.id} className="cartao cartao-linha">
                <Link to={`/vistorias/${v.id}/relatorio`} className="cartao-conteudo">
                  <div className="cartao-topo">
                    <strong>{v.condominioNome}</strong>
                    <span className="muted">{dataBR(v.data)}</span>
                  </div>
                  <span className="muted">{v.areas.filter((a) => !a.naoAplicavel).length} áreas · {v.responsavel}</span>
                </Link>
                {faixa && nota !== null && (
                  <span className="selo-nota" style={{ background: faixa.corFraca, color: faixa.cor }}>
                    {nota.toFixed(1).replace('.', ',')}
                  </span>
                )}
                <button
                  type="button"
                  className="excluir"
                  aria-label="Excluir vistoria"
                  onClick={() => remover(v.id, v.condominioNome)}
                >
                  🗑
                </button>
              </div>
            )
          })}
        </section>
      )}
    </Layout>
  )
}
