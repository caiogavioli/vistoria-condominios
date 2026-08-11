import type { VercelRequest, VercelResponse } from '@vercel/node'

import { consultar } from './_lib/db.js'
import { aplicarCors, comErros, erro, registrarContato } from './_lib/http.js'
import { garantirMigracoes } from './_lib/migrar.js'

/**
 * Conteúdo das fotos, uma por requisição.
 *
 * Separado de `/api/sync` por causa do limite de ~4,5 MB por requisição na
 * Vercel: uma vistoria completa passa de 8 MB só em imagens. Uma a uma, cada
 * chamada carrega ~300 KB — e uma foto que falhe não derruba o lote inteiro.
 *
 * GET  /api/foto?id=foto_x   → devolve os bytes (image/jpeg)
 * POST /api/foto?id=foto_x&vistoria=..&area=..  → grava os bytes
 */

// O corpo chega como binário. O runtime entrega `req.body` já como Buffer
// quando o tipo não é JSON; `lerCorpo` cobre também o caso de vir como stream.
// O teto de ~4,5 MB por requisição é da plataforma e não se ajusta por código —
// é justamente por isso que as fotos sobem uma a uma, com ~300 KB cada.

export default comErros(async function handler(req: VercelRequest, res: VercelResponse) {
  if (aplicarCors(req, res)) return
  await garantirMigracoes()

  const id = String(req.query.id ?? '')
  if (!id) return erro(res, 400, 'Informe o id da foto.')

  await registrarContato(req, '/api/foto', `${req.method} ${id}`)

  if (req.method === 'GET') return baixar(id, res)
  if (req.method === 'POST') return enviar(req, res, id)
  return erro(res, 405, 'Use GET ou POST.')
})

async function baixar(id: string, res: VercelResponse): Promise<void> {
  const linhas = await consultar<{ conteudo: Buffer; mime: string }>(
    'SELECT conteudo, mime FROM fotos WHERE id = $1',
    [id],
  )
  if (linhas.length === 0) {
    erro(res, 404, 'Foto não encontrada.')
    return
  }
  const { conteudo, mime } = linhas[0]
  res.setHeader('Content-Type', mime || 'image/jpeg')
  // A foto nunca muda de conteúdo depois de gravada — o id é único por imagem.
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  res.status(200).send(conteudo)
}

async function enviar(req: VercelRequest, res: VercelResponse, id: string): Promise<void> {
  const vistoriaId = String(req.query.vistoria ?? '')
  const areaId = String(req.query.area ?? '')
  if (!vistoriaId || !areaId) {
    return erro(res, 400, 'Informe a vistoria e a área da foto.')
  }

  const conteudo = await lerCorpo(req)
  if (conteudo.length === 0) return erro(res, 400, 'Corpo vazio.')

  // Foto de vistoria apagada não volta pela porta dos fundos.
  const apagada = await consultar(
    `SELECT 1 FROM excluidos
      WHERE (tipo = 'foto' AND id = $1) OR (tipo = 'vistoria' AND id = $2)`,
    [id, vistoriaId],
  )
  if (apagada.length > 0) {
    res.status(200).json({ ok: true, ignorada: 'registro excluído' })
    return
  }

  const agora = new Date().toISOString()
  const legenda = String(req.query.legenda ?? '')
  const mime = String(req.headers['content-type'] ?? 'image/jpeg')

  await consultar(
    `INSERT INTO fotos (id, vistoria_id, area_id, conteudo, mime, legenda,
                        criado_em, atualizado_em, versao)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$7, nextval('versao_sync'))
     ON CONFLICT (id) DO NOTHING`,
    [id, vistoriaId, areaId, conteudo, mime, legenda, agora],
  )

  res.status(200).json({ ok: true })
}

/** Junta o corpo binário da requisição. */
function lerCorpo(req: VercelRequest): Promise<Buffer> {
  // Quando o runtime já entregou o corpo pronto, não há stream para ler.
  if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body)

  return new Promise((resolve, reject) => {
    const pedacos: Buffer[] = []
    req.on('data', (p: Buffer) => pedacos.push(p))
    req.on('end', () => resolve(Buffer.concat(pedacos)))
    req.on('error', reject)
  })
}
