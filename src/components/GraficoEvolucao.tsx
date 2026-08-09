import { useState } from 'react'
import { dataBR } from '../lib/format'
import type { PontoSerie } from '../lib/historico'
import { FAIXAS, faixaDaNota } from '../lib/score'
import './grafico.css'

interface Props {
  pontos: PontoSerie[]
}

const L = 24 // margem esquerda (rótulos do eixo)
const R = 12
const T = 12
const B = 26
const LARG = 320
const ALT = 170

const y = (nota: number) => T + (1 - nota / 10) * (ALT - T - B)

/**
 * Evolução da nota geral. Série única: sem legenda — as faixas ficam no fundo e
 * a linha é neutra, então a leitura não depende de distinguir verde de amarelo.
 * A tabela de áreas logo abaixo é a visão tabular dos mesmos dados.
 */
export function GraficoEvolucao({ pontos }: Props) {
  const [selecionado, setSelecionado] = useState(pontos.length - 1)

  if (pontos.length === 0) return null

  const x = (i: number) =>
    pontos.length === 1 ? (LARG - L - R) / 2 + L : L + (i / (pontos.length - 1)) * (LARG - L - R)

  const caminho = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)} ${y(p.nota)}`).join(' ')
  const atual = pontos[Math.min(selecionado, pontos.length - 1)]
  const faixaAtual = FAIXAS[faixaDaNota(atual.nota)]
  const mostrarTodasDatas = pontos.length <= 5

  const bandas = [
    { de: 0, ate: 4.5, cor: FAIXAS.critico.cor },
    { de: 4.5, ate: 7.5, cor: FAIXAS.regular.cor },
    { de: 7.5, ate: 10, cor: FAIXAS.otimo.cor },
  ]

  return (
    <div className="grafico">
      <svg
        viewBox={`0 0 ${LARG} ${ALT}`}
        className="grafico-svg"
        role="img"
        aria-label={`Evolução da nota geral em ${pontos.length} vistorias, de ${pontos[0].nota
          .toFixed(1)
          .replace('.', ',')} em ${dataBR(pontos[0].data)} a ${pontos
          .at(-1)!
          .nota.toFixed(1)
          .replace('.', ',')} em ${dataBR(pontos.at(-1)!.data)}.`}
      >
        {bandas.map((b) => (
          <rect
            key={b.de}
            x={L}
            y={y(b.ate)}
            width={LARG - L - R}
            height={y(b.de) - y(b.ate)}
            fill={b.cor}
            opacity={0.09}
          />
        ))}

        {[0, 5, 10].map((n) => (
          <g key={n}>
            <line x1={L} x2={LARG - R} y1={y(n)} y2={y(n)} className="grafico-grade" />
            <text x={L - 6} y={y(n) + 3.5} className="grafico-tick" textAnchor="end">
              {n}
            </text>
          </g>
        ))}

        <path d={caminho} className="grafico-linha" fill="none" />

        {pontos.map((p, i) => (
          <g key={p.vistoriaId}>
            <circle cx={x(i)} cy={y(p.nota)} r={i === selecionado ? 5.5 : 4} className="grafico-ponto" />
            {/* alvo de toque maior que o marcador */}
            <circle
              cx={x(i)}
              cy={y(p.nota)}
              r={14}
              fill="transparent"
              className="grafico-alvo"
              onClick={() => setSelecionado(i)}
            >
              <title>{`${dataBR(p.data)}: ${p.nota.toFixed(1).replace('.', ',')}`}</title>
            </circle>
            {(mostrarTodasDatas || i === 0 || i === pontos.length - 1) && (
              <text x={x(i)} y={ALT - 8} className="grafico-tick" textAnchor="middle">
                {dataBR(p.data).slice(0, 5)}
              </text>
            )}
          </g>
        ))}

        {/* rótulo direto apenas no ponto final, como manda o bom senso de leitura */}
        <text
          x={x(pontos.length - 1)}
          y={y(pontos.at(-1)!.nota) - 12}
          className="grafico-valor"
          textAnchor={pontos.length === 1 ? 'middle' : 'end'}
        >
          {pontos.at(-1)!.nota.toFixed(1).replace('.', ',')}
        </text>
      </svg>

      <p className="grafico-legenda">
        <strong>{dataBR(atual.data)}</strong> · nota {atual.nota.toFixed(1).replace('.', ',')}
        <span className="etiqueta" style={{ background: faixaAtual.corFraca, color: faixaAtual.cor }}>
          {faixaAtual.simbolo} {faixaAtual.rotulo}
        </span>
        {pontos.length > 1 && <span className="muted">toque nos pontos para ver cada vistoria</span>}
      </p>
    </div>
  )
}
