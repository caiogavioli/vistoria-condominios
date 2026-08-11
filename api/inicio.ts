import type { VercelRequest, VercelResponse } from '@vercel/node'

import { consultar } from './_lib/db.js'
import { comErros } from './_lib/http.js'
import { garantirMigracoes } from './_lib/migrar.js'

/**
 * Página inicial do domínio da API.
 *
 * Antes esta raiz redirecionava direto para o aplicativo, sem dizer nada. Quem
 * abria o endereço do projeto na Vercel era jogado para outro site e ficava sem
 * saber se a API estava no ar — a pergunta que essa pessoa tinha justamente ali.
 *
 * Agora a raiz responde por si: diz o que é este endereço, mostra o estado da
 * instalação e leva ao aplicativo por um link visível.
 */

const APP = 'https://caiogavioli.github.io/vistoria-condominios/'

export default comErros(async function handler(_req: VercelRequest, res: VercelResponse) {
  const linhas: { rotulo: string; valor: string; ok: boolean }[] = []

  const temUrl = Boolean(process.env.DATABASE_URL)
  linhas.push({
    rotulo: 'Variável DATABASE_URL',
    valor: temUrl ? 'definida' : 'faltando',
    ok: temUrl,
  })

  let detalhe = ''

  if (temUrl) {
    try {
      await consultar('SELECT 1')
      linhas.push({ rotulo: 'Conexão com o banco', valor: 'respondendo', ok: true })

      await garantirMigracoes()
      const [c] = await consultar<Record<string, string>>(`
        SELECT (SELECT count(*) FROM condominios)::text AS condominios,
               (SELECT count(*) FROM vistorias)::text   AS vistorias,
               (SELECT count(*) FROM fotos)::text       AS fotos
      `)
      linhas.push({ rotulo: 'Tabelas', valor: 'criadas', ok: true })
      linhas.push({
        rotulo: 'Gravado até agora',
        valor: `${c.condominios} condomínio(s) · ${c.vistorias} vistoria(s) · ${c.fotos} foto(s)`,
        ok: true,
      })
    } catch (e) {
      linhas.push({ rotulo: 'Conexão com o banco', valor: 'falhou', ok: false })
      detalhe = e instanceof Error ? e.message : String(e)
    }
  } else {
    detalhe =
      'Defina DATABASE_URL nas variáveis de ambiente do projeto e faça um novo ' +
      'deploy — a plataforma não aplica variáveis a um deploy que já existe.'
  }

  const tudoOk = linhas.every((l) => l.ok)

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).send(`<!doctype html>
<html lang="pt-BR">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>API de Vistorias — estado</title>
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0; padding: 2.5rem 1.25rem;
    font: 16px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    background: #f6f8fa; color: #11161d;
  }
  @media (prefers-color-scheme: dark) {
    body { background: #0e1319; color: #eef2f7; }
    .cartao { background: #161c24 !important; border-color: #27313c !important; }
    tr { border-color: #27313c !important; }
    .rotulo { color: #aab4c0 !important; }
    .detalhe { background: #2a2114 !important; border-color: #5a4520 !important; }
  }
  .folha { max-width: 34rem; margin: 0 auto; }
  h1 { font-size: 1.375rem; letter-spacing: -.015em; margin: 0 0 .375rem; }
  .sub { color: #4a5462; margin: 0 0 1.75rem; }
  @media (prefers-color-scheme: dark) { .sub { color: #aab4c0; } }
  .cartao {
    background: #fff; border: 1px solid #dbe1e9; border-radius: 10px;
    padding: 1rem 1.125rem; margin-bottom: 1.25rem;
  }
  table { width: 100%; border-collapse: collapse; }
  tr { border-bottom: 1px solid #dbe1e9; }
  tr:last-child { border-bottom: 0; }
  td { padding: .55rem 0; vertical-align: baseline; }
  .rotulo { color: #4a5462; font-size: .9375rem; }
  .valor { text-align: right; font-weight: 600; font-size: .9375rem; }
  .ok { color: #14713f; }
  .falha { color: #a72f27; }
  @media (prefers-color-scheme: dark) { .ok { color: #56c98a; } .falha { color: #ef8880; } }
  .detalhe {
    background: #fbf0dd; border: 1px solid #e0c48a; border-radius: 8px;
    padding: .75rem .875rem; font-size: .875rem; margin-bottom: 1.25rem;
  }
  .botao {
    display: inline-block; background: #1f5fa9; color: #fff; text-decoration: none;
    border-radius: 8px; padding: .625rem 1rem; font-weight: 600; font-size: .9375rem;
  }
  .miudo { font-size: .8125rem; color: #78828f; margin-top: 1.5rem; }
  code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: .875em; }
</style>
<div class="folha">
  <h1>API de Vistorias</h1>
  <p class="sub">
    Este endereço é o servidor que guarda as vistorias. O aplicativo que a
    equipe usa fica em outro endereço.
  </p>

  <div class="cartao">
    <table>
      ${linhas
        .map(
          (l) => `<tr>
        <td class="rotulo">${l.rotulo}</td>
        <td class="valor ${l.ok ? 'ok' : 'falha'}">${l.ok ? '' : '▲ '}${l.valor}</td>
      </tr>`,
        )
        .join('')}
    </table>
  </div>

  ${detalhe ? `<div class="detalhe">${detalhe}</div>` : ''}

  <p><a class="botao" href="${APP}">Abrir o aplicativo de vistorias</a></p>

  <p class="miudo">
    ${
      tudoOk
        ? 'Tudo pronto: o aplicativo pode sincronizar com este servidor.'
        : 'Corrija o ponto marcado acima e recarregue esta página.'
    }
    Para o mesmo estado em formato de dados, use <code>/api/diagnostico</code>.
  </p>
</div>
</html>`)
})
