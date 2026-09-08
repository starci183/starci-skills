import fs from 'node:fs';import path from 'node:path';import {ensureBuild} from './ensure-build.mjs';
ensureBuild();
const root=path.resolve(import.meta.dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const catalog=read('workflows/catalog.json'),jobs=read('workflows/jobs.json');
const data={schema:'starci/docs@3',version:read('package.json').version,entry:'starci',gates:read('workflows/gates.json'),limits:catalog.limits,workflows:catalog.workflows.map(w=>({...w,definition:w.id==='frontend'?read('workflows/matrix.json'):jobs.workflows.find(j=>j.id===w.id)})),operators:read('ops/catalog.json').ops.map(o=>({id:o.id,goal:o.goal,contract:o.contract,authority:read('ops/'+o.authority),secondary:fs.existsSync(path.join(root,'ops',o.id,'secondary.json'))?read('ops/'+o.id+'/secondary.json'):null})),profiles:read('profiles/registry.json')};
const bytes=JSON.stringify(data)+'\n';
for(const name of ['docs/catalog.json','sites/skills/src/catalog.generated.json']){fs.mkdirSync(path.dirname(path.join(root,name)),{recursive:true});const output=name.startsWith('sites/')?JSON.stringify({...data,operators:data.operators.map(o=>({id:o.id,goal:o.goal,contract:{steps:o.contract.steps}})),workflows:data.workflows.map(w=>({id:w.id,when:w.when,execution:w.execution,definition:{id:w.id}}))})+'\n':bytes;fs.writeFileSync(path.join(root,name),output);}
process.stdout.write(JSON.stringify({ok:true,operators:data.operators.length,workflows:data.workflows.length})+'\n');
