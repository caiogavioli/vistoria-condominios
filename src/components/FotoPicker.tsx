import { useRef, useState } from 'react'
import type { Foto } from '../types'
import { comprimirImagem } from '../lib/imagem'
import { useUrlsDeFotos } from '../lib/useFotos'

interface Props {
  fotos: Foto[]
  onAdicionar: (blobs: Blob[]) => Promise<void>
  onRemover: (fotoId: string) => Promise<void>
  onLegenda: (fotoId: string, legenda: string) => Promise<void>
  obrigatoria: boolean
}

export function FotoPicker({ fotos, onAdicionar, onRemover, onLegenda, obrigatoria }: Props) {
  const camera = useRef<HTMLInputElement>(null)
  const galeria = useRef<HTMLInputElement>(null)
  const [processando, setProcessando] = useState(false)

  async function receber(lista: FileList | null) {
    if (!lista || lista.length === 0) return
    setProcessando(true)
    try {
      const blobs: Blob[] = []
      for (const arquivo of Array.from(lista)) blobs.push(await comprimirImagem(arquivo))
      await onAdicionar(blobs)
    } finally {
      setProcessando(false)
      if (camera.current) camera.current.value = ''
      if (galeria.current) galeria.current.value = ''
    }
  }

  const urls = useUrlsDeFotos(fotos)

  return (
    <div className="foto-picker">
      <div className="foto-acoes">
        <button type="button" className="btn btn-primario" onClick={() => camera.current?.click()} disabled={processando}>
          📷 Tirar foto
        </button>
        <button type="button" className="btn" onClick={() => galeria.current?.click()} disabled={processando}>
          🖼️ Da galeria
        </button>
        {processando && <span className="muted">processando…</span>}
      </div>

      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => receber(e.target.files)} />
      <input ref={galeria} type="file" accept="image/*" multiple hidden onChange={(e) => receber(e.target.files)} />

      {fotos.length === 0 && obrigatoria && (
        <p className="aviso aviso-vermelho">
          📷 Esta área exige ao menos 1 foto para validar o relatório.
        </p>
      )}

      <div className="foto-grid">
        {fotos.map((foto) => (
          <figure key={foto.id} className="foto-item">
            {urls[foto.id] && <img src={urls[foto.id]} alt={foto.legenda || 'Foto da vistoria'} />}
            <input
              className="foto-legenda"
              placeholder="Legenda (opcional)"
              defaultValue={foto.legenda}
              onBlur={(e) => onLegenda(foto.id, e.target.value)}
            />
            <button type="button" className="foto-remover" aria-label="Remover foto" onClick={() => onRemover(foto.id)}>
              ✕
            </button>
          </figure>
        ))}
      </div>
    </div>
  )
}
