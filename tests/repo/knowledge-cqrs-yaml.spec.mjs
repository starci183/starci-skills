import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import YAML from 'yaml';

const patternSource=name=>fs.readFileSync(fileURLToPath(new URL(`../../knowledge/patterns/be/${name}.yaml`,import.meta.url)),'utf8');

test('backend pattern files with comma-separated TypeScript names parse without changing CQRS case text',()=>{
  for(const name of ['folder','naming','test']){
    const doc=YAML.parseDocument(patternSource(name),{version:'1.2',schema:'core',uniqueKeys:true,strict:true});
    assert.deepEqual(doc.errors,[],name);
    assert.deepEqual(doc.warnings,[],name);
  }
  const doc=YAML.parseDocument(patternSource('api'),{version:'1.2',schema:'core',uniqueKeys:true,strict:true});
  assert.deepEqual(doc.errors,[]);
  assert.deepEqual(doc.warnings,[]);
  const cases=doc.toJS({maxAliasCount:0}).rules[0].cases;
  assert.equal(cases[0].write,'application/start-checkout.command.ts, start-checkout.handler.ts, start-checkout.contracts.ts (the handler has no spec: its service does).');
  assert.equal(cases[1].write,'application/get-cart.query.ts, get-cart.handler.ts, get-cart.contracts.ts (the handler has no spec: its service does).');
});
