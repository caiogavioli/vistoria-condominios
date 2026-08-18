import Dexie, { type EntityTable } from 'dexie'
import type { Condominio, Config, Excluido, Foto, OpcaoCondominio, SyncMeta, Vistoria } from '../types'

/**
 * Banco local (IndexedDB). Tudo roda offline no aparelho — vistoria em
 * subsolo sem sinal continua funcionando; o que foi preenchido sobe para o
 * PostgreSQL assim que o celular reencontra sinal (ver `sync.ts`).
 *
 * O aparelho continua sendo a fonte da verdade enquanto se preenche. O
 * servidor é o ponto de encontro entre os vistoriadores, não uma dependência
 * para trabalhar.
 */
class VistoriaDB extends Dexie {
  condominios!: EntityTable<Condominio, 'id'>
  vistorias!: EntityTable<Vistoria, 'id'>
  fotos!: EntityTable<Foto, 'id'>
  config!: EntityTable<Config, 'id'>
  /** Lápides: ids apagados aqui, ainda não comunicados ao servidor. */
  excluidos!: EntityTable<Excluido, 'chave'>
  /** Cursor da sincronização e carimbo do último envio. */
  syncMeta!: EntityTable<SyncMeta, 'id'>
  /** Proprietários e administradoras disponíveis no cadastro dos condomínios. */
  opcoesCondominio!: EntityTable<OpcaoCondominio, 'id'>

  constructor() {
    super('vistorias-condominios')
    this.version(1).stores({
      condominios: 'id, nome, criadoEm',
      vistorias: 'id, condominioId, data, status, atualizadoEm',
      fotos: 'id, vistoriaId, areaId, criadoEm',
      config: 'id',
    })

    // v2 — sincronização. `_pendente` é indexado porque a pergunta "o que falta
    // subir?" acontece a cada tentativa de sincronismo.
    this.version(2)
      .stores({
        condominios: 'id, nome, criadoEm, _pendente',
        vistorias: 'id, condominioId, data, status, atualizadoEm, _pendente',
        fotos: 'id, vistoriaId, areaId, criadoEm, _pendente',
        config: 'id',
        excluidos: 'chave, tipo, excluidoEm',
        syncMeta: 'id',
      })
      .upgrade(async (tx) => {
        // Tudo que já existe no aparelho nasce pendente: é exatamente o que
        // precisa subir na primeira sincronização, incluindo as vistorias que
        // as três pessoas já preencheram antes de existir servidor.
        const agora = new Date().toISOString()
        await tx
          .table('condominios')
          .toCollection()
          .modify((c: Condominio) => {
            c.atualizadoEm = c.atualizadoEm ?? c.criadoEm ?? agora
            c._pendente = 1
          })
        await tx
          .table('vistorias')
          .toCollection()
          .modify((v: Vistoria) => {
            v._pendente = 1
          })
        await tx
          .table('fotos')
          .toCollection()
          .modify((f: Foto) => {
            f.atualizadoEm = f.atualizadoEm ?? f.criadoEm ?? agora
            f._pendente = 1
          })
      })

    // v3 — Proprietário/Administradora: tabela nova, sem migração de dados
    // (nasce vazia; cada aparelho recebe o catálogo na primeira sincronização).
    this.version(3).stores({
      condominios: 'id, nome, criadoEm, _pendente',
      vistorias: 'id, condominioId, data, status, atualizadoEm, _pendente',
      fotos: 'id, vistoriaId, areaId, criadoEm, _pendente',
      config: 'id',
      excluidos: 'chave, tipo, excluidoEm',
      syncMeta: 'id',
      opcoesCondominio: 'id, tipo, nome, _pendente',
    })

    aplicarMarcacaoDePendencia(this)
  }
}

/** Tabelas que viajam para o servidor. `config` é preferência do aparelho. */
const TABELAS_SINCRONIZADAS = new Set(['condominios', 'vistorias', 'fotos', 'opcoesCondominio'])

