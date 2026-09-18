import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {buildFiles} from '../scripts/build-workflows.mjs';

const root=path.resolve(import.meta.dirname,'..');

test('installed stack contract reaches replacing op modes and ships runnable example assets',()=>{
  const files=buildFiles(root);
  const consumers={'architecture.decide':[],'backend.implement':[],'interface.implement':[],'work.author':[],
    'runtime.operate':['inspect','serve','service'],'release.deliver':['deploy','migrate'],'review.verify':['delivery','api']};
  for(const [id,modes] of Object.entries(consumers)){
    const op=JSON.parse(files.get(`ops/${id}/operator.json`));
    for(const contract of [op,...modes.map(mode=>op.executionModes[mode])]){
      assert.ok(contract.reads.some(read=>read.id==='application-stacks'),id);
      assert.ok(contract.steps[0].reads.includes('application-stacks'),id);
    }
  }
  // The old examples/application-stacks/tiny-stateful (owner ruling: deleted, examples/ keeps only the
  // todo-app repositories) shipped a toy app/Dockerfile + app/server.mjs + gateway/nginx.conf + shell
  // scripts under the `.stacks/` name; a rename script pointed this list at todo-app-backend without
  // noticing the shapes differ. todo-app-backend is a real NestJS app: it has no Dockerfile (dev compose
  // pulls a prebuilt image) and its `.mjs`/`.sh`/`.ps1`/`.conf` files are not in the packaging rule's
  // shipped-extension set for a non-application-stacks-named example (scripts/build-workflows.mjs, out of
  // this file's scope to change) - only `.md/.yaml/.yml/.ts/.tsx/.png/.svg` ship. Its real runnable proof
  // is src/main.ts (a real Nest entrypoint, `.ts` ships) plus the renamed `.starcistacks` contract files.
  for(const file of ['checks/stacks.mjs','schemas/application-stacks.schema.json','knowledge/application-stacks.json',
    'docs/application-stacks.md','docs/application-stacks-vps.md',
    ...['src/main.ts','.starcistacks/application-stacks.yaml','.starcistacks/dev/infra/compose/compose.yaml','.starcistacks/vps/infra/stack.yaml']
      .map(name=>'examples/todo-app-backend/'+name)])assert.ok(files.has(file),file);
  assert.equal([...files.keys()].some(file=>file.startsWith('examples/todo-app-backend/')&&
    (/\/(runtime|generated|\.runtime)\//.test(file)||/\.(enc|agekey)$/.test(file))),false);
});

test('stacks CLI refuses missing or malformed evidence without echoing file contents or mutation',t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'starci-stacks-cli-'));
  t.after(()=>{assert.equal(path.dirname(directory),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(directory).startsWith('starci-stacks-cli-'));fs.rmSync(directory,{recursive:true,force:true});});
  // checks/stacks.mjs hardcodes '.starcistacks/application-stacks.yaml' as the manifest location -
  // matches docs/application-stacks.md too, since ex-stacks-rename renamed the checker's own hardcoded
  // directory name from '.stacks' to '.starcistacks' to match what the examples tree already used. Write
  // to '.starcistacks/...' consistently so the checker exercises the intended malformed-deployment-model
  // scenario instead of always failing on a missing manifest.
  fs.mkdirSync(path.join(directory,'.starcistacks'));
  fs.writeFileSync(path.join(directory,'.starcistacks/application-stacks.yaml'),'schema: starci/application-stacks@1\n');
  const model=path.join(directory,'rendered.json'),sentinel='synthetic-secret-never-echo';
  fs.writeFileSync(model,'{"token":"'+sentinel+'",BROKEN');
  const before=fs.readFileSync(model);
  const result=spawnSync(process.execPath,[path.join(root,'cli/main.mjs'),'stacks','check',directory,'--environment','dev','--deployment-model',model],{encoding:'utf8'});
  assert.equal(result.status,1);
  assert.equal(JSON.parse(result.stdout).ok,false);
  assert.equal((result.stdout+result.stderr).includes(sentinel),false);
  assert.deepEqual(fs.readFileSync(model),before);
  const missing=spawnSync(process.execPath,[path.join(root,'cli/main.mjs'),'stacks','check',directory],{encoding:'utf8'});
  assert.equal(missing.status,1);assert.match(missing.stderr,/requires/);
});

test('runtime packaging excludes accidental generated example plaintext and ciphertext',t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'starci-stacks-package-'));
  t.after(()=>{assert.equal(path.dirname(directory),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(directory).startsWith('starci-stacks-package-'));fs.rmSync(directory,{recursive:true,force:true});});
  for(const entry of ['config.example.yaml','cli','ops','workflows','model','kernel','hosts','models','checks','providers','approvals',
    'execution','knowledge','contracts','specifications','examples','scripts','core','schemas'])
    fs.cpSync(path.join(root,entry),path.join(directory,entry),{recursive:true});
  const base='examples/todo-app-backend/.starcistacks/dev/';
  for(const suffix of ['secrets.yaml','secrets.yaml.enc','runtime/files/secret.yaml','generated/deployment-model.yaml']){
    const target=path.join(directory,base,suffix);fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,'synthetic-credential-must-not-ship');
  }
  const files=buildFiles(directory);
  for(const suffix of ['secrets.yaml','secrets.yaml.enc','runtime/files/secret.yaml','generated/deployment-model.yaml'])assert.equal(files.has(base+suffix),false);
  assert.ok(files.has(base+'infra/compose/compose.yaml'));
});
