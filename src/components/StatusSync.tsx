import { useCallback, useEffect, useState } from 'react'

import {
  apiConfigurada,
  estadoSync,
  iniciarSyncAutomatico,
  sincronizar,
  type EstadoSync,
} from '../lib/sync'

/**
 * Faixa de estado da sincronização.
 *
 * Ela existe para responder, sem que ninguém precise perguntar, à única dúvida
 * que importa em campo: "o que eu preenchi já chegou nos outros?". Enquanto
 * houver pendência, a faixa diz quantas — e some quando tudo subiu, para não
 * virar ruído permanente na tela.
 */
export function StatusSync() {
  const [estado, setEstado] = useState<EstadoSync | null>(null)
  const [sincronizando, setSincronizando] = useState(false)
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )

  const atualizar = useCallback(async () => {
    setEstado(await estadoSync())
  }, [])

  useEffect(() => {
    if (!apiConfigurada()) return
    void atualizar()

    const parar = iniciarSyncAutomatico(() => {
      void atualizar()
    })
    const marcarOnline = () => setOnline(true)
    const marcarOffline = () => setOnline(false)
    window.addEventListener('online', marcarOnline)
    window.addEventListener('offline', marcarOffline)

    // Uma pendência criada agora precisa aparecer sem esperar o ciclo de 5 min.
    const relogio = window.setInterval(() => void atualizar(), 10_000)

    return () => {
      parar()
      window.removeEventListener('online', marcarOnline)
      window.removeEventListener('offline', marcarOffline)
      window.clearInterval(relogio)
    }
  }, [atualizar])

  async function sincronizarAgora() {
    setSincronizando(true)
    await sincronizar()
    await atualizar()
    setSincronizando(false)
  }

  if (!estado?.configurado) return null

  const pendentes = estado.pendentes
  const tudoEmDia = pendentes === 0 && !estado.ultimoErro

  // Sem pendência e sem erro não há o que dizer: a faixa sai da frente.
  if (tudoEmDia && online) return null

  const tom = !online ? 'offline' : estado.ultimoErro ? 'erro' : 'pendente'

  return (
    <div className={`sync sync-${tom}`} role="status">
      <span className="sync-texto">
        {!online ? (
          <>
            <strong>Sem conexão.</strong> {pendentes > 0 ? `${pendentes} ` : ''}
            {pendentes === 1 ? 'alteração salva' : 'alterações salvas'} no aparelho — sobem
            sozinhas quando o sinal voltar.
          </>
        ) : estado.ultimoErro ? (
          <>
            <strong>Não consegui sincronizar.</strong> {estado.ultimoErro} Nada foi perdido:
            {pendentes > 0 ? ` ${pendentes} ` : ' as '}
            {pendentes === 1 ? 'alteração continua' : 'alterações continuam'} no aparelho.
          </>
        ) : (
          <>
            <strong>
              {pendentes} {pendentes === 1 ? 'alteração' : 'alterações'}
            </strong>{' '}
            aguardando envio.
          </>
        )}
      </span>

      {online && (
        <button
          type="button"
          className="sync-botao"
          onClick={() => void sincronizarAgora()}
          disabled={sincronizando}
        >
          {sincronizando ? 'Enviando…' : 'Enviar agora'}
        </button>
      )}
    </div>
  )
}
