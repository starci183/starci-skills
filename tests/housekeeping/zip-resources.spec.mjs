import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {zipWrite} from '../../scripts/api/fs/zip-write.mjs';
import {zipVisit} from '../../scripts/api/fs/zip-visit.mjs';
import {sha256,sha256File} from '../../engine/digest.mjs';
const world=t=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'zip-resource-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;};
test('ZIP verification visits payloads one at a time and retains only digest metadata',t=>{
  const file=path.join(world(t),'proof.zip'),data=Buffer.alloc(1024*1024,1),written=zipWrite(file,[{name:'small.txt',data:'proof'},{name:'compressible.bin',data}]);let visited=0;
  const checked=zipVisit(file,e=>{visited++;assert.equal(e.crcOk,true);assert.equal(e.sha256,sha256(e.data));assert.deepEqual(e.data,visited===1?Buffer.from('proof'):data);});assert.equal(visited,2);assert.equal(checked.sha256,written.sha256);assert.equal(checked.sha256,sha256File(file));assert.ok(checked.entries.every(e=>e.data===undefined));
  const fd=fs.openSync(file,'r');try{assert.equal(sha256File(fd),written.sha256);const b=Buffer.alloc(1);fs.readSync(fd,b,0,1,null);assert.equal(b[0],0x50,'descriptor hashing preserves caller offset');}finally{fs.closeSync(fd);}
});
test('archive, compressed, inflated, total and entry caps refuse before returning payloads',t=>{
  const root=world(t),file=path.join(root,'proof.zip');zipWrite(file,[{name:'a',data:Buffer.alloc(256,2)},{name:'b',data:Buffer.alloc(256,3)}]);
  for(const limits of [{maxArchiveBytes:fs.statSync(file).size-1},{maxEntryBytes:128},{maxTotalBytes:300},{maxEntries:1},{maxCompressedEntryBytes:1}])assert.throws(()=>zipVisit(file,undefined,limits),e=>e.code==='zip-limit');
  const tooLarge=path.join(root,'refused.zip');assert.throws(()=>zipWrite(tooLarge,[{name:'a',data:Buffer.alloc(33)}],{maxEntryBytes:32}),e=>e.code==='zip-limit');assert.equal(fs.existsSync(tooLarge),false);
  assert.throws(()=>zipWrite(tooLarge,[{name:'a',data:'one'},{name:'a',data:'two'}]),e=>e.code==='zip-name');assert.equal(fs.existsSync(tooLarge),false);
});
test('deceptive high-ratio sizes, malformed offsets and truncation stay bounded refusals',t=>{
  const file=path.join(world(t),'proof.zip');zipWrite(file,[{name:'large',data:Buffer.alloc(1024*1024)}]);const good=fs.readFileSync(file),eocd=good.length-22,central=good.readUInt32LE(eocd+16),local=good.readUInt32LE(central+42);
  const wrong=Buffer.from(good);wrong.writeUInt32LE(1,central+24);wrong.writeUInt32LE(1,local+22);fs.writeFileSync(file,wrong);assert.throws(()=>zipVisit(file),e=>e.code==='zip-corrupt');
  const outOfBounds=Buffer.from(good);outOfBounds.writeUInt32LE(good.length+100,central+42);fs.writeFileSync(file,outOfBounds);assert.throws(()=>zipVisit(file),e=>e.code==='zip-corrupt');
  fs.writeFileSync(file,good.subarray(0,good.length-1));assert.throws(()=>zipVisit(file),e=>e.code==='zip-corrupt');
});
test('duplicate reader names are rejected before any visitor sees bytes',t=>{
  const file=path.join(world(t),'proof.zip');zipWrite(file,[{name:'a',data:'one'},{name:'b',data:'two'}]);const bytes=fs.readFileSync(file),first=bytes.readUInt32LE(bytes.length-22+16),second=first+46+bytes.readUInt16LE(first+28)+bytes.readUInt16LE(first+30)+bytes.readUInt16LE(first+32),local=bytes.readUInt32LE(second+42);bytes[second+46]=0x61;bytes[local+30]=0x61;fs.writeFileSync(file,bytes);let visited=0;assert.throws(()=>zipVisit(file,()=>visited++),/duplicate/);assert.equal(visited,0);
});
