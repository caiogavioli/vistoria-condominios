import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Foto } from '../types'
import { db } from './db'

export function useFotosDaVistoria(vistoriaId: string | undefined): Foto[] {
  return (
    useLiveQuery(
      async () => (vistoriaId ? db.fotos.where('vistoriaId').equals(vistoriaId).toArray() : []),
      [vistoriaId],
      [] as Foto[],
    ) ?? []
  )
}

/**
 * Object URLs para as fotos, recriadas apenas quando o conjunto de blobs muda
 * e revogadas ao desmontar, para não vazar memória durante a vistoria.
 *
 * Uma foto tirada em outro aparelho chega primeiro como registro e só depois
 * como imagem, então nem toda foto tem blob. As que ainda não baixaram ficam
 * de fora do mapa — quem exibe trata a ausência como "baixando".
 */
export function useUrlsDeFotos(fotos: Foto[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const comBlob = fotos.filter((f): f is Foto & { blob: Blob } => f.blob instanceof Blob)
  const chave = comBlob.map((f) => `${f.id}:${f.blob.size}`).join('|')

  useEffect(() => {
    const criadas: Record<string, string> = {}
    for (const foto of comBlob) criadas[foto.id] = URL.createObjectURL(foto.blob)
    setUrls(criadas)
    return () => {
      for (const url of Object.values(criadas)) URL.revokeObjectURL(url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave])

  return urls
}
