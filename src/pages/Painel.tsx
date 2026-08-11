import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout, Vazio } from '../components/Layout'
import { Delta } from '../components/Delta'
import { Sparkline } from '../components/Sparkline'
import { carregarPainel, type PainelDados } from '../lib/dashboard'
import { dataBR } from '../lib/format'
import { FAIXAS, faixaDaNota } from '../lib/score'
import './painel.css'

/** Quantas áreas aparecem antes de o usuário pedir a lista inteira. */
const AREAS_VISIVEIS = 6

export function Painel() {
  const [dados, setDados] = useState<PainelDados | null>(null)
  const [todasAreas, setTodasAreas] = useState(false)

  useEffect(() => {
    carregarPainel().then(setDados)
  }, [])

  if (!dados) return <Layout titulo="Painel geral" voltarPara="/">Carregando…</Layout>

  if (dados.condominios.length === 0) {
    return (
      <Layout titulo="Painel geral" voltarPara="/">
        <Vazio>
          <p>Nenhuma vistoria concluída ainda.</p>
          <p className="muted">
            O painel compara os condomínios a partir da última vistoria fechada de cada um.
          </p>
        </Vazio>
      </Layout>
    )
  }

  const faixaCarteira = dados.notaCarteira === null ? null : FAIXAS[faixaDaNota(dados.notaCarteira)]

  return (
    <Layout titulo="Painel geral" subtitulo="Comparativo da carteira" voltarPara="/">
      {/* Uma única figura em destaque na tela. */}
      <section className="hero">
        <span className="hero-rotulo">Nota média da carteira</span>
        <strong className="hero-valor" style={faixaCarteira ? { color: faixaCarteira.cor } : undefined}>
          {dados.notaCarteira === null ? '—' : dados.notaCarteira.toFixed(1).replace('.', ',')}
        </strong>
        <div className="hero-apoio">
          {dados.deltaCarteira === null ? (
            <span className="muted">sem vistoria anterior para comparar</span>
          ) : (
            <>
              <Delta valor={dados.deltaCarteira} />
              <span className="muted"> na média das variações</span>
            </>
          )}
        </div>
      </section>

      <div className="tiles">
        <div className="tile">
          <span className="tile-valor">{dados.condominios.length}</span>
          <span className="tile-rotulo">condomínios</span>
        </div>
        <div className="tile">
          <span className="tile-valor">{dados.totalVistorias}</span>
          <span className="tile-rotulo">vistorias concluídas</span>
        </div>
        <div className="tile">
          <span className="tile-valor" style={dados.totalCriticas > 0 ? { color: FAIXAS.critico.cor } : undefined}>
            {dados.totalCriticas}
          </span>
          <span className="tile-rotulo">áreas críticas</span>
        </div>
      </div>

      {/* --- Comparação direta: onde cada condomínio está hoje --- */}
      <h2 className="secao">Situação atual</h2>
      <p className="muted">Última vistoria de cada condomínio, da pior nota para a melhor.</p>
      <div className="bloco">
        {dados.condominios.map((c) => {
          const f = c.nota === null ? null : FAIXAS[faixaDaNota(c.nota)]
          return (
            <Link key={c.id} to={`/condominios/${c.id}/historico`} className="linha-barra">
              <div className="linha-barra-topo">
                <span className="linha-barra-nome">{c.nome}</span>
                {f && (
                  <span className="etiqueta" style={{ background: f.corFraca, color: f.cor }}>
                    {f.simbolo} {f.rotulo}
                  </span>
                )}
              </div>
              <div className="barra-linha">
                <div className="barra-trilho">
                  <div
                    className="barra-preenche"
                    style={{ width: `${(c.nota ?? 0) * 10}%`, background: f?.cor ?? '#c9d1da' }}
                  />
                </div>
                <span className="barra-valor">{c.nota === null ? '—' : c.nota.toFixed(1).replace('.', ',')}</span>
                {c.delta !== null && <Delta valor={c.delta} />}
              </div>
              <span className="muted">
                {dataBR(c.dataUltima ?? '')}
                {c.criticas > 0 && ` · ${c.criticas} área(s) crítica(s)`}
              </span>
            </Link>
          )
        })}
      </div>

      {/* --- Trajetória: mesma escala 0–10 em todos, então dá para comparar --- */}
      <h2 className="secao">Evolução ao longo do tempo</h2>
      <p className="muted">Todos os gráficos usam a mesma escala de 0 a 10.</p>
      <div className="multiplos">
        {dados.condominios.map((c) => {
          const f = c.nota === null ? null : FAIXAS[faixaDaNota(c.nota)]
          return (
            <Link key={c.id} to={`/condominios/${c.id}/historico`} className="multiplo">
              <span className="multiplo-nome">{c.nome}</span>
              <Sparkline pontos={c.serie} />
              <div className="multiplo-rodape">
                <strong style={f ? { color: f.cor } : undefined}>
                  {c.nota === null ? '—' : c.nota.toFixed(1).replace('.', ',')}
                </strong>
                {c.delta !== null && <Delta valor={c.delta} />}
                <span className="muted">
                  {c.totalVistorias} vistoria{c.totalVistorias > 1 ? 's' : ''}
                </span>
              </div>
            </Link>
          )
        })}
      </div>

      {/* --- O que dói na carteira inteira, não em um prédio só --- */}
      <h2 className="secao">Áreas mais críticas da carteira</h2>
      <p className="muted">Média da área na última vistoria de cada condomínio, da pior para a melhor.</p>
      <div className="bloco">
        {(todasAreas ? dados.areas : dados.areas.slice(0, AREAS_VISIVEIS)).map((a) => {
          const f = FAIXAS[faixaDaNota(a.media)]
          return (
            <div key={a.chave} className="linha-barra">
              <div className="linha-barra-topo">
                <span className="linha-barra-nome">
                  <span className="emoji">{a.icone}</span> {a.nome}
                </span>
                <span className="etiqueta" style={{ background: f.corFraca, color: f.cor }}>
                  {f.simbolo} {f.rotulo}
                </span>
              </div>
              <div className="barra-linha">
                <div className="barra-trilho">
                  <div className="barra-preenche" style={{ width: `${a.media * 10}%`, background: f.cor }} />
                </div>
                <span className="barra-valor">{a.media.toFixed(1).replace('.', ',')}</span>
              </div>
              <span className="muted">
                em {a.condominios} condomínio{a.condominios > 1 ? 's' : ''}
                {a.criticos.length > 0 && ` · crítica em ${a.criticos.join(', ')}`}
              </span>
            </div>
          )
        })}
      </div>
      {dados.areas.length > AREAS_VISIVEIS && (
        <button type="button" className="btn btn-bloco" onClick={() => setTodasAreas(!todasAreas)}>
          {todasAreas ? 'Mostrar só as piores' : `Ver todas as ${dados.areas.length} áreas`}
        </button>
      )}
    </Layout>
  )
}
