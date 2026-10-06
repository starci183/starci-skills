import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {openLedger,verifyEventChain} from '../../engine/db/ledger.mjs';

// The runtime schema file is the executed DDL; a fresh ledger must carry every declared object.
const ENGINE=path.resolve(import.meta.dirname,'..', '..', 'engine', 'db', 'schema');
const read=name=>fs.readFileSync(path.join(ENGINE,name),'utf8');
const namesInFile=(kind,sql)=>{
  const names=[...sql.matchAll(new RegExp(`CREATE\\s+${kind}\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?["'\`]?(\\w+)`,'gi'))].map(m=>m[1]);
  if(kind==='TABLE')names.push(...[...sql.matchAll(/CREATE\s+VIRTUAL\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi)].map(m=>m[1]));
  return names.sort();
};
const namesInDb=(db,kind)=>db.prepare("SELECT name FROM sqlite_master WHERE type=? AND name NOT LIKE 'sqlite_%' ORDER BY name").all(kind)
  .map(r=>r.name).filter(name=>!/^logs_fts_(?:config|data|docsize|idx)$/.test(name));

test('runtime schema CREATE statements match what openLedger applies to a fresh ledger',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-schema-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite')});
  try{
    const sql=read('runtime.sql');
    for(const kind of ['TABLE','TRIGGER']){
      const file=namesInFile(kind,sql),live=namesInDb(ledger.db,kind.toLowerCase());
      assert.deepEqual(live,file,`runtime schema declares ${kind.toLowerCase()}s [${file}] but the open ledger holds [${live}]`);
    }
  }finally{ledger.close();}
});

test('runtime schema keeps events append-only and the writer computes the digest chain',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-schema-events-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite')});
  try{
    ledger.ensureWorkflow({workflowId:'wf-schema'});
    const first=ledger.appendEvent({workflowId:'wf-schema',entityType:'workflow',entityId:'wf-schema',kind:'fixture-event',payload:{n:1}});
    assert.equal(verifyEventChain(ledger.db,'wf-schema').ok,true);
    assert.throws(()=>ledger.db.prepare('UPDATE events SET kind=? WHERE seq=?').run('changed',first.seq),/events are append-only/);
  }finally{ledger.close();}
});
