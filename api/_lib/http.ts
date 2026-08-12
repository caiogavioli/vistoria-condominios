import type { VercelRequest, VercelResponse } from '@vercel/node'
import { obterQuery, type Query } from './db'
import { resolverUsuario, validarToken, type Usuario } from './auth'

/** Erro com status HTTP — vira resposta JSON em vez de 500 genérico. */
export class ErroHttp extends Error {
  constructor(
    public status: number,
    mensagem: string,
  ) {
    super(mensagem)
  }
}

export interface Contexto {
  q: Query
  usuario: Usuario
}

type Handler = (req: VercelRequest, res: VercelResponse, ctx: Contexto) => Promise<void>

/**
 * Envolve um handler com autenticação e tratamento de erro. Toda rota da API
 * exige usuário logado e ativo — não existe endpoint anônimo.
 */
export function comAutenticacao(handler: Handler) {
  return async (req: VercelRequest, res: VercelResponse) => {
    try {
      const q = obterQuery()
      const credenciais = await validarToken(req.headers.authorization)
      const usuario = await resolverUsuario(q, credenciais)
      await handler(req, res, { q, usuario })
    } catch (erro) {
      if (erro instanceof ErroHttp) {
        res.status(erro.status).json({ erro: erro.message })
        return
      }
      console.error(erro)
      res.status(500).json({ erro: 'Erro interno. Tente novamente.' })
    }
  }
}

/** Rejeita métodos não suportados com a lista do que a rota aceita. */
export function exigirMetodo(req: VercelRequest, ...permitidos: string[]): string {
  const metodo = req.method ?? 'GET'
  if (!permitidos.includes(metodo)) {
    throw new ErroHttp(405, `Método não suportado. Use: ${permitidos.join(', ')}.`)
  }
  return metodo
}

export function parametroId(req: VercelRequest): string {
  const id = req.query.id
  const valor = Array.isArray(id) ? id[0] : id
  if (!valor) throw new ErroHttp(400, 'Identificador ausente na URL.')
  return valor
}
