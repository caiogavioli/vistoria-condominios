# Especificação — App de Vistorias de Condomínios

Documento de referência do que o app faz, derivado do relatório modelo
`Relatório de Vistoria — Edifício Modelo (rev2)`.

## 1. Problema

A vistoria hoje é: percorrer o prédio, fotografar, anotar nota e observação em
algum lugar e, depois, montar o documento à mão — recortar fotos, escrever
observações, calcular a média, formatar. O trabalho de campo dura uma manhã; a
edição do relatório consome o resto do dia.

O app troca essa segunda etapa por um botão: o relatório é o próprio dado
coletado, renderizado.

## 2. Decisões de arquitetura

| Decisão | Motivo |
| --- | --- |
| Web app (PWA) em vez de app nativo | Roda em qualquer celular, sem loja de aplicativos, sem versão para aprovar; o mesmo endereço abre no computador para revisar o relatório numa tela grande. |
| Dados no aparelho (IndexedDB) | Vistoria acontece em garagem, subsolo, casa de máquinas — lugares sem sinal. Nada depende de rede. Também elimina custo de servidor e a questão de onde ficam as fotos dos condomínios. |
| PDF pela impressão do navegador | O relatório é HTML com CSS de impressão: o texto sai vetorial, a paginação é do navegador e não há biblioteca de PDF para manter. "Salvar como PDF" é o fluxo que o celular já tem. |
| Backup por arquivo `.json` | Sem servidor, a portabilidade tem que ser explícita. O arquivo carrega as fotos em base64 e importa por mesclagem (nada é apagado). |

O custo dessa escolha: os dados vivem em um aparelho por vez. Sincronizar entre
dispositivos ou entre pessoas é o primeiro item da seção 8.

## 3. Modelo de dados

```
Config            empresa (marca do relatório), responsavelPadrao
Condominio        nome, endereco, vistoriador, areasPadrao[]
  AreaTemplate    nome, icone, fotoObrigatoria
Vistoria          condominioNome*, endereco*, data, responsavel, status,
                  observacoesGerais, areas[], concluidaEm
  AreaVistoria    templateId, nome*, icone*, fotoObrigatoria*, nota (0–10 | null),
                  naoAplicavel, observacoes, fotoIds[]
Foto              vistoriaId, areaId, blob, legenda
```

`AreaVistoria.templateId` guarda o id do `AreaTemplate` de origem: é a chave que
liga a mesma área entre vistorias diferentes (seção 5).

`*` = cópia feita no momento em que a vistoria é aberta. Renomear o condomínio
ou mexer na lista de áreas depois **não** altera relatórios já emitidos — um relatório
entregue precisa continuar igual ao que foi entregue.

Os blobs das fotos ficam em tabela separada; a área guarda só a lista ordenada de
ids. Isso mantém o registro da vistoria leve para ler e gravar a cada toque.

## 4. Regras de negócio

### 4.1 Áreas

O padrão de fábrica tem 13 áreas: as 10 do relatório modelo, na mesma ordem,
seguidas de **Talude**, **Sistemas de Incêndio** e **Docas**. As três novas
entram no fim justamente para não deslocar a sequência do modelo.

Cada área é avaliada por **nota, fotos e observações** — não há subitens ou
pontos de verificação. A lista é editável por condomínio (renomear, reordenar,
remover, acrescentar).

O padrão só é copiado no momento do cadastro, então mudar o padrão não altera
condomínios já cadastrados. Para esses, a tela do condomínio mostra o bloco
**"Áreas do padrão que faltam aqui"** — comparação por nome, inclusão em um
toque, no fim da lista, sem tocar no que já foi ajustado. É opt-in de propósito:
quem removeu "Heliponto" porque o prédio não tem um decide se quer de volta.

### 4.2 Notas e faixas

| Faixa | Nota | Cor | Símbolo |
| --- | --- | --- | --- |
| Ótimo | 8 a 10 | verde `#1f9254` | ✔ |
| Regular | 5 a 7 | amarelo `#c98a00` | ⚡ |
| Crítico | 0 a 4 | vermelho `#c2352b` | ✖ |

- **Nota geral** = média aritmética das notas das áreas avaliadas, arredondada a
  uma casa decimal.
- Área **não aplicável** sai da média, da contagem de "áreas avaliadas" e do
  relatório inteiro.
- Área ativa **sem nota** aparece no resumo como "não avaliada" e não entra na
  média — o relatório não inventa nota.
- **Desempenho** na tabela de resumo = nota × 10%.

### 4.3 Foto obrigatória

