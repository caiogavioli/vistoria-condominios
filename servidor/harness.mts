/**
 * Sobe a API localmente para teste, sem a Vercel.
 *
 * Reaproveita EXATAMENTE os handlers de `api/`, com um adaptador mínimo entre
 * o `http` do Node e o formato que a Vercel entrega. Testar uma reimplementação
 * do protocolo não provaria nada sobre o que vai para produção.
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

import sync from '../api/sync.js'
import foto from '../api/foto.js'
import diagnostico from '../api/diagnostico.js'

const PORTA_API = Number(process.env.PORTA_API ?? 3201)
const PORTA_APP = Number(process.env.PORTA_APP ?? 3200)

function adaptar(handler: (req: any, res: any) => Promise<void> | void) {
  return async (reqNode: any, resNode: any) => {
    const url = new URL(reqNode.url, `http://localhost:${PORTA_API}`)
    const query: Record<string, string> = {}
    url.searchParams.forEach((v, k) => (query[k] = v))

    const corpo: Buffer = await new Promise((resolve, reject) => {
      const p: Buffer[] = []
      reqNode.on('data', (c: Buffer) => p.push(c))
      reqNode.on('end', () => resolve(Buffer.concat(p)))
      reqNode.on('error', reject)
    })

    const tipo = String(reqNode.headers['content-type'] ?? '')
    const req: any = Object.assign(reqNode, {
      query,
      body: tipo.includes('application/json')
        ? corpo.length
          ? JSON.parse(corpo.toString('utf8'))
          : {}
        : corpo,
    })

    const res: any = Object.assign(resNode, {
      status(codigo: number) {
        resNode.statusCode = codigo
        return res
      },
      json(dados: unknown) {
        resNode.setHeader('Content-Type', 'application/json')
        resNode.end(JSON.stringify(dados))
        return res
      },
      send(dados: any) {
        resNode.end(dados)
        return res
      },
    })

    await handler(req, res)
  }
}

const rotas: Record<string, (req: any, res: any) => Promise<void>> = {
  '/api/sync': adaptar(sync as any),
  '/api/foto': adaptar(foto as any),
  '/api/diagnostico': adaptar(diagnostico as any),
}

createServer(async (req, res) => {
  const caminho = new URL(req.url!, 'http://localhost').pathname
  const rota = rotas[caminho]
  if (!rota) {
    res.statusCode = 404
    res.end('sem rota')
    return
  }
  try {
    await rota(req, res)
  } catch (e) {
    console.error(e)
    if (!res.headersSent) {
      res.statusCode = 500
      res.end(JSON.stringify({ erro: String(e) }))
    }
  }
}).listen(PORTA_API, () => console.log(`API em http://localhost:${PORTA_API}`))

// Servidor estático do app, em outra porta — assim o teste também exercita o
// CORS, que é como vai funcionar em produção (Pages + Vercel).
const TIPOS: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
}

createServer(async (req, res) => {
  const caminho = new URL(req.url!, 'http://localhost').pathname
  const arquivo = caminho === '/' ? '/index.html' : caminho
  try {
    const conteudo = await readFile(join(process.cwd(), 'dist', arquivo))
    res.setHeader('Content-Type', TIPOS[extname(arquivo)] ?? 'application/octet-stream')
    res.end(conteudo)
  } catch {
    const html = await readFile(join(process.cwd(), 'dist', 'index.html'))
    res.setHeader('Content-Type', 'text/html')
    res.end(html)
  }
}).listen(PORTA_APP, () => console.log(`App em http://localhost:${PORTA_APP}`))
