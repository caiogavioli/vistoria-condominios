import type { Condominio, Foto, Vistoria } from '../types'
import { db, lerConfig, salvarConfig } from './db'
import { blobParaDataUrl, dataUrlParaBlob } from './imagem'

interface FotoExportada extends Omit<Foto, 'blob'> {
  dataUrl: string
}

interface Backup {
  formato: 'vistorias-condominios'
  versao: 1
  geradoEm: string
  condominios: Condominio[]
  vistorias: Vistoria[]
  fotos: FotoExportada[]
  config: Awaited<ReturnType<typeof lerConfig>>
}

/** Exporta tudo (inclusive fotos, em base64) para um único arquivo .json. */
export async function exportarBackup(): Promise<Blob> {
  const [condominios, vistorias, fotos, config] = await Promise.all([
    db.condominios.toArray(),
    db.vistorias.toArray(),
    db.fotos.toArray(),
    lerConfig(),
  ])

  // Foto sem blob é a que veio de outro aparelho e ainda não baixou. Ela já
  // está no servidor, então fica fora do arquivo em vez de virar entrada vazia.
  const fotosExportadas: FotoExportada[] = []
  for (const { blob, ...resto } of fotos) {
    if (!blob) continue
    fotosExportadas.push({ ...resto, dataUrl: await blobParaDataUrl(blob) })
  }

  const backup: Backup = {
    formato: 'vistorias-condominios',
    versao: 1,
    geradoEm: new Date().toISOString(),
    condominios,
    vistorias,
    fotos: fotosExportadas,
    config,
  }
  return new Blob([JSON.stringify(backup)], { type: 'application/json' })
}

export interface ResultadoImportacao {
  condominios: number
  vistorias: number
  fotos: number
}

/**
 * Importa um backup por mesclagem: registros com o mesmo id são sobrescritos,
 * os demais são preservados. Nada é apagado.
 */
export async function importarBackup(arquivo: File): Promise<ResultadoImportacao> {
  const texto = await arquivo.text()
  const dados = JSON.parse(texto) as Partial<Backup>
  if (dados.formato !== 'vistorias-condominios') {
    throw new Error('Arquivo não é um backup do app de vistorias.')
  }

  const fotos: Foto[] = []
  for (const { dataUrl, ...resto } of dados.fotos ?? []) {
    fotos.push({ ...resto, blob: await dataUrlParaBlob(dataUrl) })
  }

  await db.transaction('rw', db.condominios, db.vistorias, db.fotos, async () => {
    if (dados.condominios?.length) await db.condominios.bulkPut(dados.condominios)
    if (dados.vistorias?.length) await db.vistorias.bulkPut(dados.vistorias)
    if (fotos.length) await db.fotos.bulkPut(fotos)
  })
  if (dados.config) await salvarConfig({ ...dados.config, id: 'unica' })

  return {
    condominios: dados.condominios?.length ?? 0,
    vistorias: dados.vistorias?.length ?? 0,
    fotos: fotos.length,
  }
}

export function baixarArquivo(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nome
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
