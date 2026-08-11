/**
 * Verifica que cada função de `api/` CARREGA como a Vercel a executa.
 *
 * O ponto é compilar SEM empacotar. A Vercel compila cada arquivo
 * separadamente e deixa as importações relativas resolverem em tempo de
 * execução; empacotar embute tudo num arquivo só e faz a resolução desaparecer.
 * Foi assim que uma importação sem extensão — inválida em ESM — passou por toda
 * a bateria de testes e só quebrou em produção.
 *
 * Este teste existe para que isso não aconteça de novo.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, cpSync, writeFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

/** Lista os .ts de api/, sem depender do shell expandir glob. */
function arquivosTs(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return arquivosTs(p)
    return e.name.endsWith('.ts') ? [p] : []
  })
}

const FUNCOES = ['ping', 'diagnostico', 'inicio', 'sync', 'foto']

const saida = mkdtempSync(join(tmpdir(), 'api-build-'))
let falhas = 0

try {
  // Compila arquivo por arquivo, preservando a estrutura de pastas.
  const fontes = arquivosTs('api')
  execFileSync(
    'npx',
    [
      'esbuild',
      ...fontes,
      '--platform=node',
      '--format=esm',
      '--target=node22',
      `--outdir=${saida}`,
      '--outbase=api',
    ],
    { stdio: 'pipe' },
  )
  console.log(`compiladas ${fontes.length} fonte(s), sem empacotar\n`)

  // O runtime precisa saber que os .js são ESM.
  writeFileSync(join(saida, 'package.json'), JSON.stringify({ type: 'module' }))
  // As dependências ficam onde estão; basta o node_modules ao lado.
  cpSync('node_modules', join(saida, 'node_modules'), { recursive: true, force: true })

  for (const nome of FUNCOES) {
    const caminho = pathToFileURL(join(saida, `${nome}.js`)).href
    try {
      const modulo = await import(caminho)
      if (typeof modulo.default !== 'function') {
        console.log(`✗ ${nome}: não exporta uma função`)
        falhas++
      } else {
        console.log(`✓ ${nome}`)
      }
    } catch (e) {
      console.log(`✗ ${nome}: ${e.message.split('\n')[0]}`)
      falhas++
    }
  }
} finally {
  rmSync(saida, { recursive: true, force: true })
}

console.log(
  falhas === 0
    ? '\nTodas as funções carregam como a Vercel as executa.'
    : `\n${falhas} função(ões) não carregam.`,
)
process.exit(falhas ? 1 : 0)
