import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
test('site consumes the current generated catalog directly from .dist',()=>{
 const main=fs.readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
 assert.match(main,/from ['"]\.\.\/\.\.\/\.\.\/\.dist\/docs\/site-catalog\.json['"]/);
 assert.doesNotMatch(main,/catalog\.generated\.json/);
 const site=read('../../../.dist/docs/site-catalog.json');
 const source=read('../../../.dist/ops/catalog.json');
 assert.deepEqual(site.operators.map(o=>o.id),source.ops.map(o=>o.id));
 assert.equal(site.workflows.length,16);
 assert.ok(site.workflows.every(w=>w.definition));
 assert.ok(site.operators.find(o=>o.id==='task.execute'));
 assert.ok(!site.operators.find(o=>o.id==='interface.generate'));
});
