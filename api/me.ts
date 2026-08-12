import { comAutenticacao, exigirMetodo } from './_lib/http'

/** Quem sou eu — o app chama isto logo após o login com Microsoft. */
export default comAutenticacao(async (req, res, { usuario }) => {
  exigirMetodo(req, 'GET')
  res.status(200).json({
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    papel: usuario.papel,
  })
})
