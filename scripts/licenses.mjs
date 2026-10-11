import { readFile, readdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const tree = process.env.npm_execpath ? JSON.parse(execFileSync(process.execPath, [process.env.npm_execpath, 'list', '-r', '--prod', '--depth', 'Infinity', '--json'], { encoding: 'utf8' })) : JSON.parse(execFileSync('pnpm', ['list', '-r', '--prod', '--depth', 'Infinity', '--json'], { encoding: 'utf8' }));
const paths = new Set();
function collect(node) { if (node.path) paths.add(node.path); for (const dependency of Object.values(node.dependencies || {})) collect(dependency); }
for (const workspace of tree) collect(workspace);
const records = new Map(), notices = [];
for (const directory of paths) {
  let manifest; try { manifest = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8')); } catch { continue; }
  const id = `${manifest.name}@${manifest.version}`;
  if (records.has(id) || manifest.name.startsWith('@rouge-one/') || manifest.name === 'rouge-one') continue;
  const record = { name: manifest.name, version: manifest.version, license: manifest.license || manifest.licenses || 'UNKNOWN', repository: manifest.repository || manifest.homepage || null, noticeIncluded: false };
  const files = (await readdir(directory)).filter(name => /^(license|licence|notice)(\.|$)/i.test(name));
  for (const name of files) { try { const content=await readFile(path.join(directory,name),'utf8'); notices.push(`\n===== ${id}: ${name} =====\n${content}`); record.noticeIncluded=true; } catch {} }
  if (!record.noticeIncluded) {
    try { const content = await readFile(path.join('docs/vendor-licenses', manifest.name.replaceAll('/', '-') + '.txt'), 'utf8'); notices.push(`\n===== ${id}: upstream notice =====\n${content}`); record.noticeIncluded = true; } catch {}
  }
  records.set(id, record);
}
await writeFile('docs/dependency-licenses.json', JSON.stringify([...records.values()].sort((a,b)=>a.name.localeCompare(b.name)),null,2)+'\n');
await writeFile('THIRD_PARTY_NOTICES.txt', 'Licenses and notices of production dependencies distributed with Rouge One.\n'+notices.join('\n')+'\n');
const missing = [...records.values()].filter(r=>r.license==='UNKNOWN' || !r.noticeIncluded);
console.log(`Recorded ${records.size} production packages and copied ${notices.length} license/notice files. ${missing.length} entries require manual notice review.`);
