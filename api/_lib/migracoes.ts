/**
 * Migrações do banco, como módulo.
 *
 * O SQL mora aqui dentro, e não em arquivos `.sql` lidos do disco, por causa de
 * como o empacotamento serverless funciona: a função só leva junto os arquivos
 * que a ferramenta consegue enxergar lendo o código. Um `readdirSync` com
 * caminho montado em tempo de execução é invisível para ela — os `.sql`
 * ficariam para trás e a primeira requisição em produção morreria com "arquivo
 * não encontrado", num lugar onde não há disco para conferir.
 *
 * Como módulo importado, o SQL é parte do código: vai junto sempre.
 */

export interface Migracao {
  nome: string
  sql: string
}

export const MIGRACOES: Migracao[] = [
  {
    nome: '001_inicial',
    sql: `-- Banco central das vistorias.
--
-- O app continua gravando primeiro no aparelho (IndexedDB) e sobe para cá
-- quando há sinal. Este schema existe para receber o que veio de vários
-- aparelhos e devolver a cada um o que os outros escreveram.
--
-- Duas decisões que sustentam a sincronização:
--
-- 1. \`versao\` vem de uma sequência ÚNICA, compartilhada por todas as tabelas.
--    É o cursor do "me dê tudo que mudou desde X". Um relógio não serve: o
--    celular de quem está em campo pode estar atrasado, e um registro gravado
--    com data no passado nunca mais seria baixado pelos outros aparelhos.
--    Com a sequência, cada escrita recebe um número maior que todos os
--    anteriores, independente de relógio.
--
-- 2. \`atualizado_em\` é o relógio do APARELHO e serve para outra coisa:
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
`,
  },
  {
    nome: '002_contatos',
    sql: `
-- Registro do ultimo contato de cada aparelho.
--
-- Existe para responder uma pergunta que nao tinha resposta: o aplicativo esta
-- chegando ate aqui? Sem isso, "nada foi gravado" tem duas causas
-- indistinguiveis — o app nao chamou, ou chamou e a gravacao nao aconteceu — e
-- so da para separa-las adivinhando.
--
-- Nao guarda dado pessoal: horario, rota, origem da requisicao e um resumo do
-- que veio no lote.
CREATE TABLE IF NOT EXISTS contatos (
  id          BIGSERIAL PRIMARY KEY,
  em          TIMESTAMPTZ NOT NULL DEFAULT now(),
  rota        TEXT        NOT NULL,
  origem      TEXT,
  resumo      TEXT
);

CREATE INDEX IF NOT EXISTS contatos_em_idx ON contatos (em DESC);
`,
  },
  {
    nome: '003_usuarios',
    sql: `-- Usuários do app, para o login com a conta Microsoft da empresa.
--
-- Ninguém entra por ter conta no M365: precisa estar aqui, ativo. entra_oid
-- é preenchido no primeiro login, casando pelo e-mail. Usuário não é excluído
-- (o nome assina relatórios entregues): quem sai da equipe é desativado.

CREATE TABLE IF NOT EXISTS usuarios (
  id         TEXT PRIMARY KEY,
  entra_oid  TEXT UNIQUE,
  email      TEXT NOT NULL UNIQUE,
  nome       TEXT NOT NULL,
  papel      TEXT NOT NULL DEFAULT 'vistoriador'
             CHECK (papel IN ('admin', 'vistoriador')),
  ativo      BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- O administrador inicial; os demais entram pela área de administração.
INSERT INTO usuarios (id, email, nome, papel)
VALUES ('usr_caio', 'caio@dfsindicos.com.br', 'Caio Gavioli', 'admin')
ON CONFLICT (email) DO NOTHING;
`,
  },
  {
    nome: '004_equipe',
    sql: `-- Cadastro da equipe de vistoriadores (e-mails confirmados pelo Caio em
-- 12/08/2026). O login casa pelo e-mail; o nome é o exibido nas telas de
-- administração. Quem sair da equipe é desativado por aqui, nunca excluído.

INSERT INTO usuarios (id, email, nome, papel) VALUES
  ('usr_amanda',   'amanda@dfsindicos.com.br',        'Amanda Tigre',     'vistoriador'),
  ('usr_anapaula', 'anapaula@dfsindicos.com.br',      'Ana Paula Duarte', 'vistoriador'),
  ('usr_andre',    'andre@dfsindicos.com.br',         'André Ferreira',   'vistoriador'),
  ('usr_claudia',  'controladoria@dfsindicos.com.br', 'Claudia De Santi', 'vistoriador'),
  ('usr_denise',   'denise@dfsindicos.com.br',        'Denise Tigre',     'vistoriador')
ON CONFLICT (email) DO NOTHING;
`,
  },
]
