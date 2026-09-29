import fs from 'node:fs';import path from 'node:path';import {stringifyYaml} from '../../engine/yaml.mjs';import {checkWorkTree} from '../checks/check-example-work.mjs';import {checkWorkSchemas} from '../checks/check-work-schemas.mjs';import {starciworkGitignoreText} from '../lib/starciwork-boundary.mjs';
// A small synthetic .starciwork tree in the flat layout: workspace, catalog, one feature and two flat family
// records (business rules). It claims no investigation, implementation or
// acceptance: both records are `todo`. The tree is checked by the same gate every example tree passes.
export function makeExample(root){
 if(fs.existsSync(root))throw Error('Example destination must be new');
 const write=(p,v)=>{const file=path.join(root,p);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,typeof v==='string'?v:stringifyYaml(v));};
 // .gitignore: product content only (work-layout.yaml shape.starciworkIgnore); agent output lives in the ledger and blobs.
 write('workspace.yaml',{schema:'work/workspace@1',id:'example-expandable-work',project:'example-expandable-work',description:'A synthetic example of the flat Work layout.',repositories:[{role:'be',name:'example-backend'}]});write('.gitignore',starciworkGitignoreText());
 write('features/index.yaml',{schema:'work/catalog@1',id:'example-expandable-work',description:'Synthetic product catalog. One entry per feature; every record of a feature lives under its directory.',features:[{id:'vps',directory:'features/vps',description:'Creating a virtual private server.'}]});
 write('features/vps/index.yaml',{schema:'work/feature@1',id:'vps',title:'A person creates a virtual private server',description:'A person picks a size and a region and receives a running server. Every record of this feature lives under this directory.'});
 write('features/vps/br/one-server-per-name/index.yaml',{schema:'work/business-rule@1',id:'br.vps.one-server-per-name',title:'A server name is unique within its owner',state:'todo',statements:['An owner cannot hold two servers with the same name; the second creation is refused with the name it collided on.']});
 write('features/vps/br/known-region/index.yaml',{schema:'work/business-rule@1',id:'br.vps.known-region',title:'A server is created only in a region the product offers',state:'todo',statements:['Creating a server in a region the product does not offer is refused, naming the regions it does offer.']});
 const problems=[];checkWorkTree(root,problems);checkWorkSchemas(root,problems);if(problems.length)throw Error(JSON.stringify(problems));
 return {ok:true,records:5,root,synthetic:true};
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(import.meta.filename))console.log(JSON.stringify(makeExample(path.resolve(process.argv[2]))));
