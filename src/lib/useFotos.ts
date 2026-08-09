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
 */
export function useUrlsDeFotos(fotos: Foto[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const chave = fotos.map((f) => `${f.id}:${f.blob.size}`).join('|')

  useEffect(() => {
    const criadas: Record<string, string> = {}
    for (const foto of fotos) criadas[foto.id] = URL.createObjectURL(foto.blob)
    setUrls(criadas)
    return () => {
      for (const url of Object.values(criadas)) URL.revokeObjectURL(url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave])

  return urls
}
