import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CONFIG_PADRAO, db, lerConfig } from '../lib/db'
import { dataBR, dataHoraBR } from '../lib/format'
import { fotosDaArea } from '../lib/fotos'
import { chaveArea, formatarDelta, variacoesPorArea, vistoriaAnterior, vistoriasDoCondominio } from '../lib/historico'
import {
  FAIXAS,
  areasAvaliadas,
  areasSemFotoObrigatoria,
  faixaDaNota,
  notaGeral,
  textoDaFaixa,
} from '../lib/score'
import { useFotosDaVistoria, useUrlsDeFotos } from '../lib/useFotos'
import { agruparPorCategoria } from '../lib/vistoria'
import type { Condominio, Config, Vistoria } from '../types'
import './relatorio.css'

export function Relatorio() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [vistoria, setVistoria] = useState<Vistoria | null | undefined>(undefined)
  const [condominio, setCondominio] = useState<Condominio | null>(null)
  const [config, setConfig] = useState<Config>(CONFIG_PADRAO)
  const [previa, setPrevia] = useState<Vistoria | null>(null)
  const todasFotos = useFotosDaVistoria(id)
  const urls = useUrlsDeFotos(todasFotos)
  const opcoes = useLiveQuery(() => db.opcoesCondominio.toArray(), [], [])

  useEffect(() => {
    if (!id) return
    db.vistorias.get(id).then(async (v) => {
      setVistoria(v ?? null)
      if (!v) return
      const [todas, cond] = await Promise.all([
        vistoriasDoCondominio(v.condominioId),
        db.condominios.get(v.condominioId),
      ])
      setPrevia(vistoriaAnterior(v, todas))
      setCondominio(cond ?? null)
    })
    lerConfig().then(setConfig)
  }, [id])

  const areas = useMemo(
    () => (vistoria ? vistoria.areas.filter((a) => !a.naoAplicavel) : []),
    [vistoria],
  )

  if (vistoria === undefined) return <div className="relatorio-carregando">Carregando…</div>
  if (vistoria === null) return <div className="relatorio-carregando">Vistoria não encontrada.</div>

  const nota = notaGeral(vistoria)
  const faixa = nota === null ? null : FAIXAS[faixaDaNota(nota)]
  const semFoto = areasSemFotoObrigatoria(vistoria)
  const avaliadas = areasAvaliadas(vistoria)
  const geradoEm = vistoria.concluidaEm ?? new Date().toISOString()

  const variacoes = variacoesPorArea(vistoria, previa)
  const notaPrevia = previa ? notaGeral(previa) : null
  const deltaGeral = nota !== null && notaPrevia !== null ? nota - notaPrevia : null
  const comparativo = previa !== null && variacoes.size > 0

  const proprietario = opcoes.find((o) => o.id === condominio?.proprietarioId)?.nome
  const administradora = opcoes.find((o) => o.id === condominio?.administradoraId)?.nome

  return (
    <>
      <div className="barra-acoes sem-impressao">
        <button type="button" className="btn" onClick={() => navigate(`/vistorias/${vistoria.id}`)}>
          ‹ Voltar
        </button>
        <button type="button" className="btn btn-primario" onClick={() => window.print()}>
          🖨 Gerar PDF
        </button>
      </div>

      <article className="relatorio">
        {/* ---------- Capa / resumo ---------- */}
        <section className="folha">
          <header className="capa-topo">
            <span className="marca">{config.empresa}</span>
            <h1>Relatório de Vistoria</h1>
            <p className="subtitulo">Checklist de Vistoria — Relatório por Áreas</p>
          </header>

          <h2 className="predio">{vistoria.condominioNome}</h2>
          {vistoria.endereco && <p className="endereco">{vistoria.endereco}</p>}

          <div className="meta">
            <div>
              <span className="meta-rotulo">Data da vistoria</span>
              <strong>{dataBR(vistoria.data)}</strong>
            </div>
            <div>
              <span className="meta-rotulo">Responsável</span>
              <strong>{vistoria.responsavel || '—'}</strong>
            </div>
            <div>
              <span className="meta-rotulo">Áreas avaliadas</span>
              <strong>{avaliadas.length} áreas</strong>
            </div>
            {proprietario && (
              <div>
                <span className="meta-rotulo">Proprietário</span>
                <strong>{proprietario}</strong>
              </div>
            )}
            {administradora && (
              <div>
                <span className="meta-rotulo">Administradora</span>
                <strong>{administradora}</strong>
              </div>
            )}
            <div>
              <span className="meta-rotulo">Nota</span>
              <strong style={faixa ? { color: faixa.cor } : undefined}>
                {nota === null ? '—' : nota.toFixed(1).replace('.', ',')}
              </strong>
            </div>
          </div>

          {nota !== null && faixa && (
            <div className="destaque-nota" style={{ borderColor: faixa.cor, background: faixa.corFraca }}>
              <div className="circulo" style={{ borderColor: faixa.cor, color: faixa.cor }}>
                {nota.toFixed(1).replace('.', ',')}
              </div>
              <div>
                <p className="destaque-titulo" style={{ color: faixa.cor }}>
                  Nota Geral: {nota.toFixed(1).replace('.', ',')} / 10 — {faixa.rotulo}
                </p>
                <p className="destaque-texto">
                  Média aritmética das {avaliadas.length} áreas avaliadas. {textoDaFaixa(faixaDaNota(nota))}
                </p>
              </div>
            </div>
          )}

          {comparativo && deltaGeral !== null && (
            <p className={`comparativo comparativo-${deltaGeral > 0 ? 'sobe' : deltaGeral < 0 ? 'desce' : 'igual'}`}>
              {deltaGeral > 0 ? '▲' : deltaGeral < 0 ? '▼' : '='} Comparado à vistoria de{' '}
              {dataBR(previa!.data)}: a nota geral{' '}
              {deltaGeral > 0 ? 'subiu' : deltaGeral < 0 ? 'caiu' : 'permaneceu'} de{' '}
              {notaPrevia!.toFixed(1).replace('.', ',')} para {nota!.toFixed(1).replace('.', ',')}
              {deltaGeral !== 0 && ` (${formatarDelta(deltaGeral)})`}.
            </p>
          )}

          {semFoto.length > 0 && (
            <p className="alerta">
              ⚠ {semFoto.length} área(s) sem registro fotográfico obrigatório ({semFoto.map((a) => a.nome).join(' e ')}).
            </p>
          )}

          <p className="legenda-faixas">
            <span className="ponto" style={{ background: FAIXAS.otimo.cor }} /> Verde = 8–10 (Ótimo)
            <span className="ponto" style={{ background: FAIXAS.regular.cor }} /> Amarelo = 5–7 (Regular)
            <span className="ponto" style={{ background: FAIXAS.critico.cor }} /> Vermelho = 0–4 (Crítico)
          </p>

          <h3 className="titulo-secao">📊 Resumo de Notas por Área</h3>
          <table className="tabela-resumo">
            <thead>
              <tr>
                <th>Área</th>
                <th>Nota</th>
                {comparativo && <th className="centro">Anterior</th>}
                <th>Faixa</th>
                <th>Desempenho</th>
              </tr>
            </thead>
            <tbody>
              {agruparPorCategoria(areas).map(
                (grupo) =>
                  grupo.areas.length > 0 && (
                    <Fragment key={grupo.chave}>
                      <tr className="linha-grupo">
                        <td colSpan={comparativo ? 4 : 3}>{grupo.titulo}</td>
                      </tr>
                      {grupo.areas.map((area) => {
                        const f = area.nota === null ? null : FAIXAS[faixaDaNota(area.nota)]
                        const v = variacoes.get(chaveArea(area))
                        return (
                          <tr key={area.id}>
                            <td>
                              <span className="emoji">{area.icone}</span> {area.nome}
                            </td>
                            <td className="centro">
                              <strong style={f ? { color: f.cor } : undefined}>{area.nota ?? '—'}</strong>
                            </td>
                            {comparativo && (
                              <td className="centro variacao">
                                {v?.notaAnterior ?? '—'}
                                {v?.delta != null && v.delta !== 0 && (
                                  <span className={v.delta > 0 ? 'sobe' : 'desce'}>
                                    {' '}
                                    {v.delta > 0 ? '▲' : '▼'} {formatarDelta(v.delta)}
                                  </span>
                                )}
                              </td>
                            )}
                            <td className="centro">
                              {f ? (
                                <span className="etiqueta-faixa" style={{ background: f.corFraca, color: f.cor }}>
                                  {f.simbolo} {f.rotulo}
                                </span>
                              ) : (
                                <span className="muted">não avaliada</span>
                              )}
                            </td>
                            <td>
                              <div className="barra-tabela">
                                <div
                                  className="barra-tabela-preenchida"
                                  style={{ width: `${(area.nota ?? 0) * 10}%`, background: f?.cor ?? '#c9d1da' }}
                                />
                                <span>{(area.nota ?? 0) * 10}%</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </Fragment>
                  ),
              )}
            </tbody>
          </table>

          {vistoria.observacoesGerais.trim() && (
            <>
              <h3 className="titulo-secao">📝 Observações Gerais</h3>
              <p className="texto-corrido">{vistoria.observacoesGerais}</p>
            </>
          )}
        </section>

        {/* ---------- Detalhamento ---------- */}
        <h3 className="titulo-secao quebra-antes">🏗 Detalhamento por Área</h3>

        {agruparPorCategoria(areas).map(
          (grupo) =>
            grupo.areas.length > 0 && (
              <div key={grupo.chave}>
                <h4 className={`titulo-grupo${grupo.chave === 'caminho_do_rei' ? ' titulo-grupo-destaque' : ''}`}>
                  {grupo.titulo}
                </h4>
                {grupo.areas.map((area) => {
                  const f = area.nota === null ? null : FAIXAS[faixaDaNota(area.nota)]
                  const fotos = fotosDaArea(todasFotos, area.fotoIds)
                  const v = variacoes.get(chaveArea(area))
                  return (
                    <section key={area.id} className="area-detalhe">
                      <header className="area-cabecalho" style={f ? { borderLeftColor: f.cor } : undefined}>
                        <h4>
                          <span className="emoji">{area.icone}</span> {area.nome}
                        </h4>
                        <span className="area-nota" style={f ? { color: f.cor } : undefined}>
                          {v?.delta != null && v.delta !== 0 && (
                            <span className={`selo-variacao ${v.delta > 0 ? 'sobe' : 'desce'}`}>
                              {v.delta > 0 ? '▲' : '▼'} {formatarDelta(v.delta)} vs. {v.notaAnterior}
                            </span>
                          )}
                          {area.nota ?? '—'} / 10
                        </span>
                      </header>

                      {fotos.length > 0 ? (
                        <div className={`fotos fotos-${Math.min(fotos.length, 3)}`}>
                          {fotos.map((foto) => (
                            <figure key={foto.id}>
                              {urls[foto.id] && <img src={urls[foto.id]} alt={foto.legenda || `Foto de ${area.nome}`} />}
                              {foto.legenda && <figcaption>{foto.legenda}</figcaption>}
                            </figure>
                          ))}
                        </div>
                      ) : (
                        area.fotoObrigatoria && (
                          <div className="sem-foto">
                            <strong>📷 Foto obrigatória ausente!</strong>
                            <p>
                              Esta área não possui registro fotográfico. A inclusão de ao menos 1 foto é obrigatória
                              para validação da vistoria. Por favor, anexe as fotos e regenere o relatório.
                            </p>
                          </div>
                        )
                      )}

                      {area.observacoes.trim() && (
                        <div className="observacoes-bloco">
                          <span className="observacoes-rotulo">Observações</span>
                          <p>{area.observacoes}</p>
                        </div>
                      )}
                    </section>
                  )
                })}
              </div>
            ),
        )}

        <footer className="rodape">
          <p>
            Relatório gerado em {dataHoraBR(geradoEm)} · {config.empresa} — Sistema de Vistorias de Condomínios
          </p>
          <p className="rodape-nota">
            Este documento é de uso interno e destina-se exclusivamente à gestão condominial do{' '}
            {vistoria.condominioNome}.
          </p>
        </footer>
      </article>
    </>
  )
}
