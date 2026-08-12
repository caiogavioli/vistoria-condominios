import { comAutenticacao, exigirMetodo } from './_lib/http'
import { importarBackup } from './_lib/repositorio'

/**
 * Migração: recebe o .json exportado pelo app (sem os binários das fotos) e
 * mescla no banco. As fotos em si sobem do aparelho ao SharePoint na etapa
 * seguinte da migração, e as coordenadas entram via PATCH /api/fotos/[id].
 */
export default comAutenticacao(async (req, res, { q, usuario }) => {
  exigirMetodo(req, 'POST')
  res.status(200).json(await importarBackup(q, usuario, req.body ?? {}))
})
