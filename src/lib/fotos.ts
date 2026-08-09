import type { Foto, Vistoria } from '../types'
import { db, salvarVistoria } from './db'
import { novoId } from './id'
import { comArea } from './vistoria'

/**
 * Adiciona fotos a uma área. A ordem fica em `area.fotoIds`; os blobs vão para
 * a tabela `fotos`. As duas escritas acontecem juntas para não gerar órfãos.
 */
export async function adicionarFotos(vistoria: Vistoria, areaId: string, blobs: Blob[]): Promise<Vistoria> {
  const area = vistoria.areas.find((a) => a.id === areaId)
  if (!area) return vistoria

  const novas: Foto[] = blobs.map((blob) => ({
    id: novoId('foto'),
    vistoriaId: vistoria.id,
    areaId,
    blob,
    legenda: '',
    criadoEm: new Date().toISOString(),
  }))

  await db.fotos.bulkPut(novas)
  const atualizada = comArea(vistoria, { ...area, fotoIds: [...area.fotoIds, ...novas.map((f) => f.id)] })
  await salvarVistoria(atualizada)
  return atualizada
}

export async function removerFoto(vistoria: Vistoria, areaId: string, fotoId: string): Promise<Vistoria> {
  const area = vistoria.areas.find((a) => a.id === areaId)
  if (!area) return vistoria
  await db.fotos.delete(fotoId)
  const atualizada = comArea(vistoria, { ...area, fotoIds: area.fotoIds.filter((id) => id !== fotoId) })
  await salvarVistoria(atualizada)
  return atualizada
}

export async function definirLegenda(fotoId: string, legenda: string): Promise<void> {
  await db.fotos.update(fotoId, { legenda })
}

/** Fotos de uma área na ordem registrada, ignorando ids sem blob correspondente. */
export function fotosDaArea(todas: Foto[], fotoIds: string[]): Foto[] {
  const porId = new Map(todas.map((f) => [f.id, f]))
  return fotoIds.map((id) => porId.get(id)).filter((f): f is Foto => Boolean(f))
}
