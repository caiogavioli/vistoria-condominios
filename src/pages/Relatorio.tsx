import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CONFIG_PADRAO, db, lerConfig } from '../lib/db'
import { dataBR, dataHoraBR } from '../lib/format'
import { fotosDaArea } from '../lib/fotos'
import {
  FAIXAS,
  areasAvaliadas,
  areasSemFotoObrigatoria,
  faixaDaNota,
  notaGeral,
  textoDaFaixa,
} from '../lib/score'
import { useFotosDaVistoria, useUrlsDeFotos } from '../lib/useFotos'
import type { Config, Vistoria } from '../types'
import './relatorio.css'

export function Relatorio() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [vistoria, setVistoria] = useState<Vistoria | null | undefined>(undefined)
  const [config, setConfig] = useState<Config>(CONFIG_PADRAO)
  const todasFotos = useFotosDaVistoria(id)
  const urls = useUrlsDeFotos(todasFotos)

  useEffect(() => {
    if (!id) return
    db.vistorias.get(id).then((v) => setVistoria(v ?? null))
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
                <th>Faixa</th>
                <th>Desempenho</th>
              </tr>
            </thead>
            <tbody>
              {areas.map((area) => {
                const f = area.nota === null ? null : FAIXAS[faixaDaNota(area.nota)]
                return (
                  <tr key={area.id}>
                    <td>
                      <span className="emoji">{area.icone}</span> {area.nome}
                    </td>
                    <td className="centro">
                      <strong style={f ? { color: f.cor } : undefined}>{area.nota ?? '—'}</strong>
                    </td>
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

        {areas.map((area) => {
          const f = area.nota === null ? null : FAIXAS[faixaDaNota(area.nota)]
          const fotos = fotosDaArea(todasFotos, area.fotoIds)
          return (
            <section key={area.id} className="area-detalhe">
              <header className="area-cabecalho" style={f ? { borderLeftColor: f.cor } : undefined}>
                <h4>
                  <span className="emoji">{area.icone}</span> {area.nome}
                </h4>
                <span className="area-nota" style={f ? { color: f.cor } : undefined}>
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
                      Esta área não possui registro fotográfico. A inclusão de ao menos 1 foto é obrigatória para
                      validação da vistoria. Por favor, anexe as fotos e regenere o relatório.
                    </p>
                  </div>
                )
              )}

              {area.itens.some((i) => i.status !== 'na') && (
                <ul className="checklist">
                  {area.itens
                    .filter((i) => i.status !== 'na')
                    .map((item, i) => (
                      <li key={`${item.texto}-${i}`} className={`check check-${item.status}`}>
                        <span className="check-marca">
                          {item.status === 'ok' ? '✔' : item.status === 'atencao' ? '⚡' : '✖'}
                        </span>
                        {item.texto}
                      </li>
                    ))}
                </ul>
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
