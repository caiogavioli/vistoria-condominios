import type { AreaTemplate } from '../types'

/**
 * Checklist padrão. As 10 primeiras são as do relatório modelo (Edifício
 * Modelo, rev2), na mesma ordem; as três últimas foram acrescentadas depois e
 * entram no fim para não deslocar a sequência do modelo.
 *
 * `categoria` segue a cartilha "Cuidado com o Caminho do Rei": o trajeto do
 * visitante (portaria, acessos, vias internas, estacionamento, hall,
 * elevadores) e o que o mantém assim (limpeza e manutenção do próprio
 * trajeto) entram em `caminho_do_rei`; o resto, em `geral`.
 */
export const AREAS_PADRAO: Omit<AreaTemplate, 'id'>[] = [
  { nome: 'Recepção e Portaria', icone: '🏢', fotoObrigatoria: true, categoria: 'caminho_do_rei' },
  { nome: 'Auditório', icone: '🎭', fotoObrigatoria: true, categoria: 'geral' },
  { nome: 'Estacionamento', icone: '🚗', fotoObrigatoria: true, categoria: 'caminho_do_rei' },
  { nome: 'Segurança Patrimonial', icone: '🔒', fotoObrigatoria: true, categoria: 'caminho_do_rei' },
  { nome: 'Bicicletário', icone: '🚲', fotoObrigatoria: true, categoria: 'geral' },
  { nome: 'Elevadores', icone: '🛗', fotoObrigatoria: true, categoria: 'caminho_do_rei' },
  { nome: 'Heliponto', icone: '🚁', fotoObrigatoria: true, categoria: 'caminho_do_rei' },
  { nome: 'Jardinagem e Paisagismo', icone: '🌿', fotoObrigatoria: true, categoria: 'caminho_do_rei' },
  { nome: 'Limpeza e Conservação', icone: '🧹', fotoObrigatoria: true, categoria: 'caminho_do_rei' },
  { nome: 'Manutenção e Zeladoria', icone: '🔧', fotoObrigatoria: true, categoria: 'caminho_do_rei' },
  { nome: 'Talude', icone: '⛰️', fotoObrigatoria: true, categoria: 'geral' },
  { nome: 'Sistemas de Incêndio', icone: '🧯', fotoObrigatoria: true, categoria: 'geral' },
  { nome: 'Docas', icone: '🚚', fotoObrigatoria: true, categoria: 'geral' },
]
