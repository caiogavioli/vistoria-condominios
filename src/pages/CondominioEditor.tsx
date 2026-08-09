import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { AREAS_SUGERIDAS } from '../data/areasPadrao'
import { db } from '../lib/db'
import { novoId } from '../lib/id'
import { moverItem, templatesPadrao } from '../lib/vistoria'
import type { AreaTemplate, Condominio } from '../types'

export function CondominioEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [cond, setCond] = useState<Condominio | null | undefined>(undefined)
  const [abertaId, setAbertaId] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    db.condominios.get(id).then((c) => setCond(c ?? null))
  }, [id])

  if (cond === undefined) return <Layout titulo="Condomínio" voltarPara="/condominios">Carregando…</Layout>
  if (cond === null) return <Layout titulo="Condomínio" voltarPara="/condominios">Condomínio não encontrado.</Layout>

  async function salvar(patch: Partial<Condominio>) {
    const atualizado = { ...cond!, ...patch }
    setCond(atualizado)
    await db.condominios.put(atualizado)
  }

  function atualizarArea(areaId: string, patch: Partial<AreaTemplate>) {
    salvar({ areasPadrao: cond!.areasPadrao.map((a) => (a.id === areaId ? { ...a, ...patch } : a)) })
  }

  function adicionar(base?: Omit<AreaTemplate, 'id'>) {
    const nova: AreaTemplate = base
      ? { ...base, id: novoId('area'), itens: [...base.itens] }
      : { id: novoId('area'), nome: 'Nova área', icone: '📍', fotoObrigatoria: true, itens: [] }
    salvar({ areasPadrao: [...cond!.areasPadrao, nova] })
    setAbertaId(nova.id)
  }

  async function excluir() {
    if (!confirm(`Excluir "${cond!.nome}"? As vistorias já feitas continuam salvas.`)) return
    await db.condominios.delete(cond!.id)
    navigate('/condominios')
  }

  const jaUsadas = new Set(cond.areasPadrao.map((a) => a.nome))
  const sugestoes = AREAS_SUGERIDAS.filter((s) => !jaUsadas.has(s.nome))

  return (
    <Layout titulo={cond.nome || 'Condomínio'} voltarPara="/condominios">
      <label className="campo">
        <span>Nome</span>
        <input value={cond.nome} onChange={(e) => salvar({ nome: e.target.value })} placeholder="Edifício Modelo" />
      </label>

      <label className="campo">
        <span>Endereço</span>
        <input value={cond.endereco} onChange={(e) => salvar({ endereco: e.target.value })} placeholder="Rua, número — bairro" />
      </label>

      <label className="campo">
        <span>Síndico responsável</span>
        <input value={cond.sindico} onChange={(e) => salvar({ sindico: e.target.value })} placeholder="Nome do síndico" />
      </label>

      <h2 className="secao">Checklist de áreas ({cond.areasPadrao.length})</h2>
      <p className="muted">Essas áreas são copiadas para cada nova vistoria deste condomínio.</p>

      {cond.areasPadrao.map((area, i) => (
        <div key={area.id} className="area-config">
          <div className="area-config-topo">
            <button type="button" className="area-config-nome" onClick={() => setAbertaId(abertaId === area.id ? null : area.id)}>
              <span className="emoji">{area.icone}</span>
              <strong>{area.nome}</strong>
              <span className="chevron">{abertaId === area.id ? '⌄' : '›'}</span>
            </button>
            <div className="area-config-ordem">
              <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => salvar({ areasPadrao: moverItem(cond.areasPadrao, i, i - 1) })}>
                ▲
              </button>
              <button
                type="button"
                aria-label="Descer"
                disabled={i === cond.areasPadrao.length - 1}
                onClick={() => salvar({ areasPadrao: moverItem(cond.areasPadrao, i, i + 1) })}
              >
                ▼
              </button>
            </div>
          </div>

          {abertaId === area.id && (
            <div className="area-config-corpo">
              <div className="linha-dupla">
                <label className="campo campo-emoji">
                  <span>Ícone</span>
                  <input value={area.icone} maxLength={4} onChange={(e) => atualizarArea(area.id, { icone: e.target.value })} />
                </label>
                <label className="campo">
                  <span>Nome da área</span>
                  <input value={area.nome} onChange={(e) => atualizarArea(area.id, { nome: e.target.value })} />
                </label>
              </div>

              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={area.fotoObrigatoria}
                  onChange={(e) => atualizarArea(area.id, { fotoObrigatoria: e.target.checked })}
                />
                <span>Exigir ao menos 1 foto</span>
              </label>

              <label className="campo">
                <span>Pontos de verificação (um por linha)</span>
                <textarea
                  rows={Math.max(3, area.itens.length + 1)}
                  value={area.itens.join('\n')}
                  onChange={(e) =>
                    atualizarArea(area.id, { itens: e.target.value.split('\n').filter((l) => l.trim() !== '') })
                  }
                />
              </label>

              <button
                type="button"
                className="btn btn-perigo"
                onClick={() => salvar({ areasPadrao: cond.areasPadrao.filter((a) => a.id !== area.id) })}
              >
                Remover área
              </button>
            </div>
          )}
        </div>
      ))}

      <div className="acoes-linha">
        <button type="button" className="btn" onClick={() => adicionar()}>
          ➕ Área em branco
        </button>
        {cond.areasPadrao.length === 0 && (
          <button type="button" className="btn" onClick={() => salvar({ areasPadrao: templatesPadrao() })}>
            Restaurar checklist padrão
          </button>
        )}
      </div>

      {sugestoes.length > 0 && (
        <>
          <h2 className="secao">Adicionar área sugerida</h2>
          <div className="chips">
            {sugestoes.map((s) => (
              <button key={s.nome} type="button" className="chip" onClick={() => adicionar(s)}>
                {s.icone} {s.nome}
              </button>
            ))}
          </div>
        </>
      )}

      <button type="button" className="btn btn-perigo btn-bloco" onClick={excluir}>
        Excluir condomínio
      </button>
    </Layout>
  )
}
