import { db } from './db'
import { novoId } from './id'
import type { OpcaoCondominio } from '../types'

/** Só as ativas, em ordem alfabética — o que aparece nos seletores de escolha. */
export function opcoesAtivas(lista: OpcaoCondominio[]): OpcaoCondominio[] {
  return lista.filter((o) => o.ativo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export async function criarOpcao(tipo: OpcaoCondominio['tipo'], nome: string): Promise<void> {
  const nomeLimpo = nome.trim()
  if (!nomeLimpo) return
  const opcao: OpcaoCondominio = {
    id: novoId('opc'),
    tipo,
    nome: nomeLimpo,
    ativo: true,
    criadoEm: new Date().toISOString(),
  }
  await db.opcoesCondominio.put(opcao)
}
