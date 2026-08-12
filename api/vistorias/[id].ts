import { ErroHttp, comAutenticacao, exigirMetodo, parametroId } from '../_lib/http'
import {
  arquivarVistoria,
  atualizarVistoria,
  obterVistoria,
  restaurarVistoria,
} from '../_lib/repositorio'

export default comAutenticacao(async (req, res, { q, usuario }) => {
  const metodo = exigirMetodo(req, 'GET', 'PATCH', 'DELETE')
  const id = parametroId(req)

  if (metodo === 'GET') {
    res.status(200).json(await obterVistoria(q, usuario, id))
    return
  }

  if (metodo === 'DELETE') {
    // Decisão 2: excluir não existe — arquivar com registro, recuperável.
    throw new ErroHttp(405, 'Vistoria não é excluída. Use PATCH com {"arquivar": true}.')
  }

  const corpo = req.body ?? {}
  if (corpo.arquivar === true) {
    await arquivarVistoria(q, usuario, id)
    res.status(200).json({ arquivada: true })
    return
  }
  if (corpo.restaurar === true) {
    await restaurarVistoria(q, usuario, id)
    res.status(200).json({ restaurada: true })
    return
  }
  res.status(200).json(await atualizarVistoria(q, usuario, id, corpo))
})
