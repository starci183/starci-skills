import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root=path.resolve(import.meta.dirname,'..');
function npm(args,cwd){
  const local=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
  const cli=process.env.npm_execpath??(fs.existsSync(local)?local:null);
  return cli?spawnSync(process.execPath,[cli,...args],{cwd,encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024}):
    spawnSync('npm',args,{cwd,encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});
}

test('actual npm tarball installs a runnable source command without development dependencies',t=>{
  t.diagnostic('real npm pack + npm install on purpose: only a real install can prove no dev dependency or ERR_MODULE_NOT_FOUND leaks through; there is one scenario here, nothing to merge or fake');
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'starci-npm-package-'));
  t.after(()=>{
    assert.equal(path.dirname(temporary),fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(temporary).startsWith('starci-npm-package-'));
    fs.rmSync(temporary,{recursive:true,force:true});
  });
  const source=path.join(temporary,'source'),target=path.join(temporary,'installed');
  fs.mkdirSync(source);fs.mkdirSync(target);
  // Exercise npm's real files/gitignore rules, not a hand-copied installed tree: the payload is the
  // declared source tree, exactly what `files` publishes.
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  for(const name of ['package.json','.gitignore'])fs.copyFileSync(path.join(root,name),path.join(source,name));
  for(const entry of pkg.files){
    const from=path.join(root,entry);
    if(fs.existsSync(from))fs.cpSync(from,path.join(source,entry),{recursive:true});
  }
  const packed=npm(['pack','--ignore-scripts','--json','--pack-destination',temporary],source);
  assert.equal(packed.status,0,packed.stderr??String(packed.error));
  const receipt=JSON.parse(packed.stdout)[0];
  assert.equal(receipt.files.some(file=>file.path.startsWith('.dist')),false,'no compiled bundle is shipped');
  assert.ok(receipt.files.some(file=>file.path==='cli/main.mjs'));
  assert.ok(receipt.files.some(file=>file.path==='scripts/checks/stacks.mjs'));
  fs.writeFileSync(path.join(target,'package.json'),'{}\n');
  const installed=npm(['install','--ignore-scripts','--omit=dev','--no-audit','--no-fund','--package-lock=false',path.join(temporary,receipt.filename)],target);
  assert.equal(installed.status,0,installed.stderr??String(installed.error));
  const deployed=path.join(target,'node_modules/starci');
  assert.equal(fs.existsSync(path.join(deployed,'node_modules/yaml')),false);
  const probe=spawnSync(process.execPath,[path.join(deployed,'bin/starci.mjs'),'stacks','check',target,'--environment','dev','--deployment-model',path.join(target,'missing.json')],{cwd:target,encoding:'utf8',windowsHide:true});
  assert.equal(probe.status,1,probe.stderr);
  const result=JSON.parse(probe.stdout);
  assert.equal(result.ok,false);
  assert.equal(result.schema,'starci/application-stacks-check@1');
  assert.doesNotMatch(probe.stderr,/ERR_MODULE_NOT_FOUND|Cannot find/);
});
