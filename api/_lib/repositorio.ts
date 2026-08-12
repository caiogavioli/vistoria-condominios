import type { Usuario } from './auth'
import type { Query } from './db'
import { ErroHttp } from './http'
import {
  ehAdmin,
  podeArquivarVistoria,
  podeEditarVistoria,
  podeGerirCondominios,
  podeGerirUsuarios,
  podeImportarBackup,
  podeVerArquivadas,
} from './permissoes'
import { notaGeral } from './score'

/** Toda mutação passa por aqui — é o que sustenta o "arquivar com registro". */
async function auditar(
  q: Query,
  usuario: Usuario,
  acao: string,
  entidade: string,
  entidadeId: string,
  detalhes?: unknown,
): Promise<void> {
  await q(
    `insert into auditoria (usuario_id, acao, entidade, entidade_id, detalhes)
     values ($1, $2, $3, $4, $5)`,
    [usuario.id, acao, entidade, entidadeId, detalhes ? JSON.stringify(detalhes) : null],
  )
}

function exigirTexto(valor: unknown, campo: string): string {
  if (typeof valor !== 'string' || valor.trim() === '') {
    throw new ErroHttp(400, `Campo obrigatório: ${campo}.`)
  }
  return valor.trim()
}

// ---------- Condomínios ----------

export async function listarCondominios(q: Query): Promise<any[]> {
  const { rows } = await q(
    'select * from condominios where arquivado_em is null order by nome',
  )
  return rows
}

export async function criarCondominio(q: Query, usuario: Usuario, dados: any): Promise<any> {
  if (!podeGerirCondominios(usuario)) throw new ErroHttp(403, 'Só o administrador cadastra condomínios.')
  const id = exigirTexto(dados.id, 'id')
  const nome = exigirTexto(dados.nome, 'nome')
  const { rows } = await q(
    `insert into condominios (id, nome, endereco, vistoriador_padrao_id, areas_padrao)
     values ($1, $2, $3, $4, $5) returning *`,
    [id, nome, dados.endereco ?? '', dados.vistoriadorPadraoId ?? null, JSON.stringify(dados.areasPadrao ?? [])],
  )
  await auditar(q, usuario, 'criar', 'condominio', id)
  return rows[0]
}

export async function atualizarCondominio(
  q: Query,
  usuario: Usuario,
  id: string,
  dados: any,
): Promise<any> {
  if (!podeGerirCondominios(usuario)) throw new ErroHttp(403, 'Só o administrador edita condomínios.')
  const { rows } = await q(
    `update condominios set
       nome = coalesce($2, nome),
       endereco = coalesce($3, endereco),
       vistoriador_padrao_id = coalesce($4, vistoriador_padrao_id),
       areas_padrao = coalesce($5, areas_padrao),
       atualizado_em = now()
     where id = $1 and arquivado_em is null returning *`,
    [
      id,
      dados.nome ?? null,
      dados.endereco ?? null,
      dados.vistoriadorPadraoId ?? null,
      dados.areasPadrao ? JSON.stringify(dados.areasPadrao) : null,
    ],
  )
  if (rows.length === 0) throw new ErroHttp(404, 'Condomínio não encontrado.')
  await auditar(q, usuario, 'editar', 'condominio', id)
  return rows[0]
}

export async function arquivarCondominio(q: Query, usuario: Usuario, id: string): Promise<void> {
  if (!podeGerirCondominios(usuario)) throw new ErroHttp(403, 'Só o administrador arquiva condomínios.')
  const { rows } = await q(
    'update condominios set arquivado_em = now() where id = $1 and arquivado_em is null returning id',
    [id],
  )
  if (rows.length === 0) throw new ErroHttp(404, 'Condomínio não encontrado.')
  await auditar(q, usuario, 'arquivar', 'condominio', id)
}

// ---------- Vistorias ----------

export async function listarVistorias(
  q: Query,
  usuario: Usuario,
  filtros: { condominioId?: string; arquivadas?: boolean } = {},
): Promise<any[]> {
  if (filtros.arquivadas && !podeVerArquivadas(usuario)) {
    throw new ErroHttp(403, 'Só o administrador vê vistorias arquivadas.')
  }
  const condicoes = [filtros.arquivadas ? 'arquivada_em is not null' : 'arquivada_em is null']
  const params: unknown[] = []
  if (filtros.condominioId) {
    params.push(filtros.condominioId)
    condicoes.push(`condominio_id = $${params.length}`)
  }
  const { rows } = await q(
    `select * from vistorias where ${condicoes.join(' and ')} order by data desc, criado_em desc`,
    params,
  )
  return rows
}

