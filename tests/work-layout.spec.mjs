import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {sameDriveTmp} from './_ledger-fixture.mjs';
import {checkWorkLayout,formatWorkLayout,FAMILIES} from '../checks/work-layout.mjs';

const runtimeRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const EXAMPLE=path.join(runtimeRoot,'examples','todo-app','.starciwork');

/**
 * One fixture Work tree per case. It is built under `sameDriveTmp()` - never inside the runtime tree, which
 * `runtime-tree-hygiene.spec.mjs` enforces - and its removal is registered the moment it exists, so a case
 * that throws halfway still leaves nothing behind. Cleanup that runs only when the code under test
 * succeeded is not cleanup.
 */
function tree(t,write={}){
  const parent=sameDriveTmp();
  fs.mkdirSync(parent,{recursive:true});
  const root=fs.mkdtempSync(path.join(parent,'starci-work-layout-'));
  t.after(()=>{try{fs.rmSync(root,{recursive:true,force:true});}catch{}});
  const files={
    'workspace.yaml':'schema: work/workspace\nid: todo-app\nproject: todo-app\n',
    'index.yaml':'schema: work/catalog\nid: todo\nfeatures:\n  - {id: task, directory: features/task}\n',
    '.gitignore':'runtime.sqlite\nkernel-evidence/\n',
    'ledger-anchor.json':'{"schema":"starci/ledger-anchor","workflows":{}}\n',
    'features/task/index.yaml':'schema: work/feature\nid: task\ntitle: A task\n',
    'features/task/br/title/required/index.yaml':
      'schema: work/business-rule\nid: br.task.title.required\nstate: done\n',
    ...write,
  };
  for(const [relative,body] of Object.entries(files)){
    if(body===null)continue;
    const file=path.join(root,relative);
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,body);
  }
  return root;
}
const codes=result=>result.findings.map(finding=>finding.code);
const at=(result,code)=>result.findings.filter(finding=>finding.code===code).map(finding=>finding.path);

test('the todo-app example is the layout, and reports clean',()=>{
  const result=checkWorkLayout({workRoot:EXAMPLE});
  assert.equal(result.schema,'starci/work-layout-check@1');
  assert.deepEqual(result.findings,[],formatWorkLayout(result));
  assert.equal(result.clean,true);
});

test('a minimal tree with one feature and one record is clean',t=>{
  const result=checkWorkLayout({workRoot:tree(t)});
  assert.deepEqual(result.findings,[],formatWorkLayout(result));
});

test('a grouping directory between a family and a record carries no node and is not a finding',t=>{
  const root=tree(t,{
    'features/task/br/title/required/index.yaml':null,
    'features/task/br/complete/once/index.yaml':'schema: work/business-rule\nid: br.task.complete.once\nstate: done\n',
  });
  fs.rmSync(path.join(root,'features/task/br/title'),{recursive:true,force:true});
  const result=checkWorkLayout({workRoot:root});
  assert.deepEqual(result.findings,[],formatWorkLayout(result));
});

test('WORK_ROOT_UNKNOWN_ENTRY: a root entry that is none of the three custodies',t=>{
  const result=checkWorkLayout({workRoot:tree(t,{'notes.md':'a note nobody can place\n','scratch/keep.txt':'x\n'})});
  assert.deepEqual(codes(result),['WORK_ROOT_UNKNOWN_ENTRY','WORK_ROOT_UNKNOWN_ENTRY']);
  assert.deepEqual(at(result,'WORK_ROOT_UNKNOWN_ENTRY').sort(),['notes.md','scratch']);
});

test('WORK_RECORD_MISSING_INDEX: a leaf directory below a family with no node file',t=>{
  const root=tree(t);
  fs.mkdirSync(path.join(root,'features/task/br/delete/final'),{recursive:true});
  const result=checkWorkLayout({workRoot:root});
  assert.deepEqual(codes(result),['WORK_RECORD_MISSING_INDEX']);
  assert.deepEqual(at(result,'WORK_RECORD_MISSING_INDEX'),['features/task/br/delete/final']);
});

