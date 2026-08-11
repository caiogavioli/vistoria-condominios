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
    res.status(204).end()
    return true
  }
  return false
}

export function erro(res: VercelResponse, status: number, mensagem: string): void {
  res.status(status).json({ erro: mensagem })
}

/** Envolve o handler para que uma exceção vire 500 com log, nunca 200 mudo. */
export function comErros(
  handler: (req: VercelRequest, res: VercelResponse) => Promise<void>,
) {
  return async (req: VercelRequest, res: VercelResponse): Promise<void> => {
    try {
      await handler(req, res)
    } catch (e) {
      console.error('Falha na API de sincronização:', e)
      if (!res.headersSent) {
        erro(res, 500, 'Falha no servidor. A vistoria continua salva no aparelho.')
      }
    }
  }
}
