import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {markSource,runBlobGc,verifyBlobArchive,blobGcExitCode} from '../../scripts/housekeeping/blob-gc.mjs';
import {zipWrite} from '../../scripts/api/fs/zip-write.mjs';
import {sha256} from '../../engine/digest.mjs';
test('a missing applicable reference column invalidates marking coverage',()=>{
  const db=new DatabaseSync(':memory:');try{db.exec('CREATE TABLE blob_ref_columns(table_name TEXT,column_name TEXT); CREATE TABLE actual(sha TEXT); INSERT INTO blob_ref_columns VALUES(\'actual\',\'missing_sha\');');const out=markSource(db,{kind:'ledger'});assert.match(out.error,/actual.missing_sha/);assert.equal(out.refs[0].missing,true);}finally{db.close();}
});
test('destructive blob apply refuses without ever touching lock/writer/archive/delete seams',async()=>{
  const plan={blocked:[],marksBySource:{},toArchive:[{sha:'a'.repeat(64)}],toSweep:[]};let plans=0;
  const out=await runBlobGc({apply:true,plan:async()=>{plans++;return plan;},writers:new Proxy({}, {get(){throw Error('writer must remain untouched');}}),acquireLock:()=>{throw Error('lock must remain untouched');}});
  assert.equal(plans,1);assert.equal(out.ok,false);assert.equal(out.capability,'blob-deletion-fence-unavailable');assert.equal(out.effectState,'none');assert.equal(out.freedBytes,0);assert.deepEqual(out.items,[]);assert.equal(blobGcExitCode(out),1);
  assert.equal((await runBlobGc({plan:async()=>plan})).ok,true);for(const result of [{ok:false},{items:[{action:'refuse'}]},{items:[{action:'failed'}]},{blocked:['unknown source']},{refused:'busy'}])assert.equal(blobGcExitCode(result),1);
});
test('recorded archives need matching archive identity and exact verified blob entry',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'gc-archive-proof-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const original=path.join(root,'original'),bytes=Buffer.from('retained original proof');fs.writeFileSync(original,bytes);const sha=sha256(bytes),archive=path.join(root,'proof.zip'),written=zipWrite(archive,[{name:sha,data:bytes}]);
  assert.equal(verifyBlobArchive(`${archive}!${sha}`,sha,{expectedArchiveSha:written.sha256}).ok,true);
  assert.throws(()=>verifyBlobArchive(`${archive}!${sha}`,sha,{expectedArchiveSha:'0'.repeat(64)}),/identity mismatch/);
  const good=fs.readFileSync(archive);fs.writeFileSync(archive,good.subarray(0,good.length-7));assert.throws(()=>verifyBlobArchive(`${archive}!${sha}`,sha));assert.deepEqual(fs.readFileSync(original),bytes);
  fs.writeFileSync(archive,good);assert.throws(()=>verifyBlobArchive(`${archive}!${'b'.repeat(64)}`,'b'.repeat(64)),/digest\/CRC/);assert.deepEqual(fs.readFileSync(original),bytes);
});
