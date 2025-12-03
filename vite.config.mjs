import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/inventory-pwa/',   // <-- IMPORTANTE PARA GITHUB PAGES
})
