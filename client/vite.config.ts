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
        target: 'http://localhost:7284',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:7284',
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          socket: ['socket.io-client'],
          webrtc: ['simple-peer'],
        },
      },
    },
  },
});
