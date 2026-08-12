import { useEffect, useState, type ReactNode } from 'react'
import { entrar, loginConfigurado, prepararConta } from '../lib/conta'

/**
 * Portão de entrada: quando o login Microsoft está configurado no build, o app
 * só abre depois de entrar. Sem configuração, deixa passar — comportamento
 * idêntico ao atual, para nada quebrar antes de o Entra existir.
 */
export function PortaoLogin({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<'verificando' | 'sem-conta' | 'liberado'>(
    loginConfigurado() ? 'verificando' : 'liberado',
  )

  useEffect(() => {
    if (!loginConfigurado()) return
    prepararConta().then((conta) => setEstado(conta ? 'liberado' : 'sem-conta'))
  }, [])

  if (estado === 'liberado') return <>{children}</>

  return (
    <div className="app">
      <div className="vazio" style={{ paddingTop: '30vh' }}>
        {estado === 'verificando' ? (
          <p>Verificando sua conta…</p>
        ) : (
          <>
            <p>
              <strong>Vistorias · Condomínios</strong>
            </p>
            <p className="muted">Use sua conta da DF Síndicos para entrar.</p>
            <button type="button" className="btn btn-primario" onClick={() => entrar()}>
              Entrar com Microsoft
            </button>
          </>
        )}
      </div>
    </div>
  )
}
