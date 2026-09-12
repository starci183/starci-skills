import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {KERNEL_OWNED_LEDGER,ROLE_SIDES,bindingRoutes,readBindings,registryRoot,resolveLedgerRoot,sharedLedgerStatus} from '../execution/ledger-routing.mjs';
import {sameRepository} from '../execution/ledger-routing.mjs';
import {spawnSync as runGit} from 'node:child_process';

/**
 * One product, two repositories, one Work tree. The fixture is the shape the host route registry actually
 * has: a Source directory holding `.claude` and `.workspaces`, and the project's repositories beside it.
 */
function workspace(t,{ownerRole='be',pathFromRepository='.starciwork',features=true,project='demo'}={}){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-ledger-routing-'));
  t.after(()=>{assert.equal(path.dirname(root),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(root).startsWith('starci-ledger-routing-'));fs.rmSync(root,{recursive:true,force:true});});
  const source=path.join(root,'source');
  const host=path.join(source,'.claude');
  const backend=path.join(root,'demo-backend'),frontend=path.join(root,'demo-frontend');
  fs.mkdirSync(host,{recursive:true});
  for(const [directory,name] of [[backend,'demo-backend'],[frontend,'demo-frontend']]){
    fs.mkdirSync(directory,{recursive:true});
    fs.writeFileSync(path.join(directory,'package.json'),JSON.stringify({name}));
  }
  if(features)fs.mkdirSync(path.join(backend,'.starciwork','features','sales'),{recursive:true});
  const write=(name,binding)=>{
    const file=path.join(source,'.workspaces','projects',name,'work.json');
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,`${JSON.stringify(binding,null,2)}\n`);
    return file;
  };
  const binding={schema:'starci/workspace-binding@1',project,
    repositories:{be:{pathFromSource:'../demo-backend',gitRepository:'https://github.com/demo/demo-backend.git'},
      fe:{pathFromSource:'../demo-frontend',gitRepository:'https://github.com/demo/demo-frontend.git'}},
    work:{ownerRole,pathFromRepository}};
  const file=write(project,binding);
  return {root,source,host,backend,frontend,binding,file,write};
}
/** No remote at all: a route that still matches proves the declared path is enough on its own. */
const noRemote=()=>({status:1,stdout:'',stderr:'not a git repository'});
const remote=url=>()=>({status:0,stdout:`${url}\n`,stderr:''});

test('a frontend repository resolves the Work tree its backend owns, and the backend resolves its own',t=>{
  const fixture=workspace(t);
  const fe=resolveLedgerRoot({repoRoot:fixture.frontend,host:fixture.host,git:noRemote});
  assert.equal(fe.source,'workspace');
  assert.equal(fe.ledgerRoot,path.join(fixture.backend,'.starciwork'));
  assert.equal(fe.ownerRepoRoot,fixture.backend);
  assert.equal(fe.ownerRepository,'demo-backend');
  assert.equal(fe.sharedLedger,true);
  assert.equal(fe.exists,true);
  assert.equal(fe.project,'demo');
  assert.deepEqual([fe.role,fe.ownerRole,fe.side],['fe','be','frontend']);

  const be=resolveLedgerRoot({repoRoot:fixture.backend,host:fixture.host,git:noRemote});
  assert.equal(be.source,'workspace');
  assert.equal(be.ledgerRoot,path.join(fixture.backend,'.starciwork'));
  assert.equal(be.sharedLedger,false,'the owner shares nothing: it works its own tree');
  assert.deepEqual([be.role,be.side],['be','backend']);
  assert.equal(ROLE_SIDES.be,'backend');
});

