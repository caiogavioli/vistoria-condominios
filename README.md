# Vistorias de Condomínios

App para fazer a vistoria no celular e sair de lá com o relatório pronto — sem
montar documento à mão depois.

O formato do relatório é o do modelo `Relatório de Vistoria — Edifício Modelo`:
capa com nota geral, resumo de notas por área e detalhamento com fotos e
observações.

## Como funciona na prática

1. **Cadastra o condomínio** uma vez. Ele já vem com as 10 áreas do relatório
   modelo, na mesma ordem: Recepção e Portaria, Auditório, Estacionamento,
   Segurança Patrimonial, Bicicletário, Elevadores, Heliponto, Jardinagem e
   Paisagismo, Limpeza e Conservação, Manutenção e Zeladoria. Dá para renomear,
   reordenar, remover e acrescentar áreas se algum prédio precisar.
2. **Abre a vistoria** e percorre o prédio. Em cada área: dá a nota de 0 a 10,
   tira as fotos e escreve a observação.
3. **Conclui** e o relatório sai pronto. O botão **Gerar PDF** abre a impressão
   do navegador — escolha "Salvar como PDF" e envie para o condomínio.

A partir da segunda vistoria o app compara sozinho com a anterior: ao avaliar uma
área, aparece a nota e o que foi apontado da última vez; no relatório entram a
coluna **Anterior** e a variação por área; e o **📈 Histórico** do condomínio
mostra a evolução da nota geral e o que melhorou ou piorou.

Tudo roda no aparelho: funciona em garagem e subsolo sem sinal, e as fotos não
sobem para lugar nenhum.

## Regras que o app aplica sozinho

- **Nota geral** = média aritmética das áreas avaliadas (áreas marcadas como
  "não aplicável" ficam de fora da média e do relatório).
- **Faixas**: 8–10 Ótimo (verde), 5–7 Regular (amarelo), 0–4 Crítico (vermelho).
- **Foto obrigatória**: área marcada como obrigatória sem nenhuma foto gera o
  aviso na capa e o bloco "Foto obrigatória ausente!" no detalhamento, igual ao
  modelo.
- **Fotos são reduzidas** para no máximo 1600 px antes de salvar, para o
  aparelho e o PDF não incharem.
- **Comparativo** usa sempre a vistoria *concluída* anterior do mesmo
  condomínio. As áreas são pareadas pelo cadastro, então renomear uma área não
  quebra o histórico.

## Rodando

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # gera dist/
npm run preview  # serve o dist/
```

Instalar no celular: abra o endereço no Chrome/Safari e use "Adicionar à tela de
início". A partir daí abre como app e funciona offline.

## Publicação

O workflow `.github/workflows/deploy.yml` constrói o app a cada push na `main`
e publica a saída no branch `gh-pages`.

Para o endereço ficar no ar, uma vez só: **Settings → Pages → Source: Deploy
from a branch → `gh-pages` / `(root)` → Save**. O app passa a responder em
`https://caiogavioli.github.io/vistoria-condominios/` e cada push republica sozinho.

O `base` do Vite é relativo e as rotas usam hash, então funciona em
subdiretório sem configuração extra — serve igual em Netlify, Vercel ou
qualquer hospedagem estática.

## Backup

Os dados ficam só no aparelho (IndexedDB). Em **Ajustes → Exportar backup** sai
um `.json` com tudo, inclusive as fotos, que pode ser importado em outro
aparelho. Vale exportar de tempos em tempos — limpar os dados do site apaga as
vistorias.

## Estrutura

```
src/
  data/areasPadrao.ts   as 10 áreas do relatório modelo
  lib/db.ts             IndexedDB (Dexie): condomínios, vistorias, fotos, config
  lib/score.ts          faixas, nota geral, pendências de foto, progresso
  lib/historico.ts      pareamento entre vistorias, variações e série temporal
  lib/imagem.ts         compressão das fotos
  lib/backup.ts         exportação/importação
  pages/HistoricoCondominio.tsx  evolução da nota, o que subiu/caiu, matriz por área
  pages/Relatorio.tsx   o relatório (mesma peça na tela e no PDF)
  pages/relatorio.css   layout A4 e regras de impressão
```

A especificação funcional completa está em [`docs/ESPECIFICACAO.md`](docs/ESPECIFICACAO.md).
