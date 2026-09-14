import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseYaml} from '../core/yaml.mjs';
import {validateWorkspace} from '../core/index.mjs';
import {nodeAllowlist} from '../kernel/ledger.mjs';
import {
  DECISION_KINDS,EXECUTABLE_KINDS,decisionCandidates,disjoint,executableCandidates,layoutOf,layoutSide,ledgerSummary,nodeRepository,
  brandReferences,buildSourceIdentity,checkAssertions,loadLedger,markDecided,markDone,markInProgress,markReopened,
  nodeFile,readNode,writeEvidence,
  contractDigestOf,declaredIntegrations,integrationIdOf,integrationNodes,integrationProofStatus,missingIntegrationNodes,
  readLedgerTree,staleProofs
} from '../kernel/ledger.mjs';

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
    assert.deepEqual(DECISION_KINDS,['business','business-overview','architecture','brand']);
    assert.deepEqual(EXECUTABLE_KINDS,['implementation','uat','e2e','operations','ui','integration']);
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

test('a node that names no repository belongs to the side of the product its layout sits in',()=>{
  const root=fakeRepo();
  try{
    const ledger=open(root);
    assert.equal(layoutOf(NODES[1]),'implementation/backend/ledger');
    assert.equal(layoutOf(NODES[2]),'implementation/frontend/invoice');
    assert.equal(layoutOf(NODES[0]),'architecture/sds/ledger');
    assert.equal(layoutOf('features/billing/uat/checkout/index.yaml'),'uat/checkout');
    assert.equal(layoutOf('business/index.yaml'),'business','a node outside features/<feature>/ keeps its own directory path');
    assert.deepEqual([layoutSide(NODES[1]),layoutSide(NODES[2]),layoutSide(NODES[0]),layoutSide(NODES[3])],['backend','frontend',null,null]);
    // Neither side picks up the other's implementation leaf, and a layout with no side belongs to both.
    assert.deepEqual(executableCandidates(ledger,{side:'backend'}).map(node=>node.id),['demo.billing.implementation.backend.ledger']);
    assert.deepEqual(executableCandidates(ledger,{side:'frontend'}).map(node=>node.id),['demo.billing.implementation.frontend.invoice']);
    assert.deepEqual(executableCandidates(ledger,{side:'frontend'}).map(node=>[node.layout,node.side]),[['implementation/frontend/invoice','frontend']]);
    // A declared repository is the stronger statement: it decides on its own, whatever side asks. Here the
    // frontend-layout node says the backend delivers it, so the backend job takes both and the frontend none.
    const file=nodeFile(root,NODES[2]);
    fs.writeFileSync(file,`${fs.readFileSync(file,'utf8')}extensions:\n  work3:\n    scope:\n      repository: demo-backend\n`);
    const mixed=open(root);
    assert.deepEqual(executableCandidates(mixed,{repository:'demo-backend',side:'backend'}).map(node=>node.id),
      ['demo.billing.implementation.backend.ledger','demo.billing.implementation.frontend.invoice']);
    assert.deepEqual(executableCandidates(mixed,{repository:'demo-frontend',side:'frontend'}).map(node=>node.id),[]);
    assert.throws(()=>executableCandidates(ledger,{side:'middle'}),/A layout side is frontend or backend/);
  }finally{cleanup(root);}
});

test('a kind without a code profile binds no source at all: neither a source identity nor code refs, on the node or its evidence',()=>{
  const root=fakeRepo();
  try{
    const identity=buildSourceIdentity({repository:'demo-backend',origin:'https://github.com/demo/demo-backend.git',commit:HEAD,paths:['src/ledger/writer.ts']});
    const receipt=markDone(root,NODES[1],{...bound,opId:'op-ops',head:HEAD,checks:[check,types],sourceIdentity:identity,bindSource:false,evidence:{environment:'local'}});
    const done=parseYaml(fs.readFileSync(nodeFile(root,NODES[1]),'utf8'));
    assert.equal(done.completion.sourceIdentity,undefined);
    assert.equal(done.completion.codeRefs,undefined);
    const manifest=parseYaml(fs.readFileSync(receipt.evidence,'utf8'));
    assert.equal(manifest.sourceIdentity,undefined);
    assert.equal(manifest.codeRefs,undefined);
    assert.equal(manifest.provenance.servedVersions[0].commit,HEAD,'provenance still names what ran');
  }finally{cleanup(root);}
});

