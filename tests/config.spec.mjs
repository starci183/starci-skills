import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {loadConfig} from '../scripts/config.mjs';
import {selectProfile} from '../profiles/select.mjs';
test('local config initializes once, preserves preferences and rejects invalid data',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-config-'));
 try {
 fs.copyFileSync(new URL('../config.example.json',import.meta.url),path.join(root,'config.example.json'));
 assert.deepEqual(loadConfig(root,{initialize:true}),{language:'vi',model:null,effort:'medium'});
 const custom={language:'en',model:'test-host-model',effort:'medium'};
 fs.writeFileSync(path.join(root,'config.json'),JSON.stringify(custom));
 assert.deepEqual(loadConfig(root,{initialize:true}),custom);
 const selected=selectProfile({runtime:'codex',op:'backend.implement',config:custom});
 assert.equal(selected.model,custom.model); assert.equal(selected.effort,'medium'); assert.equal(selected.language,'en');
 fs.writeFileSync(path.join(root,'config.json'),'{}');
 assert.throws(()=>loadConfig(root,{initialize:true}),/Invalid config/);
 assert.equal(fs.readFileSync(path.join(root,'config.json'),'utf8'),'{}');
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});
