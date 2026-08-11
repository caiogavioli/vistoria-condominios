# Sincronização com PostgreSQL

O app continua sendo o mesmo: grava primeiro no aparelho e funciona sem sinal.
O que mudou é que agora ele **sobe o que foi preenchido para um banco central**,
e baixa o que os outros vistoriadores preencheram.

Sem isso, cada pessoa tinha o próprio banco isolado no próprio celular — três
pessoas preenchendo eram três acervos que nunca se encontravam.

## Como está montado

| Parte | Onde vive | Por quê |
|---|---|---|
| App (telas, checklist, relatório) | GitHub Pages, no endereço de sempre | Manter o link que a equipe já usa. Trocar o endereço apagaria o que está gravado nos aparelhos: o IndexedDB pertence ao domínio. |
| API de sincronização | Vercel (funções) | O GitHub Pages só serve arquivos; não recebe dados. |
| Banco | PostgreSQL (Neon) | Onde os acervos se encontram. |

O app fala com a API por CORS. As origens liberadas estão em
`ORIGENS_PERMITIDAS`; o padrão já cobre o GitHub Pages e o desenvolvimento local.

## Publicar

**1. Banco.** Crie um projeto no [Neon](https://neon.tech) e copie a string de
conexão. As tabelas são criadas sozinhas na primeira requisição — não há passo
de migração manual. O SQL vive em `api/_lib/migracoes.ts`, como módulo: é o que
garante que ele seja empacotado junto com a função.

**2. API.** Importe este repositório na Vercel e defina em
*Settings → Environment Variables*:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | a string de conexão do Neon |
| `ORIGENS_PERMITIDAS` | `https://caiogavioli.github.io` (opcional; é o padrão) |

A Vercel publica só a API — o `vercel.json` desliga o build do app, que continua
saindo pelo GitHub Pages.

**3. Ligar o app à API.** No GitHub, em
*Settings → Secrets and variables → Actions → Variables*, crie:

| Variável | Valor |
|---|---|
| `VITE_API_URL` | a URL da API na Vercel, ex.: `https://vistoria-condominios.vercel.app` |

Depois rode o workflow **Publicar app de vistorias** (ou faça qualquer push na
`main`).

> Enquanto `VITE_API_URL` não existir, o app funciona exatamente como antes:
> tudo local, sem sincronizar e sem mensagem de erro. É proposital — é melhor um
> app offline funcionando do que uma tela de erro no meio de uma vistoria.

## O que acontece com o que já foi preenchido

Nada se perde e ninguém precisa exportar backup. O endereço do app não muda,
então o IndexedDB de cada aparelho continua onde está. Na primeira vez que o app
abrir com a sincronização ligada, a migração local marca **tudo que já existe
como pendente** — e sobe na primeira conexão.

Na prática: as três pessoas abrem o link de sempre e o acervo delas aparece para
todos.

## Como a sincronização funciona

Cada rodada sobe o que mudou aqui e desce o que mudou lá, numa viagem só.
Dispara ao abrir o app, ao voltar o sinal, a cada 5 minutos e no botão
*Enviar agora*.

**Conflito** — vence a edição com `atualizadoEm` mais recente, comparado no
servidor. Uma vistoria viaja como documento inteiro. Duas pessoas editando a
mesma vistoria ao mesmo tempo é raro (cada uma vistoria o seu prédio); quando
acontece, perder a edição mais antiga é menos pior do que fundir dois checklists
e produzir uma terceira versão que ninguém preencheu.

**Exclusão** — viaja como lápide, nunca como ausência. Apagar é registrar
"este id foi apagado", não "este id não está mais aqui". Sem lápide, o registro
desceria de volta do servidor no sincronismo seguinte, ou outro aparelho o
reenviaria, e ele reapareceria para todo mundo.

**Cursor** — o "me dê tudo que mudou desde X" usa uma sequência do banco, não
relógio. O celular de quem está em campo pode estar atrasado; um registro
gravado com hora no passado nunca mais seria baixado pelos outros. `atualizadoEm`
existe para outra coisa: decidir conflito.

**Fotos** — sobem e descem uma a uma, por `/api/foto`. O limite de corpo da
Vercel é ~4,5 MB por requisição e uma vistoria cheia passa de 8 MB em imagens.
Uma a uma, cada chamada carrega ~300 KB, e uma foto que falhe não derruba o lote.

## Rodar e testar localmente

```bash
# Banco de teste
createdb vistorias_teste

# API + app estático (portas 3201 e 3200)
npm run build
DATABASE_URL=postgresql://localhost/vistorias_teste npx tsx servidor/harness.mts

# Três aparelhos sincronizando entre si
node servidor/teste-sync.mjs
```

O teste sobe três contextos de navegador — três IndexedDB separados,
três aparelhos de verdade — e cobre: envio, recebimento, bytes de foto atravessando
aparelhos, conflito de edição, propagação de exclusão, tentativa de
ressurreição de registro apagado e o ciclo offline → online.

## Espaço no banco

As fotos ficam no PostgreSQL como `bytea`, comprimidas para ~300 KB pelo app
antes de gravar. No plano gratuito do Neon (0,5 GB) cabem cerca de **60
vistorias completas**. Passando disso, o caminho é mover as fotos para
armazenamento de arquivos (Vercel Blob) e deixar no banco só o endereço — a
troca fica isolada em `api/foto.ts`.
