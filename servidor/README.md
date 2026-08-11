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

**A ordem importa.** A Vercel publica a *branch padrao* do repositorio: se ela
for importada antes do merge, sobe um repositorio sem a pasta `api/` e toda
chamada devolve 404.

**1. Merge primeiro.** Leve a branch da sincronizacao para a `main`. Isso tambem
dispara a publicacao no GitHub Pages; nessa primeira vez ainda sem
`VITE_API_URL`, entao o app sai funcionando como sempre, local e sem
sincronizar. Sem erro para o usuario — e proposital.

**2. Banco.** Crie um projeto no [Neon](https://neon.tech) e copie a string de
conexao. As tabelas sao criadas sozinhas na primeira requisicao — nao ha passo
de migracao manual. O SQL vive em `api/_lib/migracoes.ts`, como modulo: e o que
garante que ele seja empacotado junto com a funcao.

**3. API.** Importe o repositorio na Vercel e defina em
*Settings -> Environment Variables*:

| Variavel | Valor |
|---|---|
| `DATABASE_URL` | a string de conexao do Neon |
| `ORIGENS_PERMITIDAS` | `https://caiogavioli.github.io` (opcional; e o padrao) |

Nao mexa em Framework Preset nem em Build Settings: a deteccao automatica ja
cobre o caso. A pasta `api/` na raiz vira funcoes sem configuracao nenhuma, e o
`vercel.json` so redireciona a raiz do dominio da API para o app, para nao
existirem dois enderecos concorrentes do mesmo aplicativo.

**4. Conferir.** Abra `https://SEU-ENDERECO.vercel.app/api/diagnostico`. Ele
responde o estado das tres pontas — API no ar, variavel definida, banco
conectado, tabelas criadas — e, quando algo falta, diz qual e o proximo passo.
Nao devolve credencial nenhuma.

Se preferir conferir a rota de sincronismo direto, `/api/sync` responde
`{"erro":"Use POST."}` — parece erro, mas e a API viva: o navegador faz GET e o
endpoint so aceita POST. A primeira chamada depois de cada deploy e mais lenta,
porque e ela que cria as tabelas.

**5. Ligar o app a API.** No GitHub, em
*Settings -> Secrets and variables -> Actions -> Variables* (Variables, nao
Secrets — o valor precisa entrar no build), crie:

| Variavel | Valor |
|---|---|
| `VITE_API_URL` | a URL da API na Vercel, ex.: `https://vistoria-condominios.vercel.app` |

**6. Republicar o app.** Em *Actions -> Publicar app de vistorias -> Run
workflow*. So agora o app sai sabendo o endereco da API.

> Enquanto `VITE_API_URL` nao existir, o app funciona exatamente como antes:
> tudo local, sem sincronizar e sem mensagem de erro. E proposital — e melhor um
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