Área marcada como `fotoObrigatoria` e sem nenhuma foto produz, como no modelo:

- o aviso na capa: *"⚠ N área(s) sem registro fotográfico obrigatório (…)"*;
- no detalhamento, o bloco **"📷 Foto obrigatória ausente!"** no lugar das fotos.

Ao concluir a vistoria, o app avisa quantas áreas estão sem nota e sem foto, mas
não bloqueia: às vezes a área está interditada e o relatório precisa registrar
exatamente isso.

### 4.4 Vistoriador

O responsável é escolhido de uma **lista fixa da equipe** (`data/vistoriadores.ts`),
não digitado — o nome sai no relatório e erro de digitação viraria vistoriador
novo. O condomínio guarda o vistoriador habitual, que já vem preenchido ao abrir
a vistoria e pode ser trocado ali. Um nome gravado fora da lista continua
aparecendo no seletor, para vistoria antiga não perder o responsável.

### 4.5 Fotos

- Redimensionadas para 1600 px no maior lado e recomprimidas em JPEG 82%
  (≈ 4 MB → ≈ 300 KB), aplicando a orientação EXIF.
- Legenda opcional por foto, exibida abaixo da imagem no relatório.
- No relatório: 1 foto ocupa ~58% da largura, 2 lado a lado, 3 ou mais em três
  colunas. Altura máxima de 62 mm para não empurrar o conteúdo de página.

## 5. Comparativo histórico

A vistoria isolada diz como o prédio está; a série diz se a gestão está
funcionando. O comparativo é calculado, nunca digitado.

### 5.1 Como as vistorias são pareadas

- **Vistoria anterior** = a vistoria **concluída** mais recente do mesmo
  condomínio com data anterior à atual (desempate pela ordem de criação).
  Vistorias em andamento nunca servem de base — teriam áreas pela metade.
- **Área anterior** = mesma área, identificada pelo `templateId` do cadastro do
  condomínio. Renomear "Estacionamento" para "Garagem" **não** quebra a série.
  Para áreas antigas sem template, a reserva é o nome normalizado.
- Áreas marcadas como não aplicáveis na vistoria anterior ficam fora da
  comparação — não geram uma queda falsa.

### 5.2 Onde aparece

| Lugar | O que mostra |
| --- | --- |
| **Tela da área**, durante a vistoria | Nota da última vez, a variação e, expansível, o que foi apontado — a informação que faz diferença *antes* de você dar a nota. |
| **Relatório**, capa | "Comparado à vistoria de DD/MM/AAAA: a nota geral subiu de 6,1 para 6,3 (+0,2)." |
| **Relatório**, resumo por área | Coluna **Anterior** com a nota antiga e a variação. |
| **Relatório**, detalhamento | Selo de variação ao lado da nota da área (só quando mudou). |
| **📈 Histórico do condomínio** | Nota atual e variação, gráfico da evolução, listas "Pioraram"/"Melhoraram" e a matriz área × últimas 5 vistorias. |

O relatório só ganha essas peças quando existe vistoria anterior; a primeira sai
exatamente como antes.

### 5.3 O gráfico

Série única (nota geral por vistoria), então: sem caixa de legenda — o título já
diz o que está plotado. As três faixas entram como fundo lavado e a linha é
neutra (azul da marca), de modo que a leitura **não** depende de distinguir verde
de amarelo — a paleta de faixas fica reservada ao seu papel de status. Rótulo
direto só no ponto final; os demais valores estão na matriz logo abaixo, que é a
visão tabular dos mesmos dados. Marcadores têm alvo de toque maior que o ponto e
anel na cor da superfície.

### 5.4 Painel geral (carteira)

Enquanto o histórico olha um condomínio, o painel olha todos. Sempre a partir da
**última vistoria concluída de cada condomínio** — nunca a média de todas as
vistorias, que faria um prédio vistoriado com mais frequência pesar mais.

| Bloco | Pergunta que responde |
| --- | --- |
| Nota média da carteira (figura em destaque) + média das variações | Como está o conjunto e para onde está indo |
| Condomínios · vistorias concluídas · áreas críticas | O tamanho da operação e o passivo aberto |
| **Situação atual** — barras, da pior nota para a melhor | Qual prédio precisa de atenção primeiro |
| **Evolução ao longo do tempo** — pequenos múltiplos, escala 0–10 comum | Quem está subindo e quem está caindo |
| **Áreas mais críticas da carteira** — média por área entre prédios | Que problema é sistêmico e não de um prédio só |

Duas notas de método:

