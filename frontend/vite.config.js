import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/analyze': 'http://127.0.0.1:8000',
      '/interpret_context': 'http://127.0.0.1:8000',
      '/decision': 'http://127.0.0.1:8000',
      '/decisions': 'http://127.0.0.1:8000',
      '/risk-feed': 'http://127.0.0.1:8000',
      '/health': 'http://127.0.0.1:8000',
    },
  },
})
