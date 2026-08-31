import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const requiredSections=[
  '# Visual audit —',
  '## Owner',
  '## Current snapshot',
  '## Audit axes',
  '## Immutable audit history',
  '## Owner feedback'
];
const validStatuses=new Set(['PASS','FAIL','BLOCKED','INSUFFICIENT_EVIDENCE','STALE']);

export function validateFrontendOwnerAudit(text,{filePath='audit.md'}={}){
  const errors=[];
  if(path.basename(filePath)!=='audit.md') errors.push('owner audit filename must be lowercase audit.md');
  for(const section of requiredSections) if(!text.includes(section)) errors.push(`missing section: ${section}`);
  const kind=text.match(/^- Kind:\s*(page|layout|modal|drawer)\s*$/mi)?.[1];
  if(!kind) errors.push('Kind must be page, layout, modal, or drawer');
  const status=text.match(/^- Status:\s*([A-Z_]+)\s*$/mi)?.[1];
  if(!validStatuses.has(status)) errors.push('Status must be PASS, FAIL, BLOCKED, INSUFFICIENT_EVIDENCE, or STALE');
  const score=text.match(/^- Score:\s*(N\/A|(?:10|[0-9])\/10)\s*$/mi)?.[1];
  if(!score) errors.push('Score must be N/A or 0/10 through 10/10');
  if((status==='INSUFFICIENT_EVIDENCE'||status==='BLOCKED'||status==='STALE')&&score!=='N/A') errors.push(`${status} requires Score: N/A`);
  if(status==='PASS'&&score!=='9/10'&&score!=='10/10') errors.push('PASS requires Score: 9/10 or 10/10');
  if(status!=='PASS'&&score!=='N/A'&&Number(score.split('/')[0])>8) errors.push('a non-PASS score cannot exceed 8/10');
  const reason=text.match(/^- Reason why:\s*(.+)$/mi)?.[1]?.trim();
  if(!reason||reason.length<20) errors.push('Reason why must contain at least 20 visible-evidence characters');
  for(const field of ['Source refs','Entry context','Covered evidence','Source fingerprint','Evidence fingerprint','Finding-batch fingerprint','Remaining gaps']) {
    if(!new RegExp(`^- ${field}:\\s*\\S+`,'mi').test(text)) errors.push(`missing non-empty field: ${field}`);
  }
  return errors;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const files=process.argv.slice(2);
  if(files.length===0) throw new Error('usage: node validate-frontend-owner-audit.mjs <audit.md> [...]');
  let failed=false;
  for(const file of files){
    const absolute=path.resolve(file);
    const errors=validateFrontendOwnerAudit(await readFile(absolute,'utf8'),{filePath:absolute});
    if(errors.length){failed=true;console.error(`${file}:\n${errors.map((error)=>`- ${error}`).join('\n')}`);}
  }
  if(failed) process.exitCode=1;
}
