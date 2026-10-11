import { execFileSync } from 'node:child_process';
import { mkdir, cp, stat } from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(), snapshot=path.join(root,'.local',`release-scan-${Date.now()}`);
await mkdir(snapshot,{recursive:true});
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
for(const name of files) {
  const source=path.join(root,name),target=path.join(snapshot,name);
  try { if(!(await stat(source)).isFile()) continue; } catch { continue; }
  await mkdir(path.dirname(target),{recursive:true}); await cp(source,target);
}
const image='ghcr.io/gitleaks/gitleaks:v8.28.0';
execFileSync('docker',['run','--rm','-v',`${root}:/repo:ro`,'-e','GIT_CONFIG_COUNT=1','-e','GIT_CONFIG_KEY_0=safe.directory','-e','GIT_CONFIG_VALUE_0=/repo',image,'git','/repo','--redact','--log-opts=--all'],{stdio:'inherit'});
execFileSync('docker',['run','--rm','-v',`${snapshot}:/scan:ro`,image,'dir','/scan','--redact'],{stdio:'inherit'});