export async function obterVistoria(q: Query, usuario: Usuario, id: string): Promise<any> {
  const { rows } = await q('select * from vistorias where id = $1', [id])
  const vistoria = rows[0]
  if (!vistoria || (vistoria.arquivada_em && !podeVerArquivadas(usuario))) {
    throw new ErroHttp(404, 'Vistoria não encontrada.')
  }
  const fotos = await q('select * from fotos where vistoria_id = $1 order by ordem, criado_em', [id])
  return { ...vistoria, fotos: fotos.rows }
}

export async function criarVistoria(q: Query, usuario: Usuario, dados: any): Promise<any> {
  const id = exigirTexto(dados.id, 'id')
  const condominioId = exigirTexto(dados.condominioId, 'condominioId')
  const data = exigirTexto(dados.data, 'data')

  const cond = await q('select * from condominios where id = $1 and arquivado_em is null', [condominioId])
  if (cond.rows.length === 0) throw new ErroHttp(400, 'Condomínio não encontrado.')

  // Vistoriador cria para si; só o admin abre vistoria em nome de outra pessoa.
  const responsavelId =
    ehAdmin(usuario) && dados.responsavelId ? dados.responsavelId : usuario.id
  const resp = await q('select nome from usuarios where id = $1 and ativo', [responsavelId])
  if (resp.rows.length === 0) throw new ErroHttp(400, 'Responsável não encontrado ou desativado.')

  const areas = dados.areas ?? []
  const { rows } = await q(
    `insert into vistorias
       (id, condominio_id, condominio_nome, endereco, data, responsavel_id,
        responsavel_nome, status, areas, observacoes_gerais, nota_geral, demo)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) returning *`,
    [
      id,
      condominioId,
      cond.rows[0].nome,
      cond.rows[0].endereco,
      data,
      responsavelId,
      resp.rows[0].nome,
      'em_andamento',
      JSON.stringify(areas),
      dados.observacoesGerais ?? '',
      notaGeral(areas),
      Boolean(dados.demo),
    ],
  )
  await auditar(q, usuario, 'criar', 'vistoria', id)
  return rows[0]
}

export async function atualizarVistoria(
  q: Query,
  usuario: Usuario,
  id: string,
  dados: any,
): Promise<any> {
  const atual = (await q('select * from vistorias where id = $1', [id])).rows[0]
  if (!atual) throw new ErroHttp(404, 'Vistoria não encontrada.')
  if (!podeEditarVistoria(usuario, atual)) {
    throw new ErroHttp(403, 'Você pode ver esta vistoria, mas só o responsável ou o administrador editam.')
  }

  const status = dados.status ?? atual.status
  if (!['em_andamento', 'concluida'].includes(status)) throw new ErroHttp(400, 'Status inválido.')
  const areas = dados.areas ?? atual.areas
  const concluiu = status === 'concluida' && atual.status !== 'concluida'

  const { rows } = await q(
    `update vistorias set
       data = coalesce($2, data),
       status = $3,
       areas = $4,
       observacoes_gerais = coalesce($5, observacoes_gerais),
       nota_geral = $6,
       concluida_em = case when $7 then now() else concluida_em end,
       atualizado_em = now()
     where id = $1 returning *`,
    [id, dados.data ?? null, status, JSON.stringify(areas), dados.observacoesGerais ?? null, notaGeral(areas), concluiu],
  )
  await auditar(q, usuario, 'editar', 'vistoria', id)
  return rows[0]
}

export async function arquivarVistoria(q: Query, usuario: Usuario, id: string): Promise<void> {
  if (!podeArquivarVistoria(usuario)) throw new ErroHttp(403, 'Só o administrador arquiva vistorias.')
  const { rows } = await q(
    `update vistorias set arquivada_em = now(), arquivada_por = $2
     where id = $1 and arquivada_em is null returning condominio_nome, data`,
    [id, usuario.id],
  )
  if (rows.length === 0) throw new ErroHttp(404, 'Vistoria não encontrada ou já arquivada.')
  await auditar(q, usuario, 'arquivar', 'vistoria', id, rows[0])
}

