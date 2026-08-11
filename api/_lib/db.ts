import { Pool } from 'pg'

/**
 * Conexão com o PostgreSQL.
 *
 * Em ambiente serverless cada função pode acordar num processo novo, então o
 * pool é guardado no escopo global do módulo: enquanto o processo é reusado —
 * o caso comum — a conexão é reaproveitada em vez de abrir uma por requisição.
 *
 * `max: 1` é proposital. Muitas funções simultâneas com pools grandes estouram
 * o limite de conexões do Neon rápido; com uma conexão por processo, o teto é
 * o número de processos, que a plataforma já controla.
 */

declare global {
  // eslint-disable-next-line no-var
  var __poolVistorias: Pool | undefined
}

function criarPool(): Pool {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL não configurada no ambiente do servidor.')
  }
  return new Pool({
    connectionString,
    max: 1,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    // Neon exige TLS; o certificado é público e validado pela cadeia padrão.
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: true },
  })
}

export const pool: Pool = global.__poolVistorias ?? criarPool()
if (process.env.NODE_ENV !== 'production') global.__poolVistorias = pool

export async function consultar<T = unknown>(
  sql: string,
  parametros: unknown[] = [],
): Promise<T[]> {
  const resultado = await pool.query(sql, parametros)
  return resultado.rows as T[]
}

/** Roda várias escritas como uma só — ou entra tudo, ou não entra nada. */
export async function emTransacao<T>(
  trabalho: (executar: (sql: string, parametros?: unknown[]) => Promise<unknown[]>) => Promise<T>,
): Promise<T> {
  const cliente = await pool.connect()
  try {
    await cliente.query('BEGIN')
    const resultado = await trabalho(async (sql, parametros = []) => {
      const r = await cliente.query(sql, parametros)
      return r.rows
    })
    await cliente.query('COMMIT')
    return resultado
  } catch (erro) {
    await cliente.query('ROLLBACK')
    throw erro
  } finally {
    cliente.release()
  }
}
