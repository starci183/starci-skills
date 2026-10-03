import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root=path.resolve(import.meta.dirname,'..', '..');
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
  const cliPkg=JSON.parse(fs.readFileSync(path.join(root,'packages/cli/package.json'),'utf8'));
  assert.equal(pkg.bin,undefined,'the runtime package does not own an npm bin');
  assert.deepEqual(cliPkg.bin,{starci:'./bin/' + 'starci.mjs'},'@starci/cli owns the only starci npm bin');
  assert.ok(pkg.files.includes('packages/cli/'),'the runtime package carries packages/cli');
  for(const name of ['package.json','.gitignore'])fs.copyFileSync(path.join(root,name),path.join(source,name));
  // files[] ends with the `!` negations npm subtracts after the positive entries. Subtracting them
  // while copying yields the same tarball without first duplicating the working tree's
  // node_modules/dist/storybook-static/coverage bulk, which npm would then discard.
  const excluded=pkg.files.filter(entry=>entry.startsWith('!')).map(entry=>{
    const body=entry.slice(1).replace(/\/+$/,'').replace(/[.+^${}()|[\]\\]/g,'\\$&')
      .replace(/\*\*\//g,'\u0000').replace(/\*/g,'[^/]*').replace(/\u0000/g,'(?:[^/]+/)*');
    return new RegExp(`^${body}(?:/|$)`);
  });
  const negated=absolute=>{
    const rel=path.relative(root,absolute).replaceAll('\\','/');
    return excluded.some(pattern=>pattern.test(rel));
  };
  for(const entry of pkg.files){
    if(entry.startsWith('!'))continue;
    const from=path.join(root,entry);
    if(fs.existsSync(from))fs.cpSync(from,path.join(source,entry),{recursive:true,filter:src=>!negated(src)});
  }
  const packed=npm(['pack','--ignore-scripts','--json','--pack-destination',temporary],source);
  assert.equal(packed.status,0,packed.stderr??String(packed.error));
  const receipt=JSON.parse(packed.stdout)[0];
  const shipped=new Set(receipt.files.map(file=>file.path));
  assert.equal([...shipped].some(file=>file.startsWith('.dist')),false,'no compiled bundle is shipped');
  for(const file of [
    'packages/cli/bin/starci.mjs',
    'packages/cli/src/catalog.generated.mjs',
    'packages/cli/completions/starci.bash',
    'scripts/cli/main.mjs',
    'modules/cli/commands/_global.yaml',
    'scripts/install/install.mjs',
    'scripts/kernel/cli.mjs',
    'engine/db/ledger.mjs',
    'scripts/gates/stacks-gate.mjs',
  ])
    assert.ok(shipped.has(file),`npm tarball must ship ${file}`);
  assert.equal([...shipped].some(file=>file.startsWith('tests/')),false,'npm tarball must not ship tests');
  assert.equal([...shipped].some(file=>file.split('/').includes('node_modules')),false,'npm tarball must not ship node_modules');
  assert.equal([...shipped].some(file=>file.split('/').includes('.starciwork')),false,'npm tarball must not ship .starciwork');
  for(const dead of ['cli/','hosts/','execution/','workflows/','contracts/','approvals/','specifications/','upgrades/','legacy/','fixtures/'])
    assert.equal([...shipped].some(file=>file.startsWith(dead)),false,`npm tarball must not ship ${dead}`);
  fs.writeFileSync(path.join(target,'package.json'),'{}\n');
  const installed=npm(['install','--ignore-scripts','--omit=dev','--no-audit','--no-fund','--package-lock=false',path.join(temporary,receipt.filename)],target);
  assert.equal(installed.status,0,installed.stderr??String(installed.error));
  const deployed=path.join(target,'node_modules/starci');
  assert.equal(fs.existsSync(path.join(deployed,'node_modules/yaml')),false);
  // The entry dispatcher must load and answer a read-only verb with no dev dependencies installed.
  const probe=spawnSync(process.execPath,[path.join(deployed,'packages/cli/bin/starci.mjs'),'runtime','version'],{cwd:target,encoding:'utf8',windowsHide:true});
  assert.equal(probe.status,0,probe.stderr);
  assert.ok(probe.stdout.trim().length>0,'version prints the installed package version');
  assert.doesNotMatch(probe.stderr,/ERR_MODULE_NOT_FOUND|Cannot find/);
});
