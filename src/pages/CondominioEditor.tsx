import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { SeletorOpcaoCondominio } from '../components/SeletorOpcaoCondominio'
import { SeletorVistoriador } from '../components/SeletorVistoriador'
import { AREAS_PADRAO } from '../data/areasPadrao'
import { db, excluirCondominio } from '../lib/db'
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

  function adicionar() {
    const nova: AreaTemplate = { id: novoId('area'), nome: 'Nova área', icone: '📍', fotoObrigatoria: true }
    salvar({ areasPadrao: [...cond!.areasPadrao, nova] })
    setAbertaId(nova.id)
  }

  async function excluir() {
    if (!confirm(`Excluir "${cond!.nome}"? As vistorias já feitas continuam salvas.`)) return
    await excluirCondominio(cond!.id)
    navigate('/condominios')
  }

  // Condomínios cadastrados antes de o padrão mudar não recebem as áreas novas
  // sozinhos — aqui elas ficam a um toque, sem mexer no que já foi ajustado.
  const jaTem = new Set(cond.areasPadrao.map((a) => a.nome))
  const faltando = AREAS_PADRAO.filter((a) => !jaTem.has(a.nome))

  function adicionarFaltantes() {
    salvar({
      areasPadrao: [...cond!.areasPadrao, ...faltando.map((a) => ({ ...a, id: novoId('area') }))],
    })
  }

  return (
    <Layout
      titulo={cond.nome || 'Condomínio'}
      voltarPara="/condominios"
      acao={
        <Link to={`/condominios/${cond.id}/historico`} className="topbar-icone" aria-label="Histórico de vistorias">
          📈
        </Link>
      }
    >
      <label className="campo">
        <span>Nome</span>
        <input value={cond.nome} onChange={(e) => salvar({ nome: e.target.value })} placeholder="Edifício Modelo" />
      </label>

      <label className="campo">
        <span>Endereço</span>
        <input value={cond.endereco} onChange={(e) => salvar({ endereco: e.target.value })} placeholder="Rua, número — bairro" />
      </label>

      <SeletorVistoriador
        rotulo="Vistoriador"
        valor={cond.vistoriador ?? ''}
        vazio="Escolher na hora da vistoria"
        onChange={(vistoriador) => salvar({ vistoriador })}
      />

      <SeletorOpcaoCondominio
        tipo="proprietario"
        rotulo="Proprietário"
        valor={cond.proprietarioId}
        onChange={(proprietarioId) => salvar({ proprietarioId })}
      />
      <SeletorOpcaoCondominio
        tipo="administradora"
        rotulo="Administradora"
        valor={cond.administradoraId}
        onChange={(administradoraId) => salvar({ administradoraId })}
      />

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

      {faltando.length > 0 && cond.areasPadrao.length > 0 && (
        <div className="anterior">
          <span className="anterior-rotulo">Áreas do padrão que faltam aqui</span>
          <p className="muted">{faltando.map((a) => `${a.icone} ${a.nome}`).join(' · ')}</p>
          <button type="button" className="btn btn-bloco" onClick={adicionarFaltantes}>
            ➕ Adicionar {faltando.length === 1 ? 'esta área' : `estas ${faltando.length} áreas`}
          </button>
        </div>
      )}

      <div className="acoes-linha">
        <button type="button" className="btn" onClick={adicionar}>
          ➕ Adicionar área
        </button>
        {cond.areasPadrao.length === 0 && (
          <button type="button" className="btn" onClick={() => salvar({ areasPadrao: templatesPadrao() })}>
            Restaurar checklist padrão
          </button>
        )}
      </div>

      <button type="button" className="btn btn-perigo btn-bloco" onClick={excluir}>
        Excluir condomínio
      </button>
    </Layout>
  )
}
