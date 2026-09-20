import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {parseYaml} from '../core/yaml.mjs';
import {payloadFiles} from '../bin/starci-skills.mjs';

const root=path.resolve(import.meta.dirname,'..');

test('installed stack contract reaches replacing op modes and ships runnable example assets',()=>{
  const files=new Set(payloadFiles(root));
  const consumers={'architecture.decide':[],'backend.implement':[],'interface.implement':[],'work.author':[],
    'runtime.operate':['inspect','serve','service'],'release.deliver':['deploy','migrate'],'review.verify':['delivery','api']};
  for(const [id,modes] of Object.entries(consumers)){
    const op=parseYaml(fs.readFileSync(path.join(root,'modules/ops/ops',`${id}.yaml`),'utf8'));
    for(const contract of [op,...modes.map(mode=>op.executionModes[mode])]){
      assert.ok(contract.reads.some(read=>read.id==='application-stacks'),id);
      assert.ok(contract.steps[0].reads.includes('application-stacks'),id);
    }
  }
  for(const file of ['scripts/checks/stacks.mjs','schemas/application-stacks.schema.yaml','knowledge/application-stacks.yaml',
    'docs/application-stacks.md','docs/application-stacks-vps.md',
    ...['gateway/nginx.conf','scripts/prepare.sh','scripts/prepare.ps1','.gitignore',
      '.starcistacks/application-stacks.yaml','.starcistacks/dev/README.md','.starcistacks/dev/infra/compose/compose.yaml',
      '.starcistacks/vps/README.md','.starcistacks/vps/infra/stack.yaml']
      .map(name=>'examples/todo-app-backend/'+name)])assert.ok(files.has(file),file);
  assert.equal([...files.keys()].some(file=>file.startsWith('examples/todo-app-backend/')&&
    (/\/(runtime|generated|\.runtime)\//.test(file)||/\.(enc|agekey)$/.test(file))),false);
  assert.equal([...files.keys()].some(file=>file.startsWith('examples/todo-app-backend/')&&file.endsWith('.mjs')),false);
});

test('stacks CLI refuses missing or malformed evidence without echoing file contents or mutation',t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'starci-stacks-cli-'));
  t.after(()=>{assert.equal(path.dirname(directory),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(directory).startsWith('starci-stacks-cli-'));fs.rmSync(directory,{recursive:true,force:true});});
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
  // Minimal stack-kit fixture: only the authored compose input plus planted materialized/secret files.
  const base='examples/todo-app-backend/.starcistacks/dev/';
  for(const suffix of ['infra/compose/compose.yaml','secrets.yaml','secrets.yaml.enc','runtime/files/secret.yaml','generated/deployment-model.yaml']){
    const target=path.join(directory,base,suffix);fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,'synthetic-credential-must-not-ship');
  }
  const files=new Set(payloadFiles(directory));
  for(const suffix of ['secrets.yaml','secrets.yaml.enc','runtime/files/secret.yaml','generated/deployment-model.yaml'])assert.equal(files.has(base+suffix),false,base+suffix);
  assert.ok(files.has(base+'infra/compose/compose.yaml'));
});
