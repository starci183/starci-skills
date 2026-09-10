import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseYaml} from '../core/yaml.mjs';
import {validateSourceLayout} from '../workflows/source-layout.mjs';

const contract=parseYaml(fs.readFileSync(new URL('../schemas/source-layout.yaml',import.meta.url),'utf8'));
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-source-layout-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const be=path.join(root,'be'),fe=path.join(root,'fe');
 const make=(base,relative,content)=>{const target=path.join(base,relative);fs.mkdirSync(path.dirname(target),{recursive:true});if(content===null)fs.mkdirSync(target,{recursive:true});else fs.writeFileSync(target,content);};
 for(const relative of ['.git','.stacks','.workspaces','src'])make(be,relative,null);
 for(const relative of ['AGENTS.md','CLAUDE.md'])make(be,relative,'Read .claude/SKILL.md\n');
 make(be,'.claude/SKILL.md','Synthetic runtime entry.\n');make(be,'.starciwork/workspace.yaml','schema: work/workspace@1\nid: synthetic\n');make(be,'.starciwork/features/index.yaml','schema: work/node@2\nid: features\nkind: business\nrequired: true\ndescription: Synthetic feature catalog.\n');
 make(be,'package.json','{}');make(be,'pnpm-workspace.yaml','packages: []\n');make(be,'tsconfig.json','{}');
 for(const relative of ['.git','src','public'])make(fe,relative,null);
 make(fe,'AGENTS.md','Synthetic frontend rules.\n');make(fe,'CLAUDE.md','@AGENTS.md\n');make(fe,'package.json','{}');make(fe,'pnpm-workspace.yaml','packages: []\n');make(fe,'tsconfig.json','{}');
 return {be,fe};
}
test('one backend host owns runtime, stacks and feature Work while frontend remains source-only',t=>{const f=fixture(t),result=validateSourceLayout({...f,workRoot:path.join(f.be,'.starciwork')},contract);assert.equal(result.ok,true,JSON.stringify(result.errors));});
test('missing backend contract and duplicate frontend state fail with exact roles',t=>{const f=fixture(t);fs.rmSync(path.join(f.be,'.stacks'),{recursive:true});fs.mkdirSync(path.join(f.fe,'.claude'));fs.mkdirSync(path.join(f.fe,'.starciwork'));const result=validateSourceLayout({...f,workRoot:path.join(f.fe,'.starciwork')},contract);assert.equal(result.ok,false);assert.ok(result.errors.some(e=>e.role==='be'&&e.path==='.stacks'));assert.ok(result.errors.some(e=>e.role==='fe'&&e.path==='.claude'));assert.ok(result.errors.some(e=>e.code==='WORK_OWNER'));});
test('malformed manifests and retired backend versions are rejected',t=>{const f=fixture(t);fs.writeFileSync(path.join(f.be,'package.json'),'{');fs.mkdirSync(path.join(f.be,'.claude_legacy'));const result=validateSourceLayout(f,contract);assert.ok(result.errors.some(e=>e.code==='JSON'));assert.ok(result.errors.some(e=>e.path==='.claude_legacy'));});
