import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
export default defineConfig({ plugins: [react(), { name: 'integration-example', configureServer(server) { server.middlewares.use('/example', (_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(readFileSync(new URL('../../examples/web/index.html', import.meta.url))); }); } }], base: '/login/', server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:3000' } } });
