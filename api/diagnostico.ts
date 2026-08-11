/**
 * Estado da instalação, em uma tela.
 *
 * Este arquivo não importa NADA no topo, de propósito. Uma falha ao carregar um
 * módulo acontece antes de qualquer `try` do handler e derruba a função inteira
 * — a plataforma responde "esta função quebrou", sem dizer o motivo, e o erro
 * real só existe num log de outro serviço.
 *
 * Carregando as dependências dentro do `try`, qualquer falha — módulo ausente,
 * banco fora do ar, credencial errada — vira uma resposta legível aqui mesmo.
 * Uma ferramenta de diagnóstico que quebra junto com o que ela deveria
 * diagnosticar não serve para nada.
 *
 * Nada aqui devolve a string de conexão nem qualquer credencial.
 */

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'no-store')

  const relatorio: Record<string, unknown> = {
    api: 'no ar',
    node: process.version,
    databaseUrlDefinida: Boolean(process.env.DATABASE_URL),
  }

  if (!process.env.DATABASE_URL) {
    relatorio.proximoPasso =
      'Defina DATABASE_URL nas variáveis de ambiente do projeto e faça um novo ' +
      'deploy. A plataforma não aplica variáveis a um deploy que já existe.'
    res.status(200).json(relatorio)
    return
  }

  let consultar: (sql: string, p?: unknown[]) => Promise<any[]>
  try {
    ;({ consultar } = await import('./_lib/db'))
    relatorio.modulosCarregados = true
  } catch (e) {
    relatorio.modulosCarregados = false
    relatorio.erro = e instanceof Error ? e.message : String(e)
    relatorio.pilha = e instanceof Error ? e.stack?.split('\n').slice(0, 6) : undefined
    relatorio.proximoPasso =
      'Falha ao carregar o código do servidor — em geral, dependência ausente ' +
      'no pacote publicado.'
    res.status(200).json(relatorio)
    return
  }

  try {
    const [{ agora }] = await consultar('SELECT now()::text AS agora')
    relatorio.bancoConectado = true
    relatorio.horaDoBanco = agora
  } catch (e) {
    relatorio.bancoConectado = false
    relatorio.erro = e instanceof Error ? e.message : String(e)
    relatorio.proximoPasso =
      'A variável existe mas a conexão falhou. Confira se a string foi copiada ' +
      'inteira, incluindo ?sslmode=require no final.'
    res.status(200).json(relatorio)
    return
  }

  try {
    const { garantirMigracoes } = await import('./_lib/migrar')
    await garantirMigracoes()
    relatorio.tabelasCriadas = true

    const [c] = await consultar(`
      SELECT (SELECT count(*) FROM condominios)::text AS condominios,
             (SELECT count(*) FROM vistorias)::text   AS vistorias,
             (SELECT count(*) FROM fotos)::text       AS fotos,
             (SELECT coalesce(sum(octet_length(conteudo)), 0)::text FROM fotos) AS bytes
    `)
    relatorio.conteudo = {
      condominios: Number(c.condominios),
      vistorias: Number(c.vistorias),
      fotos: Number(c.fotos),
      espacoEmFotos: `${(Number(c.bytes) / 1024 / 1024).toFixed(1)} MB`,
    }
    relatorio.origensPermitidas =
      process.env.ORIGENS_PERMITIDAS ?? 'padrão (GitHub Pages + localhost)'
    relatorio.tudoPronto = true
  } catch (e) {
    relatorio.tabelasCriadas = false
    relatorio.erro = e instanceof Error ? e.message : String(e)
    relatorio.pilha = e instanceof Error ? e.stack?.split('\n').slice(0, 6) : undefined
    relatorio.proximoPasso = 'O banco respondeu, mas a criação das tabelas falhou.'
  }

  res.status(200).json(relatorio)
}
