import { comAutenticacao, exigirMetodo, parametroId } from '../_lib/http'
import { atualizarFoto, removerFoto } from '../_lib/repositorio'

export default comAutenticacao(async (req, res, { q, usuario }) => {
  const metodo = exigirMetodo(req, 'PATCH', 'DELETE')
  const id = parametroId(req)
  if (metodo === 'PATCH') {
    res.status(200).json(await atualizarFoto(q, usuario, id, req.body ?? {}))
    return
  }
  await removerFoto(q, usuario, id)
  res.status(200).json({ removida: true })
})
