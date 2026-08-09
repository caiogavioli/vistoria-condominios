import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' mantém o app funcional em qualquer subdiretório (GitHub Pages, etc.)
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: true },
})
