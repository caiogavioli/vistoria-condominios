import type { AreaTemplate } from '../types'

/**
 * Checklist padrão — as mesmas 10 áreas do relatório modelo
 * (Edifício Modelo, rev2), na mesma ordem.
 */
export const AREAS_PADRAO: Omit<AreaTemplate, 'id'>[] = [
  { nome: 'Recepção e Portaria', icone: '🏢', fotoObrigatoria: true },
  { nome: 'Auditório', icone: '🎭', fotoObrigatoria: true },
  { nome: 'Estacionamento', icone: '🚗', fotoObrigatoria: true },
  { nome: 'Segurança Patrimonial', icone: '🔒', fotoObrigatoria: true },
  { nome: 'Bicicletário', icone: '🚲', fotoObrigatoria: true },
  { nome: 'Elevadores', icone: '🛗', fotoObrigatoria: true },
  { nome: 'Heliponto', icone: '🚁', fotoObrigatoria: true },
  { nome: 'Jardinagem e Paisagismo', icone: '🌿', fotoObrigatoria: true },
  { nome: 'Limpeza e Conservação', icone: '🧹', fotoObrigatoria: true },
  { nome: 'Manutenção e Zeladoria', icone: '🔧', fotoObrigatoria: true },
]
