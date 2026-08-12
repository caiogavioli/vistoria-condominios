import { comAutenticacao, exigirMetodo } from './_lib/http'
import { criarVistoria, listarVistorias } from './_lib/repositorio'

export default comAutenticacao(async (req, res, { q, usuario }) => {
  const metodo = exigirMetodo(req, 'GET', 'POST')
  if (metodo === 'GET') {
    const condominioId = typeof req.query.condominioId === 'string' ? req.query.condominioId : undefined
    const arquivadas = req.query.arquivadas === '1'
    res.status(200).json(await listarVistorias(q, usuario, { condominioId, arquivadas }))
    return
  }
  res.status(201).json(await criarVistoria(q, usuario, req.body ?? {}))
})
