import fs from 'node:fs';
import path from 'node:path';
import {stringifyYaml,parseYaml} from '../core/yaml.mjs';
import {validateWorkspace} from '../core/index.mjs';
import {documentSRSV3} from './srs-v3.mjs';

const review=()=>({schema:'starci/design-review@1',reviewer:'Synthetic fixture reviewer',authority:'Synthetic runtime regression authority only.',reviewedAt:'2026-09-10T00:00:00Z',observations:[{id:'contract-reviewed',outcome:'pass',observation:'The synthetic Business specification is complete enough to exercise runtime bindings; no product acceptance is claimed.'}],limitations:['This compatibility fixture does not claim architecture, implementation or verification results.']});
const node=(id,kind,description,extra={})=>({schema:'work/node@2',id,kind,required:true,description,...extra});

export function writeSRSV3Workspace(root,{complete=true}={}){
  const write=(relative,value)=>{const file=path.join(root,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,stringifyYaml(value));};
  fs.mkdirSync(root,{recursive:true});
  write('workspace.yaml',{schema:'work/workspace@1',id:'synthetic-srs-sds-runtime'});
  const aggregates=[
    ['module/index.yaml','module','Synthetic module containing one complete Business and Architecture tree.','business'],
    ['module/business/index.yaml','module.business','Synthetic Business aggregate.','business'],
    ['module/business/srs/index.yaml','module.business.srs','Synthetic folder-owned SRS aggregate.','business'],
    ['module/business/srs/functional-requirements/index.yaml','srs-frs','Functional requirement aggregate.','business'],
    ['module/business/srs/non-functional-requirements/index.yaml','srs-nfrs','Non-functional requirement aggregate.','business'],
    ['module/business/srs/business-rules/index.yaml','srs-brs','Business rule aggregate.','business'],
    ['module/business/srs/data/index.yaml','srs-data','Business data aggregate.','business'],
    ['module/business/srs/customer-journeys/index.yaml','srs-journeys','Customer journey aggregate.','business']
  ];
  for(const [file,id,description,kind] of aggregates)write(file,node(id,kind,description));
  write('module/business/overview/index.yaml',node('business-overview','business-overview','Synthetic accepted intent and scope overview.',{state:'todo',assertions:['contract-reviewed'],businessOverview:{purpose:'Exercise a complete synthetic SRS compatibility workspace.',customerUnderstanding:'An operator receives one scoped recipient result.',desiredOutcome:'Every Business item has one typed owner and reviewable linkage.',scope:'Synthetic runtime validation only.',openQuestions:'None for the fixture; no product decision is asserted.'}}));
  const srs=documentSRSV3();
  const leaves=[
    ['module/business/srs/functional-requirements/command/index.yaml','srs-fr-command',srs.fr],
    ['module/business/srs/non-functional-requirements/reliability/index.yaml','srs-nfr-command',srs.nfr],
    ['module/business/srs/business-rules/recipient-scope/index.yaml','srs-br-scope',srs.businessRule],
    ['module/business/srs/data/command-request/index.yaml','srs-data-request',srs.data],
    ['module/business/srs/customer-journeys/operator-result/index.yaml','srs-journey-command',srs.journey]
  ];
  for(const [file,id,spec] of leaves)write(file,node(id,'business','Synthetic authored Business specification leaf.',{state:'todo',assertions:['contract-reviewed'],extensions:{work3:{specification:spec}}}));
  if(complete){
    for(const [,,spec] of leaves){spec.status='pass';if(spec.content.source)spec.content.source.acceptance='accepted';if(spec.nodeType==='non-functional-requirement')spec.content.target={status:'decided',value:'The same request remains queryable until a definitive outcome is shown.',decisionOwner:'Synthetic fixture reviewer',missingDecision:'Not applicable; accepted for the synthetic fixture.'};}
    for(const [file,,spec] of leaves){const meta=parseYaml(fs.readFileSync(path.join(root,file),'utf8'));meta.extensions.work3.specification=spec;write(file,meta);}
    for(const id of ['business-overview',...leaves.map(x=>x[1])]){const current=validateWorkspace(root),entry=current.nodes.find(n=>n.id===id);if(!entry)throw Error(`Missing fixture node ${id}`);const file=path.join(root,entry.path),meta=parseYaml(fs.readFileSync(file,'utf8'));meta.state='done';meta.completion={inputDigest:entry.inputDigest,review:review()};write(entry.path,meta);}
  }
  return root;
}