export async function restaurarVistoria(q: Query, usuario: Usuario, id: string): Promise<void> {
  if (!podeArquivarVistoria(usuario)) throw new ErroHttp(403, 'Só o administrador restaura vistorias.')
  const { rows } = await q(
    'update vistorias set arquivada_em = null, arquivada_por = null where id = $1 returning id',
    [id],
  )
  if (rows.length === 0) throw new ErroHttp(404, 'Vistoria não encontrada.')
  await auditar(q, usuario, 'restaurar', 'vistoria', id)
}

// ---------- Fotos ----------

async function vistoriaEditavel(q: Query, usuario: Usuario, vistoriaId: string): Promise<any> {
  const { rows } = await q('select * from vistorias where id = $1', [vistoriaId])
  if (rows.length === 0) throw new ErroHttp(404, 'Vistoria não encontrada.')
  if (!podeEditarVistoria(usuario, rows[0])) {
    throw new ErroHttp(403, 'Só o responsável pela vistoria ou o administrador mexem nas fotos.')
  }
  return rows[0]
}

/** O upload vai direto do aparelho ao SharePoint; aqui só o registro. */
export async function registrarFoto(q: Query, usuario: Usuario, dados: any): Promise<any> {
  const id = exigirTexto(dados.id, 'id')
  const vistoriaId = exigirTexto(dados.vistoriaId, 'vistoriaId')
  const areaId = exigirTexto(dados.areaId, 'areaId')
  await vistoriaEditavel(q, usuario, vistoriaId)
  const { rows } = await q(
    `insert into fotos (id, vistoria_id, area_id, drive_id, item_id, legenda, ordem)
     values ($1, $2, $3, $4, $5, $6, $7) returning *`,
    [id, vistoriaId, areaId, dados.driveId ?? null, dados.itemId ?? null, dados.legenda ?? '', dados.ordem ?? 0],
  )
  return rows[0]
}

export async function atualizarFoto(q: Query, usuario: Usuario, id: string, dados: any): Promise<any> {
  const foto = (await q('select * from fotos where id = $1', [id])).rows[0]
  if (!foto) throw new ErroHttp(404, 'Foto não encontrada.')
  await vistoriaEditavel(q, usuario, foto.vistoria_id)
  const { rows } = await q(
    `update fotos set
       legenda = coalesce($2, legenda),
       drive_id = coalesce($3, drive_id),
       item_id = coalesce($4, item_id),
       ordem = coalesce($5, ordem)
     where id = $1 returning *`,
    [id, dados.legenda ?? null, dados.driveId ?? null, dados.itemId ?? null, dados.ordem ?? null],
  )
  return rows[0]
}

export async function removerFoto(q: Query, usuario: Usuario, id: string): Promise<void> {
  const foto = (await q('select * from fotos where id = $1', [id])).rows[0]
  if (!foto) return
  await vistoriaEditavel(q, usuario, foto.vistoria_id)
  await q('delete from fotos where id = $1', [id])
  await auditar(q, usuario, 'remover', 'foto', id, { vistoriaId: foto.vistoria_id })
}

// ---------- Usuários ----------

export async function listarUsuarios(q: Query, usuario: Usuario): Promise<any[]> {
  if (!podeGerirUsuarios(usuario)) {
    // Vistoriador vê só a lista de nomes ativos (para o seletor de responsável).
    const { rows } = await q('select id, nome from usuarios where ativo order by nome')
    return rows
  }
  const { rows } = await q('select id, email, nome, papel, ativo, criado_em from usuarios order by nome')
  return rows
}

export async function criarUsuario(q: Query, usuario: Usuario, dados: any): Promise<any> {
  if (!podeGerirUsuarios(usuario)) throw new ErroHttp(403, 'Só o administrador cadastra usuários.')
  const id = exigirTexto(dados.id, 'id')
  const email = exigirTexto(dados.email, 'email').toLowerCase()
  const nome = exigirTexto(dados.nome, 'nome')
  const papel = dados.papel === 'admin' ? 'admin' : 'vistoriador'
  const { rows } = await q(
    'insert into usuarios (id, email, nome, papel) values ($1, $2, $3, $4) returning id, email, nome, papel, ativo',
    [id, email, nome, papel],
  )
  await auditar(q, usuario, 'criar', 'usuario', id, { email, papel })
  return rows[0]
}

