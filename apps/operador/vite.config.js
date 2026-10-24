import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [react(), tailwindcss(), basicSsl()],
  server: {
    https: true, // Garante que a câmera do celular e a lanterna sejam permitidas como SecureContext
    port: 5174,
    host: true, // Disponível na rede local (Wi-Fi)
    allowedHosts: true, // Permite acesso via túnel HTTPS
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      }
    }
  }
});
