import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {openLedger} from '../engine/ledger-db.mjs';

// engine/schema.sql is the executed DDL: the tables/triggers a fresh openLedger applies equal its CREATE
// statements, and triggers.sql (the backfill copy of events_digest_chain) is byte-equal to the inline one.
const ENGINE=path.resolve(import.meta.dirname,'..','engine');
const read=name=>fs.readFileSync(path.join(ENGINE,name),'utf8');
const namesInFile=(kind,sql)=>[...sql.matchAll(new RegExp(`CREATE\\s+${kind}\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?["'\`]?(\\w+)`,'gi'))].map(m=>m[1]).sort();
const namesInDb=(db,kind)=>db.prepare("SELECT name FROM sqlite_master WHERE type=? AND name NOT LIKE 'sqlite_%' ORDER BY name").all(kind).map(r=>r.name);
const digestTrigger=sql=>sql.match(/CREATE TRIGGER IF NOT EXISTS events_digest_chain[\s\S]*?\n {2}END;/)?.[0];

test('schema.sql CREATE statements match what openLedger applies to a fresh ledger',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-schema-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite')});
  try{
    const sql=read('schema.sql');
    for(const kind of ['TABLE','TRIGGER']){
      const file=namesInFile(kind,sql),live=namesInDb(ledger.db,kind.toLowerCase());
      assert.deepEqual(live,file,`schema.sql declares ${kind.toLowerCase()}s [${file}] but the open ledger holds [${live}]`);
    }
  }finally{ledger.close();}
});

test('triggers.sql carries the events_digest_chain trigger byte-equal to schema.sql',()=>{
  const inline=digestTrigger(read('schema.sql')),standalone=digestTrigger(read('triggers.sql'));
  assert.ok(inline,'schema.sql carries events_digest_chain');
  assert.equal(standalone,inline);
});
