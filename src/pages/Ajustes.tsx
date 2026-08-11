import { useEffect, useRef, useState } from 'react'
import { Layout } from '../components/Layout'
import { SeletorVistoriador } from '../components/SeletorVistoriador'
import { CONFIG_PADRAO, db, lerConfig, salvarConfig } from '../lib/db'
import { baixarArquivo, exportarBackup, importarBackup } from '../lib/backup'
import { hojeISO, slug } from '../lib/format'
import type { Config } from '../types'

export function Ajustes() {
  const [config, setConfig] = useState<Config>(CONFIG_PADRAO)
  const [mensagem, setMensagem] = useState('')
  const [uso, setUso] = useState<string>('')
  const arquivo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    lerConfig().then(setConfig)
    if (navigator.storage?.estimate) {
      navigator.storage.estimate().then(({ usage }) => {
        if (usage) setUso(`${(usage / 1024 / 1024).toFixed(1)} MB usados no aparelho`)
      })
    }
  }, [])

  async function atualizar(patch: Partial<Config>) {
    const novo = { ...config, ...patch }
    setConfig(novo)
    await salvarConfig(patch)
  }

  async function exportar() {
    const blob = await exportarBackup()
    baixarArquivo(blob, `backup-vistorias-${slug(hojeISO())}.json`)
    setMensagem('Backup exportado.')
  }

  async function importar(file: File | undefined) {
    if (!file) return
    try {
      const r = await importarBackup(file)
      setMensagem(`Importado: ${r.condominios} condomínio(s), ${r.vistorias} vistoria(s), ${r.fotos} foto(s).`)
    } catch (erro) {
      setMensagem(`Falha ao importar: ${(erro as Error).message}`)
    } finally {
      if (arquivo.current) arquivo.current.value = ''
    }
  }

  async function apagarTudo() {
    if (!confirm('Apagar TODOS os dados do app neste aparelho? Exporte um backup antes.')) return
    await db.delete()
    location.reload()
  }

  return (
    <Layout titulo="Ajustes" voltarPara="/">
      <label className="campo">
        <span>Empresa / administradora (aparece no relatório)</span>
        <input value={config.empresa} onChange={(e) => atualizar({ empresa: e.target.value })} />
      </label>

      <SeletorVistoriador
        rotulo="Vistoriador padrão"
        valor={config.responsavelPadrao}
        vazio="Nenhum"
        onChange={(responsavelPadrao) => atualizar({ responsavelPadrao })}
      />

      <h2 className="secao">Backup</h2>
      <p className="muted">
        Os dados ficam apenas neste aparelho. Exporte periodicamente — o arquivo inclui as fotos e pode ser
        importado em outro celular ou computador.
      </p>
      <div className="acoes-linha">
        <button type="button" className="btn" onClick={exportar}>
          ⬇ Exportar backup
        </button>
        <button type="button" className="btn" onClick={() => arquivo.current?.click()}>
          ⬆ Importar backup
        </button>
      </div>
      <input ref={arquivo} type="file" accept="application/json" hidden onChange={(e) => importar(e.target.files?.[0])} />
      {mensagem && <p className="aviso aviso-amarelo">{mensagem}</p>}
      {uso && <p className="muted">{uso}</p>}

      <h2 className="secao">Zona de risco</h2>
      <button type="button" className="btn btn-perigo btn-bloco" onClick={apagarTudo}>
        Apagar todos os dados
      </button>
    </Layout>
  )
}
