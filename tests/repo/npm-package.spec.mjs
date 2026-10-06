import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {braceVariants,globExpression} from '../../scripts/lib/glob.mjs';

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
  // npm strictly includes existing literal files; directory/glob negations prune the remaining tree.
  // Keep those exact example positives while avoiding dependency/output/private-custody bulk.
  const selectedExamples=new Set(pkg.files.filter(entry=>entry.startsWith('examples/')&&!entry.endsWith('/')&&!entry.includes('*')));
  const excluded=pkg.files.filter(entry=>entry.startsWith('!')).flatMap(entry=>{
    const body=entry.slice(1).replace(/\/(?:\*\*)?$/,'');
    return braceVariants(`${body}{,/**}`).map(globExpression);
  });
  const negated=absolute=>{
    const rel=path.relative(root,absolute).replaceAll('\\','/');
    return !selectedExamples.has(rel)&&excluded.some(pattern=>pattern.test(rel));
  };
  assert.equal(negated(path.join(root,'ext/sonar/secrets')),true,'private custody is pruned before copying the source');
  for(const project of ['ecommerce-app','lite-app','shape-slot'])
    assert.equal(negated(path.join(root,'examples',project,'.starcistacks/dev/secrets')),true,'example private custody is pruned before copying the source');
  assert.equal(negated(path.join(root,'packages/cli/node_modules')),true,'the local CLI install is pruned before copying the source');
  for(const entry of pkg.files){
    if(entry.startsWith('!'))continue;
    const from=path.join(root,entry);
    if(fs.existsSync(from))fs.cpSync(from,path.join(source,entry),{recursive:true,filter:src=>!negated(src)});
  }
  // A local CLI install must never enter the root payload, including in a clean checkout with none present.
  const privateDependency=path.join(source,'packages/cli/node_modules/starci-package-fixture');
  fs.mkdirSync(privateDependency,{recursive:true});
  fs.writeFileSync(path.join(privateDependency,'package.json'),'{"name":"starci-package-fixture","version":"0.0.0"}\n');
  const privateCustody=path.join(source,'ext/sonar/secrets');
  fs.mkdirSync(path.join(privateCustody,'nested'),{recursive:true});
  for(const file of ['fixture.key.enc','nested/fixture.txt.enc'])
    fs.writeFileSync(path.join(privateCustody,file),'package-exclusion-fixture\n');
  const neighbors=['examples/.runtimes/ecommerce-app/runtime.sqlite-wal','examples/.runtimes/ecommerce-app/runtime.sqlite-shm',
    'examples/.runtimes/ecommerce-app/runtime.sqlite-journal','examples/.runtimes/foreign/runtime.sqlite',
    'examples/.runtimes/ecommerce-app/artifacts/ff/'+ 'f'.repeat(64),
    'examples/.runtimes/ecommerce-app/artifacts/ff/'+ 'f'.repeat(64)+'.json',
    'examples/ecommerce-app/.starciwork/private.yaml','examples/ecommerce-app/.starciwork/features/private/index.yaml',
    'examples/lite-app/.starciwork/features/private/index.yaml','examples/shape-slot/.starciwork/features/private/index.yaml',
    'examples/ecommerce-app/.starcistacks/dev/secrets/fixture.key.enc',
    'examples/lite-app/.starcistacks/dev/secrets/fixture.key.enc',
    'examples/shape-slot/.starcistacks/dev/secrets/fixture.key.enc'];
  for(const relative of neighbors){const file=path.join(source,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'public synthetic exclusion fixture');}
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
    'examples/lite-app/.starciwork/features/system-health/index.yaml',
    'examples/shape-slot/.starciwork/features/system-health/index.yaml',
    'scripts/gates/stacks-gate.mjs',
  ])
    assert.ok(shipped.has(file),`npm tarball must ship ${file}`);
  assert.equal([...shipped].some(file=>file.startsWith('tests/')),false,'npm tarball must not ship tests');
  assert.equal([...shipped].some(file=>file.startsWith('packages/cli/')&&file.endsWith('.spec.mjs')),false,'npm tarball must not ship CLI source specs');
  assert.deepEqual([...shipped].filter(file=>file.split('/').includes('node_modules')),[],'npm tarball must not ship node_modules');
  assert.deepEqual([...shipped].filter(file=>file==='ext/sonar/secrets'||file.startsWith('ext/sonar/secrets/')),[],'npm tarball must not ship private Sonar custody');
  assert.equal(selectedExamples.size,18,'only BASIC13, three own Work catalog indexes and two declared system-health seeds are literal example inputs');
  // The hfs scaffold templates are the package's own source and ship whole; every other .starciwork file is a declared example index.
  const scaffold=file=>file.startsWith('packages/hfs/templates/app/');
  assert.deepEqual([...shipped].filter(file=>file.split('/').includes('.starciwork')&&!scaffold(file)).sort(),
    [...selectedExamples].filter(file=>file.split('/').includes('.starciwork')).sort(),'only declared public Work indexes ship');
  for(const file of [...shipped].filter(file=>file.split('/').includes('.starciwork')&&scaffold(file)))
    assert.ok(fs.existsSync(path.join(root,file)),`a shipped scaffold template is a file of the source tree: ${file}`);
  assert.deepEqual([...shipped].filter(file=>file.startsWith('examples/.runtimes/')).sort(),
    [...selectedExamples].filter(file=>file.startsWith('examples/.runtimes/')).sort(),'only approved basic source members ship');
  for(const relative of neighbors)assert.equal(shipped.has(relative),false,relative);
  for(const dead of ['cli/','hosts/','execution/','workflows/','contracts/','approvals/','specifications/','upgrades/','legacy/','fixtures/'])
    assert.equal([...shipped].some(file=>file.startsWith(dead)),false,`npm tarball must not ship ${dead}`);
  fs.writeFileSync(path.join(target,'package.json'),'{}\n');
  const installed=npm(['install','--ignore-scripts','--omit=dev','--no-audit','--no-fund','--package-lock=false',path.join(temporary,receipt.filename)],target);
  assert.equal(installed.status,0,installed.stderr??String(installed.error));
  const deployed=path.join(target,'node_modules/starci');
  assert.equal(fs.existsSync(path.join(deployed,'node_modules/yaml')),false);
  for(const relative of selectedExamples)assert.deepEqual(fs.readFileSync(path.join(deployed,relative)),
    fs.readFileSync(path.join(root,relative)),`installed declared example bytes: ${relative}`);
  // The entry dispatcher must load and answer a read-only verb with no dev dependencies installed.
  const probe=spawnSync(process.execPath,[path.join(deployed,'packages/cli/bin/starci.mjs'),'runtime','version'],{cwd:target,encoding:'utf8',windowsHide:true});
  assert.equal(probe.status,0,probe.stderr);
  assert.ok(probe.stdout.trim().length>0,'version prints the installed package version');
  assert.deepEqual(fs.readFileSync(path.join(deployed,'LICENSE')),fs.readFileSync(path.join(root,'LICENSE')),'installed runtime retains its canonical license bytes');
  assert.doesNotMatch(probe.stderr,/ERR_MODULE_NOT_FOUND|Cannot find/);
});
