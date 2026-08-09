import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { FotoPicker } from '../components/FotoPicker'
import { NotaSelector } from '../components/NotaSelector'
import { db, salvarVistoria } from '../lib/db'
import { adicionarFotos, definirLegenda, fotosDaArea, removerFoto } from '../lib/fotos'
import { FAIXAS, faixaDaNota } from '../lib/score'
import { useFotosDaVistoria } from '../lib/useFotos'
import { comArea } from '../lib/vistoria'
import type { AreaVistoria, StatusItem, Vistoria } from '../types'

const STATUS: { valor: StatusItem; rotulo: string; classe: string }[] = [
  { valor: 'ok', rotulo: 'OK', classe: 'ok' },
  { valor: 'atencao', rotulo: 'Atenção', classe: 'atencao' },
  { valor: 'critico', rotulo: 'Crítico', classe: 'critico' },
  { valor: 'na', rotulo: '—', classe: 'na' },
]

export function AreaEditor() {
  const { id, areaId } = useParams<{ id: string; areaId: string }>()
  const navigate = useNavigate()
  const [vistoria, setVistoria] = useState<Vistoria | null | undefined>(undefined)
  const todasFotos = useFotosDaVistoria(id)

  useEffect(() => {
    if (!id) return
    db.vistorias.get(id).then((v) => setVistoria(v ?? null))
  }, [id])

  const area = vistoria?.areas.find((a) => a.id === areaId) ?? null
  const indice = vistoria?.areas.findIndex((a) => a.id === areaId) ?? -1
  const fotos = useMemo(() => (area ? fotosDaArea(todasFotos, area.fotoIds) : []), [todasFotos, area])

  if (vistoria === undefined) return <Layout titulo="Área" voltarPara={`/vistorias/${id}`}>Carregando…</Layout>
  if (!vistoria || !area) return <Layout titulo="Área" voltarPara={`/vistorias/${id}`}>Área não encontrada.</Layout>

  async function atualizar(patch: Partial<AreaVistoria>) {
    const atualizada = comArea(vistoria!, { ...area!, ...patch })
    setVistoria(atualizada)
    await salvarVistoria(atualizada)
  }

  function statusItem(i: number, status: StatusItem) {
    atualizar({ itens: area!.itens.map((item, idx) => (idx === i ? { ...item, status } : item)) })
  }

  /** Compõe um rascunho de observação a partir dos itens marcados. */
  function montarObservacao() {
    const ok = area!.itens.filter((i) => i.status === 'ok').map((i) => i.texto.toLowerCase())
    const atencao = area!.itens.filter((i) => i.status === 'atencao').map((i) => i.texto.toLowerCase())
    const critico = area!.itens.filter((i) => i.status === 'critico').map((i) => i.texto.toLowerCase())

    const partes: string[] = []
    if (ok.length) partes.push(`Conforme: ${ok.join('; ')}.`)
    if (atencao.length) partes.push(`Pontos de atenção: ${atencao.join('; ')}.`)
    if (critico.length) partes.push(`Não conformidades críticas: ${critico.join('; ')}. Ação corretiva necessária.`)
    if (partes.length === 0) return

    const texto = partes.join(' ')
    atualizar({ observacoes: area!.observacoes ? `${area!.observacoes.trim()}\n${texto}` : texto })
  }

  const proxima = vistoria.areas[indice + 1]
  const anterior = vistoria.areas[indice - 1]
  const faixa = area.nota === null ? null : FAIXAS[faixaDaNota(area.nota)]

  return (
    <Layout titulo={`${area.icone} ${area.nome}`} subtitulo={`Área ${indice + 1} de ${vistoria.areas.length}`} voltarPara={`/vistorias/${id}`}>
      <label className="checkbox">
        <input type="checkbox" checked={area.naoAplicavel} onChange={(e) => atualizar({ naoAplicavel: e.target.checked })} />
        <span>Não aplicável nesta vistoria (fica fora da média e do relatório)</span>
      </label>

      {!area.naoAplicavel && (
        <>
          <h2 className="secao">
            Nota
            {faixa && (
              <span className="etiqueta" style={{ background: faixa.corFraca, color: faixa.cor }}>
                {faixa.simbolo} {faixa.rotulo}
              </span>
            )}
          </h2>
          <NotaSelector valor={area.nota} onChange={(nota) => atualizar({ nota })} />

          {area.itens.length > 0 && (
            <>
              <h2 className="secao">Pontos de verificação</h2>
              <div className="itens">
                {area.itens.map((item, i) => (
                  <div key={`${item.texto}-${i}`} className="item">
                    <span className="item-texto">{item.texto}</span>
                    <div className="item-status">
                      {STATUS.map((s) => (
                        <button
                          key={s.valor}
                          type="button"
                          className={`status status-${s.classe}${item.status === s.valor ? ' ativo' : ''}`}
                          onClick={() => statusItem(i, s.valor)}
                        >
                          {s.rotulo}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <h2 className="secao">Observações</h2>
          <textarea
            rows={6}
            className="observacoes"
            value={area.observacoes}
            placeholder="O que foi constatado, o que precisa ser corrigido e em que prazo."
            onChange={(e) => atualizar({ observacoes: e.target.value })}
          />
          {area.itens.some((i) => i.status !== 'na') && (
            <button type="button" className="btn" onClick={montarObservacao}>
              ✨ Montar texto a partir do checklist
            </button>
          )}

          <h2 className="secao">
            Fotos
            {area.fotoObrigatoria && <span className="etiqueta etiqueta-neutra">obrigatória</span>}
          </h2>
          <FotoPicker
            fotos={fotos}
            obrigatoria={area.fotoObrigatoria}
            onAdicionar={async (blobs) => setVistoria(await adicionarFotos(vistoria, area.id, blobs))}
            onRemover={async (fotoId) => setVistoria(await removerFoto(vistoria, area.id, fotoId))}
            onLegenda={definirLegenda}
          />
        </>
      )}

      <div className="acoes-linha navegacao">
        <button type="button" className="btn" disabled={!anterior} onClick={() => navigate(`/vistorias/${id}/areas/${anterior?.id}`)}>
          ‹ Anterior
        </button>
        {proxima ? (
          <button type="button" className="btn btn-primario" onClick={() => navigate(`/vistorias/${id}/areas/${proxima.id}`)}>
            Próxima ›
          </button>
        ) : (
          <button type="button" className="btn btn-primario" onClick={() => navigate(`/vistorias/${id}`)}>
            Concluir áreas
          </button>
        )}
      </div>
    </Layout>
  )
}
