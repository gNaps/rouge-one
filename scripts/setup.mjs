import { readFile, writeFile, access } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseEnv } from 'node:util';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const development = process.argv.includes('--dev');
const config = path.join(root, '.env.local');
try {
  await access(config);
  console.log('Keeping existing .env.local. No settings or secrets were overwritten.');
} catch {
  const secret = () => randomBytes(32).toString('hex');
  const password = secret();
  let template = await readFile('.env.example', 'utf8');
  template = template.replaceAll('GENERATED_PASSWORD', password).replace('GENERATED_DISTINCT_SECRET', secret()).replace('GENERATED_SECRET', secret()).replace('GENERATED_SETUP_TOKEN', secret());
  if (development) template = template.replace('PUBLIC_URL=http://localhost:8080', 'PUBLIC_URL=http://localhost:4200').replace('SMTP_HOST=\n', 'SMTP_HOST=localhost\n');
  await writeFile(config, template, { flag: 'wx', mode: 0o600 });
  console.log('Created .env.local. Existing .env was not read or modified.');
}
const envText = await readFile(config, 'utf8');
const values = parseEnv(envText);
const setupLink = new URL('/setup', values.PUBLIC_URL);
setupLink.hash = encodeURIComponent(values.BOOTSTRAP_TOKEN);
const printSetupLink = () => console.log(`Open this private link to create your administrator:\n${setupLink.href}`);
if (process.argv.includes('--config-only')) {
  console.log('After starting the services:');
  printSetupLink();
  process.exit(0);
}
const run = (command, args, env = process.env) => {
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit' });
  if (result.error || result.status !== 0) throw new Error(`${command} failed. Check the error above.`);
};
try {
  const probe = spawnSync('docker', ['info'], { stdio: 'ignore' });
  if (probe.status !== 0) throw new Error('Start Docker before running setup, or use --config-only for an external database.');
  if (development) {
    run('docker', ['compose', '--env-file', '.env.local', '-f', 'compose.yaml', '-f', 'compose.dev.yaml', '--profile', 'dev', 'up', '-d', '--wait', 'db', 'mailpit']);
    run('pnpm', ['--filter', '@rouge-one/api', 'db:generate'], { ...process.env, ...values });
    run('pnpm', ['db:preflight'], { ...process.env, ...values });
    run('pnpm', ['db:migrate'], { ...process.env, ...values });
    console.log('Run pnpm dev, then:');
    printSetupLink();
    console.log('Email inbox: http://localhost:8025');
  } else {
    run('docker', ['compose', '--env-file', '.env.local', 'up', '-d', '--build', '--wait']);
    printSetupLink();
    console.log('Use --profile dev to enable the local email inbox.');
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
