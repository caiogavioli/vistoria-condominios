import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

interface Props {
  titulo: string
  subtitulo?: string
  voltarPara?: string
  acao?: ReactNode
  children: ReactNode
}

export function Layout({ titulo, subtitulo, voltarPara, acao, children }: Props) {
  const navigate = useNavigate()
  return (
    <div className="app">
      <header className="topbar">
        {voltarPara !== undefined && (
          <button type="button" className="voltar" aria-label="Voltar" onClick={() => navigate(voltarPara)}>
            ‹
          </button>
        )}
        <div className="topbar-textos">
          <h1>{titulo}</h1>
          {subtitulo && <p>{subtitulo}</p>}
        </div>
        {acao}
      </header>
      <main className="conteudo">{children}</main>
    </div>
  )
}

export function Vazio({ children }: { children: ReactNode }) {
  return <div className="vazio">{children}</div>
}
