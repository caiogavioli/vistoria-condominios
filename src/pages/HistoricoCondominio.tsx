import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Layout, Vazio } from '../components/Layout'
import { Delta } from '../components/Delta'
import { GraficoEvolucao } from '../components/GraficoEvolucao'
import { db } from '../lib/db'
import { dataBR } from '../lib/format'
import {
  chaveArea,
  formatarDelta,
  matrizEvolucao,
  serieNotaGeral,
  tendencia,
  variacoesPorArea,
  vistoriaAnterior,
  vistoriasDoCondominio,
} from '../lib/historico'
import { FAIXAS, faixaDaNota, notaGeral } from '../lib/score'
import type { Condominio, Vistoria } from '../types'
import './historico.css'

/** Quantas vistorias cabem na tabela sem virar rolagem infinita no celular. */
const MAX_COLUNAS = 5

export function HistoricoCondominio() {
  const { id } = useParams<{ id: string }>()
  const [cond, setCond] = useState<Condominio | null | undefined>(undefined)
  const [vistorias, setVistorias] = useState<Vistoria[]>([])

  useEffect(() => {
    if (!id) return
    db.condominios.get(id).then((c) => setCond(c ?? null))
    // Só vistorias concluídas: uma em andamento tem áreas pela metade e
    // distorceria a curva.
    vistoriasDoCondominio(id).then((lista) => setVistorias(lista.filter((v) => v.status === 'concluida')))
  }, [id])

  if (cond === undefined) return <Layout titulo="Histórico" voltarPara="/condominios">Carregando…</Layout>
  if (cond === null) return <Layout titulo="Histórico" voltarPara="/condominios">Condomínio não encontrado.</Layout>

  const voltar = `/condominios/${cond.id}`

  if (vistorias.length === 0) {
    return (
      <Layout titulo="Histórico" subtitulo={cond.nome} voltarPara={voltar}>
        <Vazio>
          <p>Nenhuma vistoria concluída ainda.</p>
          <p className="muted">O comparativo aparece a partir da primeira vistoria fechada.</p>
        </Vazio>
      </Layout>
    )
  }

  const serie = serieNotaGeral(vistorias)
  const ultima = vistorias[vistorias.length - 1]
  const anterior = vistoriaAnterior(ultima, vistorias)
  const notaUltima = notaGeral(ultima)
  const notaAnterior = anterior ? notaGeral(anterior) : null
  const deltaGeral = notaUltima !== null && notaAnterior !== null ? notaUltima - notaAnterior : null
  const faixaUltima = notaUltima === null ? null : FAIXAS[faixaDaNota(notaUltima)]

  const variacoes = variacoesPorArea(ultima, anterior)
  const pioraram = [...variacoes.entries()].filter(([, v]) => (v.delta ?? 0) < 0)
  const subiram = [...variacoes.entries()].filter(([, v]) => (v.delta ?? 0) > 0)

  const colunas = vistorias.slice(-MAX_COLUNAS)
  const linhas = matrizEvolucao(colunas)

  const areaPorChave = new Map(ultima.areas.map((a) => [chaveArea(a), a]))

  return (
    <Layout titulo="Histórico" subtitulo={cond.nome} voltarPara={voltar}>
      <div className="painel">
        <div className="painel-nota">
          <span className="painel-nota-valor" style={faixaUltima ? { color: faixaUltima.cor } : undefined}>
            {notaUltima === null ? '—' : notaUltima.toFixed(1).replace('.', ',')}
          </span>
          <span className="muted">nota atual</span>
        </div>
        <div className="painel-progresso">
          {deltaGeral === null ? (
            <span className="muted">Primeira vistoria concluída — sem base de comparação ainda.</span>
          ) : (
            <>
              <Delta valor={deltaGeral} />
              <span className="muted">
                {' '}
                vs. {dataBR(anterior!.data)} (era {notaAnterior!.toFixed(1).replace('.', ',')})
              </span>
            </>
          )}
          <span className="muted">
            <br />
            {vistorias.length} vistoria(s) concluída(s)
          </span>
        </div>
      </div>

      {serie.length > 1 && (
        <>
          <h2 className="secao">Evolução da nota geral</h2>
          <GraficoEvolucao pontos={serie} />
        </>
      )}

      {(subiram.length > 0 || pioraram.length > 0) && (
        <>
          <h2 className="secao">Desde a vistoria de {dataBR(anterior!.data)}</h2>
          <div className="listas-variacao">
            {pioraram.length > 0 && (
              <div className="lista-variacao">
                <span className="lista-titulo desce">▼ Pioraram</span>
                {pioraram.map(([chave, v]) => (
                  <div key={chave} className="linha-variacao">
                    <span>
                      {areaPorChave.get(chave)?.icone} {areaPorChave.get(chave)?.nome ?? chave}
                    </span>
                    <strong className="desce">
                      {v.notaAnterior} → {areaPorChave.get(chave)?.nota} ({formatarDelta(v.delta!)})
                    </strong>
                  </div>
                ))}
              </div>
            )}
            {subiram.length > 0 && (
              <div className="lista-variacao">
                <span className="lista-titulo sobe">▲ Melhoraram</span>
                {subiram.map(([chave, v]) => (
                  <div key={chave} className="linha-variacao">
                    <span>
                      {areaPorChave.get(chave)?.icone} {areaPorChave.get(chave)?.nome ?? chave}
                    </span>
                    <strong className="sobe">
                      {v.notaAnterior} → {areaPorChave.get(chave)?.nota} ({formatarDelta(v.delta!)})
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <h2 className="secao">Nota por área</h2>
      <p className="muted">Últimas {colunas.length} vistorias concluídas.</p>
      <div className="tabela-rolagem">
        <table className="tabela-historico">
          <thead>
            <tr>
              <th>Área</th>
              {colunas.map((v) => (
                <th key={v.id} className="centro">
                  {dataBR(v.data).slice(0, 5)}
                </th>
              ))}
              <th className="centro">Var.</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => {
              const t = tendencia(linha.notas)
              return (
                <tr key={linha.chave}>
                  <td>
                    <span className="emoji">{linha.icone}</span> {linha.nome}
                  </td>
                  {linha.notas.map((nota, i) => {
                    const f = nota === null ? null : FAIXAS[faixaDaNota(nota)]
                    return (
                      <td key={colunas[i].id} className="centro">
                        <span
                          className="celula-nota"
                          style={f ? { background: f.corFraca, color: f.cor } : undefined}
                        >
                          {nota ?? '—'}
                        </span>
                      </td>
                    )
                  })}
                  <td className="centro">
                    {t === null ? (
                      <span className="muted">—</span>
                    ) : (
                      <Delta valor={t} />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}
