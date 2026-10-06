import fs from 'node:fs';
import path from 'node:path';
import { isMain } from '../lib/is-main.mjs';
import { HOST_BOOTSTRAP_FILES, parseHosts } from '../install/bootstrap-hosts.mjs';

const USAGE='Usage: starci runtime check --only entry -- <explicit-host> [claimed-entry] [--hosts claude,devin|all]\n  AGENTS.md is required; CLAUDE.md and DEVIN.md are judged when present or named by --hosts (the hosts the install was given), never demanded otherwise.\n';

/** Diagnose the explicitly supplied host, not the current FE directory. The bootstrap files judged are the ones an install of the selected hosts writes (scripts/install/bootstrap-hosts.mjs): AGENTS.md always, a host copy when present or named. Read-only. */
function checkEntry(host,{claimedEntry,hosts=[]}={}) {
 const source=path.resolve(host),entry=path.join(source,'.claude','CONTEXT.md');
 const bootstraps=Object.entries(HOST_BOOTSTRAP_FILES).map(([key,name])=>{
  const file=path.join(source,name),exists=fs.existsSync(file);
  return {file,exists,required:key==='agents'||hosts.includes(key)||exists,text:exists?fs.readFileSync(file,'utf8'):''};
 }).filter(b=>b.required);
 const exists=fs.existsSync(entry)&&fs.statSync(entry).isFile();
 const current=bootstraps.every(b=>b.exists&&b.text.includes('.claude/CONTEXT.md')&&!b.text.includes('.claude/INDEX.md'));
 const obsolete=claimedEntry?.replaceAll('\\','/').endsWith('.claude/INDEX.md')===true;
 let status;
 if(!exists)status='missing-runtime';
 else if(!current)status='bootstrap-review-required';
 else status=obsolete?'context-refresh-required':'ready';
 return {source,entry,entryExists:exists,status,
  bootstraps:bootstraps.map(({text,...b})=>b),runtimeWriteRequired:!exists,
  guidance:exists&&current?'Read the current host bootstrap and CONTEXT.md. A missing INDEX.md or dirty Git tree does not require a runtime update/push. If explicit older instructions conflict, obtain a replacement instruction, not permission to recreate the entry.':'Inspect the actual bootstrap/installation mismatch; this diagnostic grants no repair, install or push authority.'};
}
if(isMain(import.meta.url)) {
 const args=process.argv.slice(2),at=args.findIndex(a=>a==='--hosts'||a.startsWith('--hosts='));
 let hosts=[],badHosts=false;
 if(at>=0){
  const joined=args[at].startsWith('--hosts=');
  try{hosts=parseHosts(joined?args[at].slice(8):args[at+1]);}catch(error){badHosts=true;process.stderr.write(`${error.message}\n${USAGE}`);process.exitCode=1;}
  args.splice(at,joined?1:2);
 }
 const [host,claimedEntry]=args;
 if(badHosts){/* reported above */}
 else if(!host){process.stderr.write(USAGE);process.exitCode=1;}
 else {const result=checkEntry(host,{claimedEntry,hosts});process.stdout.write(JSON.stringify(result)+'\n');if(!['ready','context-refresh-required'].includes(result.status))process.exitCode=1;}
}
