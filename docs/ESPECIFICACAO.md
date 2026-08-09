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
dispositivos ou entre pessoas é o item 7.1 do roadmap.

## 3. Modelo de dados

```
Config            empresa (marca do relatório), responsavelPadrao
Condominio        nome, endereco, sindico, areasPadrao[]
  AreaTemplate    nome, icone, fotoObrigatoria, itens[]
Vistoria          condominioNome*, endereco*, data, responsavel, status,
                  observacoesGerais, areas[], concluidaEm
  AreaVistoria    nome*, icone*, fotoObrigatoria*, nota (0–10 | null),
                  naoAplicavel, observacoes, itens[{texto, status}], fotoIds[]
Foto              vistoriaId, areaId, blob, legenda
```

`*` = cópia feita no momento em que a vistoria é aberta. Renomear o condomínio
ou mexer no checklist depois **não** altera relatórios já emitidos — um relatório
entregue precisa continuar igual ao que foi entregue.

Os blobs das fotos ficam em tabela separada; a área guarda só a lista ordenada de
ids. Isso mantém o registro da vistoria leve para ler e gravar a cada toque.

## 4. Regras de negócio

### 4.1 Notas e faixas

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

### 4.2 Foto obrigatória

Área marcada como `fotoObrigatoria` e sem nenhuma foto produz, como no modelo:

- o aviso na capa: *"⚠ N área(s) sem registro fotográfico obrigatório (…)"*;
- no detalhamento, o bloco **"📷 Foto obrigatória ausente!"** no lugar das fotos.

Ao concluir a vistoria, o app avisa quantas áreas estão sem nota e sem foto, mas
não bloqueia: às vezes a área está interditada e o relatório precisa registrar
exatamente isso.

### 4.3 Fotos

- Redimensionadas para 1600 px no maior lado e recomprimidas em JPEG 82%
  (≈ 4 MB → ≈ 300 KB), aplicando a orientação EXIF.
- Legenda opcional por foto, exibida abaixo da imagem no relatório.
- No relatório: 1 foto ocupa ~58% da largura, 2 lado a lado, 3 ou mais em três
  colunas. Altura máxima de 62 mm para não empurrar o conteúdo de página.

## 5. Fluxo de uso

```
Início ──▶ Condomínios ──▶ Cadastro (checklist padrão já vem preenchido)
   │
   └──▶ Nova vistoria (condomínio, data, responsável)
             │
             ▼
        Lista de áreas ◀────────────┐  nota geral e progresso ao vivo
             │                      │
             ▼                      │
        Área: nota 0–10             │
              pontos OK/Atenção/Crítico
              observações (+ rascunho automático)
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

## 6. O relatório

Estrutura, na ordem:

1. **Capa/resumo** — marca da administradora, título, nome e endereço do
   condomínio; faixa com data, responsável, quantidade de áreas e nota; destaque
   da nota geral com o círculo colorido e o texto da faixa; aviso de fotos
   ausentes; legenda das cores; tabela **Resumo de Notas por Área** (área, nota,
   faixa, barra de desempenho); observações gerais, se houver.
2. **Detalhamento por Área** (começa em página nova) — por área: cabeçalho com
   ícone, nome e nota, fotos com legenda (ou o bloco de foto ausente), os pontos
   de verificação marcados e o bloco **Observações**.
3. **Rodapé** — "Relatório gerado em DD/MM/AAAA às HH:MM · {empresa} — Sistema de
   Vistorias de Condomínios" e a nota de uso interno.

Impressão: A4, margem 12 mm, cada área com `break-inside: avoid` para não partir
no meio da página, e `print-color-adjust: exact` para as barras e etiquetas
saírem coloridas no PDF.

## 7. Fora do escopo desta versão

Itens deliberadamente adiados, em ordem de utilidade provável:

1. **Sincronização / nuvem** — hoje o dado vive em um aparelho, com backup
   manual por arquivo. É o primeiro limite que aparece se mais de uma pessoa
   vistoriar.
2. **Plano de ação** — transformar cada não conformidade em item com
   responsável, prazo e status, e cobrar o fechamento na vistoria seguinte.
3. **Comparativo histórico** — evolução da nota por área entre vistorias do mesmo
   condomínio ("estacionamento saiu de 4 para 7").
4. **Envio direto** — anexar o PDF em e-mail ou WhatsApp pelo próprio app, em vez
   de passar pela impressão.
5. **Logo do condomínio/administradora** no cabeçalho do relatório.
6. **Assinatura digital** do síndico ou do vistoriador ao final.
7. **Ditado de observações** por voz durante a vistoria.
