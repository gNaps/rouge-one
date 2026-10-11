import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.json': 'application/json' };
http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/')) {
    const proxy = http.request({ hostname: '127.0.0.1', port: 3000, path: req.url, method: req.method, headers: req.headers }, upstream => { res.writeHead(upstream.statusCode, upstream.headers); upstream.pipe(res); });
    proxy.on('error', () => { res.writeHead(502); res.end('API unavailable'); }); req.pipe(proxy); return;
  }
  let url; try { url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400); res.end(); return; }
  const login = url.startsWith('/login/'), example = url.startsWith('/example/');
  const base = path.join(root, example ? 'examples/web' : login ? 'apps/login/dist' : 'apps/admin/dist/rouge-one-app/browser');
  let file = path.resolve(base, '.' + (example ? url.slice(8) : login ? url.slice(6) : url));
  if (!file.startsWith(base + path.sep) && file !== base) { res.writeHead(403); res.end(); return; }
  try { if (!(await stat(file)).isFile()) file = path.join(base,'index.html'); } catch { file = path.join(base,'index.html'); }
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); res.setHeader('Referrer-Policy', 'no-referrer');
  createReadStream(file).on('error', () => { res.writeHead(404); res.end(); }).pipe(res);
}).listen(4200, '127.0.0.1', () => console.log('Test frontend listening on localhost:4200'));