test('a source identity keeps only normalized source paths: no trailing slash, no ledger record, no empty segment',()=>{
  const identity=buildSourceIdentity({repository:'demo-backend',origin:'https://github.com/demo/demo-backend.git',commit:HEAD,
    paths:['src/a.ts','.starciwork/features/x/index.yaml','src/dir/','src/./b.ts','', '.starciwork/features/x/evidence/','src/c.ts']});
  assert.deepEqual(identity.repositories[0].coverage.paths,['src/a.ts','src/dir','src/c.ts']);
});

// --------------------------------------------------------------------------- the product brand
// The brand is a decision the kernel reads, decides and attaches: one record at the tree root plus the
// masters beside it. Synthetic fixture values only.
const BRAND_NODE={id:'product.brand',path:'brand/index.yaml',kind:'brand',state:'todo',eligible:true,inputDigest:'1'.repeat(64),dependsOn:[],refs:[],blockedBy:[],children:[],completion:null,brand:null};
const BRAND=`schema: work/node@2
id: product.brand
kind: brand
required: true
state: todo
assertions:
  - brand-tokens-match-source
assets:
  - path: assets/mascot/rest.png
    description: Mascot master at rest.
brand:
  rev: "2"
  identity:
    name: Example Product
    family: starci
    owner: Product owner
  color:
    tokens:
      - token: --example-core-primary
        value: "#c0203c"
        role: primary
    policy:
      dangerMayMatchPrimary: true
  typography:
    family: Example Sans, system-ui, sans-serif
  iconography:
    set:
      - "@example/icons"
  imagery:
    style:
      - Warm studio light.
  forbidden:
    - Never recolour the mascot.
  sources:
    - repository: example-frontend
      path: src/app/globals.css
      kind: css
`;

function brandRepo(){
  const root=fakeRepo();
  const write=(relative,content)=>{
    const file=path.join(root,'.starciwork',relative);
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,content);
  };
  write('brand/index.yaml',BRAND);
  write('brand/assets/mascot/rest.png','synthetic-mascot-bytes');
  write('brand/assets/logo/mark.svg','<svg role="img"></svg>');
  return root;
}
const brandValidate=()=>({ok:true,errors:[],warnings:[],nodes:[...NODES,BRAND_NODE],resources:[],brand:{id:'product.brand',path:'brand/index.yaml',rev:'2',digest:'1'.repeat(64),state:'todo',effectiveState:'todo',boundNodes:['demo.billing.implementation.frontend.invoice']}});

test('the brand is a decision the ledger exposes, lists and can attach as references',()=>{
  const root=brandRepo();
  try{
    assert.ok(DECISION_KINDS.includes('brand'));
    const ledger=loadLedger({repoRoot:root,validate:brandValidate});
    assert.equal(ledger.brand.node.id,'product.brand');
    assert.equal(ledger.brand.rev,'2');
    assert.equal(ledger.brand.file,path.join(root,'.starciwork','brand','index.yaml'));
    assert.equal(ledger.brand.spec.identity.family,'starci');
    assert.equal(ledger.brand.spec.color.tokens[0].token,'--example-core-primary');

    assert.deepEqual(brandReferences(ledger),[
      path.join(root,'.starciwork','brand','index.yaml'),
      path.join(root,'.starciwork','brand','assets','logo','mark.svg'),
      path.join(root,'.starciwork','brand','assets','mascot','rest.png')
    ]);

    assert.deepEqual(decisionCandidates(ledger).map(node=>node.id),['demo.payments.business.overview','product.brand']);
    assert.ok(ledgerSummary(ledger).decisionEligible.includes('product.brand'));
    assert.deepEqual(decisionCandidates(ledger,{scope:'brand'}).map(node=>node.id),['product.brand']);
  }finally{cleanup(root);}
});

