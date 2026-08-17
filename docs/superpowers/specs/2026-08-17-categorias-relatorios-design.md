# Categorias de área, Proprietário/Administradora e página de Relatórios

Data: 2026-08-17

## 1. Problema

Três pedidos relacionados:

1. As áreas do checklist não têm hierarquia. O "Caminho do Rei" — conceito da
   cartilha de boas práticas da empresa (o trajeto do visitante: portaria,
   acessos, vias internas, estacionamento, hall, elevadores) — precisa de
   destaque prioritário sobre as demais áreas ("Geral").
2. O cadastro do condomínio não sabe quem é o proprietário nem qual
   administradora o gerencia.
3. Não existe uma tela para olhar vistorias através da carteira inteira,
   filtrando por essas dimensões (e outras). `Painel.tsx` compara condomínios
   pela última vistoria; `HistoricoCondominio.tsx` mostra a evolução de um
   único condomínio. Nenhuma das duas lista vistorias individuais com filtro.

## 2. Modelo de dados

### 2.1 Categoria de área

`AreaTemplate` e `AreaVistoria` (`src/types.ts`) ganham:

```ts
categoria?: 'caminho_do_rei' | 'geral'
```

Opcional porque todo dado gravado antes desta mudança não tem o campo —
código novo sempre grava; código de leitura usa o fallback da seção
abaixo.

Viaja dentro do JSON que já existe (`areas_padrao` em `condominios`, `areas`
em `vistorias`) — **sem migração de coluna**.

`AREAS_PADRAO` (`src/data/areasPadrao.ts`) recebe a categoria de cada uma das
13 áreas-modelo, conforme a cartilha:

| Categoria | Áreas |
| --- | --- |
| `caminho_do_rei` | Recepção e Portaria, Estacionamento, Segurança Patrimonial, Elevadores, Heliponto, Jardinagem e Paisagismo, Limpeza e Conservação, Manutenção e Zeladoria |
| `geral` | Auditório, Bicicletário, Talude, Sistemas de Incêndio, Docas |

Áreas novas criadas pelo botão "➕ Adicionar área" (`CondominioEditor`) nascem
`geral`, com um controle para trocar para `caminho_do_rei`.

**Dado retroativo:** condomínios e vistorias já gravados têm áreas sem
`categoria`. Em vez de migrar linhas do banco, uma função
`categoriaPorNome(nome: string): Categoria` (`src/lib/vistoria.ts`) serve de
fallback: casa o nome com as 13 áreas-modelo e devolve a categoria
correspondente; qualquer nome fora disso cai em `geral`. Todo lugar que lê
`area.categoria` usa `area.categoria ?? categoriaPorNome(area.nome)`.

### 2.2 Proprietário / Administradora

Nova entidade **`OpcaoCondominio`**, cobrindo os dois casos com um só
mecanismo (evita duplicar tabela, sync e tela):

```ts
interface OpcaoCondominio {
  id: string
  tipo: 'proprietario' | 'administradora'
  nome: string
  ativo: boolean
  criadoEm: string
  atualizadoEm?: string
  _pendente?: 0 | 1
}
```

`Condominio` ganha:

```ts
proprietarioId?: string
administradoraId?: string
```

Referenciam `OpcaoCondominio.id`. Campos de texto livre, não — são
selecionados de uma lista mantida por um admin (pedido explícito do
usuário).

**Postgres** — migração `006_opcoes_condominio`:

```sql
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

ALTER TABLE condominios ADD COLUMN IF NOT EXISTS proprietario_id  TEXT;
ALTER TABLE condominios ADD COLUMN IF NOT EXISTS administradora_id TEXT;
```

**Sync** (`api/sync.ts`, `src/lib/sync.ts`): `opcoesCondominio` entra como
mais um lote no mesmo corpo de request/response que já carrega condomínios,
vistorias, fotos e exclusões — mesmo padrão de upsert por `versao` e
`atualizado_em`. Não usa lápide de exclusão: desativar é sempre
`ativo=false`, nunca exclusão de fato (uma opção referenciada por um
condomínio não pode sumir do banco) — mesmo racional já usado em
`usuarios.ativo`. `Excluido['tipo']` em `src/types.ts` não precisa crescer.

**Local (Dexie, `src/lib/db.ts`):** nova tabela `opcoesCondominio` na v3 do
schema, `id, tipo, nome, _pendente`.

### 2.3 Papel do usuário no front-end

Hoje `papel` (`admin` | `vistoriador`) só existe no servidor
(`api/_lib/entrada.ts`), usado para autorizar `/api/sync`. Para restringir a
tela de administração de Proprietários/Administradoras, o front precisa
saber o papel de quem está logado.

