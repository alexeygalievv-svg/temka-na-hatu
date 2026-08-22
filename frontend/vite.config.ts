import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    // Мини-аппу тестируют через туннель (ngrok/cloudflared) — разрешаем любые хосты.
    allowedHosts: true,
  },
})
