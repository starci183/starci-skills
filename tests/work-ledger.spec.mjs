import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseYaml} from '../core/yaml.mjs';
import {
  DECISION_KINDS,EXECUTABLE_KINDS,decisionCandidates,disjoint,executableCandidates,ledgerSummary,nodeRepository,
  buildSourceIdentity,checkAssertions,loadLedger,markDecided,markDone,markInProgress,markReopened,
  nodeFile,readNode,writeEvidence
} from '../execution/work-ledger.mjs';

const DIGEST='a'.repeat(64);
const HEAD='b'.repeat(40);

const ARCHITECTURE=`schema: work/node@2
id: demo.billing.architecture.sds.ledger
kind: architecture
required: true
state: done
description: "Ledger component map: the colon here, the # hash there and the trailing
  continuation line must all survive a kernel write."
refs:
  - demo.billing.business.srs.fr.invoice
assertions:
  - architecture-quality
completion:
  inputDigest: ${DIGEST}
  review:
    schema: starci/design-review@1
    reviewer: Root coordinator
    authority: User accepted the design in session 1
    reviewedAt: "2026-09-01T00:00:00.000Z"
    observations:
      - id: traceability
        outcome: pass
        observation: Every flow traces an SRS path.
    limitations: []
extensions:
  work3:
    sds:
      schema: starci/sds-overview@1
      id: SDS-LEDGER
`;

const READY=`schema: work/node@2
id: demo.billing.implementation.backend.ledger
kind: implementation
required: true
state: todo
dependsOn:
  - demo.billing.architecture.sds.ledger
description: Implement the ledger writer against the accepted SDS.
assertions:
  - implementation-quality
  - unit-tests-pass
implementation:
  status: mixed
  changes:
    - what: Write the ledger writer.
      why: The draft persists nothing.
      repository: demo-backend
      directory: .
      files:
        - src/ledger/writer.ts
        - src/ledger/writer.spec.ts
    - what: Register the writer.
      why: The module does not expose it.
      repository: demo-backend
      directory: .
      files:
        - src/ledger/ledger.module.ts
extensions:
  work3:
    checks:
      - assertion: unit-tests-pass
        command: "npm run test:unit -- src/ledger"
        scope: src/ledger
        note: The kernel re-runs this itself.
      - assertion: implementation-quality
        command: npx tsc --noEmit
gaps:
  - Nothing is persisted yet.
`;

const UNCHECKED=`schema: work/node@2
id: demo.billing.implementation.frontend.invoice
kind: implementation
required: true
state: todo
description: Render the invoice page.
implementation:
  status: mixed
  changes:
    - what: Render the page.
      why: The route is empty.
      repository: demo-frontend
      directory: .
      files:
        - app/invoice/page.tsx
`;

const NODES=[
  {id:'demo.billing.architecture.sds.ledger',path:'features/billing/architecture/sds/ledger/index.yaml',kind:'architecture',state:'done',eligible:false,inputDigest:DIGEST,dependsOn:[],refs:['demo.billing.business.srs.fr.invoice'],blockedBy:[],children:[],completion:{inputDigest:DIGEST}},
  {id:'demo.billing.implementation.backend.ledger',path:'features/billing/implementation/backend/ledger/index.yaml',kind:'implementation',state:'todo',eligible:true,inputDigest:'c'.repeat(64),dependsOn:['demo.billing.architecture.sds.ledger'],refs:[],blockedBy:[],children:[],completion:null},
  {id:'demo.billing.implementation.frontend.invoice',path:'features/billing/implementation/frontend/invoice/index.yaml',kind:'implementation',state:'todo',eligible:true,inputDigest:'d'.repeat(64),dependsOn:[],refs:[],blockedBy:[],children:[],completion:null},
  {id:'demo.payments.business.overview',path:'features/payments/business/overview/index.yaml',kind:'business-overview',state:'todo',eligible:true,inputDigest:'e'.repeat(64),dependsOn:[],refs:[],blockedBy:[],children:[],completion:null}
];

