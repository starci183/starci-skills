#!/usr/bin/env node
// Redact machine paths and user identities from captured Orca receipts before they become fixtures.
import fs from 'node:fs';
import path from 'node:path';

const replacements=[
  [/C:\/Users\/[^/"\\]+\/orca\/workspaces\//g,'<orca-workspaces>/'],
  [/C:\\\\Users\\\\[^\\"]+\\\\orca\\\\workspaces\\\\/g,'<orca-workspaces>/'],
  [/D:\/Repositories\//g,'<repositories>/'],
  [/D:\\\\Repositories\\\\/g,'<repositories>/'],
  [/C:\/Users\/[^/"\\]+\//g,'<home>/'],
  [/C:\\\\Users\\\\[^\\"]+\\\\/g,'<home>/'],
  [/"(launch_token_hash|capability_hash)":"[0-9a-f]+"/g,'"$1":"<redacted-hash>"']
];

function sanitizeText(text){return replacements.reduce((value,[pattern,replacement])=>value.replace(pattern,replacement),text);}

function sanitizeFile(file,{keepDispatches}={}){
  let text=fs.readFileSync(file,'utf8');
  if(keepDispatches){
    const json=JSON.parse(text);
    const workers=json.result?.workers;
    if(Array.isArray(workers))json.result.workers=workers.filter(worker=>keepDispatches.includes(worker.dispatchId));
    text=JSON.stringify(json,null,2);
  }
  const sanitized=sanitizeText(text);
  fs.writeFileSync(file,sanitized.endsWith('\n')?sanitized:`${sanitized}\n`);
  const leak=/C:\/Users|D:\/Repositories|C:\\\\Users/.exec(sanitized);
  if(leak)throw Error(`Unredacted machine path remains in ${file}: ${leak[0]}`);
}

const [,,directory,...keep]=process.argv;
if(!directory){process.stderr.write('Usage: sanitize-orca-fixture.mjs <fixture-dir> [dispatch-id...]\n');process.exit(1);}
for(const name of fs.readdirSync(directory)){
  const file=path.join(directory,name);
  if(!name.endsWith('.json'))continue;
  sanitizeFile(file,name==='worker-list.json'&&keep.length?{keepDispatches:keep}:{});
  process.stdout.write(`sanitized ${file}\n`);
}
