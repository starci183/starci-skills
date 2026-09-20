import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT=path.resolve(import.meta.dirname,'..');
// Lane m13: the shipped schema.sql is promoted from a docs-only extract to the
// EXECUTED DDL source (r1-REPORT §3). The parity this spec pins: the set of
// tables/triggers a fresh openLedger applies must equal the CREATE statements
// in the file — silent drift between the two was the defect this tree cut
// exists to prevent.
//
// Canonical post-flip paths are engine/schema.sql + engine/ledger-db.mjs;
// pre-flip they still live at sqlite/schema.sql + kernel/ledger-db.mjs.
const SCHEMA_FILE=['engine/schema.sql','sqlite/schema.sql'].map(p=>path.join(ROOT,p)).find(p=>fs.existsSync(p));
const LEDGER_MODULE=await (async()=>{
  for(const p of ['../engine/ledger-db.mjs','../kernel/ledger-db.mjs']){
    if(!fs.existsSync(path.join(ROOT,p.slice(3))))continue;
    try{return await import(p);}catch{/* landed but not yet wired — fall back */}
  }
  throw new Error('no importable ledger module at engine/ or kernel/');
})();
const {openLedger}=LEDGER_MODULE;

const namesInFile=(kind,sql)=>[...sql.matchAll(new RegExp(`CREATE\\s+${kind}\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?["'\`]?(\\w+)`,'gi'))].map(m=>m[1]).sort();
const namesInDb=(db,kind)=>db.prepare("SELECT name FROM sqlite_master WHERE type=? AND name NOT LIKE 'sqlite_%' ORDER BY name").all(kind).map(r=>r.name);

test('schema.sql CREATE statements match what openLedger applies to a fresh ledger',t=>{
  assert.ok(SCHEMA_FILE,'no schema.sql found at engine/ or sqlite/');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-schema-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite')});
  try{
    const sql=fs.readFileSync(SCHEMA_FILE,'utf8');
    for(const kind of ['TABLE','TRIGGER']){
      const file=namesInFile(kind,sql),live=namesInDb(ledger.db,kind.toLowerCase());
      assert.deepEqual(live,file,
        `${path.basename(SCHEMA_FILE)} declares ${kind.toLowerCase()}s [${file}] but the open ledger holds [${live}] — the file must be the executed DDL, not a stale extract`);
    }
  }finally{ledger.close();}
});
