import { db, salvarVistoria } from './db'
import { novoId } from './id'
import { areaDeTemplate } from './vistoria'
import type { AreaVistoria, Foto, Vistoria } from '../types'

const MESES_DEMO = [
  { mes: 6, dia: 10, rotulo: 'junho' },
  { mes: 7, dia: 10, rotulo: 'julho' },
  { mes: 8, dia: 10, rotulo: 'agosto' },
]

/** Perfis de evolução, para os gráficos não saírem todos iguais. */
const PERFIS = [
  { nome: 'melhorando', passo: 1 },
  { nome: 'estável', passo: 0 },
  { nome: 'piorando', passo: -1 },
]

const OBSERVACOES: Record<'otimo' | 'regular' | 'critico', string[]> = {
  otimo: [
    'Área em bom estado de conservação, sem pendências relevantes na data da vistoria.',
    'Limpeza e organização adequadas. Equipamentos operando normalmente.',
    'Sem apontamentos. Manutenção preventiva em dia.',
  ],
  regular: [
    'Conservação parcial: desgaste visível em pontos localizados. Recomenda-se manutenção programada.',
    'Funcionamento normal, porém com sinais de uso que pedem atenção no próximo ciclo.',
    'Pequenas pendências identificadas, sem risco imediato. Incluir no plano de manutenção.',
  ],
  critico: [
    'Não conformidade relevante identificada. Recomenda-se ação corretiva com prioridade.',
    'Estado crítico: item comprometido e sem condição de uso seguro. Correção imediata.',
    'Falha identificada com impacto em segurança ou operação. Abrir chamado com urgência.',
  ],
}

const AVISO_DEMO =
  'Vistoria fictícia, gerada para demonstração do aplicativo. Não corresponde a uma inspeção realizada.'

/** Números estáveis a partir de um texto — o mesmo condomínio sempre gera a mesma curva. */
function semente(texto: string): number {
  let h = 0
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) >>> 0
  return h
}

function limitar(n: number): number {
  return Math.max(0, Math.min(10, Math.round(n)))
}

/** Ano em que junho, julho e agosto já aconteceram. */
function anoDeReferencia(): number {
  const hoje = new Date()
  const ano = hoje.getFullYear()
  const agostoJaPassou = hoje.getMonth() > 7 || (hoje.getMonth() === 7 && hoje.getDate() >= 10)
  return agostoJaPassou ? ano : ano - 1
}

/** Imagem de apoio, marcada como demonstração — não passa por foto real. */
async function fotoPlaceholder(texto: string): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 480
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#e6ebf1'
  ctx.fillRect(0, 0, 640, 480)
  ctx.fillStyle = '#8c99a8'
  ctx.font = 'bold 30px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('FOTO DE DEMONSTRAÇÃO', 320, 220)
  ctx.font = '24px sans-serif'
  ctx.fillText(texto.slice(0, 28), 320, 264)
  return await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b as Blob), 'image/jpeg', 0.7),
  )
}

export interface ResultadoDemo {
  condominios: number
  vistorias: number
}

/**
 * Cria três vistorias concluídas (junho, julho e agosto) para cada condomínio
 * cadastrado. Serve para ver o histórico e o painel com conteúdo antes de ter
 * vistorias reais; tudo fica marcado como demonstração e sai junto na limpeza.
 */
export async function gerarVistoriasDemo(): Promise<ResultadoDemo> {
  const condominios = await db.condominios.toArray()
  const ano = anoDeReferencia()
  let totalVistorias = 0

  for (const cond of condominios) {
    const s = semente(cond.id || cond.nome)
    const perfil = PERFIS[s % PERFIS.length]
    const base = 4 + (s % 5) // 4 a 8

    for (let k = 0; k < MESES_DEMO.length; k++) {
      const { mes, dia } = MESES_DEMO[k]
      const data = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
      const criadoEm = new Date(`${data}T09:00:00`).toISOString()

      const areas: AreaVistoria[] = cond.areasPadrao.map((template, i) => {
        const area = areaDeTemplate(template)
        const desvio = [-2, -1, 0, 1, 2, -1, 0, 1, -2, 2, 0, -1, 1][i % 13]
        const ruido = ((s + i * 7 + k * 13) % 3) - 1
        const nota = limitar(base + desvio + perfil.passo * k + ruido)
        const faixa = nota >= 8 ? 'otimo' : nota >= 5 ? 'regular' : 'critico'
        const textos = OBSERVACOES[faixa]
        return {
          ...area,
          nota,
          observacoes: textos[(s + i + k) % textos.length],
        }
      })

      const vistoria: Vistoria = {
        id: novoId('vist'),
        condominioId: cond.id,
        condominioNome: cond.nome,
        endereco: cond.endereco,
        data,
        responsavel: cond.vistoriador || 'Caio Gavioli',
        status: 'concluida',
        areas,
        observacoesGerais: AVISO_DEMO,
        criadoEm,
        atualizadoEm: criadoEm,
        concluidaEm: new Date(`${data}T11:30:00`).toISOString(),
        demo: true,
      }

      const fotos: Foto[] = []
      for (const area of vistoria.areas) {
        if (!area.fotoObrigatoria) continue
        const foto: Foto = {
          id: novoId('foto'),
          vistoriaId: vistoria.id,
          areaId: area.id,
          blob: await fotoPlaceholder(area.nome),
          legenda: 'Registro de demonstração',
          criadoEm,
        }
        fotos.push(foto)
        area.fotoIds = [foto.id]
      }

      await db.fotos.bulkPut(fotos)
      await salvarVistoria(vistoria)
      totalVistorias++
    }
  }

  return { condominios: condominios.length, vistorias: totalVistorias }
}

export async function contarVistoriasDemo(): Promise<number> {
  const todas = await db.vistorias.toArray()
  return todas.filter((v) => v.demo).length
}

/** Remove tudo que foi gerado como demonstração, sem tocar nas vistorias reais. */
export async function apagarVistoriasDemo(): Promise<number> {
  const todas = await db.vistorias.toArray()
  const alvos = todas.filter((v) => v.demo)
  await db.transaction('rw', db.vistorias, db.fotos, async () => {
    for (const v of alvos) {
      await db.fotos.where('vistoriaId').equals(v.id).delete()
      await db.vistorias.delete(v.id)
    }
  })
  return alvos.length
}
