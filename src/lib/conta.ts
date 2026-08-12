import {
  PublicClientApplication,
  type AccountInfo,
} from '@azure/msal-browser'

/**
 * Login com a conta Microsoft da empresa (Entra ID).
 *
 * Ligado por configuração de build: sem VITE_ENTRA_TENANT_ID e
 * VITE_ENTRA_CLIENT_ID, o app se comporta como hoje — sem tela de login e sem
 * cabeçalho de autorização — casando com a tranca do servidor, que também só
 * arma quando as variáveis dele existirem. As duas pontas ligam juntas.
 *
 * O token enviado à API é o ID token do próprio registro (audiência = client
 * id), que é o que o servidor confere.
 */

const TENANT = import.meta.env.VITE_ENTRA_TENANT_ID as string | undefined
const CLIENTE = import.meta.env.VITE_ENTRA_CLIENT_ID as string | undefined
const ESCOPOS = ['openid', 'profile', 'email']

export function loginConfigurado(): boolean {
  return Boolean(TENANT && CLIENTE)
}

let msal: PublicClientApplication | null = null
let preparo: Promise<AccountInfo | null> | null = null

function instancia(): PublicClientApplication {
  msal ??= new PublicClientApplication({
    auth: {
      clientId: CLIENTE as string,
      authority: `https://login.microsoftonline.com/${TENANT}`,
      // A raiz do app (sem o hash das rotas) — é o endereço cadastrado como
      // SPA no registro do aplicativo.
      redirectUri: window.location.origin + window.location.pathname,
    },
    cache: { cacheLocation: 'localStorage' },
  })
  return msal
}

/**
 * Inicializa o MSAL e processa a volta do redirect de login, uma vez só.
 * Devolve a conta ativa (ou null, se ainda não entrou).
 */
export function prepararConta(): Promise<AccountInfo | null> {
  if (!loginConfigurado()) return Promise.resolve(null)
  preparo ??= (async () => {
    const app = instancia()
    await app.initialize()
    const resultado = await app.handleRedirectPromise().catch(() => null)
    const conta = resultado?.account ?? app.getAllAccounts()[0] ?? null
    if (conta) app.setActiveAccount(conta)
    return conta
  })()
  return preparo
}

export async function entrar(): Promise<void> {
  await prepararConta()
  await instancia().loginRedirect({ scopes: ESCOPOS, prompt: 'select_account' })
}

export async function sair(): Promise<void> {
  await prepararConta()
  await instancia().logoutRedirect()
}

function expiraEmSegundos(token: string): number {
  try {
    const corpo = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return Number(corpo.exp) - Math.floor(Date.now() / 1000)
  } catch {
    return 0
  }
}

/**
 * Token para o cabeçalho Authorization, renovando em silêncio quando estiver
 * perto de vencer. Devolve null quando o login não está configurado — e a
 * sincronização segue sem cabeçalho, como hoje.
 */
export async function tokenParaApi(): Promise<string | null> {
  if (!loginConfigurado()) return null
  const conta = await prepararConta()
  if (!conta) return null
  const app = instancia()
  try {
    let r = await app.acquireTokenSilent({ scopes: ESCOPOS, account: conta })
    if (!r.idToken || expiraEmSegundos(r.idToken) < 300) {
      r = await app.acquireTokenSilent({ scopes: ESCOPOS, account: conta, forceRefresh: true })
    }
    return r.idToken || null
  } catch {
    // Renovação silenciosa falhou (sessão revogada, cookies bloqueados…):
    // quem chamar decide pedir login de novo; aqui só não trava a sincronização.
    return null
  }
}
