# Vistorias de Condomínios

App para fazer a vistoria no celular e sair de lá com o relatório pronto — sem
montar documento à mão depois.

O formato do relatório é o do modelo `Relatório de Vistoria — Edifício Modelo`:
capa com nota geral, resumo de notas por área e detalhamento com fotos e
observações.

## Como funciona na prática

1. **Cadastra o condomínio** uma vez. Ele já vem com as 10 áreas do relatório
   modelo (Recepção, Auditório, Estacionamento, Segurança, Bicicletário,
   Elevadores, Heliponto, Jardinagem, Limpeza, Manutenção) e cada área traz seus
   pontos de verificação. Dá para renomear, reordenar, remover e adicionar
   outras (piscina, academia, gerador, combate a incêndio…).
2. **Abre a vistoria** e percorre o prédio. Em cada área: dá a nota de 0 a 10,
   marca os pontos de verificação como OK / Atenção / Crítico, tira as fotos e
   escreve a observação. O botão **Montar texto a partir do checklist** já
   redige um rascunho da observação com o que foi marcado.
3. **Conclui** e o relatório sai pronto. O botão **Gerar PDF** abre a impressão
   do navegador — escolha "Salvar como PDF" e envie para o condomínio.

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

## Rodando

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # gera dist/
npm run preview  # serve o dist/
```

Instalar no celular: abra o endereço no Chrome/Safari e use "Adicionar à tela de
início". A partir daí abre como app e funciona offline.

Publicação: `dist/` é um site estático — serve em GitHub Pages, Netlify, Vercel
ou qualquer hospedagem. O `base` do Vite é relativo, então funciona também em
subdiretório.

## Backup

Os dados ficam só no aparelho (IndexedDB). Em **Ajustes → Exportar backup** sai
um `.json` com tudo, inclusive as fotos, que pode ser importado em outro
aparelho. Vale exportar de tempos em tempos — limpar os dados do site apaga as
vistorias.

## Estrutura

```
src/
  data/areasPadrao.ts   checklist padrão (do relatório modelo) + áreas sugeridas
  lib/db.ts             IndexedDB (Dexie): condomínios, vistorias, fotos, config
  lib/score.ts          faixas, nota geral, pendências de foto, progresso
  lib/imagem.ts         compressão das fotos
  lib/backup.ts         exportação/importação
  pages/Relatorio.tsx   o relatório (mesma peça na tela e no PDF)
  pages/relatorio.css   layout A4 e regras de impressão
```

A especificação funcional completa está em [`docs/ESPECIFICACAO.md`](docs/ESPECIFICACAO.md).
