import { execFileSync } from 'node:child_process';
const tracked = execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const suspicious = tracked.filter(p=>/(^|\/)\.env($|\.)/.test(p) && !p.endsWith('.env.example') || /\.(dump|bundle|pem|key)$/.test(p));
if(suspicious.length) { console.error('Private files are tracked:',suspicious); process.exitCode=1; }
else console.log('Tracked-file check passed. Scan Git history with gitleaks before publication.');
