import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { outputs, generate, root } from '../ops/generate.mjs';
import { ops as sourceContracts } from '../ops/contracts.mjs';
import { validateCatalog } from '../ops/validate.mjs';
import { validateWorkspace, sha256 } from '../core/index.mjs';
import { parseYaml } from '../core/yaml.mjs';
const repository=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const catalogue=JSON.parse(outputs().get('catalog.json'));
const fresh=()=>structuredClone(catalogue);
const errors=cat=>validateCatalog(cat,{root,repositoryRoot:repository,documents:outputs()}).errors.map(e=>e.code);
const resolvePublicKnowledge=rel=>[path.join(repository,rel)].find(candidate=>fs.existsSync(candidate));

test('the record-authoring operator carries the cut mode: it writes child nodes, names the seam and builds nothing',()=>{
  const contract=catalogue.ops.find(op=>op.id==='work.author').contract;
  // One operator contract, three modes - a node's own record, a feature intake, and the cut - so
  // `implementation.plan` needs no second operator and the catalogue stays the closed list it was.
  assert.equal(catalogue.ops.some(op=>op.id==='implementation.plan'),false,'the cut is a kind, never a second operator');
  assert.match(contract.goal.en,/in cut mode the child nodes a node too big for one operation is split into, seam first/);
  const parts=contract.writes.find(row=>row.id==='parts');
  assert.ok(parts,'the cut writes child records of its own');
  assert.equal(parts.path,'.starciwork/<node-dir>/<part>/index.yaml');
  assert.ok(['node-dir','part'].every(name=>String(contract.placeholders?.[name]??'').trim()),'both placeholders are declared');
  for(const field of ['schema','id','kind','required','state','assertions','dependsOn','extensions.work3.allowlist','extensions.work3.checks'])
    assert.ok(parts.fields.includes(field),field);
  assert.match(parts.content.en,/Exactly one child is the seam/);
  assert.match(parts.content.en,/every other child names the seam in dependsOn/);
  assert.match(parts.content.en,/never write product code/);
  // Its steps are reachable and its proof is the one thing a cut can get wrong twice: overlap.
  const writing=contract.steps.filter(step=>step.writes.includes('parts'));
  assert.equal(writing.length,1,'one step authors the children');
  assert.match(writing[0].action.en,/NAME THE SEAM FIRST/);
  const derived=contract.steps.find(step=>/derived parent/.test(step.action.en));
  assert.match(derived.action.en,/groupAssertions/);
  const proof=contract.proofs.find(item=>item.id==='seam-first-disjoint-parts');
  assert.ok(proof,'the cut declares its own proof');
  assert.match(proof.requirement.en,/disjoint from every sibling and from the seam/);
  assert.match(proof.requirement.en,/cut: none left the tree byte-identical/);
  assert.ok(contract.blockers.some(item=>item.code==='SEAM_UNDETERMINED'),'an undeterminable seam is refused, never invented');
  // And the whole catalogue still validates with the mode in it.
  assert.deepEqual(errors(fresh()),[]);
});

test('implementation and code review route to the same resolvable coding convention contract',()=>{
  const generated=JSON.parse(outputs().get('catalog.json'));
  for(const id of ['backend.implement','interface.implement','review.verify']) {
    const refs=generated.ops.find(op=>op.id===id).supportingReferences;
    const convention=refs.find(ref=>ref.path==='knowledge/coding-reference.json');
    assert.ok(convention,`${id} must expose the shared convention contract`);
    const resolved=resolvePublicKnowledge(convention.path);
    assert.ok(resolved,`resolvable ${convention.path}`);
    const document=JSON.parse(fs.readFileSync(resolved,'utf8'));
    assert.equal(document.schema,'starci/knowledge@1');
    assert.ok(document.sections.length>0);
  }
  assert.ok(!generated.ops.find(op=>op.id==='business.decide').supportingReferences.some(ref=>ref.path==='knowledge/coding-reference.json'));
});

