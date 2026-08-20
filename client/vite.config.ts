import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:7285',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:7285',
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1300,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('socket.io-client') || id.includes('engine.io-client')) return 'socket';
            if (
              !id.includes('@ionic') &&
              (id.includes('/react/') ||
                id.includes('/react-dom/') ||
                id.includes('react-router') ||
                id.includes('/scheduler/'))
            ) {
              return 'vendor';
            }
          }
        },
        hoistTransitiveImports: false,
      },
    },
  },
});
