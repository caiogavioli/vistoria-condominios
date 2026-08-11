-- Banco central das vistorias.
--
-- O app continua gravando primeiro no aparelho (IndexedDB) e sobe para cá
-- quando há sinal. Este schema existe para receber o que veio de vários
-- aparelhos e devolver a cada um o que os outros escreveram.
--
-- Duas decisões que sustentam a sincronização:
--
-- 1. `versao` vem de uma sequência ÚNICA, compartilhada por todas as tabelas.
--    É o cursor do "me dê tudo que mudou desde X". Um relógio não serve: o
--    celular de quem está em campo pode estar atrasado, e um registro gravado
--    com data no passado nunca mais seria baixado pelos outros aparelhos.
--    Com a sequência, cada escrita recebe um número maior que todos os
--    anteriores, independente de relógio.
--
-- 2. `atualizado_em` é o relógio do APARELHO e serve para outra coisa:
--    decidir quem vence quando dois vistoriadores editam o mesmo registro.
--    Vence a edição mais recente. Os dois campos não são redundantes.

CREATE SEQUENCE IF NOT EXISTS versao_sync;

CREATE TABLE IF NOT EXISTS condominios (
  id            TEXT PRIMARY KEY,
  nome          TEXT        NOT NULL,
  endereco      TEXT        NOT NULL DEFAULT '',
  vistoriador   TEXT        NOT NULL DEFAULT '',
  areas_padrao  JSONB       NOT NULL DEFAULT '[]'::jsonb,
  criado_em     TEXT        NOT NULL,
  atualizado_em TEXT        NOT NULL,
  versao        BIGINT      NOT NULL DEFAULT nextval('versao_sync')
);

CREATE TABLE IF NOT EXISTS vistorias (
  id                 TEXT PRIMARY KEY,
  condominio_id      TEXT   NOT NULL,
  -- Cópia do nome no momento da vistoria: renomear o condomínio depois não
  -- pode reescrever o cabeçalho de um relatório já emitido.
  condominio_nome    TEXT   NOT NULL,
  endereco           TEXT   NOT NULL DEFAULT '',
  -- AAAA-MM-DD como texto, igual ao app. Guardar como DATE faria o dia
  -- escorregar conforme o fuso de quem lê.
  data               TEXT   NOT NULL,
  responsavel        TEXT   NOT NULL DEFAULT '',
  status             TEXT   NOT NULL DEFAULT 'em_andamento',
  -- As áreas viajam como documento: é assim que o app já as trata, e mantém a
  -- resolução de conflito no nível da vistoria inteira, que é a unidade que
  -- uma pessoa preenche de uma vez.
  areas              JSONB  NOT NULL DEFAULT '[]'::jsonb,
  observacoes_gerais TEXT   NOT NULL DEFAULT '',
  criado_em          TEXT   NOT NULL,
  atualizado_em      TEXT   NOT NULL,
  concluida_em       TEXT,
  versao             BIGINT NOT NULL DEFAULT nextval('versao_sync')
);

CREATE TABLE IF NOT EXISTS fotos (
  id            TEXT PRIMARY KEY,
  vistoria_id   TEXT   NOT NULL,
  area_id       TEXT   NOT NULL,
  -- O app já comprime para ~300 KB antes de gravar.
  conteudo      BYTEA  NOT NULL,
  mime          TEXT   NOT NULL DEFAULT 'image/jpeg',
  legenda       TEXT   NOT NULL DEFAULT '',
  criado_em     TEXT   NOT NULL,
  atualizado_em TEXT   NOT NULL,
  versao        BIGINT NOT NULL DEFAULT nextval('versao_sync')
);

-- Lápides de exclusão.
--
-- Sem isto, apagar uma vistoria num aparelho não apagaria nos outros: no
-- próximo sincronismo o registro voltaria do servidor, ou pior, o aparelho que
-- ainda o tem o reenviaria e ele ressuscitaria para todos. A lápide é o que
-- transforma "não tenho mais este id" em "este id foi apagado".
CREATE TABLE IF NOT EXISTS excluidos (
  tipo        TEXT   NOT NULL, -- condominio | vistoria | foto
  id          TEXT   NOT NULL,
  excluido_em TEXT   NOT NULL,
  versao      BIGINT NOT NULL DEFAULT nextval('versao_sync'),
  PRIMARY KEY (tipo, id)
);

-- Índices do cursor: toda leitura de sincronismo é "versao > $1".
CREATE INDEX IF NOT EXISTS condominios_versao_idx ON condominios (versao);
CREATE INDEX IF NOT EXISTS vistorias_versao_idx   ON vistorias (versao);
CREATE INDEX IF NOT EXISTS fotos_versao_idx       ON fotos (versao);
CREATE INDEX IF NOT EXISTS excluidos_versao_idx   ON excluidos (versao);

-- A foto é baixada por vistoria; sem este índice a busca varre a tabela
-- inteira, que é justamente a maior do banco.
CREATE INDEX IF NOT EXISTS fotos_vistoria_idx ON fotos (vistoria_id);
CREATE INDEX IF NOT EXISTS vistorias_condominio_idx ON vistorias (condominio_id);
