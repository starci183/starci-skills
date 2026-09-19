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
  if(['backend.implement','interface.implement','review.verify'].includes(op.id)) refs.push({path:'knowledge/coding-reference.json',when:'Before code changes or code acceptance, enforce applicable Academy BE/FE conventions. Verify the actual reference chain, named database injection and transaction ownership; passing tests or lint alone does not establish conformance. Review reads the applicable BE/FE pattern topics, including structural checks not covered by installed lint.'});
  if(op.id==='backend.implement') refs.push({path:'knowledge/patterns/be/INDEX.json',when:'Use only topics matching the actual selected backend family and source conventions.'});
  if(op.id==='architecture.decide') refs.push({path:'knowledge/patterns/be/INDEX.json',when:'Consult only applicable logical design mechanisms; source convention examples do not require source mapping in SDS.'});
  if(['interface.implement'].includes(op.id)) refs.push({path:'knowledge/patterns/fe/INDEX.json',when:'Use applicable topics for the actual installed frontend family and owner packages.'});
  if(['interface.draw','interface.implement'].includes(op.id)) refs.push({path:'knowledge/ui/composition/INDEX.json',when:'Use applicable composition topics for the accepted surface and installed family.'});
  if(['interface.draw','interface.implement'].includes(op.id)) {
    refs.push({path:'knowledge/ui/presentation/INDEX.json',when:'Before drawing or implementation, resolve actual installed component anatomy and token ownership alongside applicable composition rules.'});
    refs.push({path:'knowledge/grammars/INDEX.json',when:'When Grammar is selected, read applicable family knowledge and verify it against the consuming app’s resolved package and active family CSS; snapshots do not select a family or prove current APIs.'});
  }
  if(['interface.draw','interface.implement','review.verify'].includes(op.id)) refs.push({path:'knowledge/ui/proof/INDEX.json',when:'Only for selected visual assertions; use real measurements and captures. This does not add appearance scoring to UAT.'});
  return refs;
}
export function outputs() {
  const sorted=[...ops].sort((a,b)=>a.id.localeCompare(b.id));
  const catalogue={schema:'work/ops@1',commonDocument:'common.yaml',ops:sorted.map(op=>({id:op.id,document:op.id+'/operator.yaml',authority:op.id+'/authority.json',goal:op.goal.en,nodeKinds:op.nodeKinds,writeScope:op.writes.map(w=>w.path),sideEffects:op.sideEffects,completionProfile:op.completionProfile,supportingReferences:supportingReferences(op),contract:op}))};
  const json=x=>JSON.stringify(x,null,2)+'\n';
  const files=new Map([['catalog.json',json(catalogue)],['basic-ops.json',json(basicOps(sorted))],['consolidation.json',json(registry.consolidation)]]);
  for(const op of sorted){files.set(op.id+'/authority.json',json(authorityFor(op)));}
  return files;
}
export function generate({check=false}={}) {
  throw Error('Source-tree generation is retired. Use npm run build (or build:check) to publish the complete .dist runtime.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const failures=generate({check:process.argv.includes('--check')});
  if(failures.length){process.stderr.write('Stale operator outputs: '+failures.join(', ')+'\n');process.exitCode=1;}
  else process.stdout.write(`Operator catalogue/documents ${process.argv.includes('--check')?'current':'generated'}: ${ops.length} ops\n`);
}