- Entre condomínios, áreas são cruzadas pelo **nome normalizado** — o
  `templateId` é interno a cada cadastro e não serve como chave comum.
- **Área crítica** = nota ≤ 4 (faixa vermelha) na última vistoria.

Sobre as cores: o painel não usa paleta categórica. As barras carregam a **faixa**
(que significa bom/ruim, então é status, não identidade) sempre com símbolo,
palavra e o número ao lado; e as linhas de evolução são neutras sobre as faixas
ao fundo. Assim nenhuma leitura depende de distinguir verde de amarelo, e a
comparação entre condomínios vem da ordenação e da escala comum, não de dar uma
cor para cada prédio — que viraria sopa de letrinhas quando a carteira crescer.

### 5.5 Dados de demonstração

O app não tem servidor, então ninguém consegue semear a base de fora: a geração
tem que rodar no próprio aparelho. Em Ajustes, um botão cria 3 vistorias
concluídas (junho, julho e agosto do último ano em que esses meses já
passaram) para **cada condomínio cadastrado**.

- Notas derivadas do id do condomínio, então a mesma base gera sempre a mesma
  curva, e cada condomínio recebe um perfil — melhorando, estável ou piorando —
  para os gráficos não saírem idênticos.
- Observações escolhidas por faixa, e uma foto de apoio por área, para o
  relatório não ficar tomado pelo bloco de foto obrigatória ausente.
- Cada vistoria carrega `demo: true` e o aviso *"Vistoria fictícia, gerada para
  demonstração do aplicativo"* nas observações gerais, que sai impresso no
  relatório. A foto de apoio é chapada e escrita **FOTO DE DEMONSTRAÇÃO** — em
  nenhum momento um dado fictício se apresenta como registro real.
- A limpeza remove só o que tem a marca: vistorias reais, condomínios e ajustes
  ficam intactos.

## 6. Fluxo de uso

```
Início ──▶ Condomínios ──▶ Cadastro (as 10 áreas do modelo já vêm prontas)
   │
   └──▶ Nova vistoria (condomínio, data, responsável)
             │
             ▼
        Lista de áreas ◀────────────┐  nota geral e progresso ao vivo
             │                      │
             ▼                      │
        Área: nota 0–10             │
              observações
              fotos (câmera ou galeria)
             │                      │
             └── "Próxima ›" ───────┘
             │
             ▼
        Concluir ──▶ Relatório ──▶ Gerar PDF
```

A navegação principal é **Próxima ›**: a vistoria é percorrida em sequência, sem
voltar à lista a cada área. A lista serve para conferir o que falta e pular
áreas.

O gravador é imediato — cada toque em nota, item ou texto persiste no banco. Não
existe "salvar", e fechar o app no meio da vistoria não perde nada.

## 7. O relatório

Estrutura, na ordem:

1. **Capa/resumo** — marca da administradora, título, nome e endereço do
   condomínio; faixa com data, responsável, quantidade de áreas e nota; destaque
   da nota geral com o círculo colorido e o texto da faixa; aviso de fotos
   ausentes; legenda das cores; tabela **Resumo de Notas por Área** (área, nota,
   faixa, barra de desempenho); observações gerais, se houver.
2. **Detalhamento por Área** (começa em página nova) — por área: cabeçalho com
   ícone, nome e nota, fotos com legenda (ou o bloco de foto ausente) e o bloco
   **Observações**.
3. **Rodapé** — "Relatório gerado em DD/MM/AAAA às HH:MM · {empresa} — Sistema de
   Vistorias de Condomínios" e a nota de uso interno.

Impressão: A4, margem 12 mm, cada área com `break-inside: avoid` para não partir
no meio da página, e `print-color-adjust: exact` para as barras e etiquetas
saírem coloridas no PDF.

## 8. Fora do escopo desta versão

Itens deliberadamente adiados, em ordem de utilidade provável:

1. **Sincronização / nuvem** — hoje o dado vive em um aparelho, com backup
   manual por arquivo. É o primeiro limite que aparece se mais de uma pessoa
   vistoriar.
2. **Plano de ação** — transformar cada não conformidade em item com
   responsável, prazo e status, e cobrar o fechamento na vistoria seguinte. O
   comparativo (seção 5) já mostra o que piorou; falta o compromisso de correção.
3. **Envio direto** — anexar o PDF em e-mail ou WhatsApp pelo próprio app, em vez
   de passar pela impressão.
4. **Logo do condomínio/administradora** no cabeçalho do relatório.
5. **Assinatura digital** do síndico ou do vistoriador ao final.
6. **Ditado de observações** por voz durante a vistoria.
