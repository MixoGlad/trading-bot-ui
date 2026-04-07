import { defineConfig } from 'vite';
// import react from '@vitejs/plugin-react-oxc';
import react from '@vitejs/plugin-react-swc';
import checker from 'vite-plugin-checker';

export default defineConfig({
  plugins: [
    react({
      // Enable experimental support for decorators
      tsDecorators: true,
    }),
    checker({
      typescript: true,
      eslint: {
        lintCommand: 'eslint "./src/**/*.{js,jsx,ts,tsx}"',
        useFlatConfig: true,
      },
    }),
  ],
  server: {
    proxy: {
      // Proxying API requests
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      // Proxying WebSocket requests
      '/stream': {
        target: 'http://localhost:3001',
        ws: true,
        changeOrigin: true,
        rewriteWsOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('proxyReqWs', (proxyReq, req, socket, options, head) => {
            // Log to see if cookies are present in the outgoing proxy request
            console.log('WS Handshake Headers:', req.headers);
          });
          proxy.on('error', (err, _req, _res) => {
            console.error('WebSocket proxy error:', err);
          });
        },
      },
    },
  },
});