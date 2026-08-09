import Dexie, { type EntityTable } from 'dexie'
import type { Condominio, Config, Foto, Vistoria } from '../types'

/**
 * Banco local (IndexedDB). Tudo roda offline no aparelho — vistoria em
 * subsolo sem sinal continua funcionando; o backup é feito por exportação.
 */
class VistoriaDB extends Dexie {
  condominios!: EntityTable<Condominio, 'id'>
  vistorias!: EntityTable<Vistoria, 'id'>
  fotos!: EntityTable<Foto, 'id'>
  config!: EntityTable<Config, 'id'>

  constructor() {
    super('vistorias-condominios')
    this.version(1).stores({
      condominios: 'id, nome, criadoEm',
      vistorias: 'id, condominioId, data, status, atualizadoEm',
      fotos: 'id, vistoriaId, areaId, criadoEm',
      config: 'id',
    })
  }
}

export const db = new VistoriaDB()

export const CONFIG_PADRAO: Config = {
  id: 'unica',
  empresa: 'DF Síndicos',
  responsavelPadrao: '',
  notaAlerta: 5,
}

export async function lerConfig(): Promise<Config> {
  const atual = await db.config.get('unica')
  if (atual) return atual
  await db.config.put(CONFIG_PADRAO)
  return CONFIG_PADRAO
}

export async function salvarConfig(patch: Partial<Config>): Promise<void> {
  const atual = await lerConfig()
  await db.config.put({ ...atual, ...patch, id: 'unica' })
}

/** Grava a vistoria carimbando `atualizadoEm`. */
export async function salvarVistoria(vistoria: Vistoria): Promise<void> {
  await db.vistorias.put({ ...vistoria, atualizadoEm: new Date().toISOString() })
}

/** Remove a vistoria e todas as fotos vinculadas a ela. */
export async function excluirVistoria(id: string): Promise<void> {
  await db.transaction('rw', db.vistorias, db.fotos, async () => {
    await db.fotos.where('vistoriaId').equals(id).delete()
    await db.vistorias.delete(id)
  })
}
