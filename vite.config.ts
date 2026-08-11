import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * `__VERSAO__` carimba a data/hora do build dentro do aplicativo.
 *
 * Sem isso não há como saber qual versão um celular está realmente executando —
 * e um app servido do cache é indistinguível de um app com defeito. A versão
 * aparece em Ajustes, para responder essa pergunta olhando a tela.
 */
export default defineConfig({
  // base: './' mantém o app funcional em qualquer subdiretório (GitHub Pages, etc.)
  base: './',
  plugins: [react()],
  server: { host: true },
  define: {
    __VERSAO__: JSON.stringify(
      new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
    ),
  },
})
