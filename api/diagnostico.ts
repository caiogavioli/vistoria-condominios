import type { VercelRequest, VercelResponse } from '@vercel/node'

import { consultar } from './_lib/db'
import { aplicarCors, comErros } from './_lib/http'
import { garantirMigracoes } from './_lib/migrar'

/**
 * Estado da instalação, em uma tela.
 *
 * Existe porque configurar isto envolve três serviços diferentes, e quando algo
 * não funciona a pergunta é sempre a mesma: qual das três pontas está faltando?
 * Este endereço responde isso sem precisar abrir log nenhum.
 *
 * Nada aqui devolve a string de conexão nem qualquer credencial — só se ela
 * existe, se o banco responde e o que já está gravado.
 */

export default comErros(async function handler(req: VercelRequest, res: VercelResponse) {
  if (aplicarCors(req, res)) return

  const temUrl = Boolean(process.env.DATABASE_URL)
  const relatorio: Record<string, unknown> = {
    api: 'no ar',
    databaseUrlDefinida: temUrl,
  }

  if (!temUrl) {
    relatorio.proximoPasso =
      'Defina DATABASE_URL nas variáveis de ambiente do projeto e faça um novo ' +
      'deploy. A plataforma não aplica variáveis a um deploy que já existe.'
    res.status(200).json(relatorio)
    return
  }

  try {
    const [{ agora }] = await consultar<{ agora: string }>('SELECT now()::text AS agora')
    relatorio.bancoConectado = true
    relatorio.horaDoBanco = agora
  } catch (e) {
    relatorio.bancoConectado = false
    relatorio.erroDoBanco = e instanceof Error ? e.message : String(e)
    relatorio.proximoPasso =
      'A variável existe mas a conexão falhou. Confira se a string foi copiada ' +
      'inteira, incluindo ?sslmode=require no final.'
    res.status(200).json(relatorio)
    return
  }

  await garantirMigracoes()

  const [contagens] = await consultar<Record<string, string>>(`
    SELECT
      (SELECT count(*) FROM condominios)::text AS condominios,
      (SELECT count(*) FROM vistorias)::text   AS vistorias,
      (SELECT count(*) FROM fotos)::text       AS fotos,
      (SELECT coalesce(sum(octet_length(conteudo)), 0)::text FROM fotos) AS bytes_fotos
  `)

  relatorio.tabelasCriadas = true
  relatorio.conteudo = {
    condominios: Number(contagens.condominios),
    vistorias: Number(contagens.vistorias),
    fotos: Number(contagens.fotos),
    espacoEmFotos: `${(Number(contagens.bytes_fotos) / 1024 / 1024).toFixed(1)} MB`,
  }
  relatorio.origensPermitidas =
    process.env.ORIGENS_PERMITIDAS ?? 'padrão (GitHub Pages + localhost)'

  res.status(200).json(relatorio)
})
