/**
 * Testes do servidor sem servidor: roda o repositório contra um PostgreSQL
 * embutido (PGlite), com o schema real. Sem rede, sem credencial.
 *
 *   npm run test:servidor
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import type { Query } from '../api/_lib/db'
import type { Usuario } from '../api/_lib/auth'
import { ErroHttp } from '../api/_lib/http'
import * as repo from '../api/_lib/repositorio'
import { notaGeral } from '../api/_lib/score'

const pg = new PGlite()
const q: Query = async (texto, params = []) => {
  const r = await pg.query(texto, params as any[])
  return { rows: r.rows as any[] }
}

const admin: Usuario = { id: 'usr_caio', email: 'caio@dfsindicos.com.br', nome: 'Caio Gavioli', papel: 'admin', ativo: true }
const amanda: Usuario = { id: 'usr_amanda', email: 'amanda@dfsindicos.com.br', nome: 'Amanda Tigre', papel: 'vistoriador', ativo: true }
const denise: Usuario = { id: 'usr_denise', email: 'denise@dfsindicos.com.br', nome: 'Denise Tigre', papel: 'vistoriador', ativo: true }

async function negado(promessa: Promise<unknown>, status: number, rotulo: string) {
  try {
    await promessa
    assert.fail(`${rotulo}: deveria ter sido negado`)
  } catch (erro) {
    assert.ok(erro instanceof ErroHttp, `${rotulo}: erro inesperado — ${erro}`)
    assert.equal((erro as ErroHttp).status, status, `${rotulo}: status`)
  }
}

let passaram = 0
async function teste(nome: string, corpo: () => Promise<void>) {
  await corpo()
  passaram++
  console.log(`  ok — ${nome}`)
}

// ---------- preparação ----------
await pg.exec(readFileSync('db/schema.sql', 'utf-8'))
for (const u of [admin, amanda, denise]) {
  await q('insert into usuarios (id, email, nome, papel) values ($1, $2, $3, $4)', [u.id, u.email, u.nome, u.papel])
}

// ---------- nota geral ----------
await teste('nota geral espelha o app (média a 1 casa, ignora N/A e sem nota)', async () => {
  assert.equal(notaGeral([{ nota: 7, naoAplicavel: false }, { nota: 6, naoAplicavel: false }]), 6.5)
  assert.equal(notaGeral([{ nota: 9, naoAplicavel: true }, { nota: 4, naoAplicavel: false }, { nota: null, naoAplicavel: false }]), 4)
  assert.equal(notaGeral([]), null)
})

// ---------- condomínios ----------
await teste('admin cadastra condomínio; vistoriador não', async () => {
  await repo.criarCondominio(q, admin, { id: 'cond_1', nome: 'Edifício Modelo', endereco: 'Av. das Nações, 1000' })
  await negado(repo.criarCondominio(q, amanda, { id: 'cond_x', nome: 'Torre' }), 403, 'criar condomínio')
  assert.equal((await repo.listarCondominios(q)).length, 1)
})

// ---------- vistorias: criar e editar ----------
const areasA = [
  { id: 'a1', nome: 'Estacionamento', nota: 4, naoAplicavel: false },
  { id: 'a2', nome: 'Elevadores', nota: 8, naoAplicavel: false },
]

await teste('vistoriador cria a própria vistoria; nota geral é do servidor', async () => {
  const v = await repo.criarVistoria(q, amanda, {
    id: 'vist_1',
    condominioId: 'cond_1',
    data: '2026-08-10',
    areas: areasA,
  })
  assert.equal(v.responsavel_id, 'usr_amanda')
  assert.equal(v.responsavel_nome, 'Amanda Tigre')
  assert.equal(Number(v.nota_geral), 6)
  assert.equal(v.condominio_nome, 'Edifício Modelo') // snapshot
})

await teste('vistoriador não abre vistoria em nome de outro; admin abre', async () => {
  const deAmanda = await repo.criarVistoria(q, amanda, {
    id: 'vist_2', condominioId: 'cond_1', data: '2026-08-11', responsavelId: 'usr_denise', areas: [],
  })
  assert.equal(deAmanda.responsavel_id, 'usr_amanda') // pedido ignorado
  const doAdmin = await repo.criarVistoria(q, admin, {
    id: 'vist_3', condominioId: 'cond_1', data: '2026-08-12', responsavelId: 'usr_denise', areas: [],
  })
  assert.equal(doAdmin.responsavel_id, 'usr_denise')
})

await teste('decisão 1: todo mundo vê, só o dono ou o admin editam', async () => {
  const vistasPorDenise = await repo.listarVistorias(q, denise)
  assert.equal(vistasPorDenise.length, 3) // vê inclusive as da Amanda
  await negado(
    repo.atualizarVistoria(q, denise, 'vist_1', { observacoesGerais: 'invadindo' }),
    403,
    'editar vistoria alheia',
  )
  const v = await repo.atualizarVistoria(q, amanda, 'vist_1', {
    status: 'concluida',
    areas: [...areasA, { id: 'a3', nome: 'Talude', nota: 9, naoAplicavel: false }],
  })
  assert.equal(v.status, 'concluida')
  assert.ok(v.concluida_em, 'concluida_em preenchido')
  assert.equal(Number(v.nota_geral), 7)
  const peloAdmin = await repo.atualizarVistoria(q, admin, 'vist_1', { observacoesGerais: 'revisado' })
  assert.equal(peloAdmin.observacoes_gerais, 'revisado')
})

// ---------- decisão 2: arquivar com registro ----------
await teste('decisão 2: arquivar é do admin, some das listas e fica auditado', async () => {
  await negado(repo.arquivarVistoria(q, amanda, 'vist_2'), 403, 'vistoriador arquivar')
  await repo.arquivarVistoria(q, admin, 'vist_2')
  assert.equal((await repo.listarVistorias(q, amanda)).length, 2)
  await negado(repo.listarVistorias(q, amanda, { arquivadas: true }), 403, 'vistoriador ver arquivadas')
  const arquivadas = await repo.listarVistorias(q, admin, { arquivadas: true })
  assert.equal(arquivadas.length, 1)
  assert.equal(arquivadas[0].arquivada_por, 'usr_caio')
  const trilha = await q(
    "select * from auditoria where entidade = 'vistoria' and entidade_id = 'vist_2' and acao = 'arquivar'",
  )
  assert.equal(trilha.rows.length, 1)
  await repo.restaurarVistoria(q, admin, 'vist_2')
  assert.equal((await repo.listarVistorias(q, amanda)).length, 3)
})

// ---------- fotos ----------
await teste('foto: dono registra e edita; quem não é dono, não', async () => {
  const foto = await repo.registrarFoto(q, amanda, {
    id: 'foto_1', vistoriaId: 'vist_1', areaId: 'a1', legenda: 'Vaga demarcada',
  })
  assert.equal(foto.legenda, 'Vaga demarcada')
  await negado(
    repo.registrarFoto(q, denise, { id: 'foto_x', vistoriaId: 'vist_1', areaId: 'a1' }),
    403,
    'foto em vistoria alheia',
  )
  await repo.atualizarFoto(q, amanda, 'foto_1', { driveId: 'b!drive', itemId: '01ITEM' })
  const completa = await repo.obterVistoria(q, amanda, 'vist_1')
  assert.equal(completa.fotos.length, 1)
  assert.equal(completa.fotos[0].item_id, '01ITEM')
})

// ---------- usuários ----------
await teste('usuários: vistoriador vê só nomes; admin gerencia; último admin protegido', async () => {
  const paraVistoriador = await repo.listarUsuarios(q, amanda)
  assert.ok(!('email' in paraVistoriador[0]), 'vistoriador não vê e-mails')
  await negado(repo.criarUsuario(q, amanda, { id: 'x', email: 'x@x', nome: 'X' }), 403, 'vistoriador criar usuário')
  await repo.criarUsuario(q, admin, { id: 'usr_novo', email: 'novo@dfsindicos.com.br', nome: 'Novo Colega' })
  await repo.atualizarUsuario(q, admin, 'usr_novo', { ativo: false })
  await negado(repo.atualizarUsuario(q, admin, 'usr_caio', { ativo: false }), 400, 'desativar único admin')
  await negado(repo.atualizarUsuario(q, admin, 'usr_caio', { papel: 'vistoriador' }), 400, 'rebaixar único admin')
})

// ---------- importação ----------
await teste('importa backup do app preservando ids e casando responsável pelo nome', async () => {
  const backup = {
    formato: 'vistorias-condominios',
    geradoEm: '2026-08-12T10:00:00Z',
    condominios: [
      { id: 'cond_antigo', nome: 'Residencial Aurora', endereco: 'Rua A, 10', vistoriador: 'Denise Tigre', areasPadrao: [] },
    ],
    vistorias: [
      {
        id: 'vist_antiga',
        condominioId: 'cond_antigo',
        condominioNome: 'Residencial Aurora',
        data: '2026-06-15',
        responsavel: 'Denise Tigre',
        status: 'concluida',
        areas: [{ id: 'a1', nome: 'Docas', nota: 7, naoAplicavel: false }],
        observacoesGerais: '',
        concluidaEm: '2026-06-15T14:00:00Z',
      },
    ],
    fotos: [{ id: 'foto_antiga', vistoriaId: 'vist_antiga', areaId: 'a1', legenda: 'Doca 2' }],
  }
  await negado(repo.importarBackup(q, amanda, backup), 403, 'vistoriador importar')
  const r = await repo.importarBackup(q, admin, backup)
  assert.deepEqual(r, { condominios: 1, vistorias: 1, fotos: 1 })
  const v = await repo.obterVistoria(q, admin, 'vist_antiga')
  assert.equal(v.responsavel_id, 'usr_denise')
  assert.equal(Number(v.nota_geral), 7)
  assert.equal(v.fotos[0].item_id, null) // binário ainda não subiu ao SharePoint
  // Importar de novo não duplica nada (mesclagem por id).
  const r2 = await repo.importarBackup(q, admin, backup)
  assert.deepEqual(r2, { condominios: 1, vistorias: 1, fotos: 1 })
  assert.equal((await repo.listarCondominios(q)).length, 2)
})

console.log(`\n${passaram} testes passaram.`)
await pg.close()