test('WORK_RECORD_MISSING_INDEX names the deepest loss, not every segment above it',t=>{
  const root=tree(t);
  fs.mkdirSync(path.join(root,'features/task/br/delete/final/soon'),{recursive:true});
  const result=checkWorkLayout({workRoot:root});
  assert.deepEqual(at(result,'WORK_RECORD_MISSING_INDEX'),['features/task/br/delete/final/soon']);
});

test('WORK_RECORD_MISSING_INDEX: an evidence run with no manifest, and a criterion with no node',t=>{
  const root=tree(t);
  fs.mkdirSync(path.join(root,'features/task/br/title/required/evidence/proves-title'),{recursive:true});
  fs.mkdirSync(path.join(root,'features/task/br/title/required/ac/refuses-empty'),{recursive:true});
  const result=checkWorkLayout({workRoot:root});
  assert.deepEqual(at(result,'WORK_RECORD_MISSING_INDEX').sort(),
    ['features/task/br/title/required/ac/refuses-empty','features/task/br/title/required/evidence/proves-title']);
});

test('WORK_ID_PATH_MISMATCH: the id and the directory are two names for one thing',t=>{
  const result=checkWorkLayout({workRoot:tree(t,{
    'features/task/br/title/required/index.yaml':'schema: work/business-rule\nid: br.task.title.mandatory\nstate: done\n',
  })});
  assert.deepEqual(codes(result),['WORK_ID_PATH_MISMATCH']);
  assert.match(result.findings[0].detail,/br\.task\.title\.required/);
});

test('WORK_ID_PATH_MISMATCH: a criterion is named after its rule, and evidence after its directory',t=>{
  const result=checkWorkLayout({workRoot:tree(t,{
    'features/task/br/title/required/ac/refuses-empty/index.yaml':
      'schema: work/acceptance-criterion\nid: ac.task.refuses-empty\n',
    'features/task/br/title/required/evidence/proves-title/manifest.yaml':
      'schema: work/evidence\nid: proves-the-title\nrecord: br.task.title.required\n',
  })});
  assert.deepEqual(codes(result),['WORK_ID_PATH_MISMATCH','WORK_ID_PATH_MISMATCH']);
  assert.match(result.findings.find(f=>f.path.includes('/ac/')).detail,/ac\.task\.title\.required\.refuses-empty/);
  assert.match(result.findings.find(f=>f.path.includes('/evidence/')).detail,/proves-title/);
});

test('WORK_SECOND_BRAND: a product has one brand or none',t=>{
  const result=checkWorkLayout({workRoot:tree(t,{
    'brand/index.yaml':'schema: work/brand\nid: brand\nrev: 1\n',
    'features/task/decision/house-brand/index.yaml':'schema: work/brand\nid: decision.task.house-brand\n',
  })});
  assert.deepEqual(codes(result).sort(),['WORK_SECOND_BRAND','WORK_SECOND_BRAND']);
  assert.ok(result.findings.some(finding=>/2 brand records/.test(finding.detail)));
});

test('WORK_EMPTY_FAMILY: a family directory with no record in it is scaffolding',t=>{
  const root=tree(t);
  fs.mkdirSync(path.join(root,'features/task/uat'),{recursive:true});
  fs.mkdirSync(path.join(root,'features/task/sds'),{recursive:true});
  const result=checkWorkLayout({workRoot:root});
  assert.deepEqual(codes(result),['WORK_EMPTY_FAMILY','WORK_EMPTY_FAMILY']);
  assert.deepEqual(at(result,'WORK_EMPTY_FAMILY').sort(),['features/task/sds','features/task/uat']);
});

test('WORK_ASSET_AS_NODE: a node hidden in the payload',t=>{
  const result=checkWorkLayout({workRoot:tree(t,{
    'features/task/br/title/required/assets/captures/index.yaml':'schema: work/business-rule\nid: sneaky\n',
  })});
  assert.deepEqual(codes(result),['WORK_ASSET_AS_NODE']);
  assert.equal(at(result,'WORK_ASSET_AS_NODE')[0],'features/task/br/title/required/assets/captures/index.yaml');
});

