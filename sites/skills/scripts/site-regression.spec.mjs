import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {parseYaml} from '../../../core/yaml.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../../..');
const generated=path.resolve(here,'../src/catalog.generated.json');

test('site consumes the generated catalog built from source YAML',async()=>{
 const main=fs.readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
 assert.match(main,/from ['"]\.\/catalog\.generated\.json['"]/);
 assert.doesNotMatch(main,/\.dist/);
 // Regenerate so the assertion always compares against current source, not a stale artifact.
 await import('./generate-data.mjs?'+Date.now());
 const site=JSON.parse(fs.readFileSync(generated,'utf8'));
 const workflows=parseYaml(fs.readFileSync(path.join(root,'workflows','catalog.yaml'),'utf8'));
 const opsDir=path.join(root,'modules','ops','ops');
 const ops=fs.readdirSync(opsDir).filter(f=>f.endsWith('.yaml')).map(f=>parseYaml(fs.readFileSync(path.join(opsDir,f),'utf8')));
 assert.deepEqual(site.workflows.map(w=>w.id),workflows.workflows.map(w=>w.id));
 assert.equal(site.workflows.length,16);
 assert.ok(site.workflows.every(w=>w.definition));
 assert.deepEqual(site.operators.map(o=>o.id),ops.map(o=>o.id).sort());
 assert.ok(site.operators.find(o=>o.id==='task.execute'));
 assert.ok(!site.operators.find(o=>o.id==='interface.generate'));
});