test('precedence: an explicit --ledger-root outranks the route registry, which outranks the local tree',t=>{
  const fixture=workspace(t);
  // The frontend is routed, so without an option it resolves the backend tree...
  assert.equal(resolveLedgerRoot({repoRoot:fixture.frontend,host:fixture.host,git:noRemote}).ownerRepoRoot,fixture.backend);
  // ... and with one it resolves exactly what the user named, repository root or tree directory alike.
  const other=path.join(fixture.root,'other');
  fs.mkdirSync(path.join(other,'.starciwork','features'),{recursive:true});
  fs.writeFileSync(path.join(other,'package.json'),JSON.stringify({name:'@demo/other'}));
  for(const named of [path.join(other,'.starciwork'),other]){
    const option=resolveLedgerRoot({repoRoot:fixture.frontend,host:fixture.host,options:{'ledger-root':named},git:noRemote});
    assert.equal(option.source,'option');
    assert.equal(option.ledgerRoot,path.join(other,'.starciwork'));
    assert.equal(option.ownerRepoRoot,other);
    assert.equal(option.ownerRepository,'demo-other');
    assert.equal(option.sharedLedger,true);
    assert.equal(option.side,null,'an option names a tree, not a role, so it constrains no layout');
  }
  // Without a host there is no registry, so the repository's own tree is the answer.
  const local=resolveLedgerRoot({repoRoot:fixture.backend,git:noRemote});
  assert.equal(local.source,'local');
  assert.equal(local.ledgerRoot,path.join(fixture.backend,'.starciwork'));
  assert.equal(local.sharedLedger,false);
  assert.equal(local.exists,true);
  // A repository with no tree at all is not an error: that job runs the model-assessed plan ledger instead.
  const empty=resolveLedgerRoot({repoRoot:fixture.frontend,git:noRemote});
  assert.equal(empty.source,'local');
  assert.equal(empty.exists,false);
  assert.equal(empty.ledgerRoot,path.join(fixture.frontend,'.starciwork'));
});

test('a worktree is recognized by its git origin when its path is not the one the route declares',t=>{
  const fixture=workspace(t);
  const worktree=path.join(fixture.root,'worktrees','fe-session');
  fs.mkdirSync(worktree,{recursive:true});
  const routed=resolveLedgerRoot({repoRoot:worktree,host:fixture.host,git:remote('git@github.com:demo/demo-frontend.git')});
  assert.equal(routed.source,'workspace');
  assert.equal(routed.role,'fe','an scp-form remote normalizes to the declared https origin');
  assert.equal(routed.ownerRepoRoot,fixture.backend);
  assert.equal(routed.sharedLedger,true);
  // An unrelated origin at an unrelated path is bound by nothing and keeps its own (absent) tree.
  const stranger=resolveLedgerRoot({repoRoot:worktree,host:fixture.host,git:remote('https://github.com/demo/unrelated.git')});
  assert.equal(stranger.source,'local');
});

test('the host may be given as the Source directory itself, and the registry is read as bindings',t=>{
  const fixture=workspace(t);
  assert.equal(registryRoot(fixture.host),path.join(fixture.source,'.workspaces','projects'));
  assert.equal(registryRoot(fixture.source),path.join(fixture.source,'.workspaces','projects'));
  assert.equal(registryRoot(null),null);
  assert.equal(registryRoot(path.join(fixture.root,'nowhere')),null);
  const bindings=readBindings(registryRoot(fixture.host));
  assert.deepEqual(bindings.map(item=>item.project),['demo']);
  const routes=bindingRoutes(bindings[0].binding,{source:fixture.source});
  assert.deepEqual(routes.map(route=>[route.role,route.directory]),[['be',fixture.backend],['fe',fixture.frontend]]);
  assert.equal(routes[1].origin,'https://github.com/demo/demo-frontend.git');
  // A sibling-shaped route resolves to the same directory as the `pathFromSource` it replaces.
  assert.deepEqual(bindingRoutes({repositories:{fe:{kind:'sibling',directory:'demo-frontend'}}},{source:fixture.source})
    .map(route=>route.directory),[fixture.frontend]);
  assert.equal(resolveLedgerRoot({repoRoot:fixture.frontend,host:fixture.source,git:noRemote}).ownerRepoRoot,fixture.backend);
});

