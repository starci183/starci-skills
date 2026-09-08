// Disposable lifecycle fixtures: actual source binding; no product or reasoning-quality claim.
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const sha=value=>'sha256:'+createHash('sha256').update(value).digest('hex');
export function observeCheckoutFixture(files,head){
 const evidence=`.gitignore@${head}`;
 files['response/data/current-state.json']={observedHead:head,fingerprint:sha(head),components:[{componentId:'fixture-exclusions',layer:'build',name:'Disposable fixture exclusions',version:'unversioned',evidence}],boundaries:[{boundaryId:'fixture',responsibility:'Text source fixture; proposed worker is not implemented yet',stores:[],evidence:`src/model.txt@${head}`}]};
 files['response/data/stack-model.json'].components=[{componentId:'fixture-exclusions',status:'existing',justification:'observed-evidence',evidence,compatibility:['runtime-version','deployable-unit','communication-failure','datastore-ownership','backup-restore'].map(axis=>({axis,verified:true,evidence}))}];
 files['response/response.md']=files['response/response.md'].replace(/## Current state[\s\S]*?(?=## Alternatives)/,`## Current state\n\n| Boundary | Responsibility | Stores | Evidence |\n| --- | --- | --- | --- |\n| fixture | Text source fixture; future worker is proposed | — | src/model.txt@${head} |\n\n`).replace(/## Stack delta[\s\S]*?(?=## Operations)/,`## Stack delta\n\n| Component | Status | Justification | Evidence | Compatibility |\n| --- | --- | --- | --- | --- |\n| fixture-exclusions | existing | observed-evidence | ${evidence} | 5/5 fixture-only observations |\n\n`);
}
export async function prepareFixtureSource(root,branch,request){
 const{collectArchitectureSource}=await import(pathToFileURL(path.join(root,'scripts/architecture-source-review.mjs')));
 const snapshot=await collectArchitectureSource(root,branch),bytes=JSON.stringify(snapshot,null,2)+'\n';
 writeFileSync(path.join(branch,'request/source-review.json'),bytes);
 request.frozenInputs=[{ref:'request/source-review.json',sha256:sha(bytes)}];
 request.contexts=[{alias:snapshot.alias,head:snapshot.head}];request.environment.reads=[snapshot.alias];
 writeFileSync(path.join(branch,'request/request.json'),JSON.stringify(request));
 return snapshot;
}
export function fixtureSourceCritique(branch,critique){
 const bytes=readFileSync(path.join(branch,'request/source-review.json')),snapshot=JSON.parse(bytes);
 return critique.replace('\n\n## Attacks',`\n| Source snapshot | ${sha(bytes)} |\n| Independent alternative | Per-feature ownership changes the proposed failure and restore boundaries. |\n| Trade-offs | Compare cost, complexity and reversibility; this lifecycle fixture does not prove a product decision. |\n| Uncertainty | Runtime and recovery behavior remain unmeasured by this fixture. |\n\n## Attacks`).replace(/(\| (?:partial-failure|retry-idempotency|concurrency|stale-state|deletion|recovery|dependency-outage|rollback) \| )/g,`$1[source:${snapshot.files[0].path}] `);
}
