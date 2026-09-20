import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const run=args=>spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',windowsHide:true});

// There is no `starci <check>` dispatcher verb any more — the public command IS the script
// (`node scripts/checks/check-stales.mjs`), so its JSON diagnostics are the contract.
test('the stale check preserves script JSON diagnostics and nonzero status',()=>{
  const script=run(['scripts/checks/check-stales.mjs','--work']);
  assert.equal(script.status,2,script.stderr);
  assert.equal(JSON.parse(script.stdout).schema,'starci/source-staleness-error@1');
});

test('the stale check exposes the executable Work interface on --help and refuses unknown flags',()=>{
  const help=run(['scripts/checks/check-stales.mjs','--help']);
  assert.equal(help.status,0,help.stderr);
  for(const flag of ['--work','--repo','--target'])assert.ok(help.stdout.includes(flag));
  const unknown=run(['scripts/checks/check-stales.mjs','--fix','true']);
  assert.equal(unknown.status,2);assert.equal(JSON.parse(unknown.stdout).code,'INVALID_INPUT');
});
