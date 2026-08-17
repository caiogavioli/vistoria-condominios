import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { db, salvarVistoria } from '../lib/db'
import { dataBR } from '../lib/format'
import {
  FAIXAS,
  areasPendentes,
  areasSemFotoObrigatoria,
  faixaDaNota,
  notaGeral,
  progresso,
} from '../lib/score'
import { agruparPorCategoria, comArea } from '../lib/vistoria'
import type { Vistoria } from '../types'

export function VistoriaAreas() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [vistoria, setVistoria] = useState<Vistoria | null | undefined>(undefined)

  useEffect(() => {
    if (!id) return
    db.vistorias.get(id).then((v) => setVistoria(v ?? null))
  }, [id])

  if (vistoria === undefined) return <Layout titulo="Vistoria" voltarPara="/">Carregando…</Layout>
  if (vistoria === null) return <Layout titulo="Vistoria" voltarPara="/">Vistoria não encontrada.</Layout>

  async function alternarNA(areaId: string) {
    const area = vistoria!.areas.find((a) => a.id === areaId)
    if (!area) return
    const atualizada = comArea(vistoria!, { ...area, naoAplicavel: !area.naoAplicavel })
    setVistoria(atualizada)
    await salvarVistoria(atualizada)
  }

  async function concluir() {
    const semFoto = areasSemFotoObrigatoria(vistoria!)
    const pendentes = areasPendentes(vistoria!)
    const problemas: string[] = []
    if (pendentes.length) problemas.push(`${pendentes.length} área(s) sem nota`)
    if (semFoto.length) problemas.push(`${semFoto.length} área(s) sem foto obrigatória`)
    if (problemas.length && !confirm(`Ainda há ${problemas.join(' e ')}. Concluir mesmo assim?`)) return

    const atualizada: Vistoria = { ...vistoria!, status: 'concluida', concluidaEm: new Date().toISOString() }
    setVistoria(atualizada)
    await salvarVistoria(atualizada)
    navigate(`/vistorias/${atualizada.id}/relatorio`)
  }

  async function reabrir() {
    const atualizada: Vistoria = { ...vistoria!, status: 'em_andamento' }
    setVistoria(atualizada)
    await salvarVistoria(atualizada)
  }

  const nota = notaGeral(vistoria)
  const faixa = nota === null ? null : FAIXAS[faixaDaNota(nota)]
  const p = progresso(vistoria)
  const semFoto = areasSemFotoObrigatoria(vistoria)

  return (
    <Layout titulo={vistoria.condominioNome} subtitulo={`${dataBR(vistoria.data)} · ${vistoria.responsavel}`} voltarPara="/">
      <div className="painel">
        <div className="painel-nota">
          <span className="painel-nota-valor" style={faixa ? { color: faixa.cor } : undefined}>
            {nota === null ? '—' : nota.toFixed(1).replace('.', ',')}
          </span>
          <span className="muted">nota geral</span>
        </div>
        <div className="painel-progresso">
          <div className="barra">
            <div className="barra-preenchida" style={{ width: `${p.pct}%` }} />
          </div>
          <span className="muted">
            {p.feitas} de {p.total} áreas avaliadas
          </span>
        </div>
      </div>

      {semFoto.length > 0 && (
        <p className="aviso aviso-amarelo">
          ⚠ {semFoto.length} área(s) sem registro fotográfico obrigatório ({semFoto.map((a) => a.nome).join(', ')}).
        </p>
      )}

      {agruparPorCategoria(vistoria.areas).map(
        (grupo) =>
          grupo.areas.length > 0 && (
            <div key={grupo.chave}>
              <h2 className={`secao${grupo.chave === 'caminho_do_rei' ? ' secao-destaque' : ''}`}>{grupo.titulo}</h2>
              {grupo.areas.map((area) => {
                const f = area.nota === null ? null : FAIXAS[faixaDaNota(area.nota)]
                return (
                  <div key={area.id} className={`cartao cartao-linha${area.naoAplicavel ? ' desativado' : ''}`}>
                    <Link to={`/vistorias/${vistoria.id}/areas/${area.id}`} className="cartao-conteudo">
                      <div className="cartao-topo">
                        <strong>
                          <span className="emoji">{area.icone}</span> {area.nome}
                        </strong>
                      </div>
                      <span className="muted">
                        {area.naoAplicavel
                          ? 'Não aplicável'
                          : `${area.fotoIds.length} foto(s)${area.fotoObrigatoria && area.fotoIds.length === 0 ? ' · foto obrigatória' : ''}`}
                      </span>
                    </Link>
                    {!area.naoAplicavel && (
                      <span
                        className="selo-nota"
                        style={f ? { background: f.corFraca, color: f.cor } : { background: '#eef1f5', color: '#6b7684' }}
                      >
                        {area.nota ?? '—'}
                      </span>
                    )}
                    <button
                      type="button"
                      className="excluir"
                      title={area.naoAplicavel ? 'Reativar área' : 'Marcar como não aplicável'}
                      onClick={() => alternarNA(area.id)}
                    >
                      {area.naoAplicavel ? '↩' : 'N/A'}
                    </button>
                  </div>
                )
              })}
            </div>
          ),
      )}

      <label className="campo">
        <span>Observações gerais da vistoria</span>
        <textarea
          rows={4}
          value={vistoria.observacoesGerais}
          placeholder="Contexto, pessoas presentes, pendências da vistoria anterior…"
          onChange={(e) => {
            const atualizada = { ...vistoria, observacoesGerais: e.target.value }
            setVistoria(atualizada)
            salvarVistoria(atualizada)
          }}
        />
      </label>

      <div className="acoes-linha">
        <button type="button" className="btn" onClick={() => navigate(`/vistorias/${vistoria.id}/relatorio`)}>
          👁 Ver relatório
        </button>
        {vistoria.status === 'em_andamento' ? (
          <button type="button" className="btn btn-primario" onClick={concluir}>
            ✔ Concluir vistoria
          </button>
        ) : (
          <button type="button" className="btn" onClick={reabrir}>
            Reabrir para edição
          </button>
        )}
      </div>
    </Layout>
  )
}
