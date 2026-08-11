import { useCallback, useEffect, useState } from 'react'

import { enderecoApi, estadoSync, sincronizar, type EstadoSync } from '../lib/sync'

/**
 * Estado da sincronização, por extenso, na tela de Ajustes.
 *
 * A faixa do topo só aparece quando há pendência — de propósito, para não virar
 * ruído. Mas isso cria um silêncio ambíguo: um app que ainda não sabe o
 * endereço do servidor se comporta igualzinho a um app com tudo já sincronizado.
 * Os dois ficam quietos.
 *
 * Essa ambiguidade custou caro para diagnosticar. Aqui o estado é sempre dito
 * por extenso, inclusive quando é "este app não foi configurado para
 * sincronizar" — que é uma informação, não uma ausência dela.
 */
export function PainelSync() {
  const [estado, setEstado] = useState<EstadoSync | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [mensagem, setMensagem] = useState('')

  const atualizar = useCallback(async () => setEstado(await estadoSync()), [])

  useEffect(() => {
    void atualizar()
    const t = window.setInterval(() => void atualizar(), 10_000)
    return () => window.clearInterval(t)
  }, [atualizar])

  async function enviarAgora() {
    setOcupado(true)
    setMensagem('')
    const r = await sincronizar()
    await atualizar()
    setOcupado(false)
    setMensagem(
      r.ok
        ? `Enviados ${r.enviados} registro(s) e ${r.fotosEnviadas} foto(s); recebidos ${r.recebidos} registro(s) e ${r.fotosBaixadas} foto(s).`
        : (r.erro ?? 'Não foi possível sincronizar.'),
    )
  }

  const endereco = enderecoApi()

  return (
    <>
      <h2 className="secao">Sincronização</h2>

      {!endereco ? (
        <>
          <p className="aviso aviso-amarelo">
            Este aplicativo <strong>não está configurado para sincronizar</strong>. As
            vistorias ficam salvas apenas neste aparelho e não chegam aos outros.
          </p>
          <p className="muted">
            Quem administra o sistema precisa definir o endereço do servidor e publicar
            o app novamente.
          </p>
        </>
      ) : (
        <>
          <dl className="sync-lista">
            <div>
              <dt>Servidor</dt>
              <dd className="mono">{endereco}</dd>
            </div>
            <div>
              <dt>Aguardando envio</dt>
              <dd>
                {estado?.pendentes === 0
                  ? 'nada — tudo já subiu'
                  : `${estado?.pendentes ?? '…'} alteração(ões)`}
              </dd>
            </div>
            <div>
              <dt>Último envio</dt>
              <dd>
                {estado?.ultimoSucesso
                  ? new Date(estado.ultimoSucesso).toLocaleString('pt-BR')
                  : 'ainda não sincronizou'}
              </dd>
            </div>
            {estado?.ultimoErro && (
              <div>
                <dt>Última falha</dt>
                <dd>{estado.ultimoErro}</dd>
              </div>
            )}
          </dl>

          <div className="acoes-linha">
            <button type="button" className="btn" onClick={() => void enviarAgora()} disabled={ocupado}>
              {ocupado ? 'Sincronizando…' : '⟳ Sincronizar agora'}
            </button>
          </div>

          {mensagem && <p className="aviso aviso-amarelo">{mensagem}</p>}
        </>
      )}
    </>
  )
}
