import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['events', 'process', 'stream', 'buffer'],
      globals: { process: true, Buffer: true },
    }),
  ],
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
            if (id.includes('@ionic') || id.includes('ionicons')) return 'ionic';
            if (id.includes('socket.io-client') || id.includes('engine.io-client')) return 'socket';
            if (id.includes('simple-peer')) return 'webrtc';
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('react-router') ||
              id.includes('/scheduler/')
            ) {
              return 'vendor';
            }
          }
        },
      },
    },
  },
});
