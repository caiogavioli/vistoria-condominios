/**
 * Testa funções puras de src/lib que não dependem de navegador nem banco.
 * Não é um framework de testes: é um script, no mesmo espírito de
 * `teste-empacotamento.mjs` — roda com `npx tsx` e sai com código != 0 se
 * algo falhar.
 */
import assert from 'node:assert/strict'
import {
  agruparPorCategoria,
  categoriaDaArea,
  categoriaPorNome,
  moverDentroDaCategoria,
} from '../src/lib/vistoria.js'
import { opcoesAtivas } from '../src/lib/opcoesCondominio.js'
import { filtrarVistorias } from '../src/lib/relatorios.js'
import type { AreaTemplate, Condominio, Vistoria } from '../src/types.js'

let falhas = 0
function teste(nome: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ ${nome}`)
  } catch (e) {
    console.log(`✗ ${nome}: ${(e as Error).message}`)
    falhas++
  }
}

teste('Recepção e Portaria é Caminho do Rei', () => {
  assert.equal(categoriaPorNome('Recepção e Portaria'), 'caminho_do_rei')
})
teste('Elevadores é Caminho do Rei', () => {
  assert.equal(categoriaPorNome('Elevadores'), 'caminho_do_rei')
})
teste('Auditório é Geral', () => {
  assert.equal(categoriaPorNome('Auditório'), 'geral')
})
teste('nome desconhecido cai em Geral', () => {
  assert.equal(categoriaPorNome('Sala de troféus'), 'geral')
})
teste('categoriaDaArea usa o campo gravado quando existe', () => {
  assert.equal(categoriaDaArea({ nome: 'Auditório', categoria: 'caminho_do_rei' }), 'caminho_do_rei')
})
teste('categoriaDaArea cai no retroativo quando falta o campo', () => {
  assert.equal(categoriaDaArea({ nome: 'Elevadores' }), 'caminho_do_rei')
})

teste('agruparPorCategoria separa e preserva a ordem original de cada grupo', () => {
  const areas = [
    { nome: 'Auditório', categoria: 'geral' as const },
    { nome: 'Elevadores', categoria: 'caminho_do_rei' as const },
    { nome: 'Docas', categoria: 'geral' as const },
  ]
  const grupos = agruparPorCategoria(areas)
  assert.equal(grupos[0].chave, 'caminho_do_rei')
  assert.deepEqual(grupos[0].areas.map((a) => a.nome), ['Elevadores'])
  assert.equal(grupos[1].chave, 'geral')
  assert.deepEqual(grupos[1].areas.map((a) => a.nome), ['Auditório', 'Docas'])
})

function area(id: string, nome: string, categoria: 'caminho_do_rei' | 'geral'): AreaTemplate {
  return { id, nome, icone: '📍', fotoObrigatoria: false, categoria }
}

teste('moverDentroDaCategoria troca de posição só com o vizinho da mesma categoria', () => {
  const lista = [
    area('1', 'Recepção', 'caminho_do_rei'),
    area('2', 'Auditório', 'geral'),
    area('3', 'Elevadores', 'caminho_do_rei'),
  ]
  const resultado = moverDentroDaCategoria(lista, '3', -1)
  // "Elevadores" passa a preceder "Recepção" (mesma categoria — dentro do
  // grupo Caminho do Rei, [1,3] vira [3,1]). "Auditório" é o único item de
  // "Geral": sua posição relativa dentro do próprio grupo não muda, mesmo
  // que o índice absoluto dele no array mude.
  assert.deepEqual(resultado.map((a) => a.id), ['3', '1', '2'])
})
teste('moverDentroDaCategoria não faz nada no extremo do grupo', () => {
  const lista = [area('1', 'Recepção', 'caminho_do_rei'), area('2', 'Auditório', 'geral')]
  const resultado = moverDentroDaCategoria(lista, '1', -1)
  assert.deepEqual(resultado.map((a) => a.id), ['1', '2'])
})

teste('opcoesAtivas tira as inativas e ordena por nome', () => {
  const resultado = opcoesAtivas([
    { id: '1', tipo: 'administradora', nome: 'Zelo', ativo: true, criadoEm: '' },
    { id: '2', tipo: 'administradora', nome: 'Alfa', ativo: true, criadoEm: '' },
    { id: '3', tipo: 'administradora', nome: 'Beta', ativo: false, criadoEm: '' },
  ])
  assert.deepEqual(resultado.map((o) => o.nome), ['Alfa', 'Zelo'])
})

function vistoria(parciais: Partial<Vistoria> & Pick<Vistoria, 'id' | 'condominioId' | 'data'>): Vistoria {
  return {
    condominioNome: '',
    endereco: '',
    responsavel: '',
    status: 'concluida',
    areas: [{ id: 'a1', nome: 'Área', icone: '📍', fotoObrigatoria: false, nota: 8, naoAplicavel: false, observacoes: '', fotoIds: [] }],
    observacoesGerais: '',
    criadoEm: `${parciais.data}T00:00:00.000Z`,
    atualizadoEm: `${parciais.data}T00:00:00.000Z`,
    ...parciais,
  }
}

function condominio(parciais: Partial<Condominio> & Pick<Condominio, 'id'>): Condominio {
  return { nome: '', endereco: '', vistoriador: '', areasPadrao: [], criadoEm: '', ...parciais }
}

teste('filtrarVistorias filtra por condomínio', () => {
  const vistorias = [vistoria({ id: 'v1', condominioId: 'c1', data: '2026-01-01' }), vistoria({ id: 'v2', condominioId: 'c2', data: '2026-01-02' })]
  const resultado = filtrarVistorias(vistorias, [], { condominioId: 'c1' })
  assert.deepEqual(resultado.map((l) => l.vistoria.id), ['v1'])
})

teste('filtrarVistorias filtra por proprietário via o condomínio', () => {
  const vistorias = [vistoria({ id: 'v1', condominioId: 'c1', data: '2026-01-01' }), vistoria({ id: 'v2', condominioId: 'c2', data: '2026-01-02' })]
  const condominios = [condominio({ id: 'c1', proprietarioId: 'p1' }), condominio({ id: 'c2', proprietarioId: 'p2' })]
  const resultado = filtrarVistorias(vistorias, condominios, { proprietarioId: 'p1' })
  assert.deepEqual(resultado.map((l) => l.vistoria.id), ['v1'])
})

teste('filtrarVistorias filtra por período (inclusive nas duas pontas)', () => {
  const vistorias = [
    vistoria({ id: 'v1', condominioId: 'c1', data: '2026-01-01' }),
    vistoria({ id: 'v2', condominioId: 'c1', data: '2026-01-15' }),
    vistoria({ id: 'v3', condominioId: 'c1', data: '2026-02-01' }),
  ]
  const resultado = filtrarVistorias(vistorias, [], { dataDe: '2026-01-01', dataAte: '2026-01-15' })
  assert.deepEqual(resultado.map((l) => l.vistoria.id).sort(), ['v1', 'v2'])
})

teste('filtrarVistorias filtra por faixa de nota, sem separar por categoria', () => {
  const boa = vistoria({ id: 'v1', condominioId: 'c1', data: '2026-01-01' })
  const ruim = vistoria({
    id: 'v2',
    condominioId: 'c1',
    data: '2026-01-02',
    areas: [{ id: 'a1', nome: 'Área', icone: '📍', fotoObrigatoria: false, nota: 2, naoAplicavel: false, observacoes: '', fotoIds: [] }],
  })
  const resultado = filtrarVistorias([boa, ruim], [], { faixa: 'critico' })
  assert.deepEqual(resultado.map((l) => l.vistoria.id), ['v2'])
})

teste('filtrarVistorias ordena mais recente primeiro', () => {
  const vistorias = [vistoria({ id: 'v1', condominioId: 'c1', data: '2026-01-01' }), vistoria({ id: 'v2', condominioId: 'c1', data: '2026-03-01' })]
  const resultado = filtrarVistorias(vistorias, [], {})
  assert.deepEqual(resultado.map((l) => l.vistoria.id), ['v2', 'v1'])
})

console.log(falhas === 0 ? '\nTudo passou.' : `\n${falhas} teste(s) falharam.`)
process.exit(falhas ? 1 : 0)
