// `pg` é um pacote CommonJS e este projeto é ESM. A importação default seguida
// de desestruturação é a forma que funciona nos dois mundos; `import { Pool }`
// depende da análise estática do pacote e falha em alguns empacotadores.
import pg from 'pg'

const { Pool } = pg
type Pool = pg.Pool

/**
 * Conexão com o PostgreSQL.
 *
 * O pool é criado na PRIMEIRA consulta, não ao carregar o módulo. A diferença
 * importa: uma exceção durante o carregamento acontece antes de qualquer
 * tratamento de erro e a plataforma responde com "esta função quebrou", sem
 * dizer o motivo. Criando sob demanda, uma configuração faltando vira uma
 * mensagem legível na resposta e no log.
 *
 * Em ambiente serverless cada função pode acordar num processo novo, então o
 * pool é guardado no escopo do módulo: enquanto o processo é reusado — o caso
 * comum — a conexão é reaproveitada em vez de abrir uma por requisição.
 *
 * `max: 1` é proposital. Muitas funções simultâneas com pools grandes estouram
 * o limite de conexões do Neon rápido; com uma conexão por processo, o teto é o
 * número de processos, que a plataforma já controla.
 */

let poolAtual: Pool | null = null

export class ConfiguracaoAusenteError extends Error {
  constructor() {
    super(
      'DATABASE_URL não está definida nas variáveis de ambiente do projeto. ' +
        'Defina-a nas configurações e faça um novo deploy — a plataforma não ' +
        'aplica variáveis a um deploy que já existe.',
    )
    this.name = 'ConfiguracaoAusenteError'
  }
}

export function obterPool(): Pool {
  if (poolAtual) return poolAtual

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new ConfiguracaoAusenteError()

  const local =
    connectionString.includes('localhost') || connectionString.includes('127.0.0.1')

  poolAtual = new Pool({
    connectionString,
    max: 1,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
    // Fora do ambiente local, o TLS vem do próprio `sslmode` da string de
    // conexão. Forçar um objeto `ssl` aqui entraria em conflito com ele.
    ...(local ? { ssl: false as const } : {}),
  })

  return poolAtual
}

export async function consultar<T = unknown>(
  sql: string,
  parametros: unknown[] = [],
): Promise<T[]> {
  const resultado = await obterPool().query(sql, parametros)
  return resultado.rows as T[]
}

/** Roda várias escritas como uma só — ou entra tudo, ou não entra nada. */
export async function emTransacao<T>(
  trabalho: (executar: (sql: string, parametros?: unknown[]) => Promise<unknown[]>) => Promise<T>,
): Promise<T> {
  const cliente = await obterPool().connect()
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
