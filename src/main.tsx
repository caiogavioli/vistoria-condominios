import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { App } from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* HashRouter: funciona em hospedagem estática simples e offline. */}
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    /*
     * `updateViaCache: 'none'` obriga o navegador a buscar o `sw.js` na rede a
     * cada carregamento, em vez de reaproveitar a cópia em cache. Sem isso um
     * aparelho podia ficar preso na versão antiga por tempo indeterminado — e
     * um app velho, sem o código novo, é indistinguível de um app com defeito
     * para quem só olha a tela.
     */
    navigator.serviceWorker
      .register('./sw.js', { updateViaCache: 'none' })
      .then((registro) => {
        // Procura versão nova agora e a cada meia hora com o app aberto.
        void registro.update()
        setInterval(() => void registro.update(), 30 * 60 * 1000)

        // Quando uma versão nova assume o controle, recarrega uma vez para que
        // o app em uso passe a ser o novo, sem depender de o usuário fechar
        // tudo e abrir de novo.
        let recarregando = false
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (recarregando) return
          recarregando = true
          window.location.reload()
        })
      })
      .catch(() => {
        /* app segue funcionando sem cache offline */
      })
  })
}