test('markDecided settles the brand through a review that records the rev it decided',()=>{
  const root=brandRepo();
  try{
    const file=nodeFile(root,BRAND_NODE);
    markDecided(root,BRAND_NODE,{
      rev:'2',
      review:{reviewer:'Product owner',authority:'Synthetic fixture authority; no real review is claimed',
        observations:[{id:'brand-tokens-match-source',observation:'Every declared token equals the value in the named source file.'}]},
      inputDigest:FRESH
    });
    const parsed=parseYaml(fs.readFileSync(file,'utf8'));
    assert.equal(parsed.state,'done');
    assert.equal(parsed.completion.inputDigest,FRESH);
    assert.equal(parsed.completion.review.schema,'starci/design-review@1');
    assert.deepEqual(parsed.completion.review.observations,[{id:'brand-tokens-match-source',outcome:'pass',observation:'Every declared token equals the value in the named source file.'}]);
    assert.equal(parsed.extensions.work3.kernel.rev,'2');
    // Every authored line of the record survives the write.
    assert.equal(parsed.brand.rev,'2');
    assert.equal(parsed.brand.sources[0].path,'src/app/globals.css');
    assert.throws(()=>markDecided(root,BRAND_NODE,{rev:'3',review:{reviewer:'x',authority:'y',observations:[{id:'invented',observation:'Not an authored assertion.'}]},inputDigest:FRESH}),/invented/);
  }finally{cleanup(root);}
});

// ----------------------------------------------------------------- external integrations
// An integration is a record, its node is required, every proof says what it proved against, and a proof
// remembers the rules it was taken under. Synthetic fixture values only: no real endpoint, no real secret.

const DELIVERY=`schema: work/node@2
id: demo.sales.business.srs.fr.delivery
kind: business
required: true
state: done
description: An order is delivered to the customer's own chat channel.
extensions:
  work3:
    integrations:
      - id: telegram
        provider: telegram-bot-api
        credential:
          name: TELEGRAM_BOT_TOKEN
          providedBy: owner
          custody: identity:telegram-delivery
        sandbox: https://sandbox.invalid/telegram
      - id: zalo
        provider: zalo-oa-api
        credential:
          providedBy: owner
      - id: viber
        provider: viber-bot-api
        credential:
          name: VIBER_TOKEN
          providedBy: vendor
          where: the workflow environment
      - provider: nameless-api
        credential:
          name: NAMELESS_TOKEN
          providedBy: owner
`;
const TELEGRAM=`schema: work/node@2
id: demo.sales.integration.telegram
kind: integration
required: true
state: todo
description: Prove the Telegram delivery against the provider's own sandbox.
assertions:
  - telegram-live
extensions:
  work3:
    allowlist:
      - src/tests/integration/telegram.live-spec.ts
    checks:
      - assertion: telegram-live
        command: npm run test:integration -- telegram
`;
const CHECKOUT=`schema: work/node@2
id: demo.sales.e2e.checkout
kind: e2e
required: true
state: todo
description: Prove checkout through the API on the real stack.
assertions:
  - order-persisted
extensions:
  work3:
    allowlist:
      - src/tests/e2e/checkout.e2e-spec.ts
    checks:
      - assertion: order-persisted
        command: npm run test:e2e -- checkout
`;
const liveCheck={name:'integration',command:'npm run test:integration -- telegram',exitCode:0,assertion:'telegram-live'};
const e2eCheck={name:'e2e',command:'npm run test:e2e -- checkout',exitCode:0,assertion:'order-persisted'};
const DECLARATION_DIGEST='9'.repeat(64);

