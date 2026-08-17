# Categorias de área, Proprietário/Administradora e Relatórios — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Categorizar as áreas do checklist em "Caminho do Rei" (destaque) e
"Geral", cadastrar Proprietário/Administradora por condomínio a partir de
listas geridas por admin, e entregar uma página de Relatórios que filtra
vistorias da carteira inteira por essas dimensões.

**Architecture:** Tudo continua offline-first (Dexie local, sincronizado com
Postgres via `/api/sync`). Categoria de área viaja dentro do JSON que já
existe (sem migração). Proprietário/Administradora são uma única entidade
`OpcaoCondominio` (parametrizada por `tipo`) para não duplicar tabela, sync e
tela. O papel do usuário (`admin`/`vistoriador`), hoje só conhecido pelo
servidor, passa a viajar na resposta de `/api/sync` para o front poder
restringir a tela de administração.

**Tech Stack:** React 19 + React Router + Dexie (IndexedDB) + Vercel
Functions + PostgreSQL (Neon), TypeScript em todo o projeto. Sem framework de
testes unitários no repositório — verificação por script `tsx` com
`node:assert` (mesmo padrão de `servidor/teste-empacotamento.mjs`) e pelo
harness de integração já existente (`servidor/harness.mts`,
`servidor/teste-sync.mjs`).

**Spec:** `docs/superpowers/specs/2026-08-17-categorias-relatorios-design.md`

## Global Constraints

- Textos de UI, comentários e nomes de identificadores em português, como em
  todo o resto do código.
- Campos novos em tipos existentes (`categoria`, `usuario`) são **opcionais**
  — dados gravados antes desta mudança não os têm.
- `npm run typecheck` precisa passar depois de cada tarefa que toca `src/`
  ou `api/`.
- Sem framework de testes novo (nada de vitest/jest) — a verificação de
  lógica pura usa `tsx` + `node:assert/strict`, seguindo o estilo de
  `servidor/teste-empacotamento.mjs`.
- Seguir os padrões já estabelecidos: `<select className="campo">` para
  listas fechadas, `<SeletorX>` em `datalist` só quando o campo aceita texto
  livre, gravação otimista no estado local antes do `await db....put(...)`.

---

## Task 1: Categoria de área — tipos, dados-modelo e funções puras

**Files:**
- Modify: `src/types.ts`
- Modify: `src/data/areasPadrao.ts`
- Modify: `src/lib/vistoria.ts`
- Create: `servidor/teste-logica.mts`
- Modify: `package.json`

**Interfaces:**
- Produces: `CategoriaArea` (tipo), `categoriaPorNome(nome: string): CategoriaArea`,
  `categoriaDaArea(area: { nome: string; categoria?: CategoriaArea }): CategoriaArea`,
  `GRUPOS_CATEGORIA: { chave: CategoriaArea; titulo: string }[]`,
  `agruparPorCategoria<T extends { nome: string; categoria?: CategoriaArea }>(areas: T[]): { chave: CategoriaArea; titulo: string; areas: T[] }[]`,
  `moverDentroDaCategoria(lista: AreaTemplate[], id: string, direcao: -1 | 1): AreaTemplate[]`.
  Todas usadas por tarefas 8–11.

- [ ] **Step 1: Escrever o script de verificação (vai falhar — as funções ainda não existem)**

Criar `servidor/teste-logica.mts`:

```ts
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
import type { AreaTemplate } from '../src/types.js'

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

console.log(falhas === 0 ? '\nTudo passou.' : `\n${falhas} teste(s) falharam.`)
process.exit(falhas ? 1 : 0)
```

- [ ] **Step 2: Rodar e confirmar que falha (as importações ainda não existem)**

Run: `npx tsx servidor/teste-logica.mts`
Expected: falha ao importar `categoriaPorNome` (ou similar) de `vistoria.js` — o arquivo ainda não exporta essas funções.

- [ ] **Step 3: Adicionar `CategoriaArea` e o campo `categoria` aos tipos**

Em `src/types.ts`, logo acima de `AreaTemplate`:

```ts
/** 'caminho_do_rei' = trajeto do visitante (cartilha de boas práticas), destaque prioritário. 'geral' = as demais. */
export type CategoriaArea = 'caminho_do_rei' | 'geral'
```

Em `AreaTemplate`, adicionar o campo (mantendo os demais como estão):

```ts
export interface AreaTemplate {
  id: string
  nome: string
  icone: string
  fotoObrigatoria: boolean
  /** Ausente em áreas gravadas antes desta categoria existir — ver `categoriaDaArea`. */
  categoria?: CategoriaArea
}
```

Em `AreaVistoria`, adicionar o mesmo campo (entre `fotoObrigatoria` e `nota`):

```ts
  categoria?: CategoriaArea
```

- [ ] **Step 4: Categorizar as 13 áreas-modelo**