test('current V3 contracts have complete resolvable catalogue identities and English authority',()=>{
  const result=validateCatalog(catalogue,{root,repositoryRoot:repository,documents:outputs()});
  assert.deepEqual(result.errors,[]);
  assert.deepEqual(catalogue.ops.map(op=>op.id).sort(),sourceContracts.map(op=>op.id).sort());
  assert.deepEqual(Object.keys(catalogue).sort(),['commonDocument','ops','schema']);
  assert.ok(catalogue.ops.some(o=>o.id==='workspace.manage'));
  assert.ok(catalogue.ops.some(o=>o.id==='scope.retire'));
});
test('decide operator dispatch selects split SRS and SDS authoring while legacy schemas stay compatibility-only',()=>{
  const generated=JSON.parse(outputs().get('catalog.json'));
  const srsContract=parseYaml(fs.readFileSync(path.join(repository,'specifications','srs-sections.yaml'),'utf8'));
  const sdsContract=parseYaml(fs.readFileSync(path.join(repository,'specifications','sds-map.yaml'),'utf8'));
  const business=generated.ops.find(op=>op.id==='business.decide').contract;
  assert.equal(business.specificationPolicy.payloadSchema,'starci/srs-sections@1');
  assert.equal(business.specificationPolicy.payloadField,'extensions.work3.srs');
  assert.equal(business.specificationPolicy.aggregateSchema,'starci/srs-aggregate@1');
  assert.deepEqual(business.specificationPolicy.compatibilitySchemas,['starci/specification@2','starci/srs@3']);
  assert.equal(business.specificationPolicy.proseLanguage,'en');
  assert.deepEqual(business.specificationPolicy.preserveEnglish,srsContract.preserveEnglish);
  assert.equal(business.specificationPolicy.payloadSchema,srsContract.schema);
  assert.deepEqual(business.specificationPolicy.requiredSections,Object.keys(srsContract.sections));
  assert.deepEqual(business.specificationPolicy.sectionSchemas,Object.values(srsContract.sections).map(section=>section.schema));
  assert.ok(business.writes.find(write=>write.id==='node').fields.includes('extensions.work3.srs'));
  assert.ok(!business.writes.find(write=>write.id==='node').fields.includes('extensions.work3.specification'));
  // Both decide operators also carry their repair kind, and the repair rule is in the contract the agent reads:
  // an unclear record is revised to its most reasonable reading with one decision-log entry, and only a reading
  // that moves money, authority or customer data is put to the owner as numbered options with one recommendation.
  for(const id of ['business.decide','architecture.decide']){
    const contract=generated.ops.find(op=>op.id===id).contract;
    assert.ok(contract.proofs.some(proof=>proof.id==='revision-decision-log'),id);
    const revise=contract.steps.filter(step=>/decisionLog/.test(step.action.en));
    assert.equal(revise.length,1,id);
    assert.match(revise[0].action.en,/\{rev, at, gap, chosen, why, alternatives\}/,id);
    assert.match(revise[0].action.en,/money, authority or customer data/,id);
    assert.match(revise[0].action.en,/question\.kind decision/,id);
    assert.match(revise[0].action.en,/Never ask for anything else/,id);
  }
  const architecture=generated.ops.find(op=>op.id==='architecture.decide').contract;
  assert.equal(architecture.specificationPolicy.payloadSchema,'starci/sds-map@1');
  assert.equal(architecture.specificationPolicy.payloadField,'extensions.work3.sds');
  assert.equal(architecture.specificationPolicy.aggregateSchema,'starci/sds-aggregate@1');
  assert.deepEqual(architecture.specificationPolicy.compatibilitySchemas,['starci/specification@3']);
  assert.equal(architecture.specificationPolicy.proseLanguage,'en');
  assert.deepEqual(architecture.specificationPolicy.preserveEnglish,sdsContract.preserveEnglish);
  assert.equal(architecture.specificationPolicy.payloadSchema,sdsContract.schema);
  assert.deepEqual(architecture.specificationPolicy.requiredSections,Object.keys(sdsContract.sections));
  assert.deepEqual(architecture.specificationPolicy.sectionSchemas,[sdsContract.overview.schema,...Object.values(sdsContract.sections).map(section=>section.schema)]);
  assert.ok(architecture.writes.find(write=>write.id==='node').fields.includes('extensions.work3.sds'));
  assert.ok(!architecture.reads.some(read=>read.id==='source'));
  assert.ok(!architecture.writes.some(write=>write.fields.includes('sourceRefs')));
  for(const mutate of [
    contract=>{contract.specificationPolicy.payloadSchema='starci/srs@3';},
    contract=>{contract.specificationPolicy.proseLanguage='vi';},
    contract=>{contract.specificationPolicy.preserveEnglish.pop();},
    contract=>{contract.writes.find(write=>write.id==='node').fields=['extensions.work3.specification','sourceRefs'];},
  ]){const changed=fresh();mutate(changed.ops.find(op=>op.id==='business.decide').contract);assert.ok(errors(changed).includes('SPECIFICATION_POLICY'));}
  for(const mutate of [
    contract=>{contract.specificationPolicy.payloadSchema='starci/unsupported-sds@1';},
    contract=>{delete contract.specificationPolicy.proseLanguage;},
    contract=>{contract.specificationPolicy.preserveEnglish=['stable-ids-and-refs'];},
    contract=>{contract.reads.push({id:'source',path:'repository:<repo-id>/<bound-paths>',purpose:{en:'Inspect a current revision.'}});contract.steps[0].reads.push('source');},
  ]){const changed=fresh();mutate(changed.ops.find(op=>op.id==='architecture.decide').contract);const observed=errors(changed);assert.ok(observed.includes('SPECIFICATION_POLICY')||observed.includes('ARCHITECTURE_DEPTH'));}
});
test('UAT contract rejects parallel/visual execution and incomplete cleanup or recording authority',()=>{
  for(const [key,value] of [['flowOrder','parallel'],['appearanceScoring',true],['uxAnswers','scores'],['cleanup','optional'],['recording','screenshots-only'],['paidAI','unlimited']]) {
    const c=fresh();c.ops.find(o=>o.id==='uat.verify').contract.uatPolicy[key]=value;
    assert.ok(errors(c).includes('UAT_POLICY'),key);
  }
  for(const id of ['sequence','ux','recording','scripts','cleanup']) {
    const c=fresh(),op=c.ops.find(o=>o.id==='uat.verify');op.contract.proofs=op.contract.proofs.filter(p=>p.id!==id);
    assert.ok(errors(c).includes('UAT_BINDING'),id);
  }
  const c=fresh(),op=c.ops.find(o=>o.id==='uat.verify');op.contract.reads=op.contract.reads.filter(r=>r.id!=='effects');
  assert.ok(errors(c).includes('UAT_BINDING'));
});

test('API end-to-end contract keeps the proof on the public API against a real stack it starts, with one scenario per assertion',()=>{
  for(const [key,value] of [['proofSurface','any-surface'],['interfaceDriving',true],['stack','mocked'],['mocks','allowed-for-the-unit-under-proof'],['scenarios','one-per-slice'],['checks','agent-chosen-commands'],['productCode','repairable'],['environmentBlocker','any-failure'],['teardown','optional']]) {
    const c=fresh();c.ops.find(o=>o.id==='e2e.verify').contract.e2ePolicy[key]=value;
    assert.ok(errors(c).includes('E2E_POLICY'),key);
  }
  for(const id of ['coverage','api','stack','run','scope','teardown']) {
    const c=fresh(),op=c.ops.find(o=>o.id==='e2e.verify');op.contract.proofs=op.contract.proofs.filter(p=>p.id!==id);
    assert.ok(errors(c).includes('E2E_BINDING'),id);
  }
  for(const id of ['architecture','suite','stack','checks','effects']) {
    const c=fresh(),op=c.ops.find(o=>o.id==='e2e.verify');
    op.contract.reads=op.contract.reads.filter(r=>r.id!==id);
    for(const step of op.contract.steps)step.reads=step.reads.filter(r=>r!==id);
    assert.ok(errors(c).includes('E2E_BINDING'),id);
  }
});

test('the API end-to-end operator proves through the stack and the API only, and names no surface, capture or product repair',()=>{
  const document=fs.readFileSync(path.join(root,'e2e.verify','operator.yaml'),'utf8');
  const contract=JSON.stringify(catalogue.ops.find(op=>op.id==='e2e.verify').contract);
  for(const text of [document,contract]) {
    // This is not the frontend walk: no surface, no capture, no human-driven browsing may enter this contract.
    for(const forbidden of [/screenshot/i,/video/i,/rendered/i,/browser/i,/walk/i,/screens?/i,/visual/i]) {
      assert.doesNotMatch(text,forbidden,String(forbidden));
    }
    // It is the API proof on a real stack the suite starts, with the listed checks and no mock of the unit under proof.
    for(const required of [/public API/,/real stack/,/container/,/one scenario per assertion|one assertion is one scenario/i,
      /verbatim/,/no mock, stub, fake or spy of the unit under proof/,/never report done on an unrun|never .*done on an unrun/i]) {
      assert.match(text,required,String(required));
    }
  }
  const policy=catalogue.ops.find(op=>op.id==='e2e.verify').contract.e2ePolicy;
  assert.equal(policy.proofSurface,'public-api-only');
  assert.equal(policy.interfaceDriving,false);
  assert.equal(policy.stack,'real-started-by-the-suite');
  assert.equal(policy.checks,'listed-commands-verbatim');
  assert.equal(policy.productCode,'unchanged');
  // Its blockers refuse rather than improvise: no missing check is replaced, no ceiling widened.
  const codes=catalogue.ops.find(op=>op.id==='e2e.verify').contract.blockers.map(blocker=>blocker.code);
  assert.deepEqual(codes.sort(),['ASSERTION_REQUEST_INCOMPLETE','CHECK_UNRUNNABLE','DECLARED_DEPENDENCY_UNMET','PROOF_SURFACE_UNAVAILABLE','SCOPE_OUTSIDE_ALLOWLIST','STACK_UNAVAILABLE']);
});