function integrationRepo(){
  const root=path.join(os.tmpdir(),'starci-work-ledger-spec',`${Date.now()}-${Math.random().toString(16).slice(2)}`);
  fs.mkdirSync(root,{recursive:true});
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({name:'@demo/backend'}));
  const write=(relative,content)=>{
    const file=path.join(root,'.starciwork',relative);
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,content);
  };
  write('features/sales/business/srs/delivery/index.yaml',DELIVERY);
  write('features/sales/integration/telegram/index.yaml',TELEGRAM);
  write('features/sales/e2e/checkout/index.yaml',CHECKOUT);
  // Neither of these is a Work node: `assets/**` is payload and `_local` is execution state.
  write('features/sales/business/srs/delivery/assets/sample/index.yaml','id: demo.sales.sample\nkind: business\n');
  write('_local/plans/p1/index.yaml','id: demo.plan\nkind: business\n');
  return root;
}
const tree=root=>readLedgerTree(path.join(root,'.starciwork'));
const nodeOf=(at,id)=>at.nodes.get(id);

test('the tree can be read without the validator, bounded, skipping payload and execution state',()=>{
  const root=integrationRepo();
  try{
    const at=tree(root);
    assert.equal(at.workRoot,path.join(root,'.starciwork'));
    assert.equal(at.repoRoot,root);
    assert.deepEqual(at.list.map(node=>[node.id,node.kind,node.state]),[
      ['demo.sales.business.srs.fr.delivery','business','done'],
      ['demo.sales.e2e.checkout','e2e','todo'],
      ['demo.sales.integration.telegram','integration','todo']
    ]);
    assert.equal(at.list[0].path,'features/sales/business/srs/delivery/index.yaml');
    assert.equal(readNode(at.at,at.list[0]).kind,'business','a scanned node carries its own file, so the reader needs no projection');
    assert.equal(at.bounded,false);
    const clipped=readLedgerTree(path.join(root,'.starciwork'),{limit:2});
    assert.equal(clipped.list.length,2);
    assert.equal(clipped.bounded,true,'a pathological tree cannot hang a reader that bounds itself');
    assert.equal(readLedgerTree(path.join(root,'nothing-here')),null);
    assert.equal(readLedgerTree(path.join(root,'package.json')),null);
  }finally{cleanup(root);}
});

