const LADO_MAXIMO = 1600
const QUALIDADE = 0.82

/**
 * Redimensiona e recomprime a foto antes de guardar. Uma foto de celular sai
 * de ~4 MB para ~300 KB, o que mantém o IndexedDB e o PDF em tamanho viável.
 */
export async function comprimirImagem(arquivo: File | Blob): Promise<Blob> {
  const bitmap = await carregarBitmap(arquivo)
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height))
  const largura = Math.round(bitmap.width * escala)
  const altura = Math.round(bitmap.height * escala)

  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const ctx = canvas.getContext('2d')
  if (!ctx) return arquivo instanceof Blob ? arquivo : new Blob([arquivo])
  ctx.drawImage(bitmap, 0, 0, largura, altura)
  if ('close' in bitmap) bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', QUALIDADE),
  )
  return blob ?? arquivo
}

async function carregarBitmap(arquivo: File | Blob): Promise<ImageBitmap> {
  // createImageBitmap já aplica a orientação EXIF nos navegadores atuais.
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
    } catch {
      /* cai no fallback abaixo */
    }
  }
  const url = URL.createObjectURL(arquivo)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return await createImageBitmap(img)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Blob -> data URL, usado na exportação de backup e no PDF. */
export function blobParaDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export async function dataUrlParaBlob(dataUrl: string): Promise<Blob> {
  const resposta = await fetch(dataUrl)
  return await resposta.blob()
}