Em vez de um endpoint novo, a resposta de `/api/sync` — que já roda
`autenticar()` a cada chamada, inclusive a inicial — passa a incluir:

```ts
usuario: { id, nome, papel } | null
```

O front guarda isso em memória (módulo `src/lib/conta.ts`, uma variável +
getter, populada pelo primeiro `sincronizar()` bem-sucedido). Quando o login
Entra não está configurado ou `usuario` ainda é `null` (login não rodou, ou
tranca desarmada), trata como acesso liberado — mesma degradação graciosa já
usada em `trancaArmada()`/`loginConfigurado()`. Efeito prático: em ambiente
sem Entra ID configurado (como hoje), a tela de administração fica
acessível a todos, igual às demais telas.

## 3. Telas

### 3.1 `CondominioEditor`

- Dois seletores novos (`<select>`, populado por `opcoesCondominio` do tipo
  correspondente, só as `ativo`) logo abaixo do campo Endereço: Proprietário
  e Administradora.
- A lista de áreas passa a ser renderizada em duas seções: "👑 Caminho do
  Rei" e "Geral" (cabeçalho de seção + contagem, sem mudar o restante do
  card por área). Dentro do card expandido de cada área, um seletor de
  categoria substitui nada — é campo novo, ao lado do ícone/nome.
- Mover uma área entre categorias é escolher a categoria no seletor; a
  reordenação dentro da seção continua pelos botões ▲▼ já existentes,
  agora operando dentro da seção, não na lista inteira.

### 3.2 `VistoriaAreas` (preenchimento) e `Relatorio.tsx` (PDF)

- Mesmas duas seções, Caminho do Rei primeiro, com destaque visual (selo/cor
  dourada no cabeçalho da seção) nas duas telas — tela de preenchimento e
  relatório (resumo por área + detalhamento).
- Capa do relatório (`Relatorio.tsx`) ganha Proprietário e Administradora
  nos metadados, ao lado de Data/Responsável/Áreas avaliadas/Nota — lidos do
  cadastro do condomínio (via `db.condominios.get(vistoria.condominioId)`,
  já que a vistoria não guarda snapshot desses dois campos, só do nome).

### 3.3 Administração de Proprietários/Administradoras

- Nova seção em `Ajustes.tsx`, visível quando `papel !== 'vistoriador'`
  (cobre `admin` e o caso `usuario === null`): duas listas lado a lado
  (Proprietários / Administradoras), cada uma com adicionar, renomear e
  desativar — mesmo padrão de card simples já usado no checklist de áreas.
- Reaproveita um componente único `ListaOpcoes` parametrizado por `tipo`,
  já que as duas listas são operacionalmente idênticas.

### 3.4 Página de Relatórios (nova)

Rota `/relatorios`; item novo na Home, junto de "Painel geral" e "Meus
condomínios".

**Filtros:**
- Condomínio (busca/seleção)
- Proprietário
- Administradora
- Período (data de / até)
- Status (em andamento / concluída)
- Faixa de nota (ótimo / regular / crítico) — sobre a nota geral da vistoria,
  todas as áreas juntas, sem separar por categoria.

**Resultado:** lista de vistorias que batem com os filtros, mais recente
primeiro — condomínio, data, responsável, nota/faixa, status. Cada linha
leva para `/vistorias/:id/relatorio` (o relatório/PDF que já existe hoje).

**Fonte dos dados:** banco local (Dexie), igual ao `Painel` — sem endpoint
novo. Nova função `filtrarVistorias(...)` em `src/lib/relatorios.ts`, usando
`useLiveQuery` para carregar `vistorias`, `condominios` e
`opcoesCondominio`, e `useMemo` para aplicar os filtros correntes.

## 4. Testes

- `vistoria.ts`: `categoriaPorNome` cobrindo as 13 áreas-modelo e um nome
  desconhecido.
- `relatorios.ts`: `filtrarVistorias` com cada filtro isolado e combinado
  (condomínio + período, por exemplo).
- Verificação manual (dev server): criar condomínio com Proprietário e
  Administradora escolhidos, gerar vistoria, conferir seções Caminho do
  Rei/Geral na tela de preenchimento e no PDF, e a página de Relatórios
  filtrando por cada dimensão.

## 5. Fora de escopo

- Editar/renomear/mesclar Proprietários e Administradoras já em uso (só
  desativar).
- Exportar a lista filtrada de Relatórios (CSV/PDF em lote) — a página
  entrega a lista e o link para o relatório individual, que já se imprime.
- Qualquer outra tela ganhar checagem de papel além da nova administração —
  o resto do app continua acessível a qualquer usuário autenticado, como
  hoje.
