import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Esto crea la magia: '@' ahora apunta a tu carpeta 'src'
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
});