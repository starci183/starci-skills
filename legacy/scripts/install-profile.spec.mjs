import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {test as nodeTest} from 'node:test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const isPackage=existsSync(path.join(root,'bin/starci-skills.mjs'));
const {init,update}=isPackage?await import('../bin/starci-skills.mjs'):{};
const test=(name,fn)=>nodeTest(name,{skip:isPackage?false:'not the package checkout'},fn);
const quiet=()=>{};
function fixture(fn){const repo=mkdtempSync(path.join(tmpdir(),'starci lite profile '));try{return fn(repo);}finally{rmSync(repo,{recursive:true,force:true});}}
const text=(repo,name)=>readFileSync(path.join(repo,name),'utf8');
test('new installations default to Lite, ship full operators, and persist through update',()=>fixture(repo=>{
 const first=init({dir:repo,bootstrap:true},quiet);assert.equal(first.profile,'lite');assert.equal(first.bootstrapProfile,'lite');
 for(const name of ['AGENTS.md','CLAUDE.md']){const entry=text(repo,name);assert.match(entry,/enter \[StarCi Lite\]/);assert.match(entry,/Existing full workflows keep their current session and gates/);assert.doesNotMatch(entry,/Read \[`<Source>\/\.claude\/INDEX.md`\].*completely/);}
 for(const file of ['skills/starci-lite/SKILL.md','skills/starci-lite/agents/openai.yaml','operators/uat-verify/validate.mjs','operators/git-publish/validate.mjs'])assert.ok(existsSync(path.join(repo,'.claude',file)),file);
 const before=text(repo,'AGENTS.md');const updated=update({dir:repo},quiet);assert.equal(updated.profile,'lite');assert.equal(text(repo,'AGENTS.md'),before);
}));
test('explicit profile transitions replace only known generated shell and preserve custom CRLF suffix',()=>fixture(repo=>{
 const full=init({dir:repo,bootstrap:true,profile:'full'},quiet);assert.equal(full.profile,'full');assert.match(text(repo,'AGENTS.md'),/For every user prompt, enter \[StarCi\]/);
 const custom='\r\n# Team\r\nKeep our review rule exactly.\r\n';for(const name of ['AGENTS.md','CLAUDE.md'])writeFileSync(path.join(repo,name),text(repo,name).replace(/\r?\n/g,'\r\n')+custom);
 const stateFile=path.join(repo,'.worktrees/sessions/existing/state.json');mkdirSync(path.dirname(stateFile),{recursive:true});const state='{"contractVersion":"starci/v2.2","runtimeRevision":3,"lifecycle":{"phase":"active"},"proof":"unchanged"}';writeFileSync(stateFile,state);
 update({dir:repo,profile:'lite'},quiet);for(const name of ['AGENTS.md','CLAUDE.md']){const entry=text(repo,name);assert.ok(entry.endsWith(custom));assert.match(entry,/enter \[StarCi Lite\]/);assert.doesNotMatch(entry,/completely and follow its load order/);}
 assert.equal(readFileSync(stateFile,'utf8'),state);update({dir:repo,profile:'full'},quiet);assert.match(text(repo,'AGENTS.md'),/enter \[StarCi\]/);assert.ok(text(repo,'AGENTS.md').endsWith(custom));
}));
test('custom full entry and modified managed block refuse Lite before payload or manifest writes',()=>fixture(repo=>{
 init({dir:repo,bootstrap:true},quiet);const custom='# Team\nAlways read .claude/INDEX.md before work.\n';writeFileSync(path.join(repo,'AGENTS.md'),custom);
 const before=text(repo,'.claude/.starci-skills.json');const routing=text(repo,'.claude/routing.json');assert.throws(()=>update({dir:repo,profile:'lite',force:true},quiet),/custom instructions still name the full entry/);assert.equal(text(repo,'AGENTS.md'),custom);assert.equal(text(repo,'.claude/.starci-skills.json'),before);assert.equal(text(repo,'.claude/routing.json'),routing);
 const modified='# Team\n<!-- starci:prompt-entry -->\nCustom runtime entry.\n<!-- /starci:prompt-entry -->\n';writeFileSync(path.join(repo,'AGENTS.md'),modified);assert.throws(()=>update({dir:repo,profile:'lite'},quiet),/custom StarCi entry/);assert.equal(text(repo,'AGENTS.md'),modified);
}));
test('no-bootstrap records selected profile separately without claiming changed host routing',()=>fixture(repo=>{
 init({dir:repo,bootstrap:true,profile:'full'},quiet);const before=text(repo,'AGENTS.md');const changed=update({dir:repo,profile:'lite',bootstrap:false},quiet);assert.equal(changed.profile,'lite');assert.equal(changed.bootstrapProfile,'full');assert.equal(text(repo,'AGENTS.md'),before);
}));
test('CLI validates profile values and missing values before creating a runtime',()=>fixture(repo=>{
 for(const args of [['--profile','unknown'],['--profile'],['--profile=']]){const result=spawnSync(process.execPath,[path.join(root,'bin/starci-skills.mjs'),'init','--dir',repo,...args],{encoding:'utf8',windowsHide:true});assert.equal(result.status,1);assert.match(result.stderr,/profile/);assert.ok(!existsSync(path.join(repo,'.claude')));}
}));

test('custom full-only suffix on a generated bootstrap refuses Lite for LF and CRLF hosts',()=>fixture(repo=>{
 init({dir:repo,bootstrap:true,profile:'full'},quiet);const generated=text(repo,'AGENTS.md');
 for(const newline of ['\n','\r\n']){const custom=generated.replace(/\r?\n/g,newline)+newline+'Always read .claude/INDEX.md before target work.'+newline;writeFileSync(path.join(repo,'AGENTS.md'),custom);assert.throws(()=>update({dir:repo,profile:'lite'},quiet),/custom suffix still names the full entry/);assert.equal(text(repo,'AGENTS.md'),custom);}
}));

test('updates preserve explicit full and legacy full installations without profile metadata',()=>fixture(repo=>{
 init({dir:repo,bootstrap:true,profile:'full'},quiet);
 const entry=text(repo,'AGENTS.md');
 assert.equal(update({dir:repo},quiet).profile,'full');
 assert.equal(text(repo,'AGENTS.md'),entry);
 const file=path.join(repo,'.claude/.starci-skills.json');
 const legacy=JSON.parse(text(repo,'.claude/.starci-skills.json'));
 delete legacy.profile;delete legacy.bootstrapProfile;
 writeFileSync(file,JSON.stringify(legacy));
 assert.equal(update({dir:repo},quiet).profile,'full');
 assert.equal(text(repo,'AGENTS.md'),entry);
}));