Em `src/data/areasPadrao.ts`, adicionar `categoria` a cada entrada, conforme
decidido com o cliente (mapeamento da cartilha "Cuidado com o Caminho do
Rei"):

```ts
import type { AreaTemplate } from '../types'

/**
 * Checklist padrão. As 10 primeiras são as do relatório modelo (Edifício
 * Modelo, rev2), na mesma ordem; as três últimas foram acrescentadas depois e
 * entram no fim para não deslocar a sequência do modelo.
 *
 * `categoria` segue a cartilha "Cuidado com o Caminho do Rei": o trajeto do
 * visitante (portaria, acessos, vias internas, estacionamento, hall,
 * elevadores) e o que o mantém assim (limpeza e manutenção do próprio
 * trajeto) entram em `caminho_do_rei`; o resto, em `geral`.
 */
export const AREAS_PADRAO: Omit<AreaTemplate, 'id'>[] = [
  { nome: 'Recepção e Portaria', icone: '🏢', fotoObrigatoria: true, categoria: 'caminho_do_rei' },
  { nome: 'Auditório', icone: '🎭', fotoObrigatoria: true, categoria: 'geral' },
  { nome: 'Estacionamento', icone: '🚗', fotoObrigatoria: true, categoria: 'caminho_do_rei' },
  { nome: 'Segurança Patrimonial', icone: '🔒', fotoObrigatoria: true, categoria: 'caminho_do_rei' },
  { nome: 'Bicicletário', icone: '🚲', fotoObrigatoria: true, categoria: 'geral' },
  { nome: 'Elevadores', icone: '🛗', fotoObrigatoria: true, categoria: 'caminho_do_rei' },
  { nome: 'Heliponto', icone: '🚁', fotoObrigatoria: true, categoria: 'caminho_do_rei' },
  { nome: 'Jardinagem e Paisagismo', icone: '🌿', fotoObrigatoria: true, categoria: 'caminho_do_rei' },
  { nome: 'Limpeza e Conservação', icone: '🧹', fotoObrigatoria: true, categoria: 'caminho_do_rei' },
  { nome: 'Manutenção e Zeladoria', icone: '🔧', fotoObrigatoria: true, categoria: 'caminho_do_rei' },
  { nome: 'Talude', icone: '⛰️', fotoObrigatoria: true, categoria: 'geral' },
  { nome: 'Sistemas de Incêndio', icone: '🧯', fotoObrigatoria: true, categoria: 'geral' },
  { nome: 'Docas', icone: '🚚', fotoObrigatoria: true, categoria: 'geral' },
]
```

- [ ] **Step 5: Implementar as funções puras em `src/lib/vistoria.ts`**

No topo do arquivo, ajustar o import de tipos:

```ts
import { AREAS_PADRAO } from '../data/areasPadrao'
import type { AreaTemplate, AreaVistoria, CategoriaArea, Condominio, Vistoria } from '../types'
import { hojeISO } from './format'
import { novoId } from './id'
```

Logo depois do import, antes de `templatesPadrao`:

```ts
const CATEGORIA_PADRAO_POR_NOME = new Map<string, CategoriaArea>(
  AREAS_PADRAO.map((a) => [a.nome, a.categoria ?? 'geral']),
)

/** Categoria de uma área sem o campo gravado, pelo nome — pelas 13 áreas-modelo, ou "geral". */
export function categoriaPorNome(nome: string): CategoriaArea {
  return CATEGORIA_PADRAO_POR_NOME.get(nome) ?? 'geral'
}

/** Categoria efetiva: o que foi gravado na área, ou o retroativo por nome. */
export function categoriaDaArea(area: { nome: string; categoria?: CategoriaArea }): CategoriaArea {
  return area.categoria ?? categoriaPorNome(area.nome)
}

export const GRUPOS_CATEGORIA: { chave: CategoriaArea; titulo: string }[] = [
  { chave: 'caminho_do_rei', titulo: '👑 Caminho do Rei' },
  { chave: 'geral', titulo: 'Geral' },
]

/** Agrupa áreas por categoria, Caminho do Rei primeiro, preservando a ordem original de cada grupo. */
export function agruparPorCategoria<T extends { nome: string; categoria?: CategoriaArea }>(
  areas: T[],
): { chave: CategoriaArea; titulo: string; areas: T[] }[] {
  return GRUPOS_CATEGORIA.map((g) => ({
    ...g,
    areas: areas.filter((a) => categoriaDaArea(a) === g.chave),
  }))
}

/**
 * Move uma área para a posição do seu vizinho dentro da MESMA categoria — não
 * do índice adjacente na lista inteira, que poderia ser de outra categoria.
 * Áreas de fora do grupo não mudam de posição relativa entre si.
 */
export function moverDentroDaCategoria(lista: AreaTemplate[], id: string, direcao: -1 | 1): AreaTemplate[] {
  const alvo = lista.find((a) => a.id === id)
  if (!alvo) return lista
  const categoria = categoriaDaArea(alvo)
  const doGrupo = lista.map((a, indice) => ({ a, indice })).filter(({ a }) => categoriaDaArea(a) === categoria)
  const posicao = doGrupo.findIndex(({ a }) => a.id === id)
  const vizinho = doGrupo[posicao + direcao]
  if (!vizinho) return lista
  const indiceAtual = lista.findIndex((a) => a.id === id)
  return moverItem(lista, indiceAtual, vizinho.indice)
}
```

Em `areaDeTemplate`, incluir `categoria` na área da vistoria (entre
`fotoObrigatoria` e `nota`):

```ts
export function areaDeTemplate(template: AreaTemplate): AreaVistoria {
  return {
    id: novoId('av'),
    templateId: template.id,
    nome: template.nome,
    icone: template.icone,
    fotoObrigatoria: template.fotoObrigatoria,
    categoria: template.categoria,
    nota: null,
    naoAplicavel: false,
    observacoes: '',
    fotoIds: [],
  }
}
```

O resto do arquivo (`criarCondominio`, `criarVistoria`, `comArea`,
`moverItem`) não muda.

- [ ] **Step 6: Rodar o script de novo e confirmar que passa**

Run: `npx tsx servidor/teste-logica.mts`
Expected: `Tudo passou.` e código de saída 0.

- [ ] **Step 7: Registrar o script como comando npm e conferir o typecheck**

Em `package.json`, no bloco `scripts`, logo abaixo de `"teste:api"`:

```json
    "teste:api": "node servidor/teste-empacotamento.mjs",
    "teste:logica": "tsx servidor/teste-logica.mts"
```

Run: `npm run teste:logica && npm run typecheck`
Expected: os dois passam sem erro.

- [ ] **Step 8: Commit**

```bash
git add src/types.ts src/data/areasPadrao.ts src/lib/vistoria.ts servidor/teste-logica.mts package.json
git commit -m "Categoriza as áreas do checklist em Caminho do Rei e Geral"
```

---

## Task 2: `OpcaoCondominio` — tipo, campos no `Condominio` e tabela local

**Files:**
- Modify: `src/types.ts`
- Modify: `src/lib/db.ts`

**Interfaces:**
- Consumes: nada de tarefas anteriores.
- Produces: `OpcaoCondominio` (tipo), `Condominio.proprietarioId?: string`,
  `Condominio.administradoraId?: string`, `db.opcoesCondominio: EntityTable<OpcaoCondominio, 'id'>`.
  Usado a partir da Tarefa 3 (Postgres), 4/5 (sync) e 6+ (UI).

- [ ] **Step 1: Adicionar o tipo `OpcaoCondominio` e os campos no `Condominio`**

Em `src/types.ts`, logo abaixo da interface `Condominio` (que ganha dois
campos novos, entre `vistoriador` e `areasPadrao`):

```ts
export interface Condominio {
  id: string
  nome: string
  endereco: string
  vistoriador: string
  /** Referenciam `OpcaoCondominio.id`. Ausentes até o cadastro escolher um. */
  proprietarioId?: string
  administradoraId?: string
  areasPadrao: AreaTemplate[]
  criadoEm: string
  atualizadoEm?: string
  _pendente?: 0 | 1
}
```

E, depois da interface `Foto`, a nova entidade:

```ts
/**
 * Proprietário ou administradora de condomínio — mesma estrutura para os
 * dois tipos, para não duplicar tabela, sincronização e tela de gerência.
 * Nunca é apagada de fato: um condomínio pode referenciar o id. Sair de uso
 * é `ativo = false`.
 */
export interface OpcaoCondominio {
  id: string
  tipo: 'proprietario' | 'administradora'
  nome: string
  ativo: boolean
  criadoEm: string
  atualizadoEm?: string
  _pendente?: 0 | 1
}
```

- [ ] **Step 2: Adicionar a tabela local no Dexie**

Em `src/lib/db.ts`, ajustar o import de tipos:

```ts
import Dexie, { type EntityTable } from 'dexie'
import type { Condominio, Config, Excluido, Foto, OpcaoCondominio, SyncMeta, Vistoria } from '../types'
```

Na classe `VistoriaDB`, declarar o campo da tabela (junto das outras):

```ts
  /** Proprietários e administradoras disponíveis no cadastro dos condomínios. */
  opcoesCondominio!: EntityTable<OpcaoCondominio, 'id'>
```

E adicionar a versão 3 do schema, depois do bloco `this.version(2)...` e
antes de `aplicarMarcacaoDePendencia(this)`:

```ts
    // v3 — Proprietário/Administradora: tabela nova, sem migração de dados
    // (nasce vazia; cada aparelho recebe o catálogo na primeira sincronização).
    this.version(3).stores({
      condominios: 'id, nome, criadoEm, _pendente',
      vistorias: 'id, condominioId, data, status, atualizadoEm, _pendente',
      fotos: 'id, vistoriaId, areaId, criadoEm, _pendente',
      config: 'id',
      excluidos: 'chave, tipo, excluidoEm',
      syncMeta: 'id',
      opcoesCondominio: 'id, tipo, nome, _pendente',
    })
```

Por fim, incluir a nova tabela entre as que ganham marcação automática de
pendência (ela precisa do mesmo tratamento de `condominios`/`vistorias`/`fotos`,
para toda gravação virar candidata a subir na sincronização):

```ts
/** Tabelas que viajam para o servidor. `config` é preferência do aparelho. */
const TABELAS_SINCRONIZADAS = new Set(['condominios', 'vistorias', 'fotos', 'opcoesCondominio'])
```

- [ ] **Step 2: Rodar o typecheck**

Run: `npm run typecheck`
Expected: passa sem erro.

- [ ] **Step 3: Conferir a tabela nova no navegador**

Run: `npm run dev`, abrir `http://localhost:5173`, DevTools → Application →
IndexedDB → `vistorias-condominios` → versão mais recente.
Expected: a tabela `opcoesCondominio` aparece vazia, ao lado das demais.

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/lib/db.ts
git commit -m "Adiciona Proprietário/Administradora ao modelo de dados local"
```

---

## Task 3: Migração Postgres — `opcoes_condominio` e colunas no condomínio

**Files:**
- Modify: `api/_lib/migracoes.ts`

**Interfaces:**
- Consumes: nada de código; só o padrão de `MIGRACOES` já existente.
- Produces: tabela `opcoes_condominio` e colunas `condominios.proprietario_id`
  / `condominios.administradora_id` no Postgres. Usado pela Tarefa 4.

- [ ] **Step 1: Adicionar a migração**

Em `api/_lib/migracoes.ts`, ao final do array `MIGRACOES` (depois de
`005_denise_ferreira`):

```ts
  {
    nome: '006_opcoes_condominio',
    sql: `-- Proprietários e administradoras: listas geridas por admin,
-- referenciadas pelo condomínio. Uma tabela só para os dois tipos — mesma
-- estrutura, mesmo ciclo de sincronização, sem duplicar código. Nunca são
-- apagadas de fato (um condomínio pode referenciar o id); sair de uso é
-- ativo = false.

CREATE TABLE IF NOT EXISTS opcoes_condominio (
  id            TEXT PRIMARY KEY,
  tipo          TEXT NOT NULL CHECK (tipo IN ('proprietario', 'administradora')),
  nome          TEXT NOT NULL,
  ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em     TEXT NOT NULL,
  atualizado_em TEXT NOT NULL,
  versao        BIGINT NOT NULL DEFAULT nextval('versao_sync')
);

CREATE INDEX IF NOT EXISTS opcoes_condominio_versao_idx ON opcoes_condominio (versao);

ALTER TABLE condominios ADD COLUMN IF NOT EXISTS proprietario_id   TEXT;
ALTER TABLE condominios ADD COLUMN IF NOT EXISTS administradora_id TEXT;
`,
  },
```

- [ ] **Step 2: Rodar o typecheck da API**

Run: `npx tsc -p api/tsconfig.json --noEmit`
Expected: passa sem erro.

- [ ] **Step 3: Aplicar contra um banco local e conferir**

```bash
createdb vistorias_teste_migracao 2>/dev/null || true
DATABASE_URL=postgresql://localhost/vistorias_teste_migracao npx tsx servidor/harness.mts &
sleep 2
curl -s http://localhost:3201/api/diagnostico | python3 -m json.tool
kill %1
psql vistorias_teste_migracao -c "\d opcoes_condominio" -c "\d condominios"
dropdb vistorias_teste_migracao
```

Expected: `diagnostico` mostra `"tabelasCriadas": true`; `\d opcoes_condominio`
lista as colunas da tarefa; `\d condominios` mostra `proprietario_id` e
`administradora_id`.

- [ ] **Step 4: Commit**

```bash
git add api/_lib/migracoes.ts
git commit -m "Migração: tabela opcoes_condominio e colunas de propriedade no condomínio"
```

---

## Task 4: API `/api/sync` — Proprietário/Administradora, colunas do condomínio, papel do usuário

**Files:**
- Modify: `api/sync.ts`

**Interfaces:**
- Consumes: tabela `opcoes_condominio` e colunas `proprietario_id`/
  `administradora_id` (Tarefa 3); `entrada.usuario` (já existe em
  `api/_lib/entrada.ts`, tipo `UsuarioApi | null`).
- Produces: resposta de `/api/sync` ganha `usuario` e `opcoesCondominio`;
  aceita `opcoesCondominio` no corpo da requisição. Consumido pela Tarefa 5.

- [ ] **Step 1: Aceitar `opcoesCondominio` no corpo e contar no log de contato**

No tipo do corpo da requisição (perto do topo do handler):

```ts
  const corpo = (req.body ?? {}) as {
    cursor?: number
    condominios?: Record<string, unknown>[]
    vistorias?: Record<string, unknown>[]
    fotos?: Record<string, unknown>[]
    excluidos?: Excluido[]
    opcoesCondominio?: Record<string, unknown>[]
  }
```

Na chamada de `registrarContato`, acrescentar a contagem:

```ts
  await registrarContato(
    req,
    '/api/sync',
    `cursor=${cursor} condominios=${corpo.condominios?.length ?? 0} ` +
      `vistorias=${corpo.vistorias?.length ?? 0} fotos=${corpo.fotos?.length ?? 0} ` +
      `excluidos=${corpo.excluidos?.length ?? 0} opcoes=${corpo.opcoesCondominio?.length ?? 0}`,
  )
```

- [ ] **Step 2: Subir as colunas novas do condomínio**

No `INSERT INTO condominios` dentro do `emTransacao`, trocar por:

```ts
      await executar(
        `INSERT INTO condominios
           (id, nome, endereco, vistoriador, areas_padrao, proprietario_id, administradora_id, criado_em, atualizado_em, versao)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9, nextval('versao_sync'))
         ON CONFLICT (id) DO UPDATE SET
           nome              = EXCLUDED.nome,
           endereco          = EXCLUDED.endereco,
           vistoriador       = EXCLUDED.vistoriador,
           areas_padrao      = EXCLUDED.areas_padrao,
           proprietario_id   = EXCLUDED.proprietario_id,
           administradora_id = EXCLUDED.administradora_id,
           atualizado_em     = EXCLUDED.atualizado_em,
           versao            = nextval('versao_sync')
         WHERE EXCLUDED.atualizado_em > condominios.atualizado_em`,
        [
          c.id,
          c.nome ?? '',
          c.endereco ?? '',
          c.vistoriador ?? '',
          JSON.stringify(c.areasPadrao ?? []),
          c.proprietarioId ?? null,
          c.administradoraId ?? null,
          c.criadoEm ?? new Date().toISOString(),
          c.atualizadoEm ?? c.criadoEm ?? new Date().toISOString(),
        ],
      )
```

- [ ] **Step 3: Subir as opções de condomínio**

Logo depois do laço `for (const v of corpo.vistorias ?? [])` (antes do laço
das fotos), dentro do mesmo `emTransacao`:

```ts
    // Sem lápide: sair de uso é sempre `ativo = false`, nunca exclusão de
    // fato — um condomínio pode referenciar o id.
    for (const o of corpo.opcoesCondominio ?? []) {
      if (!o?.id) continue
      await executar(
        `INSERT INTO opcoes_condominio (id, tipo, nome, ativo, criado_em, atualizado_em, versao)
         VALUES ($1,$2,$3,$4,$5,$6, nextval('versao_sync'))
         ON CONFLICT (id) DO UPDATE SET
           tipo          = EXCLUDED.tipo,
           nome          = EXCLUDED.nome,
           ativo         = EXCLUDED.ativo,
           atualizado_em = EXCLUDED.atualizado_em,
           versao        = nextval('versao_sync')
         WHERE EXCLUDED.atualizado_em > opcoes_condominio.atualizado_em`,
        [
          o.id,
          o.tipo,
          o.nome ?? '',
          o.ativo !== false,
          o.criadoEm ?? new Date().toISOString(),
          o.atualizadoEm ?? o.criadoEm ?? new Date().toISOString(),
        ],
      )
    }
```

- [ ] **Step 4: Baixar as colunas novas e as opções de condomínio**

No `Promise.all` da parte `pull`, ajustar a consulta de condomínios e
acrescentar a de opções:

```ts
  const [condominios, vistorias, fotos, excluidos, opcoesCondominio] = await Promise.all([
    consultar<Record<string, unknown>>(
      `SELECT id, nome, endereco, vistoriador, areas_padrao, proprietario_id, administradora_id, criado_em, atualizado_em, versao
         FROM condominios WHERE versao > $1 ORDER BY versao LIMIT ${LIMITE}`,
      [cursor],
    ),
    consultar<Record<string, unknown>>(
      `SELECT id, condominio_id, condominio_nome, endereco, data, responsavel, status,
              areas, observacoes_gerais, criado_em, atualizado_em, concluida_em, versao
         FROM vistorias WHERE versao > $1 ORDER BY versao LIMIT ${LIMITE}`,
      [cursor],
    ),
    consultar<Record<string, unknown>>(
      `SELECT id, vistoria_id, area_id, legenda, mime, criado_em, atualizado_em, versao
         FROM fotos WHERE versao > $1 ORDER BY versao LIMIT ${LIMITE}`,
      [cursor],
    ),
    consultar<Record<string, unknown>>(
      `SELECT tipo, id, excluido_em, versao
         FROM excluidos WHERE versao > $1 ORDER BY versao LIMIT ${LIMITE}`,
      [cursor],
    ),
    consultar<Record<string, unknown>>(
      `SELECT id, tipo, nome, ativo, criado_em, atualizado_em, versao
         FROM opcoes_condominio WHERE versao > $1 ORDER BY versao LIMIT ${LIMITE}`,
      [cursor],
    ),
  ])

  const lotes = [condominios, vistorias, fotos, excluidos, opcoesCondominio]
```

(`truncados`, `topo` e `proximoCursor` continuam exatamente como estão — já
operam genericamente sobre `lotes`.)

- [ ] **Step 5: Devolver `usuario` e `opcoesCondominio` na resposta**

No `res.status(200).json({...})` final:

```ts
  res.status(200).json({
    cursor: proximoCursor,
    completo: truncados.length === 0,
    usuario: entrada.usuario,
    condominios: condominios.map(paraCondominio),
    vistorias: vistorias.map(paraVistoria),
    fotos: fotos.map(paraFoto),
    opcoesCondominio: opcoesCondominio.map(paraOpcaoCondominio),
    excluidos: excluidos.map((e) => ({
      tipo: e.tipo,
      id: e.id,
      excluidoEm: e.excluido_em,
    })),
  })
```

- [ ] **Step 6: Ajustar `paraCondominio` e criar `paraOpcaoCondominio`**

```ts
function paraCondominio(l: Record<string, unknown>) {
  return {
    id: l.id,
    nome: l.nome,
    endereco: l.endereco,
    vistoriador: l.vistoriador,
    areasPadrao: l.areas_padrao,
    proprietarioId: l.proprietario_id ?? undefined,
    administradoraId: l.administradora_id ?? undefined,
    criadoEm: l.criado_em,
    atualizadoEm: l.atualizado_em,
  }
}
```

E, depois de `paraFoto`:

```ts
function paraOpcaoCondominio(l: Record<string, unknown>) {
  return {
    id: l.id,
    tipo: l.tipo,
    nome: l.nome,
    ativo: l.ativo,
    criadoEm: l.criado_em,
    atualizadoEm: l.atualizado_em,
  }
}
```

- [ ] **Step 7: Typecheck e empacotamento**

Run: `npx tsc -p api/tsconfig.json --noEmit && npm run teste:api`
Expected: os dois passam sem erro.

- [ ] **Step 8: Conferir end-to-end contra o banco local**

Com o harness do Step 3 da Tarefa 3 no ar (`DATABASE_URL=... npx tsx
servidor/harness.mts`):

```bash
curl -s -X POST http://localhost:3201/api/sync \
  -H 'Content-Type: application/json' \
  -d '{"cursor":0,"opcoesCondominio":[{"id":"opc_teste","tipo":"administradora","nome":"Teste Ltda","ativo":true,"criadoEm":"2026-08-17T00:00:00.000Z","atualizadoEm":"2026-08-17T00:00:00.000Z"}]}' \
  | python3 -m json.tool
```

Expected: a resposta inclui `"usuario": null` (Entra não configurado neste
teste) e `"opcoesCondominio": [{"id":"opc_teste", "tipo":"administradora", "nome":"Teste Ltda", ...}]`
— a mesma opção enviada, confirmando que gravou e voltou.

- [ ] **Step 9: Commit**

```bash
git add api/sync.ts
git commit -m "API de sincronização: Proprietário/Administradora e papel do usuário logado"
```

---

## Task 5: Sincronização no app — opções de condomínio e papel do usuário

**Files:**
- Modify: `src/types.ts`
- Modify: `src/lib/sync.ts`

**Interfaces:**
- Consumes: resposta de `/api/sync` com `usuario`/`opcoesCondominio` (Tarefa 4);
  `db.opcoesCondominio` (Tarefa 2).
- Produces: `SyncMeta.usuario`, gravado a cada sincronização bem-sucedida.
  Consumido pela Tarefa 6 (`usePapel`).

- [ ] **Step 1: `SyncMeta` ganha o usuário logado**

Em `src/types.ts`, na interface `SyncMeta`:

```ts
export interface SyncMeta {
  id: 'unica'
  cursor: number
  ultimoSucesso?: string
  ultimoErro?: string
  /**
   * Quem está logado, segundo o último sincronismo — `null` quando o login
   * Microsoft não está configurado ou não identificou usuário (nesses casos
   * o acesso é tratado como liberado, como o resto do app já faz).
   */
  usuario?: { id: string; nome: string; papel: 'admin' | 'vistoriador' } | null
}
```

- [ ] **Step 2: Subir e baixar `opcoesCondominio` no ciclo de sincronização**

Em `src/lib/sync.ts`, ajustar o import de tipos:

```ts
import type { Condominio, Excluido, Foto, OpcaoCondominio, SyncMeta, Vistoria } from '../types'
```

Em `executarSync`, junto de onde os outros lotes pendentes são lidos:

```ts
    const condominios = await db.condominios.where('_pendente').equals(1).toArray()
    const vistorias = (await db.vistorias.where('_pendente').equals(1).toArray()).filter(
      (v) => !v.demo,
    )
    const fotos = await db.fotos.where('_pendente').equals(1).toArray()
    const excluidos = await db.excluidos.toArray()
    const opcoesCondominio = await db.opcoesCondominio.where('_pendente').equals(1).toArray()
```

No corpo da requisição enviada:

```ts
        body: JSON.stringify({
          cursor: m.cursor,
          condominios: primeiraRodada ? condominios.map(limpar) : [],
          vistorias: primeiraRodada ? vistorias.map(limpar) : [],
          fotos: primeiraRodada
            ? fotos.map((f) => ({
                id: f.id,
                legenda: f.legenda,
                atualizadoEm: f.atualizadoEm ?? f.criadoEm,
              }))
            : [],
          excluidos: primeiraRodada
            ? excluidos.map((e) => ({ tipo: e.tipo, id: e.id, excluidoEm: e.excluidoEm }))
            : [],
          opcoesCondominio: primeiraRodada ? opcoesCondominio.map(limpar) : [],
        }),
```

No tipo da resposta:

```ts
      const dados = (await resposta.json()) as {
        cursor: number
        completo: boolean
        usuario: { id: string; nome: string; papel: 'admin' | 'vistoriador' } | null
        condominios: Condominio[]
        vistorias: Vistoria[]
        fotos: (Omit<Foto, 'blob'> & { mime?: string })[]
        opcoesCondominio: OpcaoCondominio[]
        excluidos: { tipo: Excluido['tipo']; id: string; excluidoEm: string }[]
      }
```

Logo depois de `if (primeiraRodada) { ... }`, atualizar
`limparPendencias` para receber também `opcoesCondominio` (ver Step 3), e
guardar o usuário desta rodada:

```ts
      if (primeiraRodada) {
        await limparPendencias(condominios, vistorias, fotos, excluidos, opcoesCondominio)
        primeiraRodada = false
      }
      await db.syncMeta.put({ ...(await meta()), id: 'unica', usuario: dados.usuario })

      recebidos += await aplicarDoServidor(dados)
```

- [ ] **Step 3: `limparPendencias` e `aplicarDoServidor` cobrindo `opcoesCondominio`**

```ts
async function limparPendencias(
  condominios: Condominio[],
  vistorias: Vistoria[],
  fotos: Foto[],
  excluidos: Excluido[],
  opcoesCondominio: OpcaoCondominio[],
): Promise<void> {
  await db.transaction(
    'rw',
    db.condominios,
    db.vistorias,
    db.fotos,
    db.excluidos,
    db.opcoesCondominio,
    async () => {
      for (const c of condominios) {
        const atual = await db.condominios.get(c.id)
        if (atual && atual.atualizadoEm === c.atualizadoEm) {
          await db.condominios.put({ ...atual, _pendente: 0 })
        }
      }
      for (const v of vistorias) {
        const atual = await db.vistorias.get(v.id)
        if (atual && atual.atualizadoEm === v.atualizadoEm) {
          await db.vistorias.put({ ...atual, _pendente: 0 })
        }
      }
      for (const f of fotos) {
        const atual = await db.fotos.get(f.id)
        if (atual && atual.legenda === f.legenda) {
          await db.fotos.put({ ...atual, _pendente: 0 })
        }
      }
      for (const o of opcoesCondominio) {
        const atual = await db.opcoesCondominio.get(o.id)
        if (atual && atual.atualizadoEm === o.atualizadoEm) {
          await db.opcoesCondominio.put({ ...atual, _pendente: 0 })
        }
      }
      await db.excluidos.bulkDelete(excluidos.map((e) => e.chave))
    },
  )
}
```

Em `aplicarDoServidor`, ajustar a assinatura e incluir o laço de opções
dentro da mesma transação:

```ts
async function aplicarDoServidor(dados: {
  condominios: Condominio[]
  vistorias: Vistoria[]
  fotos: (Omit<Foto, 'blob'> & { mime?: string })[]
  opcoesCondominio: OpcaoCondominio[]
  excluidos: { tipo: Excluido['tipo']; id: string; excluidoEm: string }[]
}): Promise<number> {
  let gravados = 0

  await db.transaction('rw', db.condominios, db.vistorias, db.fotos, db.opcoesCondominio, async () => {
    for (const c of dados.condominios) {
      const local = await db.condominios.get(c.id)
      if (local && (local.atualizadoEm ?? '') > (c.atualizadoEm ?? '')) continue
      await db.condominios.put({ ...c, _pendente: 0 })
      gravados++
    }

    for (const v of dados.vistorias) {
      const local = await db.vistorias.get(v.id)
      if (local && local.atualizadoEm > v.atualizadoEm) continue
      await db.vistorias.put({ ...v, _pendente: 0 })
      gravados++
    }

    for (const f of dados.fotos) {
      const local = await db.fotos.get(f.id)
      await db.fotos.put({
        ...f,
        blob: local?.blob,
        _pendente: 0,
        _enviada: 1,
      } as Foto)
      gravados++
    }

    for (const o of dados.opcoesCondominio) {
      const local = await db.opcoesCondominio.get(o.id)
      if (local && (local.atualizadoEm ?? '') > (o.atualizadoEm ?? '')) continue
      await db.opcoesCondominio.put({ ...o, _pendente: 0 })
      gravados++
    }
  })

  // Exclusões fora da transação acima porque `excluirVistoria` abre a sua.
  for (const e of dados.excluidos) {
    if (e.tipo === 'vistoria') {
      await db.transaction('rw', db.vistorias, db.fotos, async () => {
        await db.fotos.where('vistoriaId').equals(e.id).delete()
        await db.vistorias.delete(e.id)
      })
    } else if (e.tipo === 'condominio') {
      await db.condominios.delete(e.id)
    } else {
      await db.fotos.delete(e.id)
    }
  }

  return gravados
}
```

- [ ] **Step 4: Contar pendências de opções também**

Em `contarPendentes`:

```ts
export async function contarPendentes(): Promise<number> {
  const [c, v, f, e, o] = await Promise.all([
    db.condominios.where('_pendente').equals(1).count(),
    db.vistorias.where('_pendente').equals(1).count(),
    db.fotos.where('_pendente').equals(1).count(),
    db.excluidos.count(),
    db.opcoesCondominio.where('_pendente').equals(1).count(),
  ])
  return c + v + f + e + o
}
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: passa sem erro.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/lib/sync.ts
git commit -m "Sincroniza opções de condomínio e guarda o papel do usuário logado"
```

---

## Task 6: Helpers de opções de condomínio e o hook de papel

**Files:**
- Create: `src/lib/opcoesCondominio.ts`
- Create: `src/lib/usePapel.ts`
- Modify: `servidor/teste-logica.mts`

**Interfaces:**
- Consumes: `db.opcoesCondominio` (Tarefa 2), `db.syncMeta` com `usuario`
  (Tarefa 5).
- Produces: `opcoesAtivas(lista: OpcaoCondominio[]): OpcaoCondominio[]`,
  `criarOpcao(tipo, nome): Promise<void>`, `usePapel(): 'admin' | 'vistoriador' | null | undefined`,
  `useEhAdmin(): boolean`. Usados pelas Tarefas 7, 8 e 13.

- [ ] **Step 1: `src/lib/opcoesCondominio.ts`**

```ts
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
```

- [ ] **Step 2: `src/lib/usePapel.ts`**

```ts
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'

/**
 * Papel de quem está logado, segundo o último sincronismo bem-sucedido.
 * `undefined` enquanto ainda não sincronizou nenhuma vez; `null` quando o
 * login Microsoft não está configurado ou não identificou usuário — nesses
 * casos o acesso é tratado como liberado, mesma degradação graciosa do resto
 * do app (ver `trancaArmada`/`loginConfigurado`).
 */
export function usePapel(): 'admin' | 'vistoriador' | null | undefined {
  const meta = useLiveQuery(() => db.syncMeta.get('unica'))
  if (meta === undefined) return undefined
  return meta?.usuario?.papel ?? null
}

/** Pode administrar Proprietários/Administradoras: todo mundo, exceto quem logou como vistoriador. */
export function useEhAdmin(): boolean {
  return usePapel() !== 'vistoriador'
}
```

- [ ] **Step 3: Testar `opcoesAtivas`**

Em `servidor/teste-logica.mts`, acrescentar o import e os testes (a função é
pura — dá para testar sem Dexie nem navegador):

```ts
import { opcoesAtivas } from '../src/lib/opcoesCondominio.js'
```

E, antes do `console.log(falhas === 0 ...)` final:

```ts
teste('opcoesAtivas tira as inativas e ordena por nome', () => {
  const resultado = opcoesAtivas([
    { id: '1', tipo: 'administradora', nome: 'Zelo', ativo: true, criadoEm: '' },
    { id: '2', tipo: 'administradora', nome: 'Alfa', ativo: true, criadoEm: '' },
    { id: '3', tipo: 'administradora', nome: 'Beta', ativo: false, criadoEm: '' },
  ])
  assert.deepEqual(resultado.map((o) => o.nome), ['Alfa', 'Zelo'])
})
```

- [ ] **Step 4: Rodar o script e o typecheck**

Run: `npm run teste:logica && npm run typecheck`
Expected: os dois passam sem erro.

- [ ] **Step 5: Commit**

```bash
git add src/lib/opcoesCondominio.ts src/lib/usePapel.ts servidor/teste-logica.mts
git commit -m "Helpers de Proprietário/Administradora e hook de papel do usuário"
```

---

## Task 7: Tela de administração — Proprietários e Administradoras

**Files:**
- Create: `src/components/ListaOpcoes.tsx`
- Modify: `src/pages/Ajustes.tsx`

**Interfaces:**
- Consumes: `criarOpcao`, `db.opcoesCondominio` (Tarefa 6/2), `useEhAdmin`
  (Tarefa 6).
- Produces: `<ListaOpcoes tipo rotulo />`, seção "Administração" em Ajustes.

- [ ] **Step 1: Componente `ListaOpcoes`**

```tsx
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { criarOpcao } from '../lib/opcoesCondominio'
import type { OpcaoCondominio } from '../types'

interface Props {
  tipo: OpcaoCondominio['tipo']
  rotulo: string
}

/** Lista de administração: renomear e ativar/desativar gravam direto, como no checklist de áreas do condomínio. */
export function ListaOpcoes({ tipo, rotulo }: Props) {
  const opcoes = useLiveQuery(
    async () =>
      (await db.opcoesCondominio.where('tipo').equals(tipo).toArray()).sort((a, b) =>
        a.nome.localeCompare(b.nome, 'pt-BR'),
      ),
    [tipo],
    [],
  )
  const [novoNome, setNovoNome] = useState('')

  async function adicionar() {
    await criarOpcao(tipo, novoNome)
    setNovoNome('')
  }

  /**
   * Grava direto, com `_pendente`/`atualizadoEm` explícitos.
   *
   * A marcação automática de `db.ts` só entra quando o registro chega sem
   * `_pendente` nenhum — e um registro já sincronizado uma vez carrega
   * `_pendente: 0` gravado nele. Reenviar esse valor num `put` (por exemplo
   * `{ ...o, nome: novoNome }`) faria essa edição passar batida, sem nunca
   * subir. `salvarVistoria` (`src/lib/db.ts`) evita isso do mesmo jeito.
   */
  function gravar(opcao: OpcaoCondominio) {
    return db.opcoesCondominio.put({ ...opcao, _pendente: 1, atualizadoEm: new Date().toISOString() })
  }

  return (
    <div>
      <h3 className="secao">{rotulo}</h3>
      {opcoes.map((o) => (
        <div key={o.id} className={`cartao cartao-linha${o.ativo ? '' : ' desativado'}`}>
          <div className="cartao-conteudo">
            <input value={o.nome} onChange={(e) => gravar({ ...o, nome: e.target.value })} />
          </div>
          <button type="button" className="btn" onClick={() => gravar({ ...o, ativo: !o.ativo })}>
            {o.ativo ? 'Desativar' : 'Reativar'}
          </button>
        </div>
      ))}
      <div className="linha-dupla">
        <input
          value={novoNome}
          placeholder={`Novo(a) ${rotulo.toLowerCase().replace(/s$/, '')}`}
          onChange={(e) => setNovoNome(e.target.value)}
        />
        <button type="button" className="btn" onClick={adicionar}>
          ➕ Adicionar
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Seção de administração em `Ajustes.tsx`**

Ajustar os imports no topo:

```ts
import { useEffect, useRef, useState } from 'react'
import { Layout } from '../components/Layout'
import { ListaOpcoes } from '../components/ListaOpcoes'
import { PainelSync } from '../components/PainelSync'
import { SeletorVistoriador } from '../components/SeletorVistoriador'
import { CONFIG_PADRAO, db, lerConfig, salvarConfig } from '../lib/db'
import { baixarArquivo, exportarBackup, importarBackup } from '../lib/backup'
import { apagarVistoriasDemo, contarVistoriasDemo, gerarVistoriasDemo } from '../lib/demo'
import { hojeISO, slug } from '../lib/format'
import { useEhAdmin } from '../lib/usePapel'
import type { Config } from '../types'
```

Dentro do componente, logo abaixo dos outros `useState`:

```ts
  const ehAdmin = useEhAdmin()
```

E, no JSX, logo depois de `<PainelSync />` e antes de `<h2 className="secao">Backup</h2>`:

```tsx
      {ehAdmin && (
        <>
          <h2 className="secao">Administração</h2>
          <p className="muted">
            Proprietários e administradoras disponíveis no cadastro dos condomínios.
          </p>
          <ListaOpcoes tipo="proprietario" rotulo="Proprietários" />
          <ListaOpcoes tipo="administradora" rotulo="Administradoras" />
        </>
      )}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: passa sem erro.

- [ ] **Step 4: Conferir no navegador**

Run: `npm run dev`, abrir Ajustes.
Expected: seção "Administração" visível (login Entra não está configurado
neste ambiente, então `useEhAdmin()` devolve `true`); adicionar um
Proprietário e uma Administradora funciona, renomear funciona, "Desativar"
esmaece o cartão e some do seletor da Tarefa 8.

- [ ] **Step 5: Commit**

```bash
git add src/components/ListaOpcoes.tsx src/pages/Ajustes.tsx
git commit -m "Tela de administração de Proprietários e Administradoras em Ajustes"
```

---

## Task 8: Seletor de Proprietário/Administradora no cadastro do condomínio

**Files:**
- Create: `src/components/SeletorOpcaoCondominio.tsx`
- Modify: `src/pages/CondominioEditor.tsx`

**Interfaces:**
- Consumes: `opcoesAtivas`, `db.opcoesCondominio` (Tarefa 6/2).
- Produces: `<SeletorOpcaoCondominio tipo rotulo valor onChange />`, campos
  `Condominio.proprietarioId`/`administradoraId` preenchidos pela tela.

- [ ] **Step 1: Componente `SeletorOpcaoCondominio`**

```tsx
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { opcoesAtivas } from '../lib/opcoesCondominio'
import type { OpcaoCondominio } from '../types'

interface Props {
  tipo: OpcaoCondominio['tipo']
  rotulo: string
  valor?: string
  onChange: (id: string | undefined) => void
}

export function SeletorOpcaoCondominio({ tipo, rotulo, valor, onChange }: Props) {
  const todas = useLiveQuery(() => db.opcoesCondominio.where('tipo').equals(tipo).toArray(), [tipo], [])
  const opcoes = opcoesAtivas(todas)

  return (
    <label className="campo">
      <span>{rotulo}</span>
      <select value={valor ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">Nenhum(a) cadastrado(a)</option>
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nome}
          </option>
        ))}
      </select>
    </label>
  )
}
```

- [ ] **Step 2: Usar no `CondominioEditor`**

Ajustar os imports:

```ts
import { SeletorOpcaoCondominio } from '../components/SeletorOpcaoCondominio'
```

E, logo depois do bloco `<SeletorVistoriador ... />` e antes de
`<h2 className="secao">Checklist de áreas...`:

```tsx
      <SeletorOpcaoCondominio
        tipo="proprietario"
        rotulo="Proprietário"
        valor={cond.proprietarioId}
        onChange={(proprietarioId) => salvar({ proprietarioId })}
      />
      <SeletorOpcaoCondominio
        tipo="administradora"
        rotulo="Administradora"
        valor={cond.administradoraId}
        onChange={(administradoraId) => salvar({ administradoraId })}
      />
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: passa sem erro.

