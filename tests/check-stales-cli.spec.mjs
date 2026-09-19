import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const run=args=>spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',windowsHide:true});

test('the public compiled stale command preserves script JSON diagnostics and nonzero status',()=>{
  const args=['--work'];
  const script=run(['scripts/checks/check-stales.mjs',...args]);
  const command=run(['bin/starci.mjs','check-stales',...args]);
  assert.equal(script.status,2,script.stderr);assert.equal(command.status,script.status,command.stderr);
  assert.deepEqual(JSON.parse(command.stdout),JSON.parse(script.stdout));
  assert.equal(JSON.parse(command.stdout).schema,'starci/source-staleness-error@1');
});

test('the public compiled stale command exposes the executable canonical Work interface',()=>{
  const command=run(['bin/starci.mjs','check-stales','--help']);
  assert.equal(command.status,0,command.stderr);
  for(const flag of ['--work','--repo','--target'])assert.ok(command.stdout.includes(flag));
  const unknown=run(['bin/starci.mjs','check-stales','--fix','true']);
  assert.equal(unknown.status,2);assert.equal(JSON.parse(unknown.stdout).code,'INVALID_INPUT');
});
