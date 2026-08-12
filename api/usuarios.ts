import { comAutenticacao, exigirMetodo } from './_lib/http'
import { criarUsuario, listarUsuarios } from './_lib/repositorio'

export default comAutenticacao(async (req, res, { q, usuario }) => {
  const metodo = exigirMetodo(req, 'GET', 'POST')
  if (metodo === 'GET') {
    res.status(200).json(await listarUsuarios(q, usuario))
    return
  }
  res.status(201).json(await criarUsuario(q, usuario, req.body ?? {}))
})
