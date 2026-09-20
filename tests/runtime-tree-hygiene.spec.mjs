import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

/**
 * This directory is the runtime every other repository loads. A spec that builds its fixture inside it turns
 * the runtime tree into scratch space, and the damage is not the mess: a fixture left behind is read by the
 * next run as if it were real. That is exactly what happened before this gate existed - thirteen
 * `.workflow-amendment-test-*` roots and a `.starciwork/` holding a live workflow id and a ledger of two test
 * workflows, all inside `.claude`, because one fixture's cleanup ran only if `store.close()` had not thrown.
 *
 * Cleanup that depends on the code under test succeeding is not cleanup. So the rule is enforced at its
 * source: a fixture goes in the OS temp directory, and `t.after` removes it whether or not anything threw.
 */
const runtimeRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const SPEC=/\.spec\.mjs$/;

test('no spec builds its fixture inside the runtime tree',()=>{
  const offenders=[];
  for(const name of fs.readdirSync(path.join(runtimeRoot,'tests')).filter(file=>SPEC.test(file))){
    const body=fs.readFileSync(path.join(runtimeRoot,'tests',name),'utf8');
    if(/mkdtempSync\(\s*(?:path\.join\(\s*)?process\.cwd\(\)/.test(body)||/mkdirSync\(\s*path\.join\(\s*process\.cwd\(\)\s*,\s*['"`]\./.test(body))
      offenders.push(name);
  }
  assert.deepEqual(offenders,[],'these specs create fixtures in the runtime tree; use os.tmpdir() instead');
});

test('the runtime tree carries no fixture leftovers',()=>{
  // `.starciwork` in the runtime's own root means a kernel resolved this directory as a Work root.
  const strays=fs.readdirSync(runtimeRoot,{withFileTypes:true})
    .filter(entry=>entry.isDirectory())
    .map(entry=>entry.name)
    .filter(name=>/-test-[A-Za-z0-9]{6}$/.test(name)||/^\.tmp-/.test(name)||/^tmp-/.test(name)||name==='.starciwork');
  assert.deepEqual(strays,[],'fixture leftovers in the runtime tree are read by the next run as if they were real');
});

test('the runtime directory is refused as a Work root',async()=>{
  const {ledgerFileFor,isRuntimeRoot}=await import('../engine/ledger-db.mjs');
  assert.equal(isRuntimeRoot(runtimeRoot),true,'this checkout is a runtime');
  assert.throws(()=>ledgerFileFor(runtimeRoot),/ledger-root-is-runtime/);
  // The Work root of a project still resolves normally: the refusal is about identity, not about paths.
  const elsewhere=path.join(runtimeRoot,'tests','fixtures');
  assert.equal(isRuntimeRoot(elsewhere),false);
  assert.match(ledgerFileFor(elsewhere),/\.starciwork/);
});
