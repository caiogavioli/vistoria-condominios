import type { AreaTemplate } from '../types'

/**
 * Checklist padrão derivado do relatório modelo (Edifício Modelo, rev2).
 * É apenas o ponto de partida: cada condomínio pode editar suas áreas.
 */
export const AREAS_PADRAO: Omit<AreaTemplate, 'id'>[] = [
  {
    nome: 'Recepção e Portaria',
    icone: '🏢',
    fotoObrigatoria: true,
    itens: [
      'Porteiros uniformizados e postura de atendimento',
      'Livro/sistema de registro de visitantes atualizado',
      'Iluminação e climatização do ambiente',
      'Organização da bancada e mural de avisos',
      'Controle de entrega de encomendas',
    ],
  },
  {
    nome: 'Auditório',
    icone: '🎭',
    fotoObrigatoria: true,
    itens: [
      'Estado das cadeiras e mobiliário',
      'Sistema de som e microfones',
      'Projeção / recursos audiovisuais',
      'Ar-condicionado em operação',
      'Rotas de saída desobstruídas',
    ],
  },
  {
    nome: 'Estacionamento',
    icone: '🚗',
    fotoObrigatoria: true,
    itens: [
      'Demarcação de vagas legível',
      'Iluminação em todos os setores',
      'Câmeras de segurança em funcionamento',
      'Piso sem óleo, vazamentos ou obstruções',
      'Portão automático e sensores',
      'Sinalização de rotas e velocidade',
    ],
  },
  {
    nome: 'Segurança Patrimonial',
    icone: '🔒',
    fotoObrigatoria: true,
    itens: [
      'CFTV com câmeras ativas e gravação',
      'Controle de acesso (biometria/cartão)',
      'Equipe em posto e devidamente treinada',
      'Registro de rondas atualizado',
      'Plano de emergência afixado e vigente',
    ],
  },
  {
    nome: 'Bicicletário',
    icone: '🚲',
    fotoObrigatoria: true,
    itens: [
      'Estado dos suportes (corrosão, fixação)',
      'Capacidade x ocupação',
      'Iluminação local',
      'Cobertura de câmera de segurança',
    ],
  },
  {
    nome: 'Elevadores',
    icone: '🛗',
    fotoObrigatoria: true,
    itens: [
      'Todos os elevadores em funcionamento',
      'Certificado de inspeção válido',
      'Limpeza e conservação do interior',
      'Botões e interfone de emergência testados',
      'Ruídos ou trepidação anormais',
    ],
  },
  {
    nome: 'Heliponto',
    icone: '🚁',
    fotoObrigatoria: true,
    itens: [
      'Demarcação do círculo de pouso',
      'Luzes de balizamento',
      'Acesso e fechaduras',
      'Extintor específico da área',
      'Certificação de uso vigente',
    ],
  },
  {
    nome: 'Jardinagem e Paisagismo',
    icone: '🌿',
    fotoObrigatoria: true,
    itens: [
      'Poda e aparência dos jardins',
      'Gramado e irrigação',
      'Saúde das plantas ornamentais',
      'Limpeza de folhas em calçadas',
    ],
  },
  {
    nome: 'Limpeza e Conservação',
    icone: '🧹',
    fotoObrigatoria: true,
    itens: [
      'Áreas comuns, halls e corredores',
      'Lixeiras e coleta seletiva',
      'Escadas de emergência',
      'Banheiros de uso comum',
      'Materiais e EPIs da equipe',
    ],
  },
  {
    nome: 'Manutenção e Zeladoria',
    icone: '🔧',
    fotoObrigatoria: true,
    itens: [
      'Registro de manutenções preventivas em dia',
      'Lâmpadas e luminárias queimadas',
      'Vazamentos hidráulicos',
      'Ferramental e almoxarifado',
      'Atendimento de chamados abertos',
    ],
  },
]

/** Áreas extras comuns, oferecidas ao montar o checklist de um condomínio. */
export const AREAS_SUGERIDAS: Omit<AreaTemplate, 'id'>[] = [
  { nome: 'Piscina', icone: '🏊', fotoObrigatoria: true, itens: ['Qualidade da água e tratamento', 'Cercamento e sinalização', 'Salva-vidas / regras afixadas'] },
  { nome: 'Academia', icone: '🏋️', fotoObrigatoria: true, itens: ['Estado dos equipamentos', 'Ventilação e limpeza', 'Kit de primeiros socorros'] },
  { nome: 'Salão de Festas', icone: '🎉', fotoObrigatoria: true, itens: ['Mobiliário e louças', 'Cozinha de apoio', 'Estado após últimos eventos'] },
  { nome: 'Playground', icone: '🛝', fotoObrigatoria: true, itens: ['Integridade dos brinquedos', 'Piso amortecedor', 'Ausência de pontas e parafusos expostos'] },
  { nome: 'Casa de Máquinas', icone: '⚙️', fotoObrigatoria: true, itens: ['Bombas e quadros elétricos', 'Sinalização de risco', 'Acesso restrito'] },
  { nome: 'Reservatórios de Água', icone: '💧', fotoObrigatoria: true, itens: ['Data da última limpeza', 'Tampas lacradas', 'Laudo de potabilidade'] },
  { nome: 'Combate a Incêndio', icone: '🧯', fotoObrigatoria: true, itens: ['Extintores dentro da validade', 'Hidrantes e mangueiras', 'Sinalização e rotas de fuga', 'AVCB vigente'] },
  { nome: 'Gerador', icone: '🔌', fotoObrigatoria: true, itens: ['Nível de combustível', 'Teste de partida registrado', 'Manutenção preventiva'] },
  { nome: 'Coleta de Lixo', icone: '♻️', fotoObrigatoria: true, itens: ['Higienização do abrigo', 'Separação de recicláveis', 'Frequência de retirada'] },
  { nome: 'Fachada e Cobertura', icone: '🏗️', fotoObrigatoria: true, itens: ['Trincas e infiltrações', 'Rejuntes e pastilhas', 'Calhas e ralos da cobertura'] },
]
