# Servidor — fase 1 (fundação)

Estado da migração do app para Vercel + Neon + Microsoft 365, conforme o plano
aprovado. Este documento acompanha o que está pronto, o que espera credencial e
como as peças se ligam.

## Arquitetura

```
Celular/PC ── app React (o mesmo de hoje)
   │  login "Entrar com Microsoft" (MSAL, code + PKCE)
   │
   ├──► /api/* na Vercel ──► Neon (PostgreSQL)      dados das vistorias
   │        └ valida o token do Entra ID a cada chamada
   │
   └──► Microsoft Graph ──► SharePoint /sites/Vistorias   arquivos das fotos
            (token delegado do próprio usuário — o servidor nunca vê a foto)
```

- O PDF continua sendo gerado no navegador, como hoje.
- Ids continuam gerados no cliente (`vist_…`, `cond_…`): preserva os backups na
  importação e prepara a fase offline.
- A **nota geral é recalculada no servidor** a cada gravação (`api/_lib/score.ts`)
  — o cliente nunca grava uma média por conta própria.

## O que está pronto (testado, sem credencial)

| Peça | Onde |
| --- | --- |
| Esquema do banco | `db/schema.sql` (+ `db/seed.sql` — **preencher e-mails antes de rodar**) |
| Autenticação (validação de token do Entra) | `api/_lib/auth.ts` |
| Permissões (decisões 1 e 2 do plano) | `api/_lib/permissoes.ts` |
| Repositório com auditoria | `api/_lib/repositorio.ts` |
| Rotas | `api/*.ts` (tabela abaixo) |
| Importador de backups do app | `POST /api/importar` |
| Testes (PGlite = PostgreSQL embutido) | `npm run test:servidor` — 9 cenários |

### Rotas

| Rota | Métodos | Quem |
| --- | --- | --- |
| `/api/me` | GET | qualquer usuário ativo |
| `/api/condominios` | GET / POST | todos / admin |
| `/api/condominios/[id]` | PATCH / DELETE (arquiva) | admin |
| `/api/vistorias` | GET (`?condominioId=`, `?arquivadas=1`) / POST | todos (arquivadas: admin) / todos |
| `/api/vistorias/[id]` | GET / PATCH (edita, `{arquivar}`, `{restaurar}`) | ver regras |
| `/api/fotos` · `/api/fotos/[id]` | POST / PATCH / DELETE | dono da vistoria ou admin |
| `/api/usuarios` · `/api/usuarios/[id]` | GET / POST / PATCH | admin (vistoriador vê só nomes) |
| `/api/importar` | POST | admin |

Regras aplicadas no repositório (e cobertas por teste): todo mundo vê todas as
vistorias; edita só o responsável ou o admin; arquivar/restaurar é do admin e
fica na tabela `auditoria`; usuário não é excluído, é desativado; o último
admin ativo não pode ser desativado nem rebaixado.

### Fluxo das fotos

1. O app comprime a foto (já faz hoje) e envia **direto ao Graph**, na pasta
   `Fotos de Vistoria/<Condomínio>/<AAAA-MM-DD>/`, com o token do usuário.
2. Com o `driveId`/`itemId` devolvidos pelo Graph, chama `POST /api/fotos`.
3. Para exibir, o app pede ao Graph uma URL temporária (em lote por vistoria).

Coordenadas já verificadas (gravação testada em 12/08/2026):

| | |
| --- | --- |
| Site | `/sites/Vistorias` (`33d79492-…`, `d0407961-…`) |
| Biblioteca "Documentos" (driveId) | `b!kpTXM-8mz0ahYsqKCjC2y2F5QNDTaFFMh6LxGoDboRfM-zixEz5JSY_FmoxPOOCX` |
| Pasta raiz (itemId) | `01YDIUUZRUM2U5TNCFEZA3NQBNDE4G3HPN` |

## Variáveis de ambiente (Vercel → Settings → Environment Variables)

| Variável | O que é | Segredo? |
| --- | --- | --- |
| `DATABASE_URL` | connection string do Neon | **sim — nunca no repositório** |
| `ENTRA_TENANT_ID` | ID do diretório (locatário) | não |
| `ENTRA_CLIENT_ID` | ID do aplicativo (cliente) | não |

No cliente (build): `VITE_ENTRA_TENANT_ID`, `VITE_ENTRA_CLIENT_ID`,
`VITE_SP_DRIVE_ID`, `VITE_SP_PASTA_ID` — valores acima, nenhum é segredo.

## O que falta (depende de credencial / é a próxima etapa)

1. Contas criadas pelo Caio: registro no Entra ID, Neon, Vercel (roteiro no chat
   de 12/08). Backups exportados de cada aparelho.
2. Rodar `db/schema.sql` e `db/seed.sql` no Neon (e-mails reais preenchidos).
3. **Ligar o app**: MSAL no cliente, telas lendo da API em vez do IndexedDB,
   upload das fotos ao Graph, tela de administração, página de migração que lê
   o backup e chama `/api/importar` + sobe as fotos.
4. Importar projeto na Vercel, configurar variáveis, apontar o registro do
   Entra para a URL final e desligar o GitHub Pages.

Rodar localmente: `npm run test:servidor` (testes) · `npm run typecheck:api`.
