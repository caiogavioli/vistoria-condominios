import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Layout, Vazio } from '../components/Layout'
import { SeletorVistoriador } from '../components/SeletorVistoriador'
import { CONFIG_PADRAO, db, lerConfig } from '../lib/db'
import { hojeISO } from '../lib/format'
import { criarVistoria } from '../lib/vistoria'

export function NovaVistoria() {
  const navigate = useNavigate()
  const condominios = useLiveQuery(async () => await db.condominios.orderBy('nome').toArray(), [], [])
  const [condominioId, setCondominioId] = useState('')
  const [data, setData] = useState(hojeISO())
  const [responsavel, setResponsavel] = useState('')
  const [config, setConfig] = useState(CONFIG_PADRAO)

  useEffect(() => {
    lerConfig().then(setConfig)
  }, [])

  useEffect(() => {
    if (!condominioId && condominios.length > 0) setCondominioId(condominios[0].id)
  }, [condominios, condominioId])

  // Ao escolher o condomínio, já sugere o vistoriador dele; o de Ajustes é a
  // reserva. Continua editável na lista logo abaixo.
  useEffect(() => {
    const cond = condominios.find((c) => c.id === condominioId)
    if (!cond) return
    setResponsavel(cond.vistoriador || config.responsavelPadrao || '')
  }, [condominioId, condominios, config])

  async function iniciar() {
    const cond = condominios.find((c) => c.id === condominioId)
    if (!cond) return
    const vistoria = { ...criarVistoria(cond, responsavel.trim()), data }
    await db.vistorias.put(vistoria)
    navigate(`/vistorias/${vistoria.id}`, { replace: true })
  }

  if (condominios.length === 0) {
    return (
      <Layout titulo="Nova vistoria" voltarPara="/">
        <Vazio>
          <p>Cadastre um condomínio primeiro.</p>
          <button type="button" className="btn btn-primario" onClick={() => navigate('/condominios')}>
            Ir para condomínios
          </button>
        </Vazio>
      </Layout>
    )
  }

  return (
    <Layout titulo="Nova vistoria" voltarPara="/">
      <label className="campo">
        <span>Condomínio</span>
        <select value={condominioId} onChange={(e) => setCondominioId(e.target.value)}>
          {condominios.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome || 'Sem nome'}
            </option>
          ))}
        </select>
      </label>

      <label className="campo">
        <span>Data da vistoria</span>
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
      </label>

      <SeletorVistoriador rotulo="Vistoriador" valor={responsavel} onChange={setResponsavel} />

      <button type="button" className="btn btn-primario btn-bloco" disabled={!condominioId || !responsavel.trim()} onClick={iniciar}>
        Iniciar vistoria
      </button>
      <p className="muted">
        O checklist do condomínio é copiado agora — alterações futuras no cadastro não afetam esta vistoria.
      </p>
    </Layout>
  )
}
