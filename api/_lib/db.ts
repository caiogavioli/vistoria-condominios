import { neon } from '@neondatabase/serverless'

/**
 * Executor de consultas. As funções do repositório recebem um `Query` em vez
 * de falar com o Neon diretamente — assim os testes rodam o mesmo código
 * contra um PostgreSQL embutido (PGlite), sem rede e sem credencial.
 */
export type Query = (texto: string, params?: unknown[]) => Promise<{ rows: any[] }>

let cache: Query | null = null

export function obterQuery(): Query {
  if (cache) return cache
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL não configurada nas variáveis de ambiente.')
  const cliente = neon(url)
  cache = async (texto, params = []) => {
    const rows = (await cliente.query(texto, params as any[])) as any[]
    return { rows }
  }
  return cache
}
