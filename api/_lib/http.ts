import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * O app é servido pelo GitHub Pages e a API pela Vercel — origens diferentes,
 * então o navegador exige CORS. A lista fica em variável de ambiente para não
 * precisar de deploy quando o endereço mudar; o padrão cobre a instalação atual
 * e o desenvolvimento local.
 */
const ORIGENS_PADRAO = [
  'https://caiogavioli.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
]

function origensPermitidas(): string[] {
  const doAmbiente = (process.env.ORIGENS_PERMITIDAS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
  return doAmbiente.length > 0 ? doAmbiente : ORIGENS_PADRAO
}

/**
 * Aplica CORS e responde o preflight.
 * Devolve `true` quando a requisição já foi respondida e o handler deve parar.
 */
/** Promessa da anotacao do preflight, para o handler poder aguarda-la. */
export let aguardarRegistro: Promise<void> = Promise.resolve()

export function aplicarCors(req: VercelRequest, res: VercelResponse): boolean {
  const origem = req.headers.origin
  if (origem && origensPermitidas().includes(origem)) {
    res.setHeader('Access-Control-Allow-Origin', origem)
  }
  // Origens distintas na resposta conforme o pedido: sem isto, um cache
  // intermediário serviria o cabeçalho de uma origem para outra.
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Max-Age', '86400')

  if (req.method === 'OPTIONS') {
    /*
     * O preflight tambem e anotado.
     *
     * O navegador manda um OPTIONS antes do POST. Se ele falha, o POST nunca
     * sai — e, como esta funcao respondia e retornava antes de qualquer
     * registro, a tentativa nao deixava rastro nenhum. Ficava indistinguivel
     * de "o aplicativo nem tentou", que foi exatamente onde a investigacao
     * empacou.
     */
    // Aguardado, e nao disparado e esquecido: depois que a resposta termina, o
    // ambiente serverless pode congelar a funcao, e a gravacao nunca acontece —
    // que foi exatamente o que ocorreu na primeira tentativa desta anotacao.
    aguardarRegistro = registrarContato(
      req,
      `${new URL(req.url ?? '/', 'http://x').pathname} (preflight)`,
      'OPTIONS',
    ).then(() => {
      res.status(204).end()
    })
    return true
  }
  return false
}

export function erro(res: VercelResponse, status: number, mensagem: string): void {
  res.status(status).json({ erro: mensagem })
}

/**
 * Envolve o handler para que uma exceção vire uma resposta legível, nunca a
 * tela genérica de "esta função quebrou" — que não diz o que houve e obriga a
 * caçar no log.
 *
 * A causa real vai no corpo da resposta de propósito. Esta API não tem segredo
 * a proteger: não há autenticação, e a alternativa é alguém no meio de uma
 * configuração olhando para um erro sem informação nenhuma.
 */
export function comErros(
  handler: (req: VercelRequest, res: VercelResponse) => Promise<void>,
) {
  return async (req: VercelRequest, res: VercelResponse): Promise<void> => {
    try {
      await handler(req, res)
    } catch (e) {
      const causa = e instanceof Error ? e.message : String(e)
      console.error('Falha na API de sincronização:', e)
      if (!res.headersSent) {
        res.status(500).json({
          erro: causa,
          dica: 'As vistorias continuam salvas no aparelho — nada foi perdido.',
        })
      }
    }
  }
}

/**
 * Anota que um aparelho chegou até aqui.
 *
 * Nunca lança e nunca atrasa a resposta: se a anotação falhar, a sincronização
 * segue. É instrumentação, não regra de negócio — não pode ser o motivo de uma
 * vistoria não subir.
 */
export async function registrarContato(
  req: VercelRequest,
  rota: string,
  resumo: string,
): Promise<void> {
  try {
    // Garante as tabelas antes de anotar: numa partida a frio, o preflight pode
    // ser a PRIMEIRA requisicao que o servidor recebe, e a tabela de contatos
    // ainda nao existiria — a anotacao falharia calada, justamente na hora em
    // que ela e mais necessaria.
    const { garantirMigracoes } = await import('./migrar.js')
    await garantirMigracoes()
    const { consultar } = await import('./db.js')
    await consultar(
      'INSERT INTO contatos (rota, origem, resumo) VALUES ($1, $2, $3)',
      [rota, String(req.headers.origin ?? 'sem origem'), resumo],
    )
  } catch (e) {
    console.warn('Não consegui registrar o contato (seguindo assim mesmo).', e)
  }
}
