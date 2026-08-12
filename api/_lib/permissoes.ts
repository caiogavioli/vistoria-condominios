import type { Usuario } from './auth'

/**
 * Regras de acesso — as decisões do plano em forma de função:
 *   1. Todo mundo vê todas as vistorias; edita só a própria. Admin edita qualquer uma.
 *   2. Vistoria não é apagada: é arquivada (admin), com registro em auditoria.
 *   Cadastros (condomínios, usuários, padrão de áreas) são do admin.
 */

export const ehAdmin = (u: Usuario): boolean => u.papel === 'admin'

export interface VistoriaParaPermissao {
  responsavel_id: string | null
  arquivada_em: string | Date | null
}

export function podeEditarVistoria(u: Usuario, v: VistoriaParaPermissao): boolean {
  if (v.arquivada_em) return false // arquivada não se edita; restaura primeiro
  return ehAdmin(u) || v.responsavel_id === u.id
}

export const podeArquivarVistoria = ehAdmin
export const podeVerArquivadas = ehAdmin
export const podeGerirCondominios = ehAdmin
export const podeGerirUsuarios = ehAdmin
export const podeImportarBackup = ehAdmin
