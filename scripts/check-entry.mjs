import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

/** Diagnose the explicitly supplied host, not the current FE directory. Read-only. */
export function checkEntry(host,{claimedEntry}={}) {
 const source=path.resolve(host),entry=path.join(source,'.claude','SKILL.md');
 const bootstraps=['AGENTS.md','CLAUDE.md'].map(name=>{
  const file=path.join(source,name);
  return {file,exists:fs.existsSync(file),text:fs.existsSync(file)?fs.readFileSync(file,'utf8'):''};
 });
 const exists=fs.existsSync(entry)&&fs.statSync(entry).isFile();
 const current=bootstraps.every(b=>b.exists&&b.text.includes('.claude/SKILL.md')&&!b.text.includes('.claude/INDEX.md'));
 const obsolete=claimedEntry?.replaceAll('\\','/').endsWith('.claude/INDEX.md')===true;
 return {source,entry,entryExists:exists,status:!exists?'missing-runtime':!current?'bootstrap-review-required':obsolete?'context-refresh-required':'ready',
  bootstraps:bootstraps.map(({text,...b})=>b),runtimeWriteRequired:!exists,
  guidance:exists&&current?'Read the current host bootstrap and SKILL.md. A missing retired INDEX.md or dirty Git tree does not require a runtime update/push. If explicit older instructions conflict, obtain a replacement instruction, not permission to recreate the retired entry.':'Inspect the actual bootstrap/installation mismatch; this diagnostic grants no repair, install or push authority.'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const [host,claimedEntry]=process.argv.slice(2);
 if(!host){process.stderr.write('Usage: node scripts/check-entry.mjs <explicit-host> [claimed-entry]\n');process.exitCode=1;}
 else {const result=checkEntry(host,{claimedEntry});process.stdout.write(JSON.stringify(result)+'\n');if(!['ready','context-refresh-required'].includes(result.status))process.exitCode=1;}
}
