import { basicOps } from './basic-ops.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ops, registry } from './contracts.mjs';
import { authorityFor } from './role-authority.mjs';

export const root = path.dirname(fileURLToPath(import.meta.url));
const clean = value => String(value).replaceAll('|','\\|').replaceAll('\n',' ');
const table = (headers, rows) => '| '+headers.map(clean).join(' | ')+' |\n| '+headers.map(()=> '---').join(' | ')+' |\n'+rows.map(row=>'| '+row.map(clean).join(' | ')+' |').join('\n')+'\n';
function supportingReferences(op) {
  const refs=[];
  if(['backend.implement','architecture.decide'].includes(op.id)) refs.push({path:'knowledge/patterns/be/INDEX.json',when:'Use only topics matching the actual selected backend family and source conventions.'});
  if(['interface.implement'].includes(op.id)) refs.push({path:'knowledge/patterns/fe/INDEX.json',when:'Use applicable topics for the actual installed frontend family and owner packages.'});
  if(['interface.draw','interface.implement'].includes(op.id)) refs.push({path:'knowledge/ui/composition/INDEX.json',when:'Use applicable composition topics for the accepted surface and installed family.'});
  if(op.id==='interface.implement') refs.push({path:'knowledge/ui/presentation/INDEX.json',when:'Resolve actual installed components and tokens; do not invent rule IDs or APIs.'});
  if(['interface.draw','interface.implement','review.verify'].includes(op.id)) refs.push({path:'knowledge/ui/proof/INDEX.json',when:'Only for selected visual assertions; use real measurements and captures. This does not add appearance scoring to UAT.'});
  return refs;
}
export function outputs() {
  const sorted=[...ops].sort((a,b)=>a.id.localeCompare(b.id));
  const catalogue={schema:'work/ops@1',commonDocument:'common.json',ops:sorted.map(op=>({id:op.id,document:op.id+'/operator.json',authority:op.id+'/authority.json',goal:op.goal.en,nodeKinds:op.nodeKinds,writeScope:op.writes.map(w=>w.path),sideEffects:op.sideEffects,completionProfile:op.completionProfile,supportingReferences:supportingReferences(op),contract:op}))};
  const json=x=>JSON.stringify(x,null,2)+'\n';
  const files=new Map([['catalog.json',json(catalogue)],['basic-ops.json',json(basicOps(sorted))],['consolidation.json',json(registry.consolidation)]]);
  for(const op of sorted){files.set(op.id+'/authority.json',json(authorityFor(op)));}
  return files;
}
export function generate({check=false}={}) {
  const failures=[];
  for(const [name,contents]of outputs()){
    const file=path.join(root,name);
    if(check){if(!fs.existsSync(file)||fs.readFileSync(file,'utf8')!==contents)failures.push(name);}
    else{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,contents);}
  }
  return failures;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const failures=generate({check:process.argv.includes('--check')});
  if(failures.length){process.stderr.write('Stale operator outputs: '+failures.join(', ')+'\n');process.exitCode=1;}
  else process.stdout.write(`Operator catalogue/documents ${process.argv.includes('--check')?'current':'generated'}: ${ops.length} ops\n`);
}