- [ ] **Step 4: Conferir no navegador**

Abrir um condomínio existente, escolher um Proprietário e uma Administradora
(cadastrados na Tarefa 7), recarregar a página.
Expected: a escolha persiste.

- [ ] **Step 5: Commit**

```bash
git add src/components/SeletorOpcaoCondominio.tsx src/pages/CondominioEditor.tsx
git commit -m "Cadastro do condomínio: seletores de Proprietário e Administradora"
```

---

## Task 9: Checklist do condomínio agrupado por categoria

**Files:**
- Modify: `src/pages/CondominioEditor.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `agruparPorCategoria`, `categoriaDaArea`, `moverDentroDaCategoria`
  (Tarefa 1).
- Produces: nada consumido por outras tarefas (a UI é o fim da linha aqui).

- [ ] **Step 1: Tokens de cor e cabeçalho de seção em destaque**

Em `src/styles.css`, no bloco `:root` (depois de `--vermelho`):

```css
  --dourado: #8a6d1a;
  --dourado-fraca: #f7ecd1;
```

Depois da regra `.secao { ... }`:

```css
.secao-destaque {
  color: var(--dourado);
}
```

- [ ] **Step 2: Ajustar os imports do `CondominioEditor`**

```ts
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { SeletorOpcaoCondominio } from '../components/SeletorOpcaoCondominio'
import { SeletorVistoriador } from '../components/SeletorVistoriador'
import { AREAS_PADRAO } from '../data/areasPadrao'
import { db, excluirCondominio } from '../lib/db'
import { novoId } from '../lib/id'
import { agruparPorCategoria, categoriaDaArea, moverDentroDaCategoria, templatesPadrao } from '../lib/vistoria'
import type { AreaTemplate, CategoriaArea, Condominio } from '../types'
```

- [ ] **Step 3: Trocar a lista plana de áreas pelas duas seções agrupadas**

Substituir o bloco `{cond.areasPadrao.map((area, i) => ( ... ))}` inteiro
(da linha `{cond.areasPadrao.map((area, i) => (` até o `))}` que a fecha)
por:

```tsx
      {agruparPorCategoria(cond.areasPadrao).map((grupo) => (
        <div key={grupo.chave}>
          <h2 className={`secao${grupo.chave === 'caminho_do_rei' ? ' secao-destaque' : ''}`}>
            {grupo.titulo} ({grupo.areas.length})
          </h2>
          {grupo.areas.map((area, i) => (
            <div key={area.id} className="area-config">
              <div className="area-config-topo">
                <button type="button" className="area-config-nome" onClick={() => setAbertaId(abertaId === area.id ? null : area.id)}>
                  <span className="emoji">{area.icone}</span>
                  <strong>{area.nome}</strong>
                  <span className="chevron">{abertaId === area.id ? '⌄' : '›'}</span>
                </button>
                <div className="area-config-ordem">
                  <button
                    type="button"
                    aria-label="Subir"
                    disabled={i === 0}
                    onClick={() => salvar({ areasPadrao: moverDentroDaCategoria(cond.areasPadrao, area.id, -1) })}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    aria-label="Descer"
                    disabled={i === grupo.areas.length - 1}
                    onClick={() => salvar({ areasPadrao: moverDentroDaCategoria(cond.areasPadrao, area.id, 1) })}
                  >
                    ▼
                  </button>
                </div>
              </div>

              {abertaId === area.id && (
                <div className="area-config-corpo">
                  <div className="linha-dupla">
                    <label className="campo campo-emoji">
                      <span>Ícone</span>
                      <input value={area.icone} maxLength={4} onChange={(e) => atualizarArea(area.id, { icone: e.target.value })} />
                    </label>
                    <label className="campo">
                      <span>Nome da área</span>
                      <input value={area.nome} onChange={(e) => atualizarArea(area.id, { nome: e.target.value })} />
                    </label>
                  </div>

                  <label className="campo">
                    <span>Categoria</span>
                    <select
                      value={categoriaDaArea(area)}
                      onChange={(e) => atualizarArea(area.id, { categoria: e.target.value as CategoriaArea })}
                    >
                      <option value="caminho_do_rei">👑 Caminho do Rei</option>
                      <option value="geral">Geral</option>
                    </select>
                  </label>

                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={area.fotoObrigatoria}
                      onChange={(e) => atualizarArea(area.id, { fotoObrigatoria: e.target.checked })}
                    />
                    <span>Exigir ao menos 1 foto</span>
                  </label>

                  <button
                    type="button"
                    className="btn btn-perigo"
                    onClick={() => salvar({ areasPadrao: cond.areasPadrao.filter((a) => a.id !== area.id) })}
                  >
                    Remover área
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
```

O título `<h2 className="secao">Checklist de áreas ({cond.areasPadrao.length})</h2>`
logo acima continua como está — ele conta o total; os títulos por grupo,
adicionados agora, contam cada categoria.

- [ ] **Step 4: `adicionar()` nasce em "Geral"**

```ts
  function adicionar() {
    const nova: AreaTemplate = { id: novoId('area'), nome: 'Nova área', icone: '📍', fotoObrigatoria: true, categoria: 'geral' }
    salvar({ areasPadrao: [...cond!.areasPadrao, nova] })
    setAbertaId(nova.id)
  }
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: passa sem erro.

- [ ] **Step 6: Conferir no navegador**

Abrir um condomínio, verificar as duas seções ("👑 Caminho do Rei" em
destaque dourado, "Geral" abaixo), trocar a categoria de uma área e ver ela
mudar de seção, mover uma área dentro do grupo com ▲▼ e confirmar que não
pula para o outro grupo.

- [ ] **Step 7: Commit**

```bash
git add src/pages/CondominioEditor.tsx src/styles.css
git commit -m "Checklist do condomínio agrupado em Caminho do Rei e Geral"
```

---

## Task 10: Tela de preenchimento da vistoria agrupada por categoria

**Files:**
- Modify: `src/pages/VistoriaAreas.tsx`

**Interfaces:**
- Consumes: `agruparPorCategoria` (Tarefa 1).

- [ ] **Step 1: Ajustar o import**

```ts
import { agruparPorCategoria } from '../lib/vistoria'
```

- [ ] **Step 2: Agrupar a lista de áreas**

Substituir o bloco:

```tsx
      {vistoria.areas.map((area) => {
        const f = area.nota === null ? null : FAIXAS[faixaDaNota(area.nota)]
        return (
          <div key={area.id} className={`cartao cartao-linha${area.naoAplicavel ? ' desativado' : ''}`}>
            ...
          </div>
        )
      })}
```

por:

```tsx
      {agruparPorCategoria(vistoria.areas).map(
        (grupo) =>
          grupo.areas.length > 0 && (
            <div key={grupo.chave}>
              <h2 className={`secao${grupo.chave === 'caminho_do_rei' ? ' secao-destaque' : ''}`}>{grupo.titulo}</h2>
              {grupo.areas.map((area) => {
                const f = area.nota === null ? null : FAIXAS[faixaDaNota(area.nota)]
                return (
                  <div key={area.id} className={`cartao cartao-linha${area.naoAplicavel ? ' desativado' : ''}`}>
                    <Link to={`/vistorias/${vistoria.id}/areas/${area.id}`} className="cartao-conteudo">
                      <div className="cartao-topo">
                        <strong>
                          <span className="emoji">{area.icone}</span> {area.nome}
                        </strong>
                      </div>
                      <span className="muted">
                        {area.naoAplicavel
                          ? 'Não aplicável'
                          : `${area.fotoIds.length} foto(s)${area.fotoObrigatoria && area.fotoIds.length === 0 ? ' · foto obrigatória' : ''}`}
                      </span>
                    </Link>
                    {!area.naoAplicavel && (
                      <span
                        className="selo-nota"
                        style={f ? { background: f.corFraca, color: f.cor } : { background: '#eef1f5', color: '#6b7684' }}
                      >
                        {area.nota ?? '—'}
                      </span>
                    )}
                    <button
                      type="button"
                      className="excluir"
                      title={area.naoAplicavel ? 'Reativar área' : 'Marcar como não aplicável'}
                      onClick={() => alternarNA(area.id)}
                    >
                      {area.naoAplicavel ? '↩' : 'N/A'}
                    </button>
                  </div>
                )
              })}
            </div>
          ),
      )}
```

(o corpo de cada cartão de área é idêntico ao que já existia — só mudou o
agrupamento em volta.)

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: passa sem erro.

- [ ] **Step 4: Conferir no navegador**

Abrir uma vistoria em andamento.
Expected: duas seções, Caminho do Rei primeiro e em destaque; marcar nota,
observação e N/A continuam funcionando exatamente como antes.

- [ ] **Step 5: Commit**

```bash
git add src/pages/VistoriaAreas.tsx
git commit -m "Tela de preenchimento da vistoria agrupada em Caminho do Rei e Geral"
```

---

## Task 11: Relatório (PDF) agrupado por categoria e com Proprietário/Administradora

**Files:**
- Modify: `src/pages/Relatorio.tsx`
- Modify: `src/pages/relatorio.css`

**Interfaces:**
- Consumes: `agruparPorCategoria` (Tarefa 1), `db.condominios`,
  `db.opcoesCondominio` (Tarefas 2/8).

- [ ] **Step 1: Carregar o condomínio e as opções junto da vistoria**

Ajustar os imports:

```ts
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CONFIG_PADRAO, db, lerConfig } from '../lib/db'
import { dataBR, dataHoraBR } from '../lib/format'
import { fotosDaArea } from '../lib/fotos'
import { chaveArea, formatarDelta, variacoesPorArea, vistoriaAnterior, vistoriasDoCondominio } from '../lib/historico'
import {
  FAIXAS,
  areasAvaliadas,
  areasSemFotoObrigatoria,
  faixaDaNota,
  notaGeral,
  textoDaFaixa,
} from '../lib/score'
import { useFotosDaVistoria, useUrlsDeFotos } from '../lib/useFotos'
import { agruparPorCategoria } from '../lib/vistoria'
import type { Condominio, Config, Vistoria } from '../types'
import './relatorio.css'
```

No componente, acrescentar o estado do condomínio e a busca de opções:

```ts
  const [vistoria, setVistoria] = useState<Vistoria | null | undefined>(undefined)
  const [condominio, setCondominio] = useState<Condominio | null>(null)
  const [config, setConfig] = useState<Config>(CONFIG_PADRAO)
  const [previa, setPrevia] = useState<Vistoria | null>(null)
  const todasFotos = useFotosDaVistoria(id)
  const urls = useUrlsDeFotos(todasFotos)
  const opcoes = useLiveQuery(() => db.opcoesCondominio.toArray(), [], [])
```

No `useEffect` que carrega a vistoria, buscar o condomínio junto:

```ts
  useEffect(() => {
    if (!id) return
    db.vistorias.get(id).then(async (v) => {
      setVistoria(v ?? null)
      if (!v) return
      const [todas, cond] = await Promise.all([
        vistoriasDoCondominio(v.condominioId),
        db.condominios.get(v.condominioId),
      ])
      setPrevia(vistoriaAnterior(v, todas))
      setCondominio(cond ?? null)
    })
    lerConfig().then(setConfig)
  }, [id])
```

Depois de `const comparativo = ...`, resolver os nomes:

```ts
  const proprietario = opcoes.find((o) => o.id === condominio?.proprietarioId)?.nome
  const administradora = opcoes.find((o) => o.id === condominio?.administradoraId)?.nome
```

- [ ] **Step 2: Mostrar na capa**

No `<div className="meta">`, depois do bloco "Áreas avaliadas" e antes do
bloco "Nota" (ou em qualquer ordem — o grid já acomoda mais itens):

```tsx
            {proprietario && (
              <div>
                <span className="meta-rotulo">Proprietário</span>
                <strong>{proprietario}</strong>
              </div>
            )}
            {administradora && (
              <div>
                <span className="meta-rotulo">Administradora</span>
                <strong>{administradora}</strong>
              </div>
            )}
```

- [ ] **Step 3: Agrupar o resumo por área**

Substituir `<tbody>{areas.map((area) => { ... })}</tbody>` por:

```tsx
            <tbody>
              {agruparPorCategoria(areas).map(
                (grupo) =>
                  grupo.areas.length > 0 && (
                    <Fragment key={grupo.chave}>
                      <tr className="linha-grupo">
                        <td colSpan={comparativo ? 4 : 3}>{grupo.titulo}</td>
                      </tr>
                      {grupo.areas.map((area) => {
                        const f = area.nota === null ? null : FAIXAS[faixaDaNota(area.nota)]
                        const v = variacoes.get(chaveArea(area))
                        return (
                          <tr key={area.id}>
                            <td>
                              <span className="emoji">{area.icone}</span> {area.nome}
                            </td>
                            <td className="centro">
                              <strong style={f ? { color: f.cor } : undefined}>{area.nota ?? '—'}</strong>
                            </td>
                            {comparativo && (
                              <td className="centro variacao">
                                {v?.notaAnterior ?? '—'}
                                {v?.delta != null && v.delta !== 0 && (
                                  <span className={v.delta > 0 ? 'sobe' : 'desce'}>
                                    {' '}
                                    {v.delta > 0 ? '▲' : '▼'} {formatarDelta(v.delta)}
                                  </span>
                                )}
                              </td>
                            )}
                            <td className="centro">
                              {f ? (
                                <span className="etiqueta-faixa" style={{ background: f.corFraca, color: f.cor }}>
                                  {f.simbolo} {f.rotulo}
                                </span>
                              ) : (
                                <span className="muted">não avaliada</span>
                              )}
                            </td>
                            <td>
                              <div className="barra-tabela">
                                <div
                                  className="barra-tabela-preenchida"
                                  style={{ width: `${(area.nota ?? 0) * 10}%`, background: f?.cor ?? '#c9d1da' }}
                                />
                                <span>{(area.nota ?? 0) * 10}%</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </Fragment>
                  ),
              )}
            </tbody>
```

- [ ] **Step 4: Agrupar o detalhamento por área**

Substituir o bloco `{areas.map((area) => { ... })}` do "Detalhamento por
Área" por:

```tsx
        {agruparPorCategoria(areas).map(
          (grupo) =>
            grupo.areas.length > 0 && (
              <div key={grupo.chave}>
                <h4 className={`titulo-grupo${grupo.chave === 'caminho_do_rei' ? ' titulo-grupo-destaque' : ''}`}>
                  {grupo.titulo}
                </h4>
                {grupo.areas.map((area) => {
                  const f = area.nota === null ? null : FAIXAS[faixaDaNota(area.nota)]
                  const fotos = fotosDaArea(todasFotos, area.fotoIds)
                  const v = variacoes.get(chaveArea(area))
                  return (
                    <section key={area.id} className="area-detalhe">
                      <header className="area-cabecalho" style={f ? { borderLeftColor: f.cor } : undefined}>
                        <h4>
                          <span className="emoji">{area.icone}</span> {area.nome}
                        </h4>
                        <span className="area-nota" style={f ? { color: f.cor } : undefined}>
                          {v?.delta != null && v.delta !== 0 && (
                            <span className={`selo-variacao ${v.delta > 0 ? 'sobe' : 'desce'}`}>
                              {v.delta > 0 ? '▲' : '▼'} {formatarDelta(v.delta)} vs. {v.notaAnterior}
                            </span>
                          )}
                          {area.nota ?? '—'} / 10
                        </span>
                      </header>

                      {fotos.length > 0 ? (
                        <div className={`fotos fotos-${Math.min(fotos.length, 3)}`}>
                          {fotos.map((foto) => (
                            <figure key={foto.id}>
                              {urls[foto.id] && <img src={urls[foto.id]} alt={foto.legenda || `Foto de ${area.nome}`} />}
                              {foto.legenda && <figcaption>{foto.legenda}</figcaption>}
                            </figure>
                          ))}
                        </div>
                      ) : (
                        area.fotoObrigatoria && (
                          <div className="sem-foto">
                            <strong>📷 Foto obrigatória ausente!</strong>
                            <p>
                              Esta área não possui registro fotográfico. A inclusão de ao menos 1 foto é obrigatória
                              para validação da vistoria. Por favor, anexe as fotos e regenere o relatório.
                            </p>
                          </div>
                        )
                      )}

                      {area.observacoes.trim() && (
                        <div className="observacoes-bloco">
                          <span className="observacoes-rotulo">Observações</span>
                          <p>{area.observacoes}</p>
                        </div>
                      )}
                    </section>
                  )
                })}
              </div>
            ),
        )}
```

Note que o título de topo "🏗 Detalhamento por Área" (`<h3 className="titulo-secao quebra-antes">`)
continua acima deste bloco, como já estava.

- [ ] **Step 5: Estilos dos títulos de grupo no PDF**

Em `src/pages/relatorio.css`, acrescentar (junto de outras regras de
título/tabela já existentes no arquivo):

```css
.linha-grupo td {
  background: #f4f6f9;
  font-weight: 700;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 6px 8px;
}

.titulo-grupo {
  margin: 20px 0 8px;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #6b7684;
}

.titulo-grupo-destaque {
  color: #8a6d1a;
}
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: passa sem erro.

- [ ] **Step 7: Conferir no navegador**

Abrir o relatório de uma vistoria de um condomínio com Proprietário e
Administradora cadastrados.
Expected: capa mostra os dois campos; resumo e detalhamento aparecem em duas
seções, Caminho do Rei primeiro; "🖨 Gerar PDF" continua funcionando e a
paginação de impressão não quebra no meio de uma linha de grupo.

- [ ] **Step 8: Commit**

```bash
git add src/pages/Relatorio.tsx src/pages/relatorio.css
git commit -m "Relatório: agrupa por categoria e mostra Proprietário/Administradora"
```

---

## Task 12: `filtrarVistorias` — lógica de filtro da página de Relatórios

**Files:**
- Create: `src/lib/relatorios.ts`
- Modify: `servidor/teste-logica.mts`

**Interfaces:**
- Consumes: `notaGeral`, `faixaDaNota` (`src/lib/score.ts`, já existentes).
- Produces: `FiltrosRelatorio`, `LinhaRelatorio`,
  `filtrarVistorias(vistorias, condominios, filtros): LinhaRelatorio[]`.
  Consumido pela Tarefa 13.

- [ ] **Step 1: Escrever `src/lib/relatorios.ts`**

```ts
import type { Condominio, Faixa, StatusVistoria, Vistoria } from '../types'
import { faixaDaNota, notaGeral } from './score'

export interface FiltrosRelatorio {
  condominioId?: string
  proprietarioId?: string
  administradoraId?: string
  /** YYYY-MM-DD, inclusive. */
  dataDe?: string
  /** YYYY-MM-DD, inclusive. */
  dataAte?: string
  status?: StatusVistoria
  faixa?: Faixa
}

export interface LinhaRelatorio {
  vistoria: Vistoria
  condominio: Condominio | null
  nota: number | null
  faixa: Faixa | null
}

/**
 * Filtra vistorias da carteira inteira. Proprietário/Administradora são
 * atributos do CONDOMÍNIO, não da vistoria — por isso o cruzamento por
 * `condominioId`. Nota geral usa sempre todas as áreas juntas, sem separar
 * por categoria.
 */
export function filtrarVistorias(
  vistorias: Vistoria[],
  condominios: Condominio[],
  filtros: FiltrosRelatorio,
): LinhaRelatorio[] {
  const condominioPorId = new Map(condominios.map((c) => [c.id, c]))

  return vistorias
    .filter((v) => !filtros.condominioId || v.condominioId === filtros.condominioId)
    .filter((v) => !filtros.status || v.status === filtros.status)
    .filter((v) => !filtros.dataDe || v.data >= filtros.dataDe)
    .filter((v) => !filtros.dataAte || v.data <= filtros.dataAte)
    .filter((v) => !filtros.proprietarioId || condominioPorId.get(v.condominioId)?.proprietarioId === filtros.proprietarioId)
    .filter(
      (v) => !filtros.administradoraId || condominioPorId.get(v.condominioId)?.administradoraId === filtros.administradoraId,
    )
    .map((v) => {
      const nota = notaGeral(v)
      return {
        vistoria: v,
        condominio: condominioPorId.get(v.condominioId) ?? null,
        nota,
        faixa: nota === null ? null : faixaDaNota(nota),
      }
    })
    .filter((linha) => !filtros.faixa || linha.faixa === filtros.faixa)
    .sort(
      (a, b) =>
        b.vistoria.data.localeCompare(a.vistoria.data) || b.vistoria.criadoEm.localeCompare(a.vistoria.criadoEm),
    )
}
```

- [ ] **Step 2: Testar `filtrarVistorias`**

Em `servidor/teste-logica.mts`, acrescentar o import:

```ts
import { filtrarVistorias } from '../src/lib/relatorios.js'
import type { Condominio, Vistoria } from '../src/types.js'
```

E, antes do `console.log(falhas === 0 ...)` final:

```ts
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
```

- [ ] **Step 3: Rodar o script**

Run: `npm run teste:logica`
Expected: `Tudo passou.`

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: passa sem erro.

- [ ] **Step 5: Commit**

```bash
git add src/lib/relatorios.ts servidor/teste-logica.mts
git commit -m "Lógica de filtro da página de Relatórios"
```

---

## Task 13: Página de Relatórios

**Files:**
- Create: `src/pages/Relatorios.tsx`
- Create: `src/pages/relatorios.css`
- Modify: `src/App.tsx`
- Modify: `src/pages/Home.tsx`

**Interfaces:**
- Consumes: `filtrarVistorias` (Tarefa 12), `opcoesAtivas` (Tarefa 6),
  `db.condominios`/`db.vistorias`/`db.opcoesCondominio`.

- [ ] **Step 1: `src/pages/Relatorios.tsx`**

```tsx
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Layout, Vazio } from '../components/Layout'
import { db } from '../lib/db'
import { dataBR } from '../lib/format'
import { opcoesAtivas } from '../lib/opcoesCondominio'
import { filtrarVistorias, type FiltrosRelatorio } from '../lib/relatorios'
import { FAIXAS } from '../lib/score'
import type { Faixa, StatusVistoria } from '../types'
import './relatorios.css'

export function Relatorios() {
  const condominios = useLiveQuery(() => db.condominios.orderBy('nome').toArray(), [], [])
  const vistorias = useLiveQuery(() => db.vistorias.toArray(), [], [])
  const opcoes = useLiveQuery(() => db.opcoesCondominio.toArray(), [], [])
  const [filtros, setFiltros] = useState<FiltrosRelatorio>({})

  const proprietarios = opcoesAtivas(opcoes.filter((o) => o.tipo === 'proprietario'))
  const administradoras = opcoesAtivas(opcoes.filter((o) => o.tipo === 'administradora'))

  const linhas = useMemo(() => filtrarVistorias(vistorias, condominios, filtros), [vistorias, condominios, filtros])

  function atualizar(patch: Partial<FiltrosRelatorio>) {
    setFiltros((atual) => ({ ...atual, ...patch }))
  }

  return (
    <Layout titulo="Relatórios" subtitulo="Vistorias da carteira, com filtro" voltarPara="/">
      <div className="filtros-relatorio">
        <label className="campo">
          <span>Condomínio</span>
          <select value={filtros.condominioId ?? ''} onChange={(e) => atualizar({ condominioId: e.target.value || undefined })}>
            <option value="">Todos</option>
            {condominios.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome || 'Sem nome'}
              </option>
            ))}
          </select>
        </label>

        <label className="campo">
          <span>Proprietário</span>
          <select value={filtros.proprietarioId ?? ''} onChange={(e) => atualizar({ proprietarioId: e.target.value || undefined })}>
            <option value="">Todos</option>
            {proprietarios.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="campo">
          <span>Administradora</span>
          <select value={filtros.administradoraId ?? ''} onChange={(e) => atualizar({ administradoraId: e.target.value || undefined })}>
            <option value="">Todas</option>
            {administradoras.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="campo">
          <span>Status</span>
          <select
            value={filtros.status ?? ''}
            onChange={(e) => atualizar({ status: (e.target.value || undefined) as StatusVistoria | undefined })}
          >
            <option value="">Todos</option>
            <option value="em_andamento">Em andamento</option>
            <option value="concluida">Concluída</option>
          </select>
        </label>

        <label className="campo">
          <span>Faixa de nota</span>
          <select value={filtros.faixa ?? ''} onChange={(e) => atualizar({ faixa: (e.target.value || undefined) as Faixa | undefined })}>
            <option value="">Todas</option>
            <option value="otimo">Ótimo</option>
            <option value="regular">Regular</option>
            <option value="critico">Crítico</option>
          </select>
        </label>

        <div className="linha-dupla">
          <label className="campo">
            <span>De</span>
            <input type="date" value={filtros.dataDe ?? ''} onChange={(e) => atualizar({ dataDe: e.target.value || undefined })} />
          </label>
          <label className="campo">
            <span>Até</span>
            <input type="date" value={filtros.dataAte ?? ''} onChange={(e) => atualizar({ dataAte: e.target.value || undefined })} />
          </label>
        </div>
      </div>

      {linhas.length === 0 ? (
        <Vazio>
          <p>Nenhuma vistoria bate com esses filtros.</p>
        </Vazio>
      ) : (
        <div className="bloco">
          {linhas.map(({ vistoria, nota, faixa }) => {
            const f = faixa ? FAIXAS[faixa] : null
            return (
              <Link key={vistoria.id} to={`/vistorias/${vistoria.id}/relatorio`} className="cartao cartao-linha">
                <div className="cartao-conteudo">
                  <div className="cartao-topo">
                    <strong>{vistoria.condominioNome}</strong>
                    <span className="muted">{dataBR(vistoria.data)}</span>
                  </div>
                  <span className="muted">
                    {vistoria.responsavel} · {vistoria.status === 'concluida' ? 'Concluída' : 'Em andamento'}
                  </span>
                </div>
                {f && nota !== null && (
                  <span className="selo-nota" style={{ background: f.corFraca, color: f.cor }}>
                    {nota.toFixed(1).replace('.', ',')}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </Layout>
  )
}
```

- [ ] **Step 2: `src/pages/relatorios.css`**

```css
.filtros-relatorio {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.filtros-relatorio > .linha-dupla {
  grid-column: 1 / -1;
}
```

- [ ] **Step 3: Rota em `App.tsx`**

```ts
import { Relatorios } from './pages/Relatorios'
```

E, junto das outras rotas (antes de `<Route path="*" ...>`):

```tsx
      <Route path="/relatorios" element={<Relatorios />} />
```

- [ ] **Step 4: Link na Home**

Em `src/pages/Home.tsx`, logo depois do link "📊 Painel geral":

```tsx
      <Link to="/relatorios" className="linha-link">
        📑 Relatórios
        <span className="chevron">›</span>
      </Link>
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: passa sem erro.

- [ ] **Step 6: Conferir no navegador**

Abrir "📑 Relatórios" pela Home. Testar cada filtro isoladamente (condomínio,
proprietário, administradora, status, faixa, período) e em combinação;
clicar numa linha deve abrir o relatório daquela vistoria.
Expected: a lista muda conforme os filtros; "Nenhuma vistoria bate com esses
filtros" aparece quando a combinação não bate com nada.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Relatorios.tsx src/pages/relatorios.css src/App.tsx src/pages/Home.tsx
git commit -m "Página de Relatórios: lista de vistorias da carteira com filtros"
```

---

## Task 14: Verificação de ponta a ponta

**Files:** nenhum (só verificação).

- [ ] **Step 1: Suíte completa**

Run: `npm run teste:logica && npm run typecheck && npm run teste:api`
Expected: os três passam sem erro.

- [ ] **Step 2: Sincronização entre "aparelhos"**

Com um banco de teste (`createdb vistorias_teste_e2e`), seguir o roteiro do
`servidor/README.md`:

```bash
npm run build
DATABASE_URL=postgresql://localhost/vistorias_teste_e2e npx tsx servidor/harness.mts &
node servidor/teste-sync.mjs
kill %1
dropdb vistorias_teste_e2e
```

Expected: `teste-sync.mjs` passa (ele já cobre subida, descida, conflito e
exclusão — agora também carrega `opcoesCondominio` e os campos novos do
condomínio dentro do payload existente, sem precisar de asserções extras
para passar).

- [ ] **Step 3: Roteiro manual no navegador**

Run: `npm run dev`

1. Ajustes → seção "Administração" → cadastrar um Proprietário ("Família
   Teste") e uma Administradora ("Gestão Teste").
2. Condomínios → abrir um condomínio → escolher os dois no cadastro →
   conferir que o checklist mostra "👑 Caminho do Rei" e "Geral" separados.
3. Trocar a categoria de uma área de "Geral" para "Caminho do Rei" e ver ela
   mudar de seção.
4. Iniciar uma vistoria nesse condomínio → conferir o mesmo agrupamento na
   tela de preenchimento → avaliar algumas áreas → concluir.
5. Abrir o relatório: capa mostra Proprietário e Administradora; resumo e
   detalhamento aparecem agrupados.
6. Home → "📑 Relatórios" → filtrar por esse Proprietário, depois por essa
   Administradora, depois por faixa de nota → cada filtro isola a vistoria
   criada; combinação de filtros que não bate com nada mostra a mensagem de
   vazio.

Expected: os seis passos funcionam sem erro no console do navegador.

- [ ] **Step 4: Relato final**

Sem commit nesta tarefa — é só a conferência de que as 13 tarefas
anteriores, juntas, entregam o que o spec pediu.