const OVERVIEW=`schema: work/node@2
id: demo.payments.business.overview
kind: business-overview
required: true
state: todo
description: What payments promises the customer.
`;

function fakeRepo(){
  const root=path.join(os.tmpdir(),'starci-work-ledger-spec',`${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const write=(relative,content)=>{
    const file=path.join(root,'.starciwork',relative);
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,content);
  };
  fs.mkdirSync(root,{recursive:true});
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({name:'@demo/backend'}));
  write(NODES[0].path,ARCHITECTURE);
  write(NODES[1].path,READY);
  write(NODES[2].path,UNCHECKED);
  write(NODES[3].path,OVERVIEW);
  return root;
}
const validate=()=>({ok:true,errors:[],warnings:[],nodes:NODES,resources:[]});
const open=root=>loadLedger({repoRoot:root,validate});
const cleanup=root=>fs.rmSync(root,{recursive:true,force:true}); // only this run's root: the parent is shared with parallel runs
const check={name:'unit',command:'npm run test:unit -- src/ledger',exitCode:0,assertion:'unit-tests-pass'};
const types={name:'types',command:'npx tsc --noEmit',exitCode:0,assertion:'implementation-quality'};
const FRESH='f'.repeat(64);
// The kernel block is part of the semantic digest, so a caller hands markDone the digest that the
// validator reports after the kernel block is written. The tests inject it instead of spawning one.
const bound={inputDigest:FRESH};

test('the ledger is the Work tree: candidates split by kind and a node without a scope is not schedulable',()=>{
  const root=fakeRepo();
  try{
    assert.deepEqual(DECISION_KINDS,['business','business-overview','architecture']);
    assert.deepEqual(EXECUTABLE_KINDS,['implementation','uat','operations','ui']);
    const ledger=open(root);
    assert.equal(ledger.ok,true);
    assert.equal(ledger.nodes.get('demo.billing.implementation.backend.ledger').kind,'implementation');
    assert.equal(nodeFile(root,NODES[1]),path.join(root,'.starciwork',NODES[1].path.replaceAll('/',path.sep)));
    assert.equal(readNode(root,NODES[1]).implementation.status,'mixed');

    const candidates=executableCandidates(ledger);
    assert.deepEqual(candidates.map(node=>node.id),['demo.billing.implementation.backend.ledger','demo.billing.implementation.frontend.invoice']);
    const [ready,unchecked]=candidates;
    assert.equal(ready.schedulable,true);
    assert.equal(ready.reason,null);
    assert.deepEqual(ready.allowlist,['src/ledger/writer.ts','src/ledger/writer.spec.ts','src/ledger/ledger.module.ts']);
    assert.deepEqual(ready.checks.map(item=>item.command),['npm run test:unit -- src/ledger','npx tsc --noEmit']);
    assert.deepEqual(ready.checks[0],{assertion:'unit-tests-pass',command:'npm run test:unit -- src/ledger',scope:'src/ledger',note:'The kernel re-runs this itself.'});
    assert.equal(ready.checks[1].scope,null);
    assert.deepEqual(ready.assertions,['implementation-quality','unit-tests-pass']);
    assert.equal(unchecked.schedulable,false);
    assert.match(unchecked.reason,/extensions\.work3\.checks/);
    assert.deepEqual(unchecked.allowlist,['app/invoice/page.tsx']);

    assert.deepEqual(decisionCandidates(ledger).map(node=>node.id),['demo.payments.business.overview']);
    assert.deepEqual(executableCandidates(ledger,{scope:'payments'}),[]);
    assert.deepEqual(executableCandidates(ledger,{scope:['billing']}).length,2);
    assert.deepEqual(decisionCandidates(ledger,{scope:'billing'}),[]);

    const summary=ledgerSummary(ledger);
    assert.equal(summary.total,4);
    assert.equal(summary.eligible,3);
    assert.deepEqual(summary.states,{done:1,todo:3});
    assert.deepEqual(summary.kinds.implementation,{total:2,eligible:2,states:{todo:2}});
    assert.deepEqual(summary.executableEligible,['demo.billing.implementation.backend.ledger','demo.billing.implementation.frontend.invoice']);
    assert.deepEqual(summary.decisionEligible,['demo.payments.business.overview']);
    assert.deepEqual(ledgerSummary(ledger,{scope:'payments'}).executableEligible,[]);
  }finally{cleanup(root);}
});

test('disjoint uses path-prefix semantics and treats a glob as its literal directory',()=>{
  assert.equal(disjoint(['src/a.ts'],['src/b.ts']),true);
  assert.equal(disjoint(['src/a.ts'],['src/a.ts']),false);
  assert.equal(disjoint(['src/ledger'],['src/ledger/writer.ts']),false);
  assert.equal(disjoint(['src/ledger/**'],['src/ledger/writer.ts']),false);
  assert.equal(disjoint(['src/ledger/**'],['src/billing/writer.ts']),true);
  assert.equal(disjoint(['src/ledger/*.ts'],['src/ledger/x/y.ts']),false);
  assert.equal(disjoint(['src/ledger.ts'],['src/ledgering.ts']),true);
  assert.equal(disjoint(['./src/a.ts'],['src\\a.ts']),false);
  assert.equal(disjoint(['**/*.ts'],['src/a.ts']),true,'a repository-wide glob collapses to no prefix and guards nothing');
  assert.equal(disjoint([],['src/a.ts']),true);
});

test('markDone writes state, completion and the kernel block and nothing else changes byte for byte',()=>{
  const root=fakeRepo();
  try{
    const file=nodeFile(root,NODES[1]);
    const before=fs.readFileSync(file,'utf8');
    const started=markInProgress(root,NODES[1],{opId:'op-ledger-1',dispatch:'ctx_7',startedAt:'2026-09-12T10:00:00.000Z'});
    assert.equal(started.file,file);
    const doing=parseYaml(fs.readFileSync(file,'utf8'));
    assert.equal(doing.state,'todo','work v2 authors only uninvestigate, todo and done: in-flight lives in the kernel block');
    assert.deepEqual(doing.extensions.work3.kernel,{opId:'op-ledger-1',dispatch:'ctx_7',at:'2026-09-12T10:00:00.000Z'});
    assert.equal(doing.extensions.work3.checks.length,2,'the authored checks survive beside the kernel block');

    assert.throws(()=>markDone(root,NODES[1],{...bound,opId:'op-ledger-1',head:HEAD,checks:[check]}),/no passing check proves implementation-quality/);
    assert.deepEqual(checkAssertions([check,types,{name:'e2e',command:'x',exitCode:1}]),['unit-tests-pass','implementation-quality']);
    markDone(root,NODES[1],{...bound,opId:'op-ledger-1',head:HEAD,checks:[check,types],verifiedBy:'kernel@run-1',at:'2026-09-12T10:30:00.000Z'});
    const after=fs.readFileSync(file,'utf8');
    const done=parseYaml(after);
    assert.equal(done.state,'done');
    assert.deepEqual(done.completion,{inputDigest:FRESH,evidence:['op-ledger-1-evidence'],codeRefs:[{repository:'demo-backend',commit:HEAD}]});
    assert.deepEqual(done.extensions.work3.kernel,{opId:'op-ledger-1',dispatch:'ctx_7',head:HEAD,checks:[{...check},{...types}],verifiedBy:'kernel@run-1',at:'2026-09-12T10:30:00.000Z'});

    // Every authored line outside state / completion / extensions is unchanged, byte for byte.
    const untouched = source => source.slice(source.indexOf('dependsOn:'),source.indexOf('extensions:'));
    assert.equal(untouched(after),untouched(before));
    assert.ok(after.includes(before.slice(before.indexOf('gaps:'))),'the authored tail survives and the new block is appended after it');
    assert.equal(after.slice(0,after.indexOf('state:')),before.slice(0,before.indexOf('state:')));
    assert.equal(after.includes('        command: "npm run test:unit -- src/ledger"'),true,'the authored check block keeps its own quoting');
    assert.deepEqual(readNode(root,NODES[1]).implementation,parseYaml(before).implementation);

    // Reopening returns the node to todo, keeps the stored proof and appends to the kernel history.
    markReopened(root,NODES[1],{reason:'The SDS moved under it.',by:'coordinator',at:'2026-09-12T11:00:00.000Z'});
    const reopened=parseYaml(fs.readFileSync(file,'utf8'));
    assert.equal(reopened.state,'todo');
    assert.deepEqual(reopened.completion,done.completion,'reopen never rewrites the historical receipt');
    assert.deepEqual(reopened.extensions.work3.kernel.reopened,[{reason:'The SDS moved under it.',by:'coordinator',at:'2026-09-12T11:00:00.000Z'}]);
    markReopened(root,NODES[1],{reason:'And again.',by:'coordinator',at:'2026-09-12T12:00:00.000Z'});
    assert.equal(parseYaml(fs.readFileSync(file,'utf8')).extensions.work3.kernel.reopened.length,2);
    assert.equal(fs.readFileSync(file,'utf8').slice(0,fs.readFileSync(file,'utf8').indexOf('state:')),before.slice(0,before.indexOf('state:')));
  }finally{cleanup(root);}
});

test('a node with no completion and no extensions gains both blocks, and a decision is settled by review',()=>{
  const root=fakeRepo();
  try{
    const file=nodeFile(root,NODES[3]);
    const before=fs.readFileSync(file,'utf8');
    markDecided(root,NODES[3],{...bound,rev:'r2',by:'root-coordinator',at:'2026-09-12T09:00:00.000Z',review:{
      reviewer:'Root coordinator',authority:'User accepted the overview in session 2',
      observations:[{id:'promise-clear',outcome:'pass',observation:'The promise is stated in one page.'}],
      limitations:['No pricing decision yet.']
    }});
    const decided=parseYaml(fs.readFileSync(file,'utf8'));
    assert.equal(decided.state,'done');
    assert.equal(decided.completion.inputDigest,FRESH);
    assert.equal(decided.completion.review.schema,'starci/design-review@1');
    assert.deepEqual(decided.completion.review.observations,[{id:'promise-clear',outcome:'pass',observation:'The promise is stated in one page.'}]);
    assert.deepEqual(decided.completion.review.limitations,['No pricing decision yet.']);
    assert.equal(decided.completion.evidence,undefined,'a review completion never also claims execution evidence');
    assert.deepEqual(decided.extensions.work3.kernel,{rev:'r2',verifiedBy:'root-coordinator',at:'2026-09-12T09:00:00.000Z'});
    assert.equal(fs.readFileSync(file,'utf8').startsWith(before.slice(0,before.indexOf('state:'))),true);
    assert.equal(parseYaml(fs.readFileSync(file,'utf8')).description,parseYaml(before).description);
    assert.throws(()=>markDecided(root,NODES[3],{...bound,review:{observations:[]}}),/at least one observation/);

    // An existing completion/review block is replaced exactly, not duplicated.
    const architecture=nodeFile(root,NODES[0]);
    assert.throws(()=>markDecided(root,NODES[0],{...bound,review:{observations:[{id:'invented',observation:'x'}]}}),/not an authored assertion/);
    markDone(root,NODES[0],{...bound,opId:'op-arch',head:HEAD,checks:[check],assertions:['architecture-quality'],at:'2026-09-12T09:30:00.000Z'});
    const rewritten=fs.readFileSync(architecture,'utf8');
    assert.equal(rewritten.match(/^completion:/gm).length,1);
    assert.equal(rewritten.match(/^extensions:/gm).length,1);
    const rebound=parseYaml(rewritten);
    assert.equal(rebound.completion.review,undefined);
    assert.deepEqual(rebound.completion.evidence,['op-arch-evidence']);
    assert.equal(rebound.extensions.work3.sds.id,'SDS-LEDGER','the authored sds payload survives beside the kernel block');
    assert.equal(rebound.description,parseYaml(ARCHITECTURE).description);
    assert.deepEqual(rebound.refs,['demo.billing.business.srs.fr.invoice']);
  }finally{cleanup(root);}
});

test('a write that does not round-trip restores the original bytes and throws',()=>{
  const root=fakeRepo();
  try{
    const file=nodeFile(root,NODES[1]);
    const before=fs.readFileSync(file);
    assert.throws(()=>markDone(root,NODES[1],{...bound,opId:'op-x',head:HEAD,checks:[check,types],parse:()=>({state:'todo'})}),/restored the original/);
    assert.deepEqual(fs.readFileSync(file),before);
    assert.throws(()=>markInProgress(root,NODES[1],{opId:'op-x',parse:()=>{throw Error('unparseable');}}),/restored the original: unparseable/);
    assert.deepEqual(fs.readFileSync(file),before);
    // The kernel block is written first; a failure while binding completion unwinds that write too.
    assert.throws(()=>markDone(root,NODES[1],{opId:'op-x',head:HEAD,checks:[check,types],digest:()=>{throw Error('no digest yet');}}),/no digest yet/);
    assert.deepEqual(fs.readFileSync(file),before);
    assert.throws(()=>markDone(root,NODES[1],{opId:'op-x',head:HEAD,checks:[check,types],digest:()=>'not-a-digest'}),/no sha-256/);
    assert.deepEqual(fs.readFileSync(file),before);
    assert.throws(()=>markDone(root,NODES[1],{...bound,opId:'op-x',checks:[]}),/at least one check/);
    assert.throws(()=>markDone(root,NODES[1],{...bound,opId:'op-x',checks:[{...check,exitCode:1}]}),/failing check/);
    assert.deepEqual(fs.readFileSync(file),before);
  }finally{cleanup(root);}
});

test('the evidence manifest is a work/evidence@1 record under the node it proves',()=>{
  const root=fakeRepo();
  try{
    const written=writeEvidence(root,NODES[1],{
      ...bound,opId:'op-ledger-1',head:HEAD,checks:[check,types],
      capturedAt:'2026-09-12T10:30:00.000Z',environment:'worktree-local'
    });
    assert.equal(written,path.join(path.dirname(nodeFile(root,NODES[1])),'evidence','op-ledger-1-evidence','manifest.yaml'));
    const manifest=parseYaml(fs.readFileSync(written,'utf8'));
    assert.equal(manifest.schema,'work/evidence@1');
    assert.equal(manifest.id,'op-ledger-1-evidence');
    assert.equal(manifest.nodeId,'demo.billing.implementation.backend.ledger');
    assert.equal(manifest.inputDigest,FRESH);
    assert.equal(manifest.bindings,undefined,'nodeId plus inputDigest already bind the primary node; repeating it is a duplicate binding');
    assert.equal(manifest.outcome,'pass');
    assert.deepEqual(manifest.assertions,[
      {id:'unit-tests-pass',outcome:'pass',observation:'npm run test:unit -- src/ledger exited 0'},
      {id:'implementation-quality',outcome:'pass',observation:'npx tsc --noEmit exited 0'}
    ],'an evidence assertion is the authored assertion its check declares, which is what completion must cover');
    assert.deepEqual(manifest.assets,[]);
    assert.deepEqual(manifest.codeRefs,[{repository:'demo-backend',commit:HEAD}]);
    assert.equal(manifest.provenance.actor,'starci-kernel');
    assert.equal(manifest.provenance.capturedAt,'2026-09-12T10:30:00.000Z');
    assert.deepEqual(manifest.provenance.servedVersions,[{repository:'demo-backend',commit:HEAD,artifact:'worktree'}]);
    assert.equal(manifest.extensions.work3.kernel.checks.length,2);

    // The id markDone lists in completion.evidence is the evidence folder name.
    markDone(root,NODES[1],{...bound,opId:'op-ledger-1',head:HEAD,checks:[check,types]});
    assert.deepEqual(parseYaml(fs.readFileSync(nodeFile(root,NODES[1]),'utf8')).completion.evidence,[path.basename(path.dirname(written))]);

    const failing=writeEvidence(root,NODES[2],{...bound,opId:'op frontend/1',checks:[{name:'unit',command:'npm test',exitCode:1}]});
    const second=parseYaml(fs.readFileSync(failing,'utf8'));
    assert.equal(second.id,'op-frontend-1-evidence','an operation id is sanitized into a valid Work id');
    assert.equal(second.outcome,'fail');
    assert.deepEqual(second.codeRefs,undefined);
    assert.equal(second.provenance.servedVersions[0].commit,'0'.repeat(40));
  }finally{cleanup(root);}
});

test('an implementation node may bind direct source identity instead of legacy code refs',()=>{
  const root=fakeRepo();
  try{
    const identity=buildSourceIdentity({repository:'demo-backend',origin:'https://github.com/demo/demo-backend.git',commit:HEAD,paths:['src/ledger/writer.ts']});
    assert.equal(identity.schema,'starci/source-identity@1');
    assert.deepEqual(identity.repositories[0].coverage.paths,['src/ledger/writer.ts']);
    assert.equal(identity.repositories[0].state,'committed');
    markDone(root,NODES[1],{...bound,opId:'op-1',head:HEAD,checks:[check,types],sourceIdentity:identity});
    const done=parseYaml(fs.readFileSync(nodeFile(root,NODES[1]),'utf8'));
    assert.equal(done.completion.codeRefs,undefined,'direct identity and legacy code refs are never mixed');
    assert.deepEqual(done.completion.sourceIdentity,identity);
    assert.throws(()=>buildSourceIdentity({repository:'demo-backend',origin:'https://x/y',commit:'nope'}),/full commit sha/);
  }finally{cleanup(root);}
});

test('markDone can write its evidence inside the same transaction, against the settled digest',()=>{
  const root=fakeRepo();
  try{
    const receipt=markDone(root,NODES[1],{...bound,opId:'op-9',head:HEAD,checks:[check,types],evidence:{environment:'worktree-local'}});
    const manifest=parseYaml(fs.readFileSync(receipt.evidence,'utf8'));
    assert.equal(manifest.inputDigest,FRESH,'the manifest binds the same digest the completion binds');
    assert.deepEqual(parseYaml(fs.readFileSync(nodeFile(root,NODES[1]),'utf8')).completion.evidence,[manifest.id]);
    assert.equal(manifest.provenance.environment,'worktree-local');

    // A failure after the manifest is written removes the folder this call created.
    const file=nodeFile(root,NODES[2]);
    const before=fs.readFileSync(file);
    const folder=path.join(path.dirname(file),'evidence','op-10');
    assert.throws(()=>markDone(root,NODES[2],{...bound,opId:'op-10',head:HEAD,checks:[check,types],evidence:true,parse:source=>{const value=parseYaml(source);return value.completion?{...value,state:'todo'}:value;}}),/restored the original/);
    assert.equal(fs.existsSync(folder),false);
    assert.deepEqual(fs.readFileSync(file),before);
  }finally{cleanup(root);}
});

test('a node another repository delivers is never a candidate for this repository, and stays one when no repository is asked',()=>{
  const root=fakeRepo();
  try{
    const file=nodeFile(root,NODES[2]);
    fs.writeFileSync(file,fs.readFileSync(file,'utf8')+'extensions:\n  work3:\n    scope:\n      repository: demo-frontend\n      note: delivered by the frontend workflow\n');
    const ledger=open(root);
    assert.equal(nodeRepository(readNode(root,NODES[2])),'demo-frontend');
    assert.equal(nodeRepository(readNode(root,NODES[1])),null);
    assert.deepEqual(executableCandidates(ledger).map(node=>[node.id,node.repository]),[['demo.billing.implementation.backend.ledger',null],['demo.billing.implementation.frontend.invoice','demo-frontend']]);
    assert.deepEqual(executableCandidates(ledger,{repository:'demo-backend'}).map(node=>node.id),['demo.billing.implementation.backend.ledger']);
    assert.deepEqual(executableCandidates(ledger,{repository:'demo-frontend'}).map(node=>node.id),['demo.billing.implementation.backend.ledger','demo.billing.implementation.frontend.invoice'],'a node naming no repository belongs to every job');
  }finally{cleanup(root);}
});
