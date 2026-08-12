import type { VercelRequest } from '@vercel/node'
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'

import { consultar } from './db.js'

/**
 * Porta de entrada da API: login com a conta Microsoft da empresa.
 *
 * A exigência é LIGADA POR CONFIGURAÇÃO: só quando `ENTRA_TENANT_ID` e
 * `ENTRA_CLIENT_ID` existirem no ambiente da Vercel. Sem elas, a API segue
 * aberta como está hoje — de propósito, para o deploy desta mudança não
 * derrubar os aparelhos antes de o registro no Entra ID existir e o app
 * ganhar a tela de login. Armar a tranca é: preencher as duas variáveis.
 *
 * O token conferido é o ID token do próprio registro do aplicativo (audiência
 * = client id, emissor = tenant). Ninguém vira usuário por ter conta Microsoft:
 * precisa estar na tabela `usuarios`, ativo — o cadastro é do administrador.
 */

export interface UsuarioApi {
  id: string
  email: string
  nome: string
  papel: 'admin' | 'vistoriador'
}

export type Entrada =
  | { ok: true; usuario: UsuarioApi | null }
  | { ok: false; status: number; mensagem: string }

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null

export function trancaArmada(): boolean {
  return Boolean(process.env.ENTRA_TENANT_ID && process.env.ENTRA_CLIENT_ID)
}

export async function autenticar(req: VercelRequest): Promise<Entrada> {
  if (!trancaArmada()) return { ok: true, usuario: null }

  const tenant = process.env.ENTRA_TENANT_ID as string
  const cliente = process.env.ENTRA_CLIENT_ID as string

  const cabecalho = req.headers.authorization
  if (!cabecalho?.startsWith('Bearer ')) {
    return { ok: false, status: 401, mensagem: 'Entre com sua conta Microsoft para sincronizar.' }
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
    return { ok: false, status: 401, mensagem: 'Sessão expirada. Entre novamente com sua conta Microsoft.' }
  }

  const oid = typeof payload.oid === 'string' ? payload.oid : ''
  const email = String(payload.preferred_username ?? payload.email ?? '').toLowerCase()
  if (!oid || !email) return { ok: false, status: 401, mensagem: 'Token sem identificação de usuário.' }

  // Primeiro pelo oid (imutável); o e-mail é a ponte no primeiro login.
  // `consultar` da casa devolve as linhas diretamente.
  let linhas = (await consultar('SELECT * FROM usuarios WHERE entra_oid = $1', [oid])) as any[]
  if (linhas.length === 0) {
    linhas = (await consultar('SELECT * FROM usuarios WHERE lower(email) = $1', [email])) as any[]
    if (linhas.length > 0 && !linhas[0].entra_oid) {
      await consultar('UPDATE usuarios SET entra_oid = $1 WHERE id = $2', [oid, linhas[0].id])
    }
  }

  const usuario = linhas[0] as (UsuarioApi & { ativo: boolean }) | undefined
  if (!usuario) {
    return {
      ok: false,
      status: 403,
      mensagem: 'Sua conta não está cadastrada no sistema de vistorias. Fale com o administrador.',
    }
  }
  if (!usuario.ativo) {
    return { ok: false, status: 403, mensagem: 'Seu acesso está desativado. Fale com o administrador.' }
  }
  return {
    ok: true,
    usuario: { id: usuario.id, email: usuario.email, nome: usuario.nome, papel: usuario.papel },
  }
}