export async function atualizarUsuario(
  q: Query,
  usuario: Usuario,
  id: string,
  dados: any,
): Promise<any> {
  if (!podeGerirUsuarios(usuario)) throw new ErroHttp(403, 'Só o administrador edita usuários.')

  // Nunca deixar o sistema sem administrador ativo.
  if (dados.ativo === false || (dados.papel && dados.papel !== 'admin')) {
    const alvo = (await q('select papel, ativo from usuarios where id = $1', [id])).rows[0]
    if (alvo?.papel === 'admin' && alvo.ativo) {
      const { rows } = await q(
        "select count(*)::int as n from usuarios where papel = 'admin' and ativo and id <> $1",
        [id],
      )
      if (rows[0].n === 0) throw new ErroHttp(400, 'Este é o único administrador ativo — promova outro antes.')
    }
  }

  const { rows } = await q(
    `update usuarios set
       nome = coalesce($2, nome),
       papel = coalesce($3, papel),
       ativo = coalesce($4, ativo)
     where id = $1 returning id, email, nome, papel, ativo`,
    [id, dados.nome ?? null, dados.papel ?? null, typeof dados.ativo === 'boolean' ? dados.ativo : null],
  )
  if (rows.length === 0) throw new ErroHttp(404, 'Usuário não encontrado.')
  await auditar(q, usuario, 'editar', 'usuario', id, dados)
  return rows[0]
}

// ---------- Importação dos backups do app ----------

/**
 * Recebe o .json exportado pelo app (sem os binários das fotos — esses sobem
 * do aparelho direto ao SharePoint) e mescla no banco. Ids são preservados;
 * registro que já existe é sobrescrito, nada é apagado.
 */
export async function importarBackup(q: Query, usuario: Usuario, backup: any): Promise<any> {
  if (!podeImportarBackup(usuario)) throw new ErroHttp(403, 'Só o administrador importa backups.')
  if (backup?.formato !== 'vistorias-condominios') {
    throw new ErroHttp(400, 'Arquivo não é um backup do app de vistorias.')
  }

  const usuariosPorNome = new Map<string, string>()
  for (const u of (await q('select id, nome from usuarios', [])).rows) {
    usuariosPorNome.set(String(u.nome).toLowerCase(), u.id)
  }

  let condominios = 0
  for (const c of backup.condominios ?? []) {
    await q(
      `insert into condominios (id, nome, endereco, vistoriador_padrao_id, areas_padrao)
       values ($1, $2, $3, $4, $5)
       on conflict (id) do update set
         nome = excluded.nome, endereco = excluded.endereco,
         vistoriador_padrao_id = excluded.vistoriador_padrao_id,
         areas_padrao = excluded.areas_padrao, atualizado_em = now()`,
      [
        c.id,
        c.nome || 'Sem nome',
        c.endereco ?? '',
        usuariosPorNome.get(String(c.vistoriador ?? '').toLowerCase()) ?? null,
        JSON.stringify(c.areasPadrao ?? []),
      ],
    )
    condominios++
  }

  let vistorias = 0
  for (const v of backup.vistorias ?? []) {
    const responsavelId = usuariosPorNome.get(String(v.responsavel ?? '').toLowerCase()) ?? null
    await q(
      `insert into vistorias
         (id, condominio_id, condominio_nome, endereco, data, responsavel_id, responsavel_nome,
          status, areas, observacoes_gerais, nota_geral, demo, concluida_em)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       on conflict (id) do update set
         status = excluded.status, areas = excluded.areas,
         observacoes_gerais = excluded.observacoes_gerais,
         nota_geral = excluded.nota_geral, atualizado_em = now()`,
      [
        v.id,
        v.condominioId,
        v.condominioNome ?? '',
        v.endereco ?? '',
        v.data,
        responsavelId,
        v.responsavel ?? '',
        v.status === 'concluida' ? 'concluida' : 'em_andamento',
        JSON.stringify(v.areas ?? []),
        v.observacoesGerais ?? '',
        notaGeral(v.areas ?? []),
        Boolean(v.demo),
        v.concluidaEm ?? null,
      ],
    )
    vistorias++
  }

  // Metadados das fotos; drive/item ficam nulos até o aparelho subir o arquivo.
  let fotos = 0
  for (const f of backup.fotos ?? []) {
    await q(
      `insert into fotos (id, vistoria_id, area_id, legenda)
       values ($1, $2, $3, $4) on conflict (id) do nothing`,
      [f.id, f.vistoriaId, f.areaId, f.legenda ?? ''],
    )
    fotos++
  }

  await auditar(q, usuario, 'importar', 'backup', backup.geradoEm ?? 'sem-data', {
    condominios,
    vistorias,
    fotos,
  })
  return { condominios, vistorias, fotos }
}