test('a declared integration is data: a credential nobody owns or a nameless entry is a finding, not a silent skip',()=>{
  const root=integrationRepo();
  try{
    const at=tree(root);
    const {list,problems}=declaredIntegrations(at);
    assert.deepEqual(list.map(item=>item.id),['telegram','zalo','viber']);
    // Custody, not a place: the declaration names the encrypted identity resource that holds the value.
    assert.deepEqual(list[0],{id:'telegram',provider:'telegram-bot-api',declaredBy:'demo.sales.business.srs.fr.delivery',
      declaredPath:'features/sales/business/srs/delivery/index.yaml',
      credential:{name:'TELEGRAM_BOT_TOKEN',providedBy:'owner',custody:'identity:telegram-delivery',slug:'telegram-delivery',where:null},
      sandbox:'https://sandbox.invalid/telegram'});
    assert.equal(list[1].credential.name,null);
    assert.equal(list[1].sandbox,undefined,'a declaration without a sandbox promises none');
    // `where` is the retired 5.1 spelling: it named a place, not a custody, so a declaration that carries only
    // `where` is told what to change rather than passing as if it had said where the value lives.
    assert.deepEqual(problems.map(item=>[item.code,item.id]),[
      ['credential-missing','zalo'],['credential-not-owner','viber'],['credential-custody-missing','viber'],['integration-shape',null]]);
    assert.ok(problems.every(item=>item.declaredBy==='demo.sales.business.srs.fr.delivery'));
    assert.match(problems[0].detail,/declares no credential name/);
    assert.match(problems[1].detail,/a credential is the owner's/);
    assert.match(problems[2].detail,/declare `custody: identity:<slug>`.*retired `where: the workflow environment`/);
    assert.equal(list[2].credential.where,'the workflow environment','the retired spelling is still read, so the tree can be told what to change');
    // Only the business and design sides declare one: an implementation node naming a provider declares nothing.
    assert.deepEqual(declaredIntegrations({at:at.at,list:at.list.map(node=>({...node,kind:'implementation'}))}).list,[]);
    assert.deepEqual(declaredIntegrations({at:at.at,list:[]}),{list:[],problems:[]});

    // The tree owes one node per declared id; the two that have none are what makes it incomplete.
    assert.deepEqual(integrationNodes(at).map(node=>node.id),['demo.sales.integration.telegram']);
    assert.equal(integrationIdOf(at.list[2]),'telegram');
    assert.equal(integrationIdOf(at.list[1]),null);
    assert.deepEqual(missingIntegrationNodes(at),['zalo','viber']);

    // `integration` is executable work the kernel may schedule, with its own allowlist and check.
    assert.ok(EXECUTABLE_KINDS.includes('integration'));
    const eligible={...at,list:at.list.map(node=>({...node,eligible:true}))};
    const candidate=executableCandidates(eligible).find(node=>node.kind==='integration');
    assert.equal(candidate.schedulable,true);
    assert.deepEqual(candidate.allowlist,['src/tests/integration/telegram.live-spec.ts']);
    assert.deepEqual(candidate.assertions,['telegram-live']);
  }finally{cleanup(root);}
});

test('an evidence manifest says what it was proven against, and refuses a boundary nobody published',()=>{
  const root=integrationRepo();
  try{
    const at=tree(root);
    const telegram=nodeOf(at,'demo.sales.integration.telegram'),checkout=nodeOf(at,'demo.sales.e2e.checkout');
    const live=parseYaml(fs.readFileSync(writeEvidence(root,telegram,{...bound,opId:'op-live',checks:[liveCheck],proof:{boundary:'live'}}),'utf8'));
    assert.deepEqual(live.proof,{boundary:'live',fakes:[]},'a proof that names no fake still says so, rather than staying silent');
    const api=parseYaml(fs.readFileSync(writeEvidence(root,checkout,{...bound,opId:'op-api',checks:[e2eCheck],proof:{boundary:'api',fakes:['zalo','zalo','telegram']}}),'utf8'));
    assert.deepEqual(api.proof,{boundary:'api',fakes:['zalo','telegram']});
    // Evidence written without a proof block makes no claim about a boundary; it does not invent one.
    assert.equal(parseYaml(fs.readFileSync(writeEvidence(root,checkout,{...bound,opId:'op-silent',checks:[e2eCheck]}),'utf8')).proof,undefined);
    assert.throws(()=>writeEvidence(root,telegram,{...bound,opId:'op-x',checks:[liveCheck],proof:{boundary:'recorded'}}),/boundary is api or live/);
    assert.throws(()=>writeEvidence(root,telegram,{...bound,opId:'op-y',checks:[liveCheck],proof:{fakes:['zalo']}}),/Missing evidence proof boundary/);
    assert.throws(()=>writeEvidence(root,telegram,{...bound,opId:'op-z',checks:[liveCheck],proof:{boundary:'live',fakes:'zalo'}}),/lists its fakes as provider ids/);
  }finally{cleanup(root);}
});

test('a proof remembers the rules it was taken under: markDone stores the contract digest and hands the proof to the evidence',()=>{
  const root=integrationRepo();
  try{
    const telegram=nodeOf(tree(root),'demo.sales.integration.telegram');
    const receipt=markDone(root,telegram,{...bound,opId:'op-telegram-1',checks:[liveCheck],
      contractDigest:DECLARATION_DIGEST,proof:{boundary:'live',fakes:[]},evidence:{environment:'worktree-local'}});
    const done=parseYaml(fs.readFileSync(nodeFile(root,telegram),'utf8'));
    assert.equal(done.state,'done');
    assert.equal(done.extensions.work3.kernel.contractDigest,DECLARATION_DIGEST);
    assert.equal(done.extensions.work3.allowlist[0],'src/tests/integration/telegram.live-spec.ts','the authored record survives the receipt');
    assert.deepEqual(parseYaml(fs.readFileSync(receipt.evidence,'utf8')).proof,{boundary:'live',fakes:[]});
    assert.throws(()=>markDone(root,telegram,{...bound,opId:'op-2',checks:[liveCheck],contractDigest:'not-a-digest'}),/lowercase sha-256/);
    // A node the kernel completed without naming its rules keeps no digest at all rather than a placeholder.
    const checkout=nodeOf(tree(root),'demo.sales.e2e.checkout');
    markDone(root,checkout,{...bound,opId:'op-checkout-1',checks:[e2eCheck]});
    assert.equal(parseYaml(fs.readFileSync(nodeFile(root,checkout),'utf8')).extensions.work3.kernel.contractDigest,undefined);
  }finally{cleanup(root);}
});

test('the contract digest is the declaration itself, in a stable order, and a moved rule reopens the proof',()=>{
  const declaration={kind:'integration.verify',kindRecord:{family:'prove',reads:['integration','sds','code'],writes:['evidence']},
    operator:'steps:\n  - call the provider\n',rules:['a fake of the declared provider is a defect']};
  const digest=contractDigestOf(declaration);
  assert.match(digest,/^[a-f0-9]{64}$/);
  assert.equal(digest,contractDigestOf({rules:declaration.rules,operator:declaration.operator,
    kindRecord:{writes:['evidence'],reads:['integration','sds','code'],family:'prove'},kind:'integration.verify'}),'key order is not part of the declaration');
  assert.notEqual(digest,contractDigestOf({...declaration,kindRecord:{...declaration.kindRecord,reads:['sds','integration','code']}}),'list order is');
  assert.notEqual(digest,contractDigestOf({...declaration,rules:[...declaration.rules,'and no recorded response']}));
  assert.notEqual(digest,contractDigestOf({...declaration,operator:`${declaration.operator}  - and keep the output\n`}));
  assert.equal(contractDigestOf({kind:'e2e.verify'}),contractDigestOf({kind:'e2e.verify',kindRecord:null,operator:null,rules:[]}));
  assert.throws(()=>contractDigestOf({}),/Missing operation kind/);

  const root=integrationRepo();
  try{
    const telegram=nodeOf(tree(root),'demo.sales.integration.telegram');
    markDone(root,telegram,{...bound,opId:'op-telegram-1',checks:[liveCheck],contractDigest:digest,evidence:{environment:'worktree-local'}});
    assert.deepEqual(staleProofs(tree(root),{digestOf:()=>digest}),[],'a proof taken under the current declaration stands');
    const moved=staleProofs(tree(root),{digestOf:()=>'a'.repeat(64)});
    assert.deepEqual(moved.map(entry=>[entry.node.id,entry.stored,entry.current]),[['demo.sales.integration.telegram',digest,'a'.repeat(64)]]);
    // A done record the kernel never completed (the business record, settled elsewhere) is never dragged in.
    assert.ok(!moved.some(entry=>entry.node.id==='demo.sales.business.srs.fr.delivery'));

    // A node completed with no digest at all is a proof that does not remember its rules: it is stale too.
    const checkout=nodeOf(tree(root),'demo.sales.e2e.checkout');
    markDone(root,checkout,{...bound,opId:'op-checkout-1',checks:[e2eCheck]});
    assert.deepEqual(staleProofs(tree(root),{digestOf:kind=>kind==='integration'?digest:'c'.repeat(64)})
      .map(entry=>[entry.node.id,entry.stored]),[['demo.sales.e2e.checkout',null]]);
    // The kernel names the kind and owns the comparison; answering nothing to either leaves the node alone.
    assert.deepEqual(staleProofs(tree(root),{digestOf:()=>null}),[]);
    assert.deepEqual(staleProofs(tree(root),{kindOf:()=>null,digestOf:()=>'c'.repeat(64)}),[]);
    assert.deepEqual(staleProofs(tree(root),{kindOf:(node,{kernel})=>kernel.opId==='op-checkout-1'?'e2e.verify':null,
      digestOf:kind=>kind==='e2e.verify'?'c'.repeat(64):null}).map(entry=>entry.node.id),['demo.sales.e2e.checkout']);
    assert.throws(()=>staleProofs(tree(root),{}),/digestOf/);
  }finally{cleanup(root);}
});

test('every declared integration is proven live, proven against a fake, or not proven - and there is no fourth state',()=>{
  const root=integrationRepo();
  try{
    const at=tree(root);
    assert.deepEqual(integrationProofStatus(at).map(entry=>[entry.id,entry.node,entry.proven,entry.evidence.length]),[
      ['telegram','demo.sales.integration.telegram','none',0],['zalo',null,'none',0],['viber',null,'none',0]
    ],'a tree that has proven nothing claims nothing');

    // The e2e run proves the product's API and fakes the Zalo channel; it names it, and Zalo reads as faked.
    markDone(root,nodeOf(at,'demo.sales.e2e.checkout'),{...bound,opId:'op-checkout-1',checks:[e2eCheck],
      proof:{boundary:'api',fakes:['zalo']},evidence:{environment:'worktree-local'}});
    // The integration run reaches the provider itself, so Telegram - and only Telegram - reads as live.
    markDone(root,nodeOf(at,'demo.sales.integration.telegram'),{...bound,opId:'op-telegram-1',checks:[liveCheck],
      contractDigest:DECLARATION_DIGEST,proof:{boundary:'live',fakes:[]},evidence:{environment:'worktree-local'}});
    const status=integrationProofStatus(tree(root));
    assert.deepEqual(status.map(entry=>[entry.id,entry.node,entry.proven]),[
      ['telegram','demo.sales.integration.telegram','live'],['zalo',null,'fake'],['viber',null,'none']]);
    assert.deepEqual(status[0].evidence.map(item=>[item.node,item.boundary,item.outcome]),[['demo.sales.integration.telegram','live','pass']]);
    assert.deepEqual(status[1].evidence.map(item=>[item.node,item.boundary,item.fakes]),[['demo.sales.e2e.checkout','api',['zalo']]]);
    assert.equal(status[0].provider,'telegram-bot-api');

    // A live run that failed is not a live proof: it ran, it did not prove.
    const red=integrationRepo();
    try{
      const other=tree(red);
      writeEvidence(red,nodeOf(other,'demo.sales.integration.telegram'),{...bound,opId:'op-red',
        checks:[{...liveCheck,exitCode:1}],proof:{boundary:'live',fakes:[]}});
      const failing=integrationProofStatus(tree(red)).find(entry=>entry.id==='telegram');
      assert.equal(failing.proven,'none');
      assert.equal(failing.evidence.length,1,'the run is still on record, it simply proves nothing');
    }finally{cleanup(red);}
  }finally{cleanup(root);}
});

test('a tree with no brand record exposes none and offers no brand references',()=>{
  const root=fakeRepo();
  try{
    const ledger=open(root);
    assert.equal(ledger.brand,null);
    assert.deepEqual(brandReferences(ledger),[]);
    assert.ok(!ledgerSummary(ledger).decisionEligible.includes('product.brand'));
  }finally{cleanup(root);}
});

/* ------------------------------------------------------------------ the shape a cut leaves behind */

/**
 * What `implementation.plan` writes, judged by the real validator rather than by an injected projection: the node
 * it cut is a derived parent - no `state`, no `completion`, no write scope - whose assertions stay as the group's
 * acceptance under `extensions.work3.groupAssertions`, and its children are ordinary launchable nodes with
 * disjoint write scopes, the seam first. It is the shape the tree has to accept for heavy work to fan out at all.
 */
const cutTree=()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-work-cut-'));
  const write=(relative,content)=>{
    const file=path.join(root,'.starciwork',relative);
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,content);
  };
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({name:'@demo/backend'}));
  write('workspace.yaml','schema: work/workspace@1\nid: demo\n');
  const at='features/sales/implementation/backend/checkout';
  write(`${at}/index.yaml`,`schema: work/node@2
id: demo.sales.implementation.backend.checkout
kind: implementation
required: true
description: Check a cart out end to end.
extensions:
  work3:
    groupAssertions:
      - checkout-completes
`);
  const child=(part,dependsOn=[])=>write(`${at}/${part}/index.yaml`,`schema: work/node@2
id: demo.sales.implementation.backend.checkout.${part}
kind: implementation
required: true
state: todo
description: The ${part} part of checkout.
assertions:
  - ${part}-works
${dependsOn.length?`dependsOn:\n${dependsOn.map(entry=>`  - ${entry}`).join('\n')}\n`:''}implementation:
  status: mixed
  gaps:
    - The ${part} part does not exist yet.
  changes:
    - what: Build ${part}.
      why: It does not exist.
      repository: demo-backend
      directory: .
      revision: HEAD
      verification:
        - npm run test:unit -- src/checkout/${part}
      files:
        - src/checkout/${part}.ts
extensions:
  work3:
    checks:
      - assertion: ${part}-works
        command: npm run test:unit -- src/checkout/${part}
`);
  child('wiring');
  child('payment',['demo.sales.implementation.backend.checkout.wiring']);
  child('shipping',['demo.sales.implementation.backend.checkout.wiring']);
  return {root,workRoot:path.join(root,'.starciwork'),at};
};

