import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {tempRoot} from '../../engine/temp-root.mjs';
import {ruleCatalog} from '../../scripts/work/ui/grammar-knowledge-renderers.mjs';

const fixture=t=>{
  const root=fs.mkdtempSync(path.join(tempRoot(),'starci-rule-catalog-reader-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.mkdirSync(path.join(root,'src','common'),{recursive:true});
  return {root,file:path.join(root,'src','common','rule-catalog.generated.ts')};
};

test('the census catalog reads numeric and AUTO addresses only from the generated declaration array',t=>{
  const f=fixture(t);
  fs.writeFileSync(f.file,'/* "STATE-4" is a retired reference, not a declaration. */\n'+
    'export const RULE_FAMILY_COUNTS = Object.freeze({ "COLOR-1": 2 } as const)\n'+
    'export const CANONICAL_RULE_IDS: ReadonlyArray<string> = Object.freeze(["STATE-8", "MARGIN-AUTO", "RADIUS-6"])\n');
  const catalog=ruleCatalog(f.root);
  assert.deepEqual(catalog.ids,['STATE-8','MARGIN-AUTO','RADIUS-6']);
  assert.deepEqual([...catalog.prefixes],['STATE','MARGIN','RADIUS']);
});

test('missing, invalid or duplicate declaration arrays refuse instead of shrinking the census silently',t=>{
  const f=fixture(t);
  for(const body of [
    'const other = "STATE-8";\n',
    'export const CANONICAL_RULE_IDS = Object.freeze([])\n',
    'export const CANONICAL_RULE_IDS = Object.freeze(["STATE-8", "STATE-8"])\n',
    'export const CANONICAL_RULE_IDS = Object.freeze(["not-a-rule"])\n',
  ]){
    fs.writeFileSync(f.file,body);
    assert.throws(()=>ruleCatalog(f.root),/canonical rule id array/i);
  }
});

test('the generator can validate a specific existing target through the same catalog reader',t=>{
  const f=fixture(t),target=path.join(f.root,'pending.ts');
  fs.writeFileSync(target,'export const CANONICAL_RULE_IDS = Object.freeze(["MARGIN-AUTO"])\n');
  assert.deepEqual(ruleCatalog(f.root,{file:target}).ids,['MARGIN-AUTO']);
  assert.deepEqual([...ruleCatalog(f.root,{file:target}).prefixes],['MARGIN']);
});
