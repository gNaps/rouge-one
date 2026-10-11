import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
const run=(args)=> { const result=spawnSync('docker',args,{encoding:'utf8'}); if(result.status!==0) throw new Error(result.stderr||result.stdout); return result.stdout.trim(); };
const config=Object.fromEntries((await readFile('.env.local','utf8')).split('\n').filter(s=>s && !s.startsWith('#')).map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1)];}));
const user=config.POSTGRES_USER || 'rouge', db='rouge_volume_test';
run(['exec','rouge-one-db-1','createdb','-U',user,db]);
try {
 run(['exec','rouge-one-db-1','psql','-U',user,'-d',db,'-c',"CREATE TABLE probe (id INTEGER PRIMARY KEY); INSERT INTO probe VALUES (42)"]);
 run(['compose','--env-file','.env.local','up','-d','--force-recreate','--wait','db']);
 const id=run(['exec','rouge-one-db-1','psql','-U',user,'-d',db,'-At','-c','SELECT id FROM probe']);
 if(id!=='42') throw new Error('Persistent volume lost the probe record');
 console.log('Persistence verified after database-container recreation. Application database was not modified.');
} finally { run(['exec','rouge-one-db-1','dropdb','-U',user,db]); }
