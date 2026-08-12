import type { VercelRequest, VercelResponse } from '@vercel/node'

import { aplicarCors, comErros, erro, registrarContato } from './_lib/http.js'

/**
 * Sincronização de documentos: sobe o que o aparelho mudou e desce o que os
 * outros mudaram, numa só viagem.
 *
 * As FOTOS não passam por aqui — só os metadados delas. O corpo de uma
 * requisição na Vercel é limitado a ~4,5 MB e uma vistoria cheia passa de 8 MB
 * em fotos, então cada imagem sobe e desce sozinha por `/api/foto`.
 *
 * Conflito: vence a edição com `atualizadoEm` mais recente. É o relógio do
 * aparelho, e é o critério certo aqui — quem editou por último tem o que a
 * pessoa realmente quis. Empate mantém o que já estava no servidor.
 */

const LIMITE = 500

type Excluido = { tipo: string; id: string; excluidoEm: string }

export default comErros(async function handler(req: VercelRequest, res: VercelResponse) {
  if (aplicarCors(req, res)) return
  if (req.method !== 'POST') return erro(res, 405, 'Use POST.')

  /*
   * Carregado aqui dentro, e nao no topo do arquivo.
   *
   * Uma falha ao importar modulo acontece antes de qualquer codigo do handler
   * — inclusive antes dos cabecalhos de CORS. A plataforma responde com a
   * pagina generica de erro, que nao traz esses cabecalhos, e o navegador
   * reporta "erro de CORS" em vez do erro verdadeiro. Foi assim que uma falha
   * de importacao se disfarcou de problema de permissao.
   */
  // Tranca de entrada: exige conta Microsoft quando o Entra estiver
  // configurado no ambiente. Import tardio pelo mesmo motivo do db abaixo.
  const { autenticar } = await import('./_lib/entrada.js')
  const entrada = await autenticar(req)
  if (!entrada.ok) return erro(res, entrada.status, entrada.mensagem)

  const { emTransacao, consultar } = await import('./_lib/db.js')
  const { garantirMigracoes } = await import('./_lib/migrar.js')
  await garantirMigracoes()

  const corpo = (req.body ?? {}) as {
    cursor?: number
    condominios?: Record<string, unknown>[]
    vistorias?: Record<string, unknown>[]
    fotos?: Record<string, unknown>[]
    excluidos?: Excluido[]
  }

  const cursor = Number.isFinite(Number(corpo.cursor)) ? Number(corpo.cursor) : 0

  await registrarContato(
    req,
    '/api/sync',
    `cursor=${cursor} condominios=${corpo.condominios?.length ?? 0} ` +
      `vistorias=${corpo.vistorias?.length ?? 0} fotos=${corpo.fotos?.length ?? 0} ` +
      `excluidos=${corpo.excluidos?.length ?? 0}`,
  )

  // ------------------------------------------------------------------ push --
  await emTransacao(async (executar) => {
    // Lápides primeiro: assim, se o mesmo lote traz uma exclusão e um aparelho
    // atrasado reenvia o registro, a exclusão já está registrada e o upsert
    // abaixo a respeita, em vez de ressuscitar o que foi apagado.
    for (const e of corpo.excluidos ?? []) {
      if (!e?.id || !e?.tipo) continue
      await executar(
        `INSERT INTO excluidos (tipo, id, excluido_em, versao)
         VALUES ($1, $2, $3, nextval('versao_sync'))
         ON CONFLICT (tipo, id) DO NOTHING`,
        [e.tipo, e.id, e.excluidoEm ?? new Date().toISOString()],
      )
      const tabela =
        e.tipo === 'condominio' ? 'condominios' : e.tipo === 'vistoria' ? 'vistorias' : 'fotos'
      await executar(`DELETE FROM ${tabela} WHERE id = $1`, [e.id])
      if (e.tipo === 'vistoria') {
        await executar('DELETE FROM fotos WHERE vistoria_id = $1', [e.id])
      }
    }

    for (const c of corpo.condominios ?? []) {
      if (!c?.id) continue
      await executar(
        `INSERT INTO condominios
           (id, nome, endereco, vistoriador, areas_padrao, criado_em, atualizado_em, versao)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7, nextval('versao_sync'))
         ON CONFLICT (id) DO UPDATE SET
           nome          = EXCLUDED.nome,
           endereco      = EXCLUDED.endereco,
           vistoriador   = EXCLUDED.vistoriador,
           areas_padrao  = EXCLUDED.areas_padrao,
           atualizado_em = EXCLUDED.atualizado_em,
           versao        = nextval('versao_sync')
         WHERE EXCLUDED.atualizado_em > condominios.atualizado_em`,
        [
          c.id,
          c.nome ?? '',
          c.endereco ?? '',
          c.vistoriador ?? '',
          JSON.stringify(c.areasPadrao ?? []),
          c.criadoEm ?? new Date().toISOString(),
          c.atualizadoEm ?? c.criadoEm ?? new Date().toISOString(),
        ],
      )
      // Um registro apagado por outro aparelho não volta por reenvio.
      await executar(
        `DELETE FROM condominios WHERE id = $1
           AND EXISTS (SELECT 1 FROM excluidos WHERE tipo = 'condominio' AND id = $1)`,
        [c.id],
      )
    }

    for (const v of corpo.vistorias ?? []) {
      if (!v?.id) continue
      await executar(
        `INSERT INTO vistorias
           (id, condominio_id, condominio_nome, endereco, data, responsavel, status,
            areas, observacoes_gerais, criado_em, atualizado_em, concluida_em, versao)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12, nextval('versao_sync'))
         ON CONFLICT (id) DO UPDATE SET
           condominio_id      = EXCLUDED.condominio_id,
           condominio_nome    = EXCLUDED.condominio_nome,
           endereco           = EXCLUDED.endereco,
           data               = EXCLUDED.data,
           responsavel        = EXCLUDED.responsavel,
           status             = EXCLUDED.status,
           areas              = EXCLUDED.areas,
           observacoes_gerais = EXCLUDED.observacoes_gerais,
           atualizado_em      = EXCLUDED.atualizado_em,
           concluida_em       = EXCLUDED.concluida_em,
           versao             = nextval('versao_sync')
         WHERE EXCLUDED.atualizado_em > vistorias.atualizado_em`,
        [
          v.id,
          v.condominioId ?? '',
          v.condominioNome ?? '',
          v.endereco ?? '',
          v.data ?? '',
          v.responsavel ?? '',
          v.status ?? 'em_andamento',
          JSON.stringify(v.areas ?? []),
          v.observacoesGerais ?? '',
          v.criadoEm ?? new Date().toISOString(),
          v.atualizadoEm ?? v.criadoEm ?? new Date().toISOString(),
          v.concluidaEm ?? null,
        ],
      )
      await executar(
        `DELETE FROM vistorias WHERE id = $1
           AND EXISTS (SELECT 1 FROM excluidos WHERE tipo = 'vistoria' AND id = $1)`,
        [v.id],
      )
    }

    // Só a legenda da foto muda depois de criada; o conteúdo sobe por /api/foto.
    for (const f of corpo.fotos ?? []) {
      if (!f?.id) continue
      await executar(
        `UPDATE fotos SET legenda = $2, atualizado_em = $3, versao = nextval('versao_sync')
          WHERE id = $1 AND $3 > atualizado_em`,
        [f.id, f.legenda ?? '', f.atualizadoEm ?? new Date().toISOString()],
      )
    }
  })

  // ------------------------------------------------------------------ pull --
  const [condominios, vistorias, fotos, excluidos] = await Promise.all([
    consultar<Record<string, unknown>>(
      `SELECT id, nome, endereco, vistoriador, areas_padrao, criado_em, atualizado_em, versao
         FROM condominios WHERE versao > $1 ORDER BY versao LIMIT ${LIMITE}`,
      [cursor],
    ),
    consultar<Record<string, unknown>>(
      `SELECT id, condominio_id, condominio_nome, endereco, data, responsavel, status,
              areas, observacoes_gerais, criado_em, atualizado_em, concluida_em, versao
         FROM vistorias WHERE versao > $1 ORDER BY versao LIMIT ${LIMITE}`,
      [cursor],
    ),
    // Sem `conteudo`: aqui vai só o catálogo do que existe.
    consultar<Record<string, unknown>>(
      `SELECT id, vistoria_id, area_id, legenda, mime, criado_em, atualizado_em, versao
         FROM fotos WHERE versao > $1 ORDER BY versao LIMIT ${LIMITE}`,
      [cursor],
    ),
    consultar<Record<string, unknown>>(
      `SELECT tipo, id, excluido_em, versao
         FROM excluidos WHERE versao > $1 ORDER BY versao LIMIT ${LIMITE}`,
      [cursor],
    ),
  ])

  const lotes = [condominios, vistorias, fotos, excluidos]
  const truncados = lotes.filter((l) => l.length === LIMITE)

  /*
   * Cursor da próxima rodada.
   *
   * Se algum tipo veio cheio, há mais coisa esperando: o cursor tem que parar
   * no MENOR dos topos truncados. Avançar além disso pularia registros do tipo
   * que ficou para trás — a falha mais cara possível numa sincronização,
   * porque some sem erro. Reenviar alguns registros já vistos é inofensivo:
   * a gravação no aparelho é idempotente.
   */
  const topo = (lote: Record<string, unknown>[]) =>
    lote.length === 0 ? cursor : Number(lote[lote.length - 1].versao)

  const proximoCursor =
    truncados.length > 0
      ? Math.min(...truncados.map(topo))
      : Math.max(cursor, ...lotes.map(topo))

  res.status(200).json({
    cursor: proximoCursor,
    completo: truncados.length === 0,
    condominios: condominios.map(paraCondominio),
    vistorias: vistorias.map(paraVistoria),
    fotos: fotos.map(paraFoto),
    excluidos: excluidos.map((e) => ({
      tipo: e.tipo,
      id: e.id,
      excluidoEm: e.excluido_em,
    })),
  })
})

/* Conversão para o formato que o app já usa (camelCase). */

function paraCondominio(l: Record<string, unknown>) {
  return {
    id: l.id,
    nome: l.nome,
    endereco: l.endereco,
    vistoriador: l.vistoriador,
    areasPadrao: l.areas_padrao,
    criadoEm: l.criado_em,
    atualizadoEm: l.atualizado_em,
  }
}

function paraVistoria(l: Record<string, unknown>) {
  return {
    id: l.id,
    condominioId: l.condominio_id,
    condominioNome: l.condominio_nome,
    endereco: l.endereco,
    data: l.data,
    responsavel: l.responsavel,
    status: l.status,
    areas: l.areas,
    observacoesGerais: l.observacoes_gerais,
    criadoEm: l.criado_em,
    atualizadoEm: l.atualizado_em,
    concluidaEm: l.concluida_em ?? undefined,
  }
}

function paraFoto(l: Record<string, unknown>) {
  return {
    id: l.id,
    vistoriaId: l.vistoria_id,
    areaId: l.area_id,
    legenda: l.legenda,
    mime: l.mime,
    criadoEm: l.criado_em,
    atualizadoEm: l.atualizado_em,
  }
}
