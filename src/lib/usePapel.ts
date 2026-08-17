import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'

/**
 * Papel de quem está logado, segundo o último sincronismo bem-sucedido.
 * `undefined` enquanto ainda não sincronizou nenhuma vez; `null` quando o
 * login Microsoft não está configurado ou não identificou usuário — nesses
 * casos o acesso é tratado como liberado, mesma degradação graciosa do resto
 * do app (ver `trancaArmada`/`loginConfigurado`).
 */
export function usePapel(): 'admin' | 'vistoriador' | null | undefined {
  const meta = useLiveQuery(() => db.syncMeta.get('unica'))
  if (meta === undefined) return undefined
  return meta?.usuario?.papel ?? null
}

/** Pode administrar Proprietários/Administradoras: todo mundo, exceto quem logou como vistoriador. */
export function useEhAdmin(): boolean {
  return usePapel() !== 'vistoriador'
}