/**
 * Marca como pendente qualquer gravação nas tabelas sincronizadas.
 *
 * Vai no nível do DBCore, abaixo de `put`, `bulkPut`, `add` e `update`, porque
 * as telas escrevem de oito lugares diferentes. Marcar em cada chamada
 * deixaria buraco na primeira que alguém esquecesse — e um registro sem marca
 * simplesmente nunca subiria, sem erro nenhum para denunciar.
 *
 * Quem já sabe o estado de sincronismo do registro (o motor, aplicando o que
 * baixou) manda `_pendente` explícito e o middleware respeita. É o que impede
 * o pingue-pongue: baixar do servidor não vira pendência de subida.
 *
 * Junto com a marca vai o carimbo de `atualizadoEm`. Não é conveniência: é o
 * campo que o servidor usa para decidir quem vence um conflito, e telas que
 * gravam direto (o editor de condomínio, por exemplo) não o atualizavam. Sem o
 * carimbo aqui, a segunda edição de um condomínio subiria com a data da
 * primeira e o servidor a descartaria por "mais antiga que a que já tenho" —
 * uma perda silenciosa, sem erro em lugar nenhum.
 */
function aplicarMarcacaoDePendencia(db: Dexie): void {
  db.use({
    stack: 'dbcore',
    name: 'marcarPendente',
    create: (abaixo) => ({
      ...abaixo,
      table: (nome) => {
        const tabela = abaixo.table(nome)
        if (!TABELAS_SINCRONIZADAS.has(nome)) return tabela
        return {
          ...tabela,
          mutate: (req) => {
            if (req.type === 'add' || req.type === 'put') {
              const agora = new Date().toISOString()
              // Toda gravação local pede uma sincronização — agrupada, para não
              // disparar uma por tecla digitada. Fica aqui, e não nas telas,
              // pelo mesmo motivo da marca de pendência: são oito lugares que
              // gravam, e o esquecido seria justamente o que não sincroniza.
              void import('./sync.js').then((m) => m.agendarSync())
              return tabela.mutate({
                ...req,
                values: req.values.map((v: Record<string, unknown>) =>
                  v && v._pendente === undefined
                    ? { ...v, _pendente: 1, atualizadoEm: agora }
                    : v,
                ),
              })
            }
            return tabela.mutate(req)
          },
        }
      },
    }),
  })
}

export const db = new VistoriaDB()

export const CONFIG_PADRAO: Config = {
  id: 'unica',
  empresa: 'DF Síndicos',
  responsavelPadrao: '',
  notaAlerta: 5,
}

export async function lerConfig(): Promise<Config> {
  const atual = await db.config.get('unica')
  if (atual) return atual
  await db.config.put(CONFIG_PADRAO)
  return CONFIG_PADRAO
}

export async function salvarConfig(patch: Partial<Config>): Promise<void> {
  const atual = await lerConfig()
  await db.config.put({ ...atual, ...patch, id: 'unica' })
}

/** Grava a vistoria carimbando `atualizadoEm`. */
export async function salvarVistoria(vistoria: Vistoria): Promise<void> {
  await db.vistorias.put({ ...vistoria, atualizadoEm: new Date().toISOString(), _pendente: 1 })
}

/**
 * Registra a lápide de um id apagado.
 *
 * Sem isto a exclusão não sai do aparelho: no sincronismo seguinte o registro
 * desceria de volta do servidor, ou outro aparelho o reenviaria, e ele
 * reapareceria para todo mundo. A lápide é o que diz "isto foi apagado", em
 * vez de "isto não está aqui".
 */
export async function registrarExclusao(
  tipo: Excluido['tipo'],
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return
  const excluidoEm = new Date().toISOString()
  await db.excluidos.bulkPut(
    ids.map((id) => ({ chave: `${tipo}:${id}`, tipo, id, excluidoEm })),
  )
}

/** Remove a vistoria e todas as fotos vinculadas a ela. */
export async function excluirVistoria(id: string): Promise<void> {
  const fotos = await db.fotos.where('vistoriaId').equals(id).primaryKeys()
  await db.transaction('rw', db.vistorias, db.fotos, db.excluidos, async () => {
    await db.fotos.where('vistoriaId').equals(id).delete()
    await db.vistorias.delete(id)
    await registrarExclusao('vistoria', [id])
    await registrarExclusao('foto', fotos as string[])
  })
}

/** Remove o condomínio. As vistorias já feitas ficam — elas guardam o nome. */
export async function excluirCondominio(id: string): Promise<void> {
  await db.transaction('rw', db.condominios, db.excluidos, async () => {
    await db.condominios.delete(id)
    await registrarExclusao('condominio', [id])
  })
}
