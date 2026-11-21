import { defineConfig } from 'vite';

// Dev server forwards /api to the backend (npm run api), so the browser talks to one origin
// and the backend needs no CORS setup.
export default defineConfig({
  server: {
    proxy: { '/api': { target: 'http://127.0.0.1:3001', changeOrigin: false } }
  }
});
