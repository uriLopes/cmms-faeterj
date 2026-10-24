import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    host: true, // Permite abrir pelo celular na mesma rede Wi-Fi via IP local!
    allowedHosts: true, // Permite acesso via túnel HTTPS (localtunnel/cloudflared/ngrok)
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
});