test('WORK_PARENT_AUTHORS_STATE: the catalog, a feature and a record with records below it',t=>{
  const result=checkWorkLayout({workRoot:tree(t,{
    'index.yaml':'schema: work/catalog\nid: todo\nstate: done\nfeatures: []\n',
    'features/task/index.yaml':'schema: work/feature\nid: task\nstate: done\nproven: {by: []}\n',
    'features/task/br/title/index.yaml':'schema: work/business-rule\nid: br.task.title\nstate: done\n',
  })});
  assert.deepEqual(codes(result),['features/task/br/title/index.yaml','features/task/index.yaml','index.yaml']
    .map(()=>'WORK_PARENT_AUTHORS_STATE'));
  assert.deepEqual(at(result,'WORK_PARENT_AUTHORS_STATE').sort(),
    ['features/task/br/title/index.yaml','features/task/index.yaml','index.yaml']);
});

test('WORK_RUNTIME_IN_CANONICAL: runtime custody smuggled below the root',t=>{
  const root=tree(t);
  fs.mkdirSync(path.join(root,'features/task/br/title/required/kernel-evidence'),{recursive:true});
  fs.writeFileSync(path.join(root,'features/task/br/title/required/runtime.sqlite'),'');
  fs.mkdirSync(path.join(root,'features/task/kernel-strays'),{recursive:true});
  const result=checkWorkLayout({workRoot:root});
  assert.deepEqual(codes(result),['WORK_RUNTIME_IN_CANONICAL','WORK_RUNTIME_IN_CANONICAL','WORK_RUNTIME_IN_CANONICAL']);
  assert.deepEqual(at(result,'WORK_RUNTIME_IN_CANONICAL').sort(),[
    'features/task/br/title/required/kernel-evidence',
    'features/task/br/title/required/runtime.sqlite',
    'features/task/kernel-strays']);
});

test('runtime custody at the root is legal and hashed by nobody',t=>{
  const root=tree(t);
  for(const name of ['runtime.sqlite','runtime.sqlite-wal','runtime.sqlite-shm'])fs.writeFileSync(path.join(root,name),'');
  for(const name of ['kernel-evidence','kernel-strays','kernel-headless','kernel-approvals','_local'])
    fs.mkdirSync(path.join(root,name),{recursive:true});
  const result=checkWorkLayout({workRoot:root});
  assert.deepEqual(result.findings,[],formatWorkLayout(result));
});

test('WORK_UNKNOWN_FAMILY: a directory under a feature that is not one of the ten',t=>{
  const root=tree(t);
  fs.mkdirSync(path.join(root,'features/task/business/srs'),{recursive:true});
  fs.writeFileSync(path.join(root,'features/task/readme.md'),'x\n');
  const result=checkWorkLayout({workRoot:root});
  assert.deepEqual(codes(result),['WORK_UNKNOWN_FAMILY','WORK_UNKNOWN_FAMILY']);
  assert.deepEqual(at(result,'WORK_UNKNOWN_FAMILY').sort(),['features/task/business','features/task/readme.md']);
  assert.match(result.findings.find(f=>f.path==='features/task/business').detail,new RegExp(FAMILIES.join(', ')));
});

test('shared/ carries the same record shape, under the shared owner',t=>{
  const result=checkWorkLayout({workRoot:tree(t,{
    'shared/br/audit/trail/index.yaml':'schema: work/business-rule\nid: br.shared.audit.trail\nstate: done\n',
  })});
  assert.deepEqual(result.findings,[],formatWorkLayout(result));
});

test('a uat record may keep its accounts.yaml; no other family may',t=>{
  const result=checkWorkLayout({workRoot:tree(t,{
    'features/task/uat/create/index.yaml':'schema: work/uat-flow\nid: uat.task.create\nstate: done\n',
    'features/task/uat/create/accounts.yaml':'schema: work/disposable-accounts\naccounts: []\n',
    'features/task/br/title/required/accounts.yaml':'schema: work/disposable-accounts\naccounts: []\n',
  })});
  assert.deepEqual(codes(result),['WORK_UNKNOWN_RECORD_ENTRY']);
  assert.equal(at(result,'WORK_UNKNOWN_RECORD_ENTRY')[0],'features/task/br/title/required/accounts.yaml');
});

test('a Work root that does not exist is refused, not reported as findings',()=>{
  assert.throws(()=>checkWorkLayout({workRoot:path.join(sameDriveTmp(),'no-such-work-root')}),/Not a Work root/);
  assert.throws(()=>checkWorkLayout({}),/Not a Work root/);
});