test('the live integration operator proves through the real provider with the owner\'s own credential, and refuses without it',()=>{
  const document=fs.readFileSync(path.join(root,'integration.verify','operator.yaml'),'utf8');
  const summary=catalogue.ops.find(op=>op.id==='integration.verify');
  assert.ok(summary,'the live proof operator is in the catalogue');
  assert.deepEqual(summary.nodeKinds,['integration']);
  assert.equal(summary.completionProfile,'integration');
  const contract=summary.contract;
  for(const text of [document,JSON.stringify(contract)]) {
    // A stand-in for the declared provider is the defect this operation exists to catch, not a fallback.
    for(const required of [/real provider|the real provider/i,/sandbox/,/No mock, stub, fake, spy/,
      /blocked` with reason `environment`|`blocked` `environment`|reason `environment`/,/redact/i]) {
      assert.match(text,required,String(required));
    }
    // The credential is the owner's: never invented, and its value never written down anywhere.
    assert.match(text,/never invented, defaulted, substituted or silently skipped|never invented, never defaulted/);
  }
  // The policy block is the machine-readable half of the same six rules.
  assert.deepEqual(contract.integrationPolicy,{proofSurface:'real-provider',fakes:'none',
    credential:'owner-provided-named-variable-in-identity-custody',
    credentialCustody:'identity-resource-sops-exec-env',
    missingCredential:'blocked-environment-with-custody-slug-and-variable-name',
    secretValues:'never-written',evidenceProof:'live'});
  // Custody, not a place: the value is read through sops at the moment of use and exists in one process only.
  assert.match(document,/sops exec-env/);
  assert.match(document,/_resources\/identity\/<slug>\/secrets\.enc\.yaml/);
  assert.doesNotMatch(document,/named environment variable/,'an environment variable is not custody');
  // It reads the declaration that named the provider and the variable, and the client that actually calls it.
  for(const id of ['target','integration','architecture','repo','credential','effects'])
    assert.ok(contract.reads.some(read=>read.id===id),id);
  // Its whole write ceiling: the node's kernel fields, its own evidence, the workflow handoff. No source.
  assert.deepEqual(contract.writes.map(write=>write.id),['node','evidence','handoff']);
  assert.equal(contract.writes.some(write=>String(write.path).startsWith('repository:')),false,'it proves the client, it never repairs it');
  assert.ok(contract.writes.find(write=>write.id==='evidence').fields.includes('proof'),'the manifest says what it proved against');
  for(const id of ['binding','declaration','live','credential','readback','cleanup'])
    assert.ok(contract.proofs.some(proof=>proof.id===id),id);
  // Its blockers refuse rather than improvise: no key is invented and no provider is replaced to proceed.
  assert.deepEqual(contract.blockers.map(blocker=>blocker.code).sort(),
    ['CLIENT_UNAVAILABLE','CREDENTIAL_MISSING','DECLARED_DEPENDENCY_UNMET','INTEGRATION_UNDECLARED','PROVIDER_UNREACHABLE','SCOPE_OUTSIDE_ALLOWLIST']);
  assert.deepEqual(validateCatalog(catalogue,{root,repositoryRoot:repository,documents:outputs()}).errors,[]);
});

/**
 * The operator is the half of the owner loop an agent reads before it reads its contract, so the two rules
 * that keep the owner's time and the owner's secrets have to be in it: the question is put in the op's own
 * terminal before any report, and a credential is put into the tree's encrypted custody by the owner's own
 * command - this operation only ever checks that it is there.
 */
test('the decision.prepare operator prepares the decision, prints it in its own terminal and never waits',()=>{
  const document=fs.readFileSync(path.join(root,'decision.prepare','operator.yaml'),'utf8');
  const contract=catalogue.ops.find(op=>op.id==='decision.prepare').contract;
  assert.deepEqual(contract.writes.map(write=>write.id),['decision']);
  // The decision is a policy-decision leaf where the tree already keeps them, never a folder the tree lacks.
  assert.match(contract.writes[0].path,/business\/srs\/business-rules\/policy-decisions\/<slug>\/index\.yaml$/);
  for(const text of [document,JSON.stringify(contract)]){
    assert.match(text,/srs-policy-decision section with decisionStatus\s*\n?\s*open/);
    assert.match(text,/answer here\s*\n?\s*with the number, or later with workflow-answer/);
    assert.match(text,/do not wait/);
    assert.match(text,/answered-by-owner: <n>/);
    assert.match(text,/recommended: <n>/);
    assert.match(text,/that is provision\.ask/);
  }
  assert.ok(contract.proofs.some(proof=>proof.id==='asked-in-the-terminal'),'printing in the tab is a proof, not a hope');
});

test('the provision.ask operator delegates credentials to the workflow form and waits in its terminal only for other provisions',()=>{
  const document=fs.readFileSync(path.join(root,'provision.ask','operator.yaml'),'utf8');
  const contract=catalogue.ops.find(op=>op.id==='provision.ask').contract;
  assert.deepEqual(contract.writes.map(write=>write.path),['E/manifest.yaml'],'the only write is the report of the attempt, never the tree');
  for(const text of [document,JSON.stringify(contract)]){
    assert.match(text,/Never invent, stub, default or skip it/);
    assert.match(text,/For anything else, ask in this terminal and wait/);
    assert.match(text,/workflow owns the researched form/);
    assert.match(text,/kernel verifies encrypted-custody presence through the canonical verifier/);
    assert.doesNotMatch(text,/identity set <slug>|sops exec-env/);
    assert.match(text,/never prints it/);
    assert.match(text,/Stored presence does not establish provider validity/);
    assert.match(text,/provided: <what the owner provided, in a few words>/);
  }
  assert.ok(contract.proofs.some(proof=>proof.id==='asked-in-the-workflow'),'the workflow input surface is part of the proof contract');
  assert.match(contract.proofs.find(proof=>proof.id==='no-secret').requirement.en,/verifies only that it is present/);
});

test('an operator cannot write a record its kind never declared',()=>{
  // The kind graph says what each operation produces; the operator contract is held to the same declaration,
  // so a widened write ceiling cannot slip in as a path nobody compared against the catalog.
  const business=fresh(),node=business.ops.find(op=>op.id==='business.decide').contract.writes.find(w=>w.id==='node');
  node.path='.starciwork/<business>/architecture/sds/**/index.yaml';
  assert.ok(errors(business).includes('IO_DRIFT'),'settling a requirement may not rewrite the design it is realised by');
  const proof=fresh(),source=proof.ops.find(op=>op.id==='integration.verify').contract.writes.find(w=>w.id==='node');
  source.path='.starciwork/<business>/business/**/index.yaml';
  source.fields=['acceptance'];
  assert.ok(errors(proof).includes('IO_DRIFT'),'a live proof may not author the requirement it proved');
  // The attempt's own report is the kernel's, whatever its kind: every operation writes one.
  assert.deepEqual(errors(fresh()),[]);
});

test('the brand operator traces every value to a real source file, writes one record plus its own assets, and refuses instead of choosing',()=>{
  const document=fs.readFileSync(path.join(root,'brand.decide','operator.yaml'),'utf8');
  const summary=catalogue.ops.find(op=>op.id==='brand.decide');
  assert.ok(summary,'the identity operator is in the catalogue');
  assert.deepEqual(summary.nodeKinds,['brand']);
  assert.equal(summary.completionProfile,'brand');
  // It produces bytes (a placeholder mascot), so the effect is declared rather than hidden in a decision op.
  assert.ok(summary.sideEffects.length);
  const contract=summary.contract;
  // One record, its own assets, its own evidence: no product source write, so no repository write ceiling.
  assert.deepEqual(contract.writes.map(write=>write.id),['node','brandAssets','evidence']);
  assert.equal(contract.writes.some(write=>String(write.path).startsWith('repository:')),false);
  assert.ok(contract.writes.find(write=>write.id==='node').fields.some(field=>field.startsWith('brand:')));
  assert.ok(contract.writes.find(write=>write.id==='node').fields.includes('rev'));
  // The real token files of the interface and the assets that already exist are inputs, not inventions.
  for(const id of ['target','owner','grammar','sources','assets','knowledge','profile'])assert.ok(contract.reads.some(read=>read.id===id),id);
  assert.match(contract.reads.find(read=>read.id==='sources').purpose.en,/source of truth/);
  // The two refusals: an untraceable value asks, a missing source file is the user's environment.
  const blockers=contract.blockers.map(blocker=>blocker.code);
  assert.deepEqual(blockers.sort(),['BRAND_DECISION_UNRULED','BRAND_SOURCE_MISSING','BRAND_TOKEN_UNTRACEABLE','DECLARED_DEPENDENCY_UNMET']);
  assert.match(contract.blockers.find(blocker=>blocker.code==='BRAND_SOURCE_MISSING').condition.en,/`blocked` with `environment`/);
  assert.match(contract.blockers.find(blocker=>blocker.code==='BRAND_TOKEN_UNTRACEABLE').condition.en,/`ask`/);
  for(const id of ['binding','token-traceability','brand-checks','asset-provenance'])assert.ok(contract.proofs.some(proof=>proof.id===id),id);
  for(const text of [document,JSON.stringify(contract)]){
    assert.match(text,/traceable/i,'a value is traceable to its source or it is not written');
    assert.match(text,/placeholder/,'a generated mascot is a placeholder, never the accepted one');
    assert.match(text,/never\s+described\s+as\s+generated/,'a missing file is never described as generated');
    assert.match(text,/never\s+claim\s+a\s+file\s+exists/,'a deferred asset is a brief and an empty slot');
  }
  assert.deepEqual(validateCatalog(catalogue,{root,repositoryRoot:repository,documents:outputs()}).errors,[]);
});

test('all generated authority/catalogue bytes are reproducible without writes in check mode',()=>{
  const before=outputs();
  assert.deepEqual(outputs(),before);
});
test('operator generation and catalogue validation need only current operator sources and selected domain references',()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'work3-ops-minimal-'));
  try {
    const isolatedRoot=path.join(temporary,'ops');fs.cpSync(root,isolatedRoot,{recursive:true});
    fs.cpSync(path.join(repository,'core'),path.join(temporary,'core'),{recursive:true});
    for(const ref of new Set(catalogue.ops.flatMap(op=>op.supportingReferences.map(r=>r.path)))) {
      const target=path.join(temporary,ref);fs.mkdirSync(path.dirname(target),{recursive:true});
      const sourced=[path.join(repository,ref)].find(candidate=>fs.existsSync(candidate));
      assert.ok(sourced,`missing domain reference fixture for ${ref}`);
      fs.copyFileSync(sourced,target);
    }
    const observed=spawnSync(process.execPath,['--input-type=module','-e',"import {outputs} from './generate.mjs'; if(!outputs().size)process.exit(1)"],{cwd:isolatedRoot,encoding:'utf8'});
    assert.equal(observed.status,0,observed.stderr+observed.stdout);
    assert.deepEqual(fs.readdirSync(temporary).sort(),['core','knowledge','ops']);
    assert.deepEqual(validateCatalog(catalogue,{root:isolatedRoot,repositoryRoot:temporary,documents:outputs()}).errors,[]);
  } finally {assert.equal(path.dirname(temporary),os.tmpdir());assert.ok(path.basename(temporary).startsWith('work3-ops-minimal-'));fs.rmSync(temporary,{recursive:true,force:true});}
});
test('migration contract cannot substitute inferred intent, completed imports or unsafe worktree retirement',()=>{
  const c=fresh(),op=c.ops.find(o=>o.id==='workspace.manage');assert.ok(op);
  const migration=op.contract.executionModes.import;
  assert.equal(migration.graphPolicy.mode,'selected-scope-only');
  migration.migrationPolicy.importState='done';assert.ok(errors(c).includes('MODE_MIGRATION_POLICY'));
  migration.migrationPolicy=structuredClone(catalogue.ops.find(o=>o.id===op.id).contract.executionModes.import.migrationPolicy);
  migration.migrationPolicy.registeredWorktreeRemoval='recursive-delete';assert.ok(errors(c).includes('MODE_MIGRATION_POLICY'));
  migration.reads=migration.reads.filter(r=>r.id!=='custody');assert.ok(errors(c).includes('MODE_MIGRATION_BINDING'));
  delete migration.migrationPolicy;assert.ok(errors(c).includes('MODE_MIGRATION_POLICY'));
});
test('one-pilot import binds real committed source and recoverable untracked bytes without accepting implementation or UAT',()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'work3-op-import-'));
  try {
    const repo=path.join(temporary,'source');fs.mkdirSync(repo);
    const git=(...args)=>{const result=spawnSync('git',args,{cwd:repo,encoding:'utf8'});assert.equal(result.status,0,result.stderr);return result.stdout.trim();};
    git('init');fs.writeFileSync(path.join(repo,'chat.mjs'),'export const draftState = "draft";\n');git('add','chat.mjs');git('-c','user.name=Synthetic Test','-c','user.email=test@example.invalid','commit','-m','Synthetic source fixture');
    const commit=git('rev-parse','HEAD');assert.match(commit,/^[a-f0-9]{40,64}$/);
    fs.mkdirSync(path.join(repo,'old-artifacts'));const original=path.join(repo,'old-artifacts','notes.md');fs.writeFileSync(original,'Historical note: draft save was claimed complete; no current proof.\n');
    const status=git('status','--porcelain','--untracked-files=all');assert.match(status,/\?\? old-artifacts\/notes.md/);
    const worktrees=git('worktree','list','--porcelain');assert.match(worktrees,/worktree /);
    const work=path.join(temporary,'.work'),resource=path.join(work,'_resources','imports','pilot');fs.mkdirSync(path.join(resource,'assets'),{recursive:true});
    fs.writeFileSync(path.join(work,'workspace.yaml'),JSON.stringify({schema:'work/workspace@1',id:'synthetic-import'}));
    const preserved=path.join(resource,'assets','notes.md');fs.copyFileSync(original,preserved);assert.equal(sha256(fs.readFileSync(original)),sha256(fs.readFileSync(preserved)));
    fs.writeFileSync(path.join(resource,'resource.yaml'),JSON.stringify({schema:'work/resource@1',id:'source-facts',kind:'import',owner:'synthetic-owner',revision:commit,details:{repository:repo,commit,sourcePath:'chat.mjs',observed:'source exports draft string',intent:'candidate; not approved',untracked:status,worktrees},files:[{path:'assets/notes.md'}]}));
    const bodies=new Map();const metadata=new Map();
    const put=(id,meta)=>{const dir=path.join(work,'pilot',id);fs.mkdirSync(dir,{recursive:true});const body=bodies.get(id)??'# Synthetic import\nObserved source only; expected intent is unapproved.\n';bodies.set(id,body);metadata.set(id,meta);fs.writeFileSync(path.join(dir,'node.md'),'---\n'+JSON.stringify(meta)+'\n---\n'+body);};
    for(const [id,kind] of [['business','business'],['implementation','implementation'],['uat','uat.ux']]) put(id,{schema:'work/node@1',id,kind,required:true,state:'suspended',suspensionReason:'Imported source claim requires independently selected intent/proof review.',assertions:['own-proof'],refs:['source-facts']});
    put('consumer',{schema:'work/node@1',id:'consumer',kind:'operations',required:true,state:'todo',assertions:['consumer-proof'],dependsOn:['implementation']});
    put('migration',{schema:'work/node@1',id:'migration',kind:'operations',required:true,state:'todo',assertions:['preservation'],refs:['source-facts']});
    const before=validateWorkspace(work);assert.deepEqual(before.errors,[]);assert.equal(before.nodes.find(n=>n.id==='consumer').eligible,false);
    const node=before.nodes.find(n=>n.id==='migration'),evidenceDir=path.join(work,'pilot','migration','evidence','import-check');fs.mkdirSync(evidenceDir,{recursive:true});
    const report=JSON.stringify({commit,status,worktrees,originHash:sha256(fs.readFileSync(original)),retrievedHash:sha256(fs.readFileSync(preserved)),cleanup:'not-requested',acceptance:'migration preservation only; product unapproved'});
    fs.writeFileSync(path.join(evidenceDir,'preservation.json'),report);
    fs.writeFileSync(path.join(evidenceDir,'manifest.yaml'),JSON.stringify({schema:'work/evidence@1',id:'import-check',nodeId:'migration',inputDigest:node.inputDigest,outcome:'pass',assertions:[{id:'preservation',outcome:'pass',observation:'Read actual Git commit/status/worktree inventory and independently compared retained original versus copied untracked note hashes in this isolated synthetic fixture.'}],assets:[{path:'preservation.json',sha256:sha256(report)}]}));
    put('migration',{...metadata.get('migration'),state:'done',completion:{inputDigest:node.inputDigest,evidence:['import-check']}});
    const after=validateWorkspace(work);assert.deepEqual(after.errors,[]);assert.equal(after.nodes.find(n=>n.id==='migration').effectiveState,'done');
    for(const id of ['business','implementation','uat']) {assert.equal(after.nodes.find(n=>n.id===id).effectiveState,'suspended');assert.equal(metadata.get(id).completion,undefined);}
    assert.equal(after.nodes.find(n=>n.id==='consumer').eligible,false);assert.equal(fs.existsSync(original),true);
    const withoutReason={...metadata.get('business')};delete withoutReason.suspensionReason;put('business',withoutReason);assert.equal(validateWorkspace(work).ok,false);
  } finally {assert.equal(path.dirname(temporary),os.tmpdir());assert.ok(path.basename(temporary).startsWith('work3-op-import-'));fs.rmSync(temporary,{recursive:true,force:true});}
});
test('operator and document identity collision is refused',()=>{
  const c=fresh();c.ops.push(structuredClone(c.ops[0]));
  assert.ok(errors(c).includes('DUPLICATE_OP'));assert.ok(errors(c).includes('DUPLICATE_DOCUMENT'));
});
test('a Vietnamese mirror cannot be loaded as runtime authority; path escapes are refused',()=>{
  const c=fresh();c.ops[0].document='../CONTRACT.md';assert.ok(errors(c).includes('DOCUMENT_PATH'));
  c.ops[0].document='review.verify.vi.md';assert.ok(errors(c).includes('DOCUMENT_PATH'));
});
test('every procedure read/write is bound; missing declaration cannot silently widen scope',()=>{
  const c=fresh();c.ops[0].contract.steps[0].writes.push('undeclared-remote');assert.ok(errors(c).includes('UNDECLARED_WRITE'));
  c.ops[0].contract.steps[0].reads.push('imaginary-account');assert.ok(errors(c).includes('UNDECLARED_READ'));
});
test('every declared read and output has an actual procedural consumer/producer',()=>{
  const c=fresh();c.ops[0].contract.reads.push({id:'unused',path:'N/node.md',purpose:{en:'actual required input',vi:'đầu vào bắt buộc thật'}});
  assert.ok(errors(c).includes('UNUSED_READ'));
  c.ops[0].contract.writes.push({id:'never-written',path:'E/unused.json',fields:['actual'],content:{en:'unproduced output',vi:'output chưa tạo'}});
  assert.ok(errors(c).includes('UNREACHABLE_WRITE'));
});
test('every template placeholder must be explicitly grounded; broad absolute write scope is refused',()=>{
  const c=fresh();c.ops[0].contract.writes[0].path='repository:<unbound>/<write-ceiling>';
  assert.ok(errors(c).includes('UNDEFINED_PLACEHOLDER'));assert.ok(errors(c).includes('WRITE_DESTINATION'));
  c.ops[0].contract.writes[0].path='C:/Users';assert.ok(errors(c).includes('UNSAFE_TEMPLATE'));
});
test('source mutation cannot be described as read-only or omit repository grounding',()=>{
  const c=fresh();const op=c.ops.find(o=>o.id==='backend.implement');op.sideEffects=[];op.contract.sideEffects=[];
  assert.ok(errors(c).includes('SOURCE_AUTHORITY'));
  op.contract.reads=op.contract.reads.filter(r=>r.id!=='repo');assert.ok(errors(c).includes('UNDECLARED_READ'));
});
test('a catalogue cannot omit fields, proof or concrete blockers and still pass',()=>{
  const c=fresh();c.ops[0].contract.writes[0].fields=[];c.ops[0].contract.proofs=[];c.ops[0].contract.blockers=[];
  assert.ok(errors(c).includes('WRITE_FIELDS'));assert.ok(errors(c).includes('EMPTY_CONTRACT'));
});
test('a V3 operator cannot disappear from the catalogue or carry unknown catalogue root fields',()=>{
  const c=fresh();c.ops.pop();assert.ok(errors(c).includes('DOCUMENT_COVERAGE'));
  c.ops=[];assert.ok(errors(c).includes('CATALOG_EMPTY'));
  c.unexpectedMapping={};assert.ok(errors(c).includes('CATALOG_FIELDS'));
});
test('summary write ceilings/effects cannot drift from detailed contracts',()=>{
  const c=fresh();c.ops[0].writeScope.push('arbitrary external target');assert.ok(errors(c).includes('WRITE_SCOPE_DRIFT'));
  c.ops[0].sideEffects.push('delete all');assert.ok(errors(c).includes('CATALOG_DRIFT'));
});
test('all completion profiles refer to actually supported core profiles',()=>{
  const profilePath=path.join(repository,'schemas/profiles.yaml');
  assert.ok(fs.existsSync(profilePath),'profiles schema must resolve from authored YAML');
  const profileFile=parseYaml(fs.readFileSync(profilePath,'utf8'));
  const profiles=profileFile.profiles??profileFile;
  const result=validateCatalog(catalogue,{root,repositoryRoot:repository,profiles,documents:outputs()});
  assert.deepEqual(result.errors,[]);
  const c=fresh();c.ops[0].completionProfile='fake-profile';c.ops[0].nodeKinds=['fake-profile'];c.ops[0].contract.completionProfile='fake-profile';
  assert.ok(validateCatalog(c,{profiles}).errors.some(e=>e.code==='UNKNOWN_PROFILE'));
});

test('request analysis cannot acquire source, runtime, release or data effects',()=>{
  const catalog=fresh(), task=catalog.ops.find(o=>o.id==='task.execute').contract;
  assert.deepEqual(task.sideEffects,[]);
  assert.deepEqual(task.writes.map(w=>w.id),['evidence']);
  for(const mutate of [
    x=>x.sideEffects.push('source edit'),
    x=>x.writes.push({id:'source',path:'repository:any',fields:['code'],content:{en:'Mutate code'}}),
    x=>x.adHocPolicy.authority='request-bound-not-unrestricted',
  ]){const changed=fresh();mutate(changed.ops.find(o=>o.id==='task.execute').contract);assert.equal(validateCatalog(changed).ok,false);}
});

test('data correction mode requires schema and readback recovery without arbitrary code',()=>{
  const catalog=fresh(), mode=catalog.ops.find(o=>o.id==='release.deliver').contract.executionModes.migrate;
  assert.equal(mode.dataCorrectionPolicy.arbitraryCode,false);
  assert.equal(mode.dataCorrectionPolicy.adHocSql,false);
  for(const mutate of [
    x=>x.dataCorrectionPolicy.schemaInspection='optional',
    x=>x.dataCorrectionPolicy.postMutationReadback='optional',
    x=>x.dataCorrectionPolicy.arbitraryCode=true,
  ]){const changed=fresh();mutate(changed.ops.find(o=>o.id==='release.deliver').contract.executionModes.migrate);assert.equal(validateCatalog(changed).ok,false);}
});
test('conditional reused domain references must resolve; a fabricated reference cannot pass',()=>{
  const c=fresh();const op=c.ops.find(o=>o.id==='backend.implement');
  assert.ok(op.supportingReferences.length>0);
  op.supportingReferences[0].path='knowledge/patterns/not-real/INDEX.json';
  assert.ok(errors(c).includes('DOMAIN_REFERENCE'));
});
test('draw and FE discovery both expose applicable presentation and Grammar package knowledge',()=>{
  const generated=JSON.parse(outputs().get('catalog.json'));
  for(const id of ['interface.draw','interface.implement']) {
    const refs=generated.ops.find(op=>op.id===id).supportingReferences;
    for(const target of ['knowledge/ui/composition/INDEX.json','knowledge/ui/presentation/INDEX.json','knowledge/grammars/INDEX.json']) {
      assert.equal(refs.filter(ref=>ref.path===target).length,1,`${id}: ${target}`);
      assert.ok(resolvePublicKnowledge(target), target);
    }
  }
  assert.ok(!generated.ops.find(op=>op.id==='backend.implement').supportingReferences.some(ref=>ref.path==='knowledge/grammars/INDEX.json'));
  const draw=generated.ops.find(op=>op.id==='interface.draw').contract;
  assert.ok(draw.reads.some(read=>read.id==='grammar'));
  for(const step of draw.steps.slice(0,3)) assert.ok(step.reads.includes('grammar'));
  assert.deepEqual(validateCatalog(generated,{root,repositoryRoot:repository,documents:outputs()}).errors,[]);
});
test('the artwork operator re-renders the slots the drawing declared, writes only asset paths and the record, and leaves the wiring to the build',()=>{
  const document=fs.readFileSync(path.join(root,'interface.asset','operator.yaml'),'utf8');
  const op=catalogue.ops.find(x=>x.id==='interface.asset');
  const draw=catalogue.ops.find(x=>x.id==='interface.draw');
  assert.ok(op,'the catalogue carries the artwork operator');
  const contract=JSON.stringify(op.contract);
  for(const text of [document,contract]) {
    // The slots, the approved candidate crop, the brand masters and the recorded bytes are all in the contract.
    for(const required of [/artworkSlots/,/image generator|image model/i,/crop/,/sha256/,/brand record/,/declared size and format|declared pixel size/]) {
      assert.match(text,required,String(required));
    }
  }
  // It is a design-side op on the same node as the drawing it serves, and it owns its own document.
  assert.deepEqual(op.nodeKinds,draw.nodeKinds);
  assert.equal(op.completionProfile,draw.completionProfile);
  assert.equal(op.document,'interface.asset/operator.yaml');
  assert.equal(op.contract.graphPolicy.mode,'read-only');
  // Its whole write ceiling: the allowlisted asset destination, the design record, its own evidence.
  assert.deepEqual(op.writeScope,['repository:<repo-id>/<asset-path>','N/index.yaml','E/manifest.yaml + E/artwork-slots.yaml + E/prompt.txt']);
  const source=op.contract.writes.find(w=>w.id==='source');
  assert.equal(op.contract.writes.filter(w=>String(w.path).startsWith('repository:')).length,1);
  assert.deepEqual(source.fields,['generated artwork files only']);
  assert.equal(op.sideEffects.length,1);
  assert.match(op.sideEffects[0],/artwork files inside the owned asset paths/);
  // It reads the record that declares the slots, the candidate, the brand and the host's image capability.
  assert.deepEqual(op.contract.reads.map(r=>r.id),['target','design','brand','repo','profile']);
  // Its blockers refuse rather than improvise: no brief is authored here and no placeholder counts as artwork.
  assert.deepEqual(op.contract.blockers.map(b=>b.code).sort(),
    ['ARTWORK_SLOT_UNDECLARED','BRAND_RULE_UNSATISFIABLE','DECLARED_DEPENDENCY_UNMET','IMAGE_MODEL_UNAVAILABLE','SCOPE_OUTSIDE_ALLOWLIST']);
  assert.deepEqual(op.contract.proofs.map(p=>p.id),['slot-coverage','candidate-fidelity','brand-conformance','binding']);
});

test('consumer graph policy cannot add prerequisites, accept NA or dispatch a successor',()=>{
  const c=fresh();const op=c.ops.find(o=>o.id==='uat.verify');
  assert.equal(op.contract.graphPolicy.mode,'read-only');
  op.contract.writes.find(w=>w.id==='node').fields.push('dependsOn');
  assert.ok(errors(c).includes('CONSUMER_GRAPH_WRITE'));
  op.contract.graphPolicy.prerequisiteState='na';op.contract.graphPolicy.dispatch='automatic';
  assert.ok(errors(c).includes('GRAPH_POLICY'));
  const planning=catalogue.ops.find(o=>o.id==='workspace.manage');
  assert.equal(planning.contract.executionModes.prepare.graphPolicy.mode,'selected-scope-only');
  assert.ok(planning.contract.executionModes.prepare.writes.find(w=>w.id==='node').fields.includes('dependsOn'));
});
test('quality verification records real runner output in evidence and completes without staling its own semantic inputs',()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'work3-op-proof-'));
  try {
    const work=path.join(temporary,'.work'),nodeDir=path.join(work,'example','quality'),evidenceDir=path.join(nodeDir,'evidence','actual-gate');
    fs.mkdirSync(evidenceDir,{recursive:true});
    fs.writeFileSync(path.join(work,'workspace.yaml'),JSON.stringify({schema:'work/workspace@1',id:'synthetic-operator-test'}));
    const metadata={schema:'work/node@1',id:'quality-piece',kind:'operations',required:true,state:'todo',assertions:['selected-gate']};
    const body='# Selected quality gate\n\nRun the selected synthetic arithmetic test; expected: the one required test passes.\n';
    const nodeFile=path.join(nodeDir,'node.md');
    const nodeBytes=meta=>'---\n'+JSON.stringify(meta)+'\n---\n'+body;
    fs.writeFileSync(nodeFile,nodeBytes(metadata));
    const before=validateWorkspace(work);assert.equal(before.ok,true);
    const digest=before.nodes.find(n=>n.id===metadata.id).inputDigest;
    fs.writeFileSync(path.join(temporary,'gate.test.mjs'),"import test from 'node:test'; import assert from 'node:assert/strict'; test('selected arithmetic',()=>assert.equal(1+1,2));\n");
    const childEnvironment={...process.env};delete childEnvironment.NODE_TEST_CONTEXT;
    const observed=spawnSync(process.execPath,['--test','gate.test.mjs'],{cwd:temporary,encoding:'utf8',env:childEnvironment});
    assert.equal(observed.status,0,observed.stderr);
    const output=observed.stdout+observed.stderr;
    assert.match(output,/selected arithmetic/);
    fs.writeFileSync(path.join(evidenceDir,'gate-output.txt'),output);
    const report='Observed selected node test runner exit: '+observed.status+'.\nThis is synthetic framework testing, not product acceptance.\n';
    fs.writeFileSync(path.join(evidenceDir,'result.md'),report);
    const evidence={schema:'work/evidence@1',id:'actual-gate',nodeId:metadata.id,inputDigest:digest,outcome:'pass',assertions:[{id:'selected-gate',outcome:'pass',observation:'Executed node --test gate.test.mjs in the isolated fixture; actual exit 0 and selected arithmetic case present in retained runner output.'}],assets:[{path:'gate-output.txt',sha256:sha256(output)},{path:'result.md',sha256:sha256(report)}]};
    fs.writeFileSync(path.join(evidenceDir,'manifest.yaml'),JSON.stringify(evidence));
    fs.writeFileSync(nodeFile,nodeBytes({...metadata,state:'done',completion:{inputDigest:digest,evidence:['actual-gate']}}));
    const after=validateWorkspace(work);assert.deepEqual(after.errors,[]);assert.equal(after.nodes[0].effectiveState,'done');assert.equal(after.nodes[0].inputDigest,digest);
    fs.appendFileSync(nodeFile,'\n## Actual gate result\nThis post-proof output must not be written into the semantic specification.\n');
    const stale=validateWorkspace(work);assert.equal(stale.ok,false);assert.notEqual(stale.nodes[0].inputDigest,digest);assert.equal(stale.nodes[0].effectiveState,'suspended');
  } finally {
    assert.equal(path.dirname(temporary),os.tmpdir());
    assert.ok(path.basename(temporary).startsWith('work3-op-proof-'));
    fs.rmSync(temporary,{recursive:true,force:true});
  }
});
test('declared design source byte changes suspend only linked graph; a new output capture does not authorize redesign',()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'work3-op-graph-'));
  try {
    const work=path.join(temporary,'.work');fs.mkdirSync(work);
    fs.writeFileSync(path.join(work,'workspace.yaml'),JSON.stringify({schema:'work/workspace@1',id:'synthetic-graph-scope'}));
    const sourceDir=path.join(work,'_resources','design','selected');fs.mkdirSync(path.join(sourceDir,'assets'),{recursive:true});
    const sourceFile=path.join(sourceDir,'assets','direction.svg');
    fs.writeFileSync(sourceFile,'<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>');
    fs.writeFileSync(path.join(sourceDir,'resource.yaml'),JSON.stringify({schema:'work/resource@1',id:'selected-design',kind:'design',owner:'synthetic-owner',revision:'1',details:{purpose:'synthetic graph binding, not product acceptance'},files:[{path:'assets/direction.svg'}]}));
    const specs=[
      {id:'art-direction',refs:['selected-design']},
      {id:'ui-design',dependsOn:['art-direction'],refs:['selected-design']},
      {id:'frontend',dependsOn:['ui-design']},
      {id:'uat',dependsOn:['frontend']},
      {id:'unrelated'}
    ];
    const nodePaths=new Map(),metadata=new Map();
    function render(meta){return '---\n'+JSON.stringify(meta)+'\n---\n# Synthetic graph node\nScope and expected assertion are fixed; this fixture is not real product UAT.\n';}
    for(const spec of specs){const folder=path.join(work,spec.id);fs.mkdirSync(folder);const file=path.join(folder,'node.md');const meta={schema:'work/node@1',kind:'operations',required:true,state:'todo',assertions:['fixture-proof'],...spec};metadata.set(spec.id,meta);nodePaths.set(spec.id,file);fs.writeFileSync(file,render(meta));}
    for(const spec of specs){
      const current=validateWorkspace(work);assert.equal(current.ok,true,JSON.stringify(current.errors));
      const node=current.nodes.find(n=>n.id===spec.id);assert.equal(node.eligible,true);
      const e=path.join(work,spec.id,'evidence','initial');fs.mkdirSync(e,{recursive:true});
      fs.writeFileSync(path.join(e,'manifest.yaml'),JSON.stringify({schema:'work/evidence@1',id:spec.id+'-proof',nodeId:spec.id,inputDigest:node.inputDigest,outcome:'pass',assertions:[{id:'fixture-proof',outcome:'pass',observation:'Synthetic contract fixture observation; not a product verification claim.'}],assets:[]}));
      fs.writeFileSync(nodePaths.get(spec.id),render({...metadata.get(spec.id),state:'done',completion:{inputDigest:node.inputDigest,evidence:[spec.id+'-proof']}}));
    }
    const complete=validateWorkspace(work);assert.equal(complete.ok,true);assert.ok(complete.nodes.every(n=>n.effectiveState==='done'));
    const savedNodes=new Map([...nodePaths].map(([id,file])=>[id,fs.readFileSync(file,'utf8')]));
    // A freshly captured OUTPUT has its own new evidence bundle; it is not promoted into resource.files.
    const captureDir=path.join(work,'ui-design','evidence','new-capture');fs.mkdirSync(captureDir,{recursive:true});
    const capture=Buffer.from('89504e470d0a1a0a','hex');fs.writeFileSync(path.join(captureDir,'output.png'),capture);
    fs.writeFileSync(path.join(captureDir,'manifest.yaml'),JSON.stringify({schema:'work/evidence@1',id:'new-output-only',nodeId:'ui-design',inputDigest:complete.nodes.find(n=>n.id==='ui-design').inputDigest,outcome:'inconclusive',assertions:[{id:'output-only',outcome:'inconclusive',observation:'Synthetic new output artifact, not accepted design authority.'}],assets:[{path:'output.png',sha256:sha256(capture)}]}));
    const captured=validateWorkspace(work);assert.equal(captured.ok,true,JSON.stringify(captured.errors));assert.ok(captured.nodes.every(n=>n.effectiveState==='done'));
    fs.writeFileSync(sourceFile,'<svg xmlns="http://www.w3.org/2000/svg"><rect width="20" height="10"/></svg>');
    const changed=validateWorkspace(work);assert.equal(changed.ok,false);
    for(const id of ['art-direction','ui-design','frontend','uat']) assert.equal(changed.nodes.find(n=>n.id===id).effectiveState,'suspended',id);
    assert.equal(changed.nodes.find(n=>n.id==='unrelated').effectiveState,'done');
    for(const [id,file] of nodePaths) assert.equal(fs.readFileSync(file,'utf8'),savedNodes.get(id),'Validation preserves old completion/evidence refs');
    // NA does not supply an account/module prerequisite even in a fresh valid scope.
    const accountDir=path.join(work,'account');fs.mkdirSync(accountDir);fs.writeFileSync(path.join(accountDir,'node.md'),render({schema:'work/node@1',id:'account',kind:'operations',required:true,state:'na',naReason:'Synthetic decision: account not provisioned'}));
    const moduleDir=path.join(work,'module');fs.mkdirSync(moduleDir);fs.writeFileSync(path.join(moduleDir,'node.md'),render({schema:'work/node@1',id:'module',kind:'operations',required:true,state:'todo',dependsOn:['account'],assertions:['module-proof']}));
    const gated=validateWorkspace(work).nodes.find(n=>n.id==='module');assert.equal(gated.eligible,false);assert.ok(gated.blockedBy.includes('account'));
  } finally {assert.equal(path.dirname(temporary),os.tmpdir());assert.ok(path.basename(temporary).startsWith('work3-op-graph-'));fs.rmSync(temporary,{recursive:true,force:true});}
});
