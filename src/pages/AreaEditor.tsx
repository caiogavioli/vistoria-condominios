import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Delta } from '../components/Delta'
import { FotoPicker } from '../components/FotoPicker'
import { NotaSelector } from '../components/NotaSelector'
import { db, salvarVistoria } from '../lib/db'
import { dataBR } from '../lib/format'
import { chaveArea, vistoriaAnterior, vistoriasDoCondominio } from '../lib/historico'
import { adicionarFotos, definirLegenda, fotosDaArea, removerFoto } from '../lib/fotos'
import { FAIXAS, faixaDaNota } from '../lib/score'
import { useFotosDaVistoria } from '../lib/useFotos'
import { comArea } from '../lib/vistoria'
import type { AreaVistoria, Vistoria } from '../types'

export function AreaEditor() {
  const { id, areaId } = useParams<{ id: string; areaId: string }>()
  const navigate = useNavigate()
  const [vistoria, setVistoria] = useState<Vistoria | null | undefined>(undefined)
  const [previa, setPrevia] = useState<Vistoria | null>(null)
  const todasFotos = useFotosDaVistoria(id)

  useEffect(() => {
    if (!id) return
    db.vistorias.get(id).then((v) => setVistoria(v ?? null))
  }, [id])

  // Carrega a vistoria anterior uma vez por vistoria — depende do id, não do
  // objeto, que muda a cada toque na nota.
  const condominioId = vistoria?.condominioId
  const vistoriaId = vistoria?.id
  useEffect(() => {
    if (!condominioId || !vistoriaId) return
    let ativo = true
    vistoriasDoCondominio(condominioId).then((todas) => {
      const atual = todas.find((v) => v.id === vistoriaId)
      if (ativo && atual) setPrevia(vistoriaAnterior(atual, todas))
    })
    return () => {
      ativo = false
    }
  }, [condominioId, vistoriaId])

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

  const areaAnterior = previa?.areas.find((a) => chaveArea(a) === chaveArea(area)) ?? null
  const delta =
    areaAnterior && areaAnterior.nota !== null && area.nota !== null ? area.nota - areaAnterior.nota : null

  const proxima = vistoria.areas[indice + 1]
  const anterior = vistoria.areas[indice - 1]
  const faixa = area.nota === null ? null : FAIXAS[faixaDaNota(area.nota)]

  return (
    <Layout titulo={`${area.icone} ${area.nome}`} subtitulo={`Área ${indice + 1} de ${vistoria.areas.length}`} voltarPara={`/vistorias/${id}`}>
      <label className="checkbox">
        <input type="checkbox" checked={area.naoAplicavel} onChange={(e) => atualizar({ naoAplicavel: e.target.checked })} />
        <span>Não aplicável nesta vistoria (fica fora da média e do relatório)</span>
      </label>

      {!area.naoAplicavel && areaAnterior && !areaAnterior.naoAplicavel && (
        <div className="anterior">
          <div className="anterior-topo">
            <span className="anterior-rotulo">Vistoria de {dataBR(previa!.data)}</span>
            <strong>
              Nota {areaAnterior.nota ?? '—'}
              {delta !== null && (
                <>
                  {' '}
                  <Delta valor={delta} />
                </>
              )}
            </strong>
          </div>
          {areaAnterior.observacoes.trim() && (
            <details>
              <summary>Ver o que foi apontado da última vez</summary>
              <p>{areaAnterior.observacoes}</p>
            </details>
          )}
        </div>
      )}

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

          <h2 className="secao">Observações</h2>
          <textarea
            rows={6}
            className="observacoes"
            value={area.observacoes}
            placeholder="O que foi constatado, o que precisa ser corrigido e em que prazo."
            onChange={(e) => atualizar({ observacoes: e.target.value })}
          />
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
