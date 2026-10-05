import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {putBlob,getBlob,blobPath} from '../../engine/db/blob.mjs';
const world=t=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'blob-publication-')),saved=process.env.STARCI_ARTIFACT_ROOT;process.env.STARCI_ARTIFACT_ROOT=root;t.after(()=>{if(saved===undefined)delete process.env.STARCI_ARTIFACT_ROOT;else process.env.STARCI_ARTIFACT_ROOT=saved;fs.rmSync(root,{recursive:true,force:true});});return root;};
test('same-size corrupted immutable destination is refused without replacement',t=>{
  world(t);const bytes=Buffer.from('verified evidence'),first=putBlob(bytes),file=blobPath(first.sha);fs.writeFileSync(file,Buffer.alloc(bytes.length,0));assert.throws(()=>putBlob(bytes),/hash mismatch/);assert.deepEqual(fs.readFileSync(file),Buffer.alloc(bytes.length,0));
});
test('failed flush publishes no acknowledged bytes and leaves only an incomplete sidecar',t=>{
  const root=world(t),real=fs.fsyncSync;let count=0;fs.fsyncSync=fd=>{if(++count===2)throw Error('injected flush failure');return real(fd);};
  try{assert.throws(()=>putBlob(Buffer.from('complete on retry')),/injected flush/);}finally{fs.fsyncSync=real;}
  const files=fs.readdirSync(root,{recursive:true}).filter(n=>fs.statSync(path.join(root,n)).isFile());assert.equal(files.length,1);assert.ok(files[0].endsWith('.json'));assert.ok(files.every(n=>!n.endsWith('.tmp')));
  const retried=putBlob(Buffer.from('complete on retry'));assert.deepEqual(getBlob(retried.sha),Buffer.from('complete on retry'));
});
test('a refused exclusive temp create never cleans up another writer\'s file',t=>{
  world(t);const real=fs.openSync;let collided=null;
  fs.openSync=(file,flags,...args)=>{if(flags==='wx'&&String(file).endsWith('.tmp')){collided=file;const fd=real(file,'wx');try{fs.writeFileSync(fd,'other writer temp');}finally{fs.closeSync(fd);}throw Object.assign(Error('injected exclusive-create collision'),{code:'EEXIST'});}return real(file,flags,...args);};
  try{assert.throws(()=>putBlob(Buffer.from('never published')),e=>e.code==='EEXIST');}finally{fs.openSync=real;}
  assert.equal(fs.readFileSync(collided,'utf8'),'other writer temp');
});
