import fs from 'node:fs';
import path from 'node:path';
import {stringifyYaml,parseYaml} from '../core/yaml.mjs';
import {validateWorkspace} from '../core/index.mjs';
import {documentSRSV3} from './srs-v3.mjs';
import {documentSDSV4,documentSDSV4Overview} from './sds-v4.mjs';

const review=()=>({schema:'starci/design-review@1',reviewer:'Synthetic fixture reviewer',authority:'Synthetic runtime regression authority only.',reviewedAt:'2026-09-10T00:00:00Z',observations:[{id:'contract-reviewed',outcome:'pass',observation:'The synthetic specification is complete enough to exercise runtime bindings; no product or code acceptance is claimed.'}],limitations:['All code units and verification tests are planned and were not executed.']});
const node=(id,kind,description,extra={})=>({schema:'work/node@2',id,kind,required:true,description,...extra});

export function writeSrsSdsWorkspace(root,{complete=true}={}){
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
    ['module/business/srs/customer-journeys/index.yaml','srs-journeys','Customer journey aggregate.','business'],
    ['module/architecture/index.yaml','module.architecture','Synthetic Architecture aggregate.','architecture'],
    ['module/architecture/sds/index.yaml','module.architecture.sds','Synthetic flow-led SDS aggregate.','architecture'],
    ['module/architecture/sds/flows/index.yaml','sds-flows','SDS flow aggregate.','architecture'],
    ['module/architecture/sds/code-map/index.yaml','sds-code','SDS code map aggregate.','architecture'],
    ['module/architecture/sds/code-map/frontend/index.yaml','sds-code-frontend','Frontend code aggregate.','architecture'],
    ['module/architecture/sds/code-map/backend/index.yaml','sds-code-backend','Backend code aggregate.','architecture'],
    ['module/architecture/sds/code-map/shared/index.yaml','sds-code-shared','Shared code aggregate.','architecture'],
    ['module/architecture/sds/contracts/index.yaml','sds-contracts','Contract aggregate.','architecture'],
    ['module/architecture/sds/data/index.yaml','sds-data','Architecture data aggregate.','architecture'],
    ['module/architecture/sds/quality/index.yaml','sds-quality','Quality aggregate.','architecture'],
    ['module/architecture/sds/quality/reliability/index.yaml','sds-quality-reliability','Reliability aggregate.','architecture'],
    ['module/architecture/sds/deployment/index.yaml','sds-deployments','Deployment aggregate.','architecture'],
    ['module/architecture/sds/decisions/index.yaml','sds-decisions','Decision aggregate.','architecture'],
    ['module/architecture/sds/verification/index.yaml','sds-verifications','Verification aggregate.','architecture']
  ];
  for(const [file,id,description,kind] of aggregates)write(file,node(id,kind,description,file==='module/architecture/index.yaml'?{refs:['module.business']}:{}));
  write('module/business/overview/index.yaml',node('business-overview','business-overview','Synthetic accepted intent and scope overview.',{state:'todo',assertions:['contract-reviewed'],businessOverview:{purpose:'Exercise a complete synthetic SRS and SDS workspace.',customerUnderstanding:'An operator receives one scoped recipient result.',desiredOutcome:'Every business and design item has one typed owner and reviewable linkage.',scope:'Synthetic runtime validation only.',openQuestions:'None for the fixture; no product decision is asserted.'}}));
  const srs=documentSRSV3();
  const srsLeaves=[
    ['module/business/srs/functional-requirements/command/index.yaml','srs-fr-command',srs.fr],
    ['module/business/srs/non-functional-requirements/reliability/index.yaml','srs-nfr-command',srs.nfr],
    ['module/business/srs/business-rules/recipient-scope/index.yaml','srs-br-scope',srs.businessRule],
    ['module/business/srs/data/command-request/index.yaml','srs-data-request',srs.data],
    ['module/business/srs/customer-journeys/operator-result/index.yaml','srs-journey-command',srs.journey]
  ];
  const sds=documentSDSV4();
  const overview=documentSDSV4Overview();
  const sdsLeaves=[
    ['module/architecture/overview/index.yaml','sds-overview',overview],
    ['module/architecture/sds/flows/command/index.yaml','sds-flow-command',sds.flow],
    ['module/architecture/sds/code-map/frontend/command-page/index.yaml','sds-code-page',sds.units[0]],
    ['module/architecture/sds/code-map/shared/router/index.yaml','sds-code-router',sds.units[1]],
    ['module/architecture/sds/code-map/backend/recipient/index.yaml','sds-code-recipient',sds.units[2]],
    ['module/architecture/sds/contracts/command/index.yaml','sds-contract-command',sds.contract],
    ['module/architecture/sds/data/receipt/index.yaml','sds-data-receipt',sds.data],
    ['module/architecture/sds/quality/reliability/idempotency/index.yaml','sds-quality-idempotency',sds.quality],
    ['module/architecture/sds/deployment/monolith/index.yaml','sds-deployment-monolith',sds.deployment],
    ['module/architecture/sds/decisions/named-command/index.yaml','sds-decision-command',sds.decision],
    ['module/architecture/sds/verification/command/index.yaml','sds-verification-command',sds.verification]
  ];
  for(const [file,id,spec] of [...srsLeaves,...sdsLeaves])write(file,node(id,spec.op==='business.decide'?'business':'architecture','Synthetic authored specification leaf.',{state:'todo',assertions:['contract-reviewed'],extensions:{work3:{specification:spec}}}));
  if(complete){
    for(const [,id,spec] of [...srsLeaves,...sdsLeaves]){spec.status='pass';if(spec.content.source)spec.content.source.acceptance='accepted';if(spec.nodeType==='non-functional-requirement')spec.content.target={status:'decided',value:'The same request remains queryable until a definitive outcome is shown.',decisionOwner:'Synthetic fixture reviewer',missingDecision:'Not applicable; accepted for the synthetic fixture.'};if(spec.nodeType==='quality')spec.content.target={status:'decided',value:'Exactly one recipient effect per stable request.',decisionOwner:'Synthetic fixture reviewer',missingDecision:'Not applicable; accepted for the synthetic fixture.'};if(spec.nodeType==='decision')spec.content.status='accepted';}
    for(const [file,,spec] of [...srsLeaves,...sdsLeaves]){const meta=parseYaml(fs.readFileSync(path.join(root,file),'utf8'));meta.extensions.work3.specification=spec;write(file,meta);}
    const ids=['business-overview',...srsLeaves.map(x=>x[1]),...sdsLeaves.map(x=>x[1])];
    for(const id of ids){const current=validateWorkspace(root),entry=current.nodes.find(n=>n.id===id);if(!entry)throw Error(`Missing fixture node ${id}`);const file=path.join(root,entry.path),meta=parseYaml(fs.readFileSync(file,'utf8'));meta.state='done';meta.completion={inputDigest:entry.inputDigest,review:review()};write(entry.path,meta);}
  }
  return root;
}
