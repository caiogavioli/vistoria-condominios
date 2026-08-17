import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Layout, Vazio } from '../components/Layout'
import { db } from '../lib/db'
import { dataBR } from '../lib/format'
import { opcoesAtivas } from '../lib/opcoesCondominio'
import { filtrarVistorias, type FiltrosRelatorio } from '../lib/relatorios'
import { FAIXAS } from '../lib/score'
import type { Faixa, StatusVistoria } from '../types'
import './relatorios.css'

export function Relatorios() {
  const condominios = useLiveQuery(() => db.condominios.orderBy('nome').toArray(), [], [])
  const vistorias = useLiveQuery(() => db.vistorias.toArray(), [], [])
  const opcoes = useLiveQuery(() => db.opcoesCondominio.toArray(), [], [])
  const [filtros, setFiltros] = useState<FiltrosRelatorio>({})

  const proprietarios = opcoesAtivas(opcoes.filter((o) => o.tipo === 'proprietario'))
  const administradoras = opcoesAtivas(opcoes.filter((o) => o.tipo === 'administradora'))

  const linhas = useMemo(() => filtrarVistorias(vistorias, condominios, filtros), [vistorias, condominios, filtros])

  function atualizar(patch: Partial<FiltrosRelatorio>) {
    setFiltros((atual) => ({ ...atual, ...patch }))
  }

  return (
    <Layout titulo="Relatórios" subtitulo="Vistorias da carteira, com filtro" voltarPara="/">
      <div className="filtros-relatorio">
        <label className="campo">
          <span>Condomínio</span>
          <select value={filtros.condominioId ?? ''} onChange={(e) => atualizar({ condominioId: e.target.value || undefined })}>
            <option value="">Todos</option>
            {condominios.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome || 'Sem nome'}
              </option>
            ))}
          </select>
        </label>

        <label className="campo">
          <span>Proprietário</span>
          <select value={filtros.proprietarioId ?? ''} onChange={(e) => atualizar({ proprietarioId: e.target.value || undefined })}>
            <option value="">Todos</option>
            {proprietarios.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="campo">
          <span>Administradora</span>
          <select value={filtros.administradoraId ?? ''} onChange={(e) => atualizar({ administradoraId: e.target.value || undefined })}>
            <option value="">Todas</option>
            {administradoras.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="campo">
          <span>Status</span>
          <select
            value={filtros.status ?? ''}
            onChange={(e) => atualizar({ status: (e.target.value || undefined) as StatusVistoria | undefined })}
          >
            <option value="">Todos</option>
            <option value="em_andamento">Em andamento</option>
            <option value="concluida">Concluída</option>
          </select>
        </label>

        <label className="campo">
          <span>Faixa de nota</span>
          <select value={filtros.faixa ?? ''} onChange={(e) => atualizar({ faixa: (e.target.value || undefined) as Faixa | undefined })}>
            <option value="">Todas</option>
            <option value="otimo">Ótimo</option>
            <option value="regular">Regular</option>
            <option value="critico">Crítico</option>
          </select>
        </label>

        <div className="linha-dupla">
          <label className="campo">
            <span>De</span>
            <input type="date" value={filtros.dataDe ?? ''} onChange={(e) => atualizar({ dataDe: e.target.value || undefined })} />
          </label>
          <label className="campo">
            <span>Até</span>
            <input type="date" value={filtros.dataAte ?? ''} onChange={(e) => atualizar({ dataAte: e.target.value || undefined })} />
          </label>
        </div>
      </div>

      {linhas.length === 0 ? (
        <Vazio>
          <p>Nenhuma vistoria bate com esses filtros.</p>
        </Vazio>
      ) : (
        <div className="bloco">
          {linhas.map(({ vistoria, nota, faixa }) => {
            const f = faixa ? FAIXAS[faixa] : null
            return (
              <Link key={vistoria.id} to={`/vistorias/${vistoria.id}/relatorio`} className="cartao cartao-linha">
                <div className="cartao-conteudo">
                  <div className="cartao-topo">
                    <strong>{vistoria.condominioNome}</strong>
                    <span className="muted">{dataBR(vistoria.data)}</span>
                  </div>
                  <span className="muted">
                    {vistoria.responsavel} · {vistoria.status === 'concluida' ? 'Concluída' : 'Em andamento'}
                  </span>
                </div>
                {f && nota !== null && (
                  <span className="selo-nota" style={{ background: f.corFraca, color: f.cor }}>
                    {nota.toFixed(1).replace('.', ',')}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </Layout>
  )
}
