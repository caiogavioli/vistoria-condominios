import { useEffect, useRef, useState } from 'react'
import type { AccountInfo } from '@azure/msal-browser'
import { Layout } from '../components/Layout'
import { ListaOpcoes } from '../components/ListaOpcoes'
import { PainelSync } from '../components/PainelSync'
import { SeletorVistoriador } from '../components/SeletorVistoriador'
import { loginConfigurado, prepararConta, sair } from '../lib/conta'
import { CONFIG_PADRAO, db, lerConfig, salvarConfig } from '../lib/db'
import { baixarArquivo, exportarBackup, importarBackup } from '../lib/backup'
import { apagarVistoriasDemo, contarVistoriasDemo, gerarVistoriasDemo } from '../lib/demo'
import { hojeISO, slug } from '../lib/format'
import { useEhAdmin } from '../lib/usePapel'
import type { Config } from '../types'

export function Ajustes() {
  const [config, setConfig] = useState<Config>(CONFIG_PADRAO)
  const [mensagem, setMensagem] = useState('')
  const [uso, setUso] = useState<string>('')
  const [demo, setDemo] = useState(0)
  const [gerando, setGerando] = useState(false)
  const [conta, setConta] = useState<AccountInfo | null>(null)
  const arquivo = useRef<HTMLInputElement>(null)
  const ehAdmin = useEhAdmin()

  useEffect(() => {
    lerConfig().then(setConfig)
    contarVistoriasDemo().then(setDemo)
    if (loginConfigurado()) prepararConta().then(setConta)
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

  async function gerarDemo() {
    const quantos = await db.condominios.count()
    if (quantos === 0) {
      setMensagem('Cadastre um condomínio antes de gerar as vistorias de demonstração.')
      return
    }
    if (!confirm(`Gerar 3 vistorias fictícias (junho, julho e agosto) para cada um dos ${quantos} condomínios?`)) return
    setGerando(true)
    try {
      const r = await gerarVistoriasDemo()
      setDemo(await contarVistoriasDemo())
      setMensagem(`Geradas ${r.vistorias} vistorias de demonstração em ${r.condominios} condomínio(s).`)
    } finally {
      setGerando(false)
    }
  }

  async function limparDemo() {
    if (!confirm('Apagar todas as vistorias de demonstração? As vistorias reais não são tocadas.')) return
    const n = await apagarVistoriasDemo()
    setDemo(await contarVistoriasDemo())
    setMensagem(`${n} vistoria(s) de demonstração apagada(s).`)
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

      <PainelSync />

      {loginConfigurado() && (
        <>
          <h2 className="secao">Conta</h2>
          <p className="muted">{conta?.username || conta?.name || 'Verificando…'}</p>
          <button type="button" className="btn" onClick={() => sair()}>
            Sair
          </button>
        </>
      )}

      {ehAdmin && (
        <>
          <h2 className="secao">Administração</h2>
          <p className="muted">
            Proprietários e administradoras disponíveis no cadastro dos condomínios.
          </p>
          <ListaOpcoes tipo="proprietario" rotulo="Proprietários" />
          <ListaOpcoes tipo="administradora" rotulo="Administradoras" />
        </>
      )}

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

      <h2 className="secao">Dados de demonstração</h2>
      <p className="muted">
        Gera 3 vistorias fictícias — junho, julho e agosto — para cada condomínio cadastrado, para você ver o
        histórico e o painel com conteúdo. Cada uma sai marcada como demonstração no relatório e pode ser
        apagada em bloco, sem afetar as vistorias reais.
      </p>
      <div className="acoes-linha">
        <button type="button" className="btn" onClick={gerarDemo} disabled={gerando}>
          {gerando ? 'Gerando…' : '🧪 Gerar vistorias de demonstração'}
        </button>
        {demo > 0 && (
          <button type="button" className="btn btn-perigo" onClick={limparDemo}>
            Apagar as {demo} de demonstração
          </button>
        )}
      </div>

      <h2 className="secao">Zona de risco</h2>
      <button type="button" className="btn btn-perigo btn-bloco" onClick={apagarTudo}>
        Apagar todos os dados
      </button>
    </Layout>
  )
}
