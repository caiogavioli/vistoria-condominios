-- Esquema do banco (PostgreSQL / Neon) — fase 1 do servidor.
--
-- Ids são texto gerado no cliente (mesmo formato que o app já usa, ex.
-- 'vist_<uuid>'). Isso preserva os ids na importação dos backups e prepara a
-- fase offline, em que o aparelho cria o registro antes de falar com o banco.

create table if not exists usuarios (
  id         text primary key,
  -- Objeto do Entra ID; preenchido no primeiro login, casando pelo e-mail.
  entra_oid  text unique,
  email      text not null unique,
  nome       text not null,
  papel      text not null default 'vistoriador'
             check (papel in ('admin', 'vistoriador')),
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);

create table if not exists condominios (
  id                     text primary key,
  nome                   text not null,
  endereco               text not null default '',
  -- Vistoriador habitual; vira o responsável sugerido ao abrir vistoria.
  vistoriador_padrao_id  text references usuarios (id),
  -- Checklist de áreas copiado para cada nova vistoria (mesmo formato do app).
  areas_padrao           jsonb not null default '[]'::jsonb,
  arquivado_em           timestamptz,
  criado_em              timestamptz not null default now(),
  atualizado_em          timestamptz not null default now()
);

create table if not exists vistorias (
  id                text primary key,
  condominio_id     text not null references condominios (id),
  -- Snapshots: o relatório entregue não muda se o cadastro for editado depois.
  condominio_nome   text not null,
  endereco          text not null default '',
  data              date not null,
  responsavel_id    text references usuarios (id),
  responsavel_nome  text not null default '',
  status            text not null default 'em_andamento'
                    check (status in ('em_andamento', 'concluida')),
  -- Áreas com nota/observações/fotoIds, no mesmo formato do app.
  areas             jsonb not null default '[]'::jsonb,
  observacoes_gerais text not null default '',
  -- Recalculada no servidor a cada gravação; nunca aceita do cliente.
  nota_geral        numeric(3, 1),
  demo              boolean not null default false,
  concluida_em      timestamptz,
  -- Decisão 2: vistoria não é apagada — é arquivada, com autor e data.
  arquivada_em      timestamptz,
  arquivada_por     text references usuarios (id),
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);

create index if not exists vistorias_condominio_data
  on vistorias (condominio_id, data);
create index if not exists vistorias_ativas
  on vistorias (atualizado_em desc) where arquivada_em is null;

create table if not exists fotos (
  id           text primary key,
  vistoria_id  text not null references vistorias (id) on delete cascade,
  area_id      text not null,
  -- Coordenadas do arquivo no SharePoint; nulas até o upload confirmar.
  drive_id     text,
  item_id      text,
  legenda      text not null default '',
  ordem        int  not null default 0,
  criado_em    timestamptz not null default now()
);

create index if not exists fotos_por_vistoria on fotos (vistoria_id);

-- Registro de quem alterou o quê — base do "arquivar com registro".
create table if not exists auditoria (
  id          bigserial primary key,
  usuario_id  text,
  acao        text not null,
  entidade    text not null,
  entidade_id text not null,
  detalhes    jsonb,
  criado_em   timestamptz not null default now()
);

create index if not exists auditoria_por_entidade
  on auditoria (entidade, entidade_id);

create table if not exists config (
  id           text primary key default 'unica',
  empresa      text not null default 'DF Síndicos',
  -- Padrão de fábrica das áreas para condomínio novo.
  areas_padrao jsonb not null default '[]'::jsonb
);
