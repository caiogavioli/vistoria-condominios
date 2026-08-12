import { comAutenticacao, exigirMetodo, parametroId } from '../_lib/http'
import { atualizarUsuario } from '../_lib/repositorio'

/**
 * Só edição de papel/nome/ativo — usuário não é excluído: o nome dele assina
 * relatórios já entregues. Quem sai da equipe é desativado.
 */
export default comAutenticacao(async (req, res, { q, usuario }) => {
  exigirMetodo(req, 'PATCH')
  res.status(200).json(await atualizarUsuario(q, usuario, parametroId(req), req.body ?? {}))
})