test('a tree that something promised and is not there is an error, never a silent fallback',t=>{
  // A named root with no features/ at all.
  const fixture=workspace(t);
  assert.throws(()=>resolveLedgerRoot({repoRoot:fixture.frontend,host:fixture.host,options:{'ledger-root':fixture.frontend},git:noRemote}),
    /is not a Work ledger/);
  // A route that points the Work somewhere the owner does not keep it.
  const moved=workspace(t,{pathFromRepository:'.work'});
  assert.throws(()=>resolveLedgerRoot({repoRoot:moved.frontend,host:moved.host,git:noRemote}),/has no features\/ tree/);
  // A binding that names this repository but no resolvable owner of the Work.
  const orphan=workspace(t,{ownerRole:'nobody'});
  assert.throws(()=>resolveLedgerRoot({repoRoot:orphan.frontend,host:orphan.host,git:noRemote}),/names no resolvable work\.ownerRole/);
  // Two projects claiming the same repository: the kernel asks instead of picking one.
  const twice=workspace(t);
  twice.write('duplicate',{...twice.binding,project:'duplicate'});
  assert.throws(()=>resolveLedgerRoot({repoRoot:twice.frontend,host:twice.host,git:noRemote}),/bound by 2 workspace projects/);
  // An owner whose tree exists resolves even when the project directory name is not the project id.
  const renamed=workspace(t,{project:'route-file-name'});
  assert.equal(resolveLedgerRoot({repoRoot:renamed.frontend,host:renamed.host,git:noRemote}).project,'route-file-name');
});

test('a shared ledger refuses to start over pending changes the kernel does not own',t=>{
  const fixture=workspace(t);
  const ledgerRoot=path.join(fixture.backend,'.starciwork');
  const status=lines=>sharedLedgerStatus({ownerRepoRoot:fixture.backend,ledgerRoot,
    git:(executable,args)=>{
      assert.deepEqual(args.slice(0,3),['status','--porcelain','--']);
      assert.equal(args[3],'.starciwork');
      return {status:0,stdout:lines.join('\n'),stderr:''};
    }});
  const kernelOwned=status([' M .starciwork/features/sales/implementation/backend/intake/index.yaml',
    '?? .starciwork/features/sales/implementation/backend/intake/evidence/',
    ' M .starciwork/_local/workflows/20260912-110000-x/state.json']);
  assert.equal(kernelOwned.ok,true);
  assert.deepEqual(kernelOwned.foreign,[]);
  assert.equal(kernelOwned.kernelOwned.length,3);
  const foreign=status([' M .starciwork/features/sales/business/srs/index.yaml',
    ' M .starciwork/features/sales/architecture/sds/intake/assets/flow.png',
    ' M .starciwork/features/sales/implementation/backend/intake/index.yaml']);
  assert.equal(foreign.ok,false);
  assert.deepEqual(foreign.foreign,['.starciwork/features/sales/architecture/sds/intake/assets/flow.png']);
  assert.ok(KERNEL_OWNED_LEDGER.test('.starciwork/features/sales/business/srs/index.yaml'));
  assert.equal(KERNEL_OWNED_LEDGER.test('.starciwork/features/sales/architecture/sds/intake/assets/flow.png'),false);
  // A tree git cannot read blocks nothing: the refusal needs an actual pending change, not a failed probe.
  assert.equal(sharedLedgerStatus({ownerRepoRoot:fixture.backend,ledgerRoot,git:noRemote}).ok,true);
  assert.equal(sharedLedgerStatus({ownerRepoRoot:fixture.backend,ledgerRoot,git:noRemote}).readable,false);
});

test('a worktree and the checkout it was cut from are one repository; two repositories are not',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-same-repo-'));
  const git=(cwd,...args)=>runGit('git',args,{cwd,encoding:'utf8',windowsHide:true});
  try{
    const main=path.join(root,'main'),other=path.join(root,'other'),wt=path.join(root,'wt');
    for(const dir of [main,other]){fs.mkdirSync(dir);git(dir,'init','-q');git(dir,'-c','user.email','t@t','-c','user.name','t','commit','-q','--allow-empty','-m','init');}
    git(main,'worktree','add','-q',wt,'-b','branch');
    assert.equal(sameRepository(main,wt),true);
    assert.equal(sameRepository(wt,main),true);
    assert.equal(sameRepository(main,other),false);
    assert.equal(sameRepository(main,main),true);
  }finally{try{git(path.join(root,'main'),'worktree','remove','--force',path.join(root,'wt'));}catch{}fs.rmSync(root,{recursive:true,force:true});}
});
