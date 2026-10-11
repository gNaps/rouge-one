import { spawnSync } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
const run = (command,args,env=process.env) => {
  const result=spawnSync(command,args,{encoding:'utf8',env});
  if(result.status!==0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
};
// Uses only the dedicated disposable test server. No installation data is changed.
const db = 'rouge_one_test', restored = 'rouge_restore_test';
run('docker',['exec','rouge-one-test-db','psql','-U','rouge_test','-d',db,'-At','-c','SELECT 1']);
run('docker',['exec','rouge-one-test-db','createdb','-U','rouge_test',restored]);
await mkdir('.local',{recursive:true});
const configFile='.local/storage-test.env';
const configuration = name => `POSTGRES_PASSWORD=rouge_test_only\nDATABASE_URL=postgresql://rouge_test:rouge_test_only@host.docker.internal:5437/${name}\n`;
const dump=`backups/storage-test-${Date.now()}.dump`;
try {
  await writeFile(configFile,configuration(db),{mode:0o600});
  run(process.execPath,['scripts/database.mjs','backup',dump,'--external'],{...process.env,CONFIG_FILE:configFile});
  await writeFile(configFile,configuration(restored),{mode:0o600});
  run(process.execPath,['scripts/database.mjs','restore',dump,'--external'],{...process.env,CONFIG_FILE:configFile});
  const query='SELECT (SELECT count(*) FROM "User") || \'/\' || (SELECT count(*) FROM "Project") || \'/\' || (SELECT count(*) FROM "People")';
  const count=name=>run('docker',['exec','rouge-one-test-db','psql','-U','rouge_test','-d',name,'-At','-c',query]);
  if(count(db)!==count(restored)) throw new Error('Restored row counts differ');
  const refusal=spawnSync(process.execPath,['scripts/database.mjs','restore',dump,'--external'],{env:{...process.env,CONFIG_FILE:configFile},encoding:'utf8'});
  if(refusal.status===0 || !refusal.stderr.includes('not empty')) throw new Error('Populated restore target was not rejected');
  console.log(`Backup/restore verified; matching User/Project/People counts: ${count(db)}. Populated-target refusal verified.`);
} finally { run('docker',['exec','rouge-one-test-db','dropdb','-U','rouge_test',restored]); }
