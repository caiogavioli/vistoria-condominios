import { comAutenticacao, exigirMetodo } from './_lib/http'
import { criarCondominio, listarCondominios } from './_lib/repositorio'

export default comAutenticacao(async (req, res, { q, usuario }) => {
  const metodo = exigirMetodo(req, 'GET', 'POST')
  if (metodo === 'GET') {
    res.status(200).json(await listarCondominios(q))
    return
  }
  res.status(201).json(await criarCondominio(q, usuario, req.body ?? {}))
})
