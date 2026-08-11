import { obterPool } from './db.js'
import { MIGRACOES } from './migracoes.js'

/**
 * Aplica as migrações pendentes.
 *
 * Roda sob demanda, na primeira requisição depois de um deploy, porque não há
 * passo de build com acesso ao banco. É idempotente: cada migração é registrada
 * em `migracoes_aplicadas` e nunca roda duas vezes.
 *
 * O bloqueio consultivo evita a corrida óbvia — duas funções acordando juntas
 * depois do deploy e tentando criar as mesmas tabelas ao mesmo tempo.
 */

const CHAVE_BLOQUEIO = 918_273_645

let jaRodouNesteProcesso = false

export async function garantirMigracoes(): Promise<void> {
  if (jaRodouNesteProcesso) return

  const cliente = await obterPool().connect()
  try {
    await cliente.query(`
      CREATE TABLE IF NOT EXISTS migracoes_aplicadas (
        arquivo     TEXT PRIMARY KEY,
        aplicada_em TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await cliente.query('SELECT pg_advisory_lock($1)', [CHAVE_BLOQUEIO])
    try {
      const { rows } = await cliente.query<{ arquivo: string }>(
        'SELECT arquivo FROM migracoes_aplicadas',
      )
      const aplicadas = new Set(rows.map((r) => r.arquivo))

      for (const migracao of MIGRACOES) {
        if (aplicadas.has(migracao.nome)) continue
        await cliente.query(migracao.sql)
        await cliente.query('INSERT INTO migracoes_aplicadas (arquivo) VALUES ($1)', [
          migracao.nome,
        ])
        console.log(`Migração aplicada: ${migracao.nome}`)
      }
    } finally {
      await cliente.query('SELECT pg_advisory_unlock($1)', [CHAVE_BLOQUEIO])
    }
    jaRodouNesteProcesso = true
  } finally {
    cliente.release()
  }
}
