import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseYaml} from '../core/yaml.mjs';
import {skillRoot} from '../core/runtime-root.mjs';
import {validateSourceLayout} from '../workflows/source-layout.mjs';
import {main} from '../cli/main.mjs';

const contract=parseYaml(fs.readFileSync(new URL('../schemas/source-layout.yaml',import.meta.url),'utf8'));
function fixture(t,{hostIsBackend=false}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-source-layout-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const host=path.join(root,'host'),be=hostIsBackend?host:path.join(root,'be'),fe=path.join(root,'fe');
 const make=(base,relative,content)=>{const target=path.join(base,relative);fs.mkdirSync(path.dirname(target),{recursive:true});if(content===null)fs.mkdirSync(target,{recursive:true});else fs.writeFileSync(target,content);};
 for(const relative of ['.git','.workspaces/projects'])make(host,relative,null);
 for(const relative of ['AGENTS.md','CLAUDE.md'])make(host,relative,'Read .claude/SKILL.md\n');
 make(host,'.claude/SKILL.md','Synthetic runtime entry.\n');
 for(const relative of ['.git','src'])make(be,relative,null);
 make(be,'.claude/deployments',null);make(be,'.workspaces/device-state.json','{}');make(be,'.stacks/deployment.json','{}');
 make(be,'.starciwork/workspace.yaml','schema: work/workspace@1\nid: synthetic\n');make(be,'.starciwork/features/index.yaml','schema: work/node@2\nid: features\nkind: business\nrequired: true\ndescription: Synthetic feature catalog.\n');
 make(be,'package.json','{}');make(be,'pnpm-workspace.yaml','packages: []\n');make(be,'tsconfig.json','{}');
 for(const relative of ['.git','apps'])make(fe,relative,null);
 make(fe,'.claude/sources',null);make(fe,'.stacks/frontend-deployment.json','{}');
 make(fe,'package.json','{}');make(fe,'pnpm-workspace.yaml','packages: []\n');
 return {host,be,fe};
}
test('an explicit external host owns runtime while backend owns feature Work and frontend remains source-only',t=>{const f=fixture(t),result=validateSourceLayout({...f,workRoot:path.join(f.be,'.starciwork')},contract);assert.equal(result.ok,true,JSON.stringify(result.errors));assert.notEqual(result.roots.host,result.roots.be);});
test('an explicitly identical host/backend is valid without manufacturing another runtime',t=>{const f=fixture(t,{hostIsBackend:true}),result=validateSourceLayout({...f,workRoot:path.join(f.be,'.starciwork')},contract);assert.equal(result.ok,true,JSON.stringify(result.errors));assert.equal(result.roots.host,result.roots.be);});
test('missing explicit host fails closed',t=>{const f=fixture(t),result=validateSourceLayout({be:f.be,fe:f.fe,workRoot:path.join(f.be,'.starciwork')},contract);assert.equal(result.ok,false);assert.ok(result.errors.some(e=>e.role==='host'&&e.code==='ROOT'));});
test('project metadata names and deployment stacks do not impersonate host identities',t=>{const f=fixture(t),result=validateSourceLayout({...f,workRoot:path.join(f.be,'.starciwork')},contract);assert.equal(result.ok,true,JSON.stringify(result.errors));});
test('a routed backend cannot duplicate the external runtime or route-registry identity',t=>{const f=fixture(t);makeIdentity(f.be);const result=validateSourceLayout({...f,workRoot:path.join(f.be,'.starciwork')},contract);assert.equal(result.ok,false);assert.ok(result.errors.some(e=>e.role==='be'&&e.code==='DUPLICATE_IDENTITY'&&e.path.includes('.claude/SKILL.md')));assert.ok(result.errors.some(e=>e.role==='be'&&e.code==='DUPLICATE_IDENTITY'&&e.path.includes('.workspaces/projects')));});
test('duplicate frontend runtime identity or Work and a wrong Work owner are rejected',t=>{const f=fixture(t);const skill=path.join(f.fe,'.claude','SKILL.md');fs.mkdirSync(path.dirname(skill),{recursive:true});fs.writeFileSync(skill,'Duplicate synthetic runtime.');fs.mkdirSync(path.join(f.fe,'.starciwork'));const result=validateSourceLayout({...f,workRoot:path.join(f.fe,'.starciwork')},contract);assert.equal(result.ok,false);assert.ok(result.errors.some(e=>e.role==='fe'&&e.code==='DUPLICATE_IDENTITY'&&e.path.includes('.claude/SKILL.md')));assert.ok(result.errors.some(e=>e.role==='fe'&&e.path==='.starciwork'));assert.ok(result.errors.some(e=>e.code==='WORK_OWNER'));});
test('malformed manifests and retired host versions are rejected',t=>{const f=fixture(t);fs.writeFileSync(path.join(f.be,'package.json'),'{');fs.mkdirSync(path.join(f.host,'.claude_legacy'));const result=validateSourceLayout({...f,workRoot:path.join(f.be,'.starciwork')},contract);assert.ok(result.errors.some(e=>e.code==='JSON'));assert.ok(result.errors.some(e=>e.role==='host'&&e.path==='.claude_legacy'));});
test('CLI resolves the host outside .claude even when executed through compiled runtime',async t=>{const f=fixture(t),chunks=[];const code=await main(['source-layout',f.be,f.fe],{out:value=>chunks.push(value),err:value=>chunks.push(value)});const result=JSON.parse(chunks.join(''));assert.equal(code,0,JSON.stringify(result.errors));assert.equal(result.roots.host,fs.realpathSync(path.dirname(skillRoot)));});

function makeIdentity(root){const skill=path.join(root,'.claude','SKILL.md'),projects=path.join(root,'.workspaces','projects');fs.mkdirSync(path.dirname(skill),{recursive:true});fs.writeFileSync(skill,'Duplicate synthetic runtime.');fs.mkdirSync(projects,{recursive:true});}
