import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import type { Query } from './db'
import { ErroHttp } from './http'

export interface Credenciais {
  /** Identificador imutável da pessoa no Entra ID. */
  oid: string
  email: string
  nome: string
}

export interface Usuario {
  id: string
  email: string
  nome: string
  papel: 'admin' | 'vistoriador'
  ativo: boolean
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null

/**
 * Valida o token emitido pelo Entra ID para o nosso registro de aplicativo.
 * O app envia o token no cabeçalho Authorization; aqui conferimos assinatura,
 * emissor (o tenant da DF Síndicos) e audiência (o client id do registro).
 */
export async function validarToken(cabecalho: string | undefined): Promise<Credenciais> {
  if (!cabecalho?.startsWith('Bearer ')) throw new ErroHttp(401, 'Entre com sua conta Microsoft para continuar.')

  const tenant = process.env.ENTRA_TENANT_ID
  const cliente = process.env.ENTRA_CLIENT_ID
  if (!tenant || !cliente) {
    throw new ErroHttp(500, 'ENTRA_TENANT_ID e ENTRA_CLIENT_ID precisam estar configurados.')
  }

  jwks ??= createRemoteJWKSet(
    new URL(`https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`),
  )

  let payload: JWTPayload
  try {
    ;({ payload } = await jwtVerify(cabecalho.slice('Bearer '.length), jwks, {
      issuer: `https://login.microsoftonline.com/${tenant}/v2.0`,
      audience: cliente,
    }))
  } catch {
    throw new ErroHttp(401, 'Sessão expirada. Entre novamente.')
  }

  const oid = typeof payload.oid === 'string' ? payload.oid : ''
  const email = String(payload.preferred_username ?? payload.email ?? '').toLowerCase()
  if (!oid || !email) throw new ErroHttp(401, 'Token sem identificação de usuário.')
  return { oid, email, nome: typeof payload.name === 'string' ? payload.name : email }
}

/**
 * Traduz a conta Microsoft para o usuário do app. Ninguém é criado
 * automaticamente: quem não está na tabela `usuarios` (ou está desativado)
 * não entra — o cadastro é do administrador.
 */
export async function resolverUsuario(q: Query, cred: Credenciais): Promise<Usuario> {
  // Primeiro pelo oid (imutável); e-mail é a ponte no primeiro login.
  let { rows } = await q('select * from usuarios where entra_oid = $1', [cred.oid])
  if (rows.length === 0) {
    ;({ rows } = await q('select * from usuarios where lower(email) = $1', [cred.email]))
    if (rows.length > 0 && !rows[0].entra_oid) {
      await q('update usuarios set entra_oid = $1 where id = $2', [cred.oid, rows[0].id])
    }
  }

  const usuario = rows[0] as Usuario | undefined
  if (!usuario) {
    throw new ErroHttp(403, 'Sua conta não está cadastrada no sistema de vistorias. Fale com o administrador.')
  }
  if (!usuario.ativo) {
    throw new ErroHttp(403, 'Seu acesso está desativado. Fale com o administrador.')
  }
  return usuario
}
