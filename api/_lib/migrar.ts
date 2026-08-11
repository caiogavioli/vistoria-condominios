import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { pool } from './db'

/**
 * Aplica as migrações pendentes.
 *
 * Roda sob demanda, na primeira requisição depois de um deploy, porque a
 * Vercel não tem passo de build com acesso ao banco para um projeto Vite. É
 * idempotente: cada arquivo é registrado em `migracoes_aplicadas` e nunca roda
 * duas vezes.
 *
 * O bloqueio consultivo evita a corrida óbvia — duas funções acordando juntas
 * depois do deploy e tentando criar as mesmas tabelas ao mesmo tempo.
 */

const CHAVE_BLOQUEIO = 918_273_645

let jaRodouNesteProcesso = false

export async function garantirMigracoes(): Promise<void> {
  if (jaRodouNesteProcesso) return

  const cliente = await pool.connect()
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

      for (const arquivo of arquivosDeMigracao()) {
        if (aplicadas.has(arquivo.nome)) continue
        await cliente.query(arquivo.sql)
        await cliente.query('INSERT INTO migracoes_aplicadas (arquivo) VALUES ($1)', [
          arquivo.nome,
        ])
        console.log(`Migração aplicada: ${arquivo.nome}`)
      }
    } finally {
      await cliente.query('SELECT pg_advisory_unlock($1)', [CHAVE_BLOQUEIO])
    }
    jaRodouNesteProcesso = true
  } finally {
    cliente.release()
  }
}

function arquivosDeMigracao(): { nome: string; sql: string }[] {
  // `process.cwd()` é a raiz do projeto tanto no runtime da Vercel quanto local.
  const pasta = join(process.cwd(), 'servidor', 'migracoes')
  return readdirSync(pasta)
    .filter((n) => n.endsWith('.sql'))
    .sort()
    .map((nome) => ({ nome, sql: readFileSync(join(pasta, nome), 'utf8') }))
}
