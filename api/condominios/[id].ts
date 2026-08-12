import { comAutenticacao, exigirMetodo, parametroId } from '../_lib/http'
import { arquivarCondominio, atualizarCondominio } from '../_lib/repositorio'

export default comAutenticacao(async (req, res, { q, usuario }) => {
  const metodo = exigirMetodo(req, 'PATCH', 'DELETE')
  const id = parametroId(req)
  if (metodo === 'PATCH') {
    res.status(200).json(await atualizarCondominio(q, usuario, id, req.body ?? {}))
    return
  }
  // DELETE arquiva — vistorias do condomínio continuam no banco.
  await arquivarCondominio(q, usuario, id)
  res.status(200).json({ arquivado: true })
})
