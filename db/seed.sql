-- Carga inicial. Rode uma vez após o schema.sql.
--
-- IMPORTANTE: preencha os e-mails reais dos cinco vistoriadores antes de rodar
-- — o login casa a conta Microsoft com o usuário PELO E-MAIL, então um e-mail
-- errado significa "acesso negado" para aquela pessoa.

insert into usuarios (id, email, nome, papel) values
  ('usr_caio', 'caio@dfsindicos.com.br', 'Caio Gavioli', 'admin')
on conflict (email) do nothing;

-- Preencher e rodar (troque os e-mails de exemplo pelos reais do M365):
-- insert into usuarios (id, email, nome, papel) values
--   ('usr_amanda',  'amanda@dfsindicos.com.br',  'Amanda Tigre',    'vistoriador'),
--   ('usr_anapaula','anapaula@dfsindicos.com.br','Ana Paula Duarte','vistoriador'),
--   ('usr_andre',   'andre@dfsindicos.com.br',   'André Ferreira',  'vistoriador'),
--   ('usr_claudia', 'claudia@dfsindicos.com.br', 'Claudia De Santi','vistoriador'),
--   ('usr_denise',  'denise@dfsindicos.com.br',  'Denise Tigre',    'vistoriador')
-- on conflict (email) do nothing;

insert into config (id, empresa, areas_padrao) values (
  'unica',
  'DF Síndicos',
  '[
    {"nome":"Recepção e Portaria","icone":"🏢","fotoObrigatoria":true},
    {"nome":"Auditório","icone":"🎭","fotoObrigatoria":true},
    {"nome":"Estacionamento","icone":"🚗","fotoObrigatoria":true},
    {"nome":"Segurança Patrimonial","icone":"🔒","fotoObrigatoria":true},
    {"nome":"Bicicletário","icone":"🚲","fotoObrigatoria":true},
    {"nome":"Elevadores","icone":"🛗","fotoObrigatoria":true},
    {"nome":"Heliponto","icone":"🚁","fotoObrigatoria":true},
    {"nome":"Jardinagem e Paisagismo","icone":"🌿","fotoObrigatoria":true},
    {"nome":"Limpeza e Conservação","icone":"🧹","fotoObrigatoria":true},
    {"nome":"Manutenção e Zeladoria","icone":"🔧","fotoObrigatoria":true},
    {"nome":"Talude","icone":"⛰️","fotoObrigatoria":true},
    {"nome":"Sistemas de Incêndio","icone":"🧯","fotoObrigatoria":true},
    {"nome":"Docas","icone":"🚚","fotoObrigatoria":true}
  ]'::jsonb
)
on conflict (id) do nothing;
