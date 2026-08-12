import { useCallback, useEffect, useState } from 'react'

import { apiConfigurada, contarPendentes, sincronizar } from '../lib/sync'

/**
 * Estado da sincronização no cabeçalho, ao lado dos ajustes.
 *
 * O app sincroniza sozinho — ao abrir, ao voltar o sinal, segundos depois de
 * cada alteração. Este botão não existe para suprir isso; existe para tornar o
 * automático visível. Quem acabou de preencher uma vistoria num subsolo quer
 * saber se ela já saiu do celular, e ficar sem resposta é o que leva a
 * preencher tudo de novo por desconfiança.
 *
 * Por isso o ícone conta o que falta subir e some quando não falta nada: em dia
 * é o estado silencioso, pendência é o que merece atenção.
 */
export function BotaoSync() {
  const [pendentes, setPendentes] = useState(0)
  const [ocupado, setOcupado] = useState(false)

  const atualizar = useCallback(async () => setPendentes(await contarPendentes()), [])

  useEffect(() => {
    if (!apiConfigurada()) return
    void atualizar()
    const t = window.setInterval(() => void atualizar(), 4000)
    return () => window.clearInterval(t)
  }, [atualizar])

  if (!apiConfigurada()) return null

  async function agora() {
    setOcupado(true)
    await sincronizar()
    await atualizar()
    setOcupado(false)
  }

  const emDia = pendentes === 0

  return (
    <button
      type="button"
      className="topbar-icone sync-icone"
      onClick={() => void agora()}
      disabled={ocupado}
      aria-label={
        ocupado
          ? 'Sincronizando'
          : emDia
            ? 'Tudo sincronizado. Toque para verificar agora.'
            : `${pendentes} alteração(ões) aguardando envio. Toque para enviar agora.`
      }
      title={emDia ? 'Tudo sincronizado' : `${pendentes} aguardando envio`}
    >
      <span className={ocupado ? 'girando' : undefined} aria-hidden>
        {ocupado ? '⟳' : emDia ? '✓' : '⟳'}
      </span>
      {!emDia && !ocupado && (
        <span className="sync-contador" aria-hidden>
          {pendentes > 9 ? '9+' : pendentes}
        </span>
      )}
    </button>
  )
}