test('a cut leaves a derived parent whose assertions are the group acceptance, and children the kernel can launch',()=>{
  const {root,workRoot}=cutTree();
  try{
    const result=validateWorkspace(workRoot);
    assert.deepEqual(result.errors.map(error=>`${error.code} ${error.path}: ${error.message}`),[],'the shape a cut writes is a valid tree');
    const parent=result.nodes.find(node=>node.id==='demo.sales.implementation.backend.checkout');
    // A parent with children authors no state and derives one from them: that is why the cut removes it.
    assert.equal(parent.state,null);
    assert.equal(parent.completion,null);
    assert.deepEqual([...parent.children].sort(),
      ['demo.sales.implementation.backend.checkout.payment','demo.sales.implementation.backend.checkout.shipping',
        'demo.sales.implementation.backend.checkout.wiring']);
    assert.equal(parent.effectiveState,'todo','it derives todo from the children that are still to be built');
    // The group's acceptance survived the cut as a record of its own, not as an assertion nobody can reach.
    const raw=readNode(root,parent);
    assert.deepEqual(raw.extensions.work3.groupAssertions,['checkout-completes']);
    assert.equal(raw.state,undefined);
    assert.deepEqual(nodeAllowlist(raw),[],'a derived parent declares no write scope of its own');
    // The parent is no candidate at all; the children are, and only the seam is eligible right now.
    const ledger=loadLedger({repoRoot:root,validate:()=>result});
    const candidates=executableCandidates(ledger,{});
    assert.deepEqual(candidates.map(node=>node.id),['demo.sales.implementation.backend.checkout.wiring'],
      'the seam is built first; its siblings wait on it through dependsOn');
    assert.equal(candidates[0].schedulable,true);
    assert.deepEqual(candidates[0].allowlist,['src/checkout/wiring.ts']);
    // Disjoint write scopes are the whole point of the cut: no two children can be running the same file.
    const scopes=['wiring','payment','shipping'].map(part=>[`src/checkout/${part}.ts`]);
    for(const [index,left] of scopes.entries())
      for(const right of scopes.slice(index+1))assert.equal(disjoint(left,right),true,`${left} vs ${right}`);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('a cut that left the parent its own state is refused: a branch may not author one',()=>{
  const {root,workRoot,at}=cutTree();
  try{
    const file=path.join(workRoot,at,'index.yaml');
    fs.writeFileSync(file,`${fs.readFileSync(file,'utf8')}state: todo\n`);
    assert.deepEqual(validateWorkspace(workRoot).errors.map(error=>error.code),['BRANCH_STATE'],
      'the derived parent is the one thing the cut must leave behind');
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
