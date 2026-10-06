import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ledgerIdForRepo,ledgerFileFor,openLedger} from '../../engine/db/ledger.mjs';
import {sha256File} from '../../engine/digest.mjs';
import {repoRootKey} from '../../engine/db/ledger-paths.mjs';
import {pathKey} from '../../scripts/lib/path-key.mjs';
test('Current-platform case identities preserve owned stores and refuse another physical root',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'ledger-native-case-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const upper=path.join(root,'Repo'),lower=path.join(root,'repo');fs.mkdirSync(upper);
  const windows=process.platform==='win32';
  if(windows){
    assert.equal(fs.realpathSync.native(lower),fs.realpathSync.native(upper));
    assert.equal(pathKey(upper),pathKey(lower));assert.equal(repoRootKey(upper),repoRootKey(lower));assert.equal(ledgerIdForRepo(upper),ledgerIdForRepo(lower));
  }else{
    fs.mkdirSync(lower);assert.notEqual(fs.realpathSync.native(upper),fs.realpathSync.native(lower));
    assert.notEqual(pathKey(upper),pathKey(lower));assert.notEqual(repoRootKey(upper),repoRootKey(lower));assert.notEqual(ledgerIdForRepo(upper),ledgerIdForRepo(lower));
  }
  const env={STARCI_PROJECTS_ROOT:path.join(root,'projects'),STARCI_TEST_MACHINE_FILE:path.join(root,'missing-machine.sqlite')};
  const owned=path.join(env.STARCI_PROJECTS_ROOT,ledgerIdForRepo(upper),'runtime.sqlite');
  const ledger=openLedger({file:owned});try{ledger.db.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES('repo_root',?)").run(upper);}finally{ledger.close();}
  const ownedDigest=sha256File(owned);assert.equal(ledgerFileFor(upper,{env}),owned);
  if(windows)assert.equal(ledgerFileFor(lower,{env}),owned);
  assert.equal(sha256File(owned),ownedDigest);
  const other=windows?path.join(root,'Other'):lower;if(windows)fs.mkdirSync(other);
  assert.notEqual(repoRootKey(upper),repoRootKey(other));assert.notEqual(ledgerIdForRepo(upper),ledgerIdForRepo(other));
  const foreign=path.join(env.STARCI_PROJECTS_ROOT,ledgerIdForRepo(other),'runtime.sqlite');assert.notEqual(foreign,owned);
  const wrong=openLedger({file:foreign});try{wrong.db.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES('repo_root',?)").run(upper);}finally{wrong.close();}
  const foreignDigest=sha256File(foreign);assert.throws(()=>ledgerFileFor(other,{env}),e=>e.code==='STARCI_LEDGER_ROOT_MISMATCH');
  assert.equal(sha256File(foreign),foreignDigest);assert.equal(sha256File(owned),ownedDigest);
});
