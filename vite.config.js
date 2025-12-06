import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Visual Editor ve Selection Mode gibi arayüzü bozan eklentiler çıkarıldı.
export default defineConfig({
  plugins: [
    react()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true, // Docker veya ağ üzerinden erişim için
    port: 5173,
  }
});