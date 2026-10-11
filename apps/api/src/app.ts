import { loadConfig } from './config';
import { buildServer } from './server';

async function main() {
  const config = loadConfig();
  const server = await buildServer(config);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, async () => { await server.close(); process.exit(0); });
  await server.listen({ port: config.port, host: config.host });
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
