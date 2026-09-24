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

/**
 * A ledger opened on a hard-coded absolute path registers that path in the host's machine arbiter
 * (machine.sqlite `ledgers`), and the registration outlives the spec. engine-lifecycle.spec once enrolled
 * `C:/fixture/.starciwork/runtime.sqlite`: the directory was created outside every temp root, the ledger was
 * registered on the live host, and the allocation balance (scripts/agent/balance.mjs) counted it as a product
 * ledger long after the spec was deleted. A spec's ledger lives under a temp directory it made (withLedger,
 * mkdtempSync) or is handed an injected registry - never a real path literal.
 */
test('no spec names a real-path ledger: fixtures use temp dirs or an injected registry',()=>{
  // An absolute ledger-path literal handed to whatever opens, enrolls or registers a ledger: a `file`,
  // `ledgerFile`, `journalFile` or `machineFile` field, or the first argument of openLedger, openMachine,
  // inspectLedger, ledgerFileFor or registerLedger. A path a spec merely classifies is data, not a sink.
  const LITERAL=/(?:\b(?:file|ledgerFile|journalFile|machineFile)\s*:\s*|\b(?:openLedger|openMachine|inspectLedger|ledgerFileFor|registerLedger)\(\s*)(['"`])(?:[A-Za-z]:(?=[\\/])|(?=\/(?![/*])))[^'"`\n]*?(?:\.sqlite|[\\/]\.starciwork|[\\/]fixtures?\b)[^'"`\n]*\1/g;
  // The rule itself, on the literal that caused it.
  assert.equal([..."enrollEngine(store,state,{ledgerFile:'C:/fixture/.starciwork/runtime.sqlite'})".matchAll(LITERAL)].length,1);
  assert.equal([..."openLedger({file:'/fixture/.starciwork/runtime.sqlite'})".matchAll(LITERAL)].length,1);
  assert.equal([..."ledgerFileFor('C:/fixture')".matchAll(LITERAL)].length,1);
  assert.equal([..."openLedger({file:path.join(root,'.starciwork','runtime.sqlite')})".matchAll(LITERAL)].length,0);
  assert.equal([..."isFixtureLedgerPath('C:/fixture/.starciwork/runtime.sqlite')".matchAll(LITERAL)].length,0,'data, not a sink');
  const self=path.resolve(fileURLToPath(import.meta.url));
  const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()
    ?walk(path.join(dir,entry.name)):/\.m?js$/.test(entry.name)?[path.join(dir,entry.name)]:[]);
  const offenders=[];
  for(const file of walk(path.join(runtimeRoot,'tests')).filter(file=>path.resolve(file)!==self)){
    for(const match of fs.readFileSync(file,'utf8').matchAll(LITERAL))
      offenders.push(`${path.relative(runtimeRoot,file).replace(/\\/g,'/')}: ${match[0]}`);
  }
  assert.deepEqual(offenders,[],'these specs name an absolute ledger path; build it under a temp directory instead');
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
