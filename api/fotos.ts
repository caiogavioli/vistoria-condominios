import { comAutenticacao, exigirMetodo } from './_lib/http'
import { registrarFoto } from './_lib/repositorio'

/**
 * O arquivo da foto sobe do aparelho direto ao SharePoint (Graph, token
 * delegado). Este endpoint só registra as coordenadas no banco.
 */
export default comAutenticacao(async (req, res, { q, usuario }) => {
  exigirMetodo(req, 'POST')
  res.status(201).json(await registrarFoto(q, usuario, req.body ?? {}))
})
