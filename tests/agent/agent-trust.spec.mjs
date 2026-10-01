import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from '../helpers/fake-orca.mjs';
import {openLedger,inspectLedger,ledgerFileFor} from '../../engine/db/ledger.mjs';
import {
  claudeKeyForms,codexKeyForms,codexHeader,codexProjectTables,writeClaudeTrust,writeCodexTrust,writeCodexNoUpdateCheck,writeCodexNoModelNudge,
  assertClaudeBypassConsent,ensureLaunchTrust,trustTargets,orcaCodexHome,assertClaudeSettingsEnv,claudeLaunchEnv,
  toolGuardCommand,assertJsonToolGuard,writeDevinProfile,codexGuardBlock,writeCodexToolGuard,trustCodexToolGuard,projectTargets,excludeFromGit,
} from '../../scripts/agent/trust.mjs';
import {gateMenuPosition} from '../../scripts/agent/lib.mjs';
import {seedWorkflow} from '../helpers/ledger-fixture.mjs';

// Owner instruction 2026-09-23: the owner never approves a launch prompt; the runtime does. Layer 1 pre-trusts
// the launch directory in ~/.claude.json and every Codex config.toml; layer 2 answers an allowlisted launch gate
// once from the screen. Every spec here writes only temp copies (STARCI_AGENT_TRUST_HOME / explicit files).
const ROOT=path.resolve(import.meta.dirname,'..', '..');
// The card's settle/attestation windows (~25s of pure waiting per dispatch) are counted logically; scale the real sleeps down (scripts/lib/sleep-sync.mjs).
process.env.STARCI_SLEEP_SCALE??='0.02';
// This spec is about dispatch delivery/liveness, not the host-contract listing (orca-call-contract covers it): left on,
// every mutation spawns the fake orca's agent-context under a 15s timeout that misses under full-suite load.
process.env.STARCI_ORCA_SKIP_LIVE_CHECK??='1';
const API=path.join(ROOT,'scripts','kernel','cli.mjs');
const DEFINE_GOAL=path.join(ROOT,'scripts','goal','define-goal.mjs');
const START_WORKFLOW=path.join(ROOT,'scripts','kernel','start-workflow.mjs');
const json=text=>{try{return JSON.parse(text);}catch{return null;}};
const tmp=(t,prefix)=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),prefix));t.after(()=>fs.rmSync(d,{recursive:true,force:true,maxRetries:20,retryDelay:25}));return d;};

/* ------------------------------------------------------------ key forms */

test('trust keys use the exact forms Claude and Codex write on Windows',()=>{
  assert.deepEqual(claudeKeyForms('d:\\Repositories\\starci-next','win32'),['D:/Repositories/starci-next','D:\\Repositories\\starci-next']);
  assert.deepEqual(claudeKeyForms('D:/Repositories/starci-next','win32'),['D:/Repositories/starci-next','D:\\Repositories\\starci-next']);
  assert.deepEqual(codexKeyForms('D:/Repositories/starci-next','win32'),['d:\\repositories\\starci-next','D:\\Repositories\\starci-next']);
  assert.deepEqual(codexKeyForms('d:\\lower\\only','win32'),['d:\\lower\\only','D:\\lower\\only'],'distinct strings, so never a duplicate table');
  assert.deepEqual(claudeKeyForms('/home/me/repo','linux'),['/home/me/repo']);
  assert.deepEqual(codexKeyForms('/home/me/repo','linux'),['/home/me/repo']);
  assert.equal(codexHeader('d:\\repositories\\starci-next'),"[projects.'d:\\repositories\\starci-next']");
  assert.equal(codexHeader('D:\\Repositories\\starci-next'),'[projects."D:\\\\Repositories\\\\starci-next"]');
  assert.equal(codexHeader('/home/me/repo'),'[projects."/home/me/repo"]');
});

test('Orca CODEX_HOME resolves from the platform userData dir, and a test process never targets the real home',()=>{
  assert.equal(orcaCodexHome({env:{APPDATA:'C:\\Users\\u\\AppData\\Roaming'},platform:'win32',home:'C:\\Users\\u'}),
    path.join('C:\\Users\\u\\AppData\\Roaming','orca','codex-runtime-home','home'));
  assert.equal(orcaCodexHome({env:{},platform:'darwin',home:'/Users/u'}),path.join('/Users/u','Library','Application Support','orca','codex-runtime-home','home'));
  assert.equal(orcaCodexHome({env:{STARCI_ORCA_CODEX_HOME:'/x'},platform:'linux',home:'/h'}),'/x');
  assert.match(trustTargets({env:{NODE_TEST_CONTEXT:'child-v8'}}).skipped,/STARCI_AGENT_TRUST_HOME/);
  const rooted=trustTargets({env:{NODE_TEST_CONTEXT:'child-v8',STARCI_AGENT_TRUST_HOME:'/t',CODEX_HOME:'/real'},platform:'linux'});
  assert.equal(rooted.claudeJson,path.join('/t','.claude.json'));
  assert.ok(rooted.codexHomes.every(h=>h.dir.startsWith(path.resolve('/t'))),'CODEX_HOME is ignored under a trust home');
});

/* ------------------------------------------------------- claude writer */

const CLAUDE_FIXTURE={numStartups:5,installMethod:'global',tipsHistory:{x:3},hasCompletedOnboarding:true,
  projects:{'D:/Repositories/nivo-backend':{allowedTools:[],hasTrustDialogAccepted:true,lastCost:32.96738740000001},
    'D:\\Repositories\\starci-next':{allowedTools:['Bash'],hasTrustDialogAccepted:false,lastSessionId:'abc'}},
  userID:'9007199254740993123'};

test('Claude trust sets hasTrustDialogAccepted in both key forms, keeps every other field, and is idempotent',t=>{
  const dir=tmp(t,'starci-trust-claude-');const file=path.join(dir,'.claude.json');
  const original=JSON.stringify(CLAUDE_FIXTURE,null,2);fs.writeFileSync(file,original);
  const keys=claudeKeyForms('D:\\Repositories\\starci-next','win32');
  const first=writeClaudeTrust({file,keys});
  assert.equal(first.ok,true,first.error);
  assert.deepEqual(first.written,keys,'the untrusted backslash key is upgraded, the forward-slash key is added');
  const doc=JSON.parse(fs.readFileSync(file,'utf8'));
  assert.equal(doc.projects['D:\\Repositories\\starci-next'].hasTrustDialogAccepted,true);
  assert.equal(doc.projects['D:/Repositories/starci-next'].hasTrustDialogAccepted,true);
  assert.deepEqual(doc.projects['D:\\Repositories\\starci-next'],{...CLAUDE_FIXTURE.projects['D:\\Repositories\\starci-next'],hasTrustDialogAccepted:true},
    'an existing project keeps its fields and key order');
  const rest=structuredClone(doc);delete rest.projects['D:/Repositories/starci-next'];rest.projects['D:\\Repositories\\starci-next'].hasTrustDialogAccepted=false;
  assert.equal(JSON.stringify(rest,null,2),original,'nothing else changed, byte for byte');
  const bytes=fs.readFileSync(file,'utf8');
  const again=writeClaudeTrust({file,keys});
  assert.deepEqual([again.ok,again.written,again.already.length],[true,[],2]);
  assert.equal(fs.readFileSync(file,'utf8'),bytes,'an already-trusted directory is not rewritten');
});

test('a concurrent Claude session rewrite is a lost update that is retried and verified',t=>{
  const dir=tmp(t,'starci-trust-race-');const file=path.join(dir,'.claude.json');
  fs.writeFileSync(file,JSON.stringify(CLAUDE_FIXTURE,null,2));
  const keys=claudeKeyForms('D:\\Race\\repo','win32');
  // attempt 1: a session rewrites the file between our read and our rename (numStartups 6);
  // attempt 2: another session renames its stale copy over ours right after our rename.
  const stale=JSON.stringify({...CLAUDE_FIXTURE,numStartups:6},null,2);
  const result=writeClaudeTrust({file,keys,hooks:{
    beforeRename:({attempt})=>{if(attempt===1)fs.writeFileSync(file,stale);},
    afterRename:({attempt})=>{if(attempt===2)fs.writeFileSync(file,stale);},
  }});
  assert.equal(result.ok,true,result.error);
  assert.equal(result.attempts,3);
  assert.deepEqual(result.trail.map(x=>x.lost),['rewritten-before-rename','overwritten-after-rename']);
  const doc=JSON.parse(fs.readFileSync(file,'utf8'));
  assert.equal(doc.numStartups,6,'the concurrent writer\'s change survives');
  for(const k of keys)assert.equal(doc.projects[k].hasTrustDialogAccepted,true);
  const always=writeClaudeTrust({file,keys:claudeKeyForms('D:\\Race\\other','win32'),hooks:{afterRename:()=>fs.writeFileSync(file,stale)}});
  assert.equal(always.ok,false);
  assert.match(always.error,/lost update/);
  assert.equal(always.trail.length,5,'bounded retries');
});

test('the bypass-permissions consent is asserted and set only when missing',t=>{
  const dir=tmp(t,'starci-trust-settings-');const file=path.join(dir,'settings.json');
  fs.writeFileSync(file,JSON.stringify({model:'opus',permissions:{allow:['Bash']}},null,2));
  assert.equal(assertClaudeBypassConsent({file}).state,'written');
  assert.deepEqual(JSON.parse(fs.readFileSync(file,'utf8')),{model:'opus',permissions:{allow:['Bash']},skipDangerousModePermissionPrompt:true});
  assert.equal(assertClaudeBypassConsent({file}).state,'already');
  fs.writeFileSync(file,JSON.stringify({skipDangerousModePermissionPrompt:false}));
  assert.equal(assertClaudeBypassConsent({file}).state,'owner-set-false');
  assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).skipDangerousModePermissionPrompt,false,'an explicit owner value is never overwritten');
});

// A managed worker's command is composed by Orca (worker-start), so its launch env cannot carry the card's
// launchEnv: the same keys are asserted under settings.json env, only where the owner has not set them.
test('the Claude card launchEnv is asserted under settings.json env, set only when missing, owner values kept',t=>{
  assert.deepEqual(claudeLaunchEnv(),{DISABLE_AUTOUPDATER:'1'});
  const dir=tmp(t,'starci-trust-env-');const file=path.join(dir,'settings.json');
  fs.writeFileSync(file,JSON.stringify({model:'opus',env:{FOO:'bar'}},null,2)+'\n');
  const vars={DISABLE_AUTOUPDATER:'1'};
  assert.equal(assertClaudeSettingsEnv({file,vars}).state,'written');
  const doc=JSON.parse(fs.readFileSync(file,'utf8'));
  assert.deepEqual(doc,{model:'opus',env:{FOO:'bar',DISABLE_AUTOUPDATER:'1'}});
  assert.ok(fs.readFileSync(file,'utf8').endsWith('}\n'),'the trailing newline is kept');
  assert.equal(assertClaudeSettingsEnv({file,vars}).state,'already');
  fs.writeFileSync(file,JSON.stringify({env:{DISABLE_AUTOUPDATER:'0'}}));
  const owner=assertClaudeSettingsEnv({file,vars});
  assert.equal(owner.state,'owner-set');
  assert.deepEqual(owner.owner,['DISABLE_AUTOUPDATER']);
  assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).env.DISABLE_AUTOUPDATER,'0','an explicit owner value is never overwritten');
  const fresh=path.join(dir,'none','settings.json');
  assert.equal(assertClaudeSettingsEnv({file:fresh,vars}).state,'written','a missing settings.json is created');
  fs.writeFileSync(file,JSON.stringify({env:'oops'}));
  assert.equal(assertClaudeSettingsEnv({file,vars}).ok,false,'an env that is not an object is never rewritten');
});

test('ensureLaunchTrust asserts the launch env for a Claude launch only',t=>{
  const home=tmp(t,'starci-trust-env-home-');const cwd=tmp(t,'starci-trust-env-cwd-');
  const env={NODE_TEST_CONTEXT:'child-v8',STARCI_AGENT_TRUST_HOME:home};
  const claude=ensureLaunchTrust({agent:'claude',cwd,env});
  assert.equal(claude.launchEnv,'written');
  assert.equal(JSON.parse(fs.readFileSync(path.join(cwd,'.claude','settings.local.json'),'utf8')).env.DISABLE_AUTOUPDATER,'1','the worktree\'s local project settings, never ~/.claude/settings.json');
  assert.equal(fs.existsSync(path.join(home,'.claude','settings.json')),false);
  assert.equal(ensureLaunchTrust({agent:'claude',cwd,env}).launchEnv,'already');
  assert.equal(ensureLaunchTrust({agent:'codex',cwd,env}).launchEnv,undefined);
});

/* -------------------------------------------------------- codex writer */

const TOML_FIXTURE=[
  '# owner config — keep me',
  'model = "gpt-6-sol"',
  'approval_policy = "never"',
  'sandbox_mode = "danger-full-access"',
  '',
  '[features]',
  'web_search = true # inline comment',
  '',
  "[projects.'d:\\repositories\\kept']",
  'trust_level = "trusted"',
  '',
  '[projects."D:\\\\Repositories\\\\Upgrade"]',
  'trust_level = "untrusted"',
  '',
  '[mcp_servers.node_repl]',
  'command = "node"',
  '',
].join('\r\n');

test('Codex trust appends [projects] tables, upgrades an untrusted one in place, and keeps every other table and comment',t=>{
  const dir=tmp(t,'starci-trust-codex-');const file=path.join(dir,'config.toml');
  fs.writeFileSync(file,TOML_FIXTURE);
  const keys=['d:\\repositories\\kept','D:\\Repositories\\Upgrade','d:\\repositories\\new','D:\\Repositories\\New'];
  const r=writeCodexTrust({file,keys});
  assert.equal(r.ok,true,r.error);
  assert.deepEqual(r.already,['d:\\repositories\\kept']);
  assert.deepEqual(r.written,['D:\\Repositories\\Upgrade','d:\\repositories\\new','D:\\Repositories\\New']);
  const text=fs.readFileSync(file,'utf8');
  assert.ok(text.startsWith(TOML_FIXTURE.replace('trust_level = "untrusted"','trust_level = "trusted"')),'the original text is a prefix: append only, one line edited');
  assert.match(text,/\[projects\.'d:\\repositories\\new'\]\r\ntrust_level = "trusted"\r\n/);
  assert.match(text,/\[projects\."D:\\\\Repositories\\\\New"\]\r\ntrust_level = "trusted"\r\n/);
  for(const line of ['# owner config — keep me','approval_policy = "never"','sandbox_mode = "danger-full-access"','web_search = true # inline comment','[mcp_servers.node_repl]'])
    assert.ok(text.includes(line),`kept: ${line}`);
  const tables=codexProjectTables(text);
  for(const k of keys)assert.equal(tables.get(k)?.trust,'trusted',k);
  assert.equal(codexProjectTables(text).size,4,'no duplicate table');
  const again=writeCodexTrust({file,keys});
  assert.deepEqual([again.ok,again.written],[true,[]]);
  assert.equal(fs.readFileSync(file,'utf8'),text,'idempotent');
});

test('a Codex config rewritten mid-update is retried and the other writer\'s table survives',t=>{
  const dir=tmp(t,'starci-trust-codex-race-');const file=path.join(dir,'config.toml');
  fs.writeFileSync(file,'model = "a"\n');
  const r=writeCodexTrust({file,keys:['/repo/x'],hooks:{beforeRename:({attempt})=>{if(attempt===1)fs.appendFileSync(file,'\n[projects."/other"]\ntrust_level = "trusted"\n');}}});
  assert.equal(r.ok,true);
  assert.equal(r.attempts,2);
  const tables=codexProjectTables(fs.readFileSync(file,'utf8'));
  assert.deepEqual([tables.get('/other')?.trust,tables.get('/repo/x')?.trust],['trusted','trusted']);
});

test('ensureLaunchTrust writes Claude and every Codex home under the trust home, then reports already',t=>{
  const home=tmp(t,'starci-trust-home-');const cwd=tmp(t,'starci-trust-cwd-');
  const env={NODE_TEST_CONTEXT:'child-v8',STARCI_AGENT_TRUST_HOME:home};
  const orcaHome=orcaCodexHome({env:{APPDATA:path.join(home,'AppData','Roaming'),XDG_CONFIG_HOME:path.join(home,'.config')},home});
  fs.mkdirSync(path.join(home,'.codex'),{recursive:true});fs.mkdirSync(orcaHome,{recursive:true});
  fs.writeFileSync(path.join(orcaHome,'config.toml'),'approval_policy = "never"\n');
  const claude=ensureLaunchTrust({agent:'claude',cwd,env});
  assert.equal(claude.status,'written');
  assert.deepEqual(claude.paths,[path.resolve(cwd)]);
  assert.equal(claude.bypassConsent,'written');
  const doc=JSON.parse(fs.readFileSync(path.join(home,'.claude.json'),'utf8'));
  for(const k of claudeKeyForms(cwd))assert.equal(doc.projects[k].hasTrustDialogAccepted,true);
  const codex=ensureLaunchTrust({agent:'codex',cwd,env});
  assert.equal(codex.status,'written');
  assert.deepEqual([...new Set(codex.written.map(w=>w.file))].sort(),[path.join(home,'.codex','config.toml'),path.join(orcaHome,'config.toml'),path.join(cwd,'.codex','config.toml')].sort());
  assert.match(fs.readFileSync(path.join(orcaHome,'config.toml'),'utf8'),/^approval_policy = "never"\n/,'the owner\'s approval policy is untouched');
  assert.equal(ensureLaunchTrust({agent:'codex',cwd,env}).status,'already');
  assert.equal(ensureLaunchTrust({agent:'claude',cwd,env}).status,'already');
  assert.equal(ensureLaunchTrust({agent:'gemini',cwd,env}),null,'an agent the runtime launches no worker for is not touched');
  assert.equal(ensureLaunchTrust({agent:'claude',cwd:'active',env}).status,'skipped','an Orca selector is not a directory');
});

/* ---------------------------------------- the command guard, every host */

// The op guard is a PreToolUse hook every agent host runs (scripts/guards/command-guard.mjs); launch trust registers
// it in the launch worktree's PROJECT files only, and pins Devin's model in Devin's local project config (worker-start
// passes Devin no --model).
test('launch trust registers the command guard hook in the worktree\'s project settings for Claude and Devin, and pins Devin\'s model there',t=>{
  const home=tmp(t,'starci-trust-guard-home-');const cwd=tmp(t,'starci-trust-guard-cwd-');
  const env={NODE_TEST_CONTEXT:'child-v8',STARCI_AGENT_TRUST_HOME:home};
  const command=toolGuardCommand();
  assert.match(command,/^node ".*\/scripts\/guards\/command-guard\.mjs"$/);
  assert.doesNotMatch(command,/\\/,'forward slashes: Claude and Devin run hooks through Git Bash on Windows');
  const {claudeSettings:settings,devinConfig:devinFile}=projectTargets(cwd);
  assert.equal(settings,path.join(cwd,'.claude','settings.local.json'));
  assert.equal(devinFile,path.join(cwd,'.devin','config.local.json'));
  fs.mkdirSync(path.dirname(settings),{recursive:true});
  fs.writeFileSync(settings,JSON.stringify({hooks:{PreToolUse:[{matcher:'Edit',hooks:[{type:'command',command:'owner-hook'}]},{matcher:'Bash',hooks:[{type:'command',command:'node "D:/old/runtime/scripts/guards/command-guard.mjs"'}]}]}},null,2));
  const claude=ensureLaunchTrust({agent:'claude',cwd,env});
  assert.deepEqual(claude.toolGuard,[{file:settings,state:'written'}]);
  const pre=JSON.parse(fs.readFileSync(settings,'utf8')).hooks.PreToolUse;
  assert.deepEqual(pre,[{matcher:'Edit',hooks:[{type:'command',command:'owner-hook'}]},{matcher:'Bash|PowerShell',hooks:[{type:'command',command,timeout:30}]}],'the owner\'s hook stays; an older guard entry is replaced, never doubled');
  assert.deepEqual(ensureLaunchTrust({agent:'claude',cwd,env}).toolGuard,[{file:settings,state:'already'}]);
  // Devin: its local project config, the model pinned, any other key kept.
  fs.mkdirSync(path.dirname(devinFile),{recursive:true});
  fs.writeFileSync(devinFile,JSON.stringify({version:1,permissions:{allow:['Read']}},null,2));
  const devin=ensureLaunchTrust({agent:'devin',cwd,env,model:'swe-2-max',platform:'win32'});
  assert.equal(devin.status,'written',JSON.stringify(devin));
  assert.deepEqual(devin.modelPin,{file:devinFile,model:'swe-2-max',state:'written'});
  const doc=JSON.parse(fs.readFileSync(devinFile,'utf8'));
  assert.equal(doc.agent.model,'swe-2-max');
  assert.deepEqual(doc.permissions,{allow:['Read']});
  assert.deepEqual(doc.hooks.PreToolUse,[{hooks:[{type:'command',command,timeout:30}]}]);
  assert.equal(ensureLaunchTrust({agent:'devin',cwd,env,model:'swe-2-max',platform:'win32'}).status,'already');
  // The model moves with the route: a different pinned model is rewritten, the guard kept.
  assert.equal(writeDevinProfile({file:devinFile,command,model:'swe-2-high'}).state,'written');
  assert.equal(JSON.parse(fs.readFileSync(devinFile,'utf8')).agent.model,'swe-2-high');
  fs.writeFileSync(devinFile,'{"hooks":[]}');
  assert.equal(assertJsonToolGuard({file:devinFile,command}).ok,false,'a hooks value that is not an object is never rewritten');
});

// Lead ruling 2026-10-01: launch trust writes only under the launch worktree (and its repository's own
// info/exclude), never a user-global settings file: ~/.claude/settings.json, Devin's user config.json and each Codex
// home keep no guard hook and no launch setting from the runtime. The home is injected (STARCI_AGENT_TRUST_HOME).
test('launch trust writes only under the op worktree and never touches a user-global settings file',t=>{
  const home=tmp(t,'starci-trust-scope-home-');const cwd=tmp(t,'starci-trust-scope-cwd-');
  const env={NODE_TEST_CONTEXT:'child-v8',STARCI_AGENT_TRUST_HOME:home};
  const git=(...a)=>spawnSync('git',a,{cwd,encoding:'utf8',windowsHide:true});
  assert.equal(git('init','-q').status,0);
  const orcaHome=orcaCodexHome({env:{APPDATA:path.join(home,'AppData','Roaming'),XDG_CONFIG_HOME:path.join(home,'.config')},home});
  const userSettings=path.join(home,'.claude','settings.json');
  const devinUser=path.join(home,'AppData','Roaming','devin','config.json');
  const codexUsers=[path.join(home,'.codex','config.toml'),path.join(orcaHome,'config.toml')];
  for(const [file,text] of [[userSettings,'{"model":"opus"}\n'],[devinUser,'{"version":1}\n'],...codexUsers.map(f=>[f,'approval_policy = "never"\n'])]){
    fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);
  }
  const snapshot=(dir)=>{const out=new Map();const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else out.set(p,fs.readFileSync(p,'utf8'));}};walk(dir);return out;};
  const homeBefore=snapshot(home);
  const codexServer=({requests})=>requests.map(q=>q.method==='config/batchWrite'?{}:{data:[{hooks:[{key:'k',eventName:'preToolUse',command:toolGuardCommand(),currentHash:'h',trustStatus:'trusted'}]}]});
  for(const agent of ['claude','codex','devin']){
    const r=ensureLaunchTrust({agent,cwd,env,model:agent==='devin'?'swe-2-max':null,codexAppServer:codexServer});
    assert.notEqual(r.status,'failed',JSON.stringify(r));
    for(const g of r.toolGuard)assert.ok(path.resolve(g.file).startsWith(path.resolve(cwd)+path.sep),`${agent}: the guard hook lives under the worktree, not ${g.file}`);
  }
  // Under the home only the per-user trust records change: ~/.claude.json and each Codex home's project trust and
  // notices - never a hook or a launch setting, and never ~/.claude/settings.json or Devin's user config.
  const homeAfter=snapshot(home);
  const changed=[...homeAfter].filter(([f,text])=>homeBefore.get(f)!==text).map(([f])=>f).sort();
  assert.deepEqual(changed,[path.join(home,'.claude.json'),...codexUsers].sort());
  assert.equal(homeAfter.get(userSettings),homeBefore.get(userSettings),'~/.claude/settings.json is untouched');
  assert.equal(homeAfter.get(devinUser),homeBefore.get(devinUser),'Devin\'s user config is untouched');
  for(const f of codexUsers)assert.doesNotMatch(homeAfter.get(f),/command-guard|hooks\.PreToolUse/,`${f} carries no guard hook`);
  // Under the worktree: the three project files, each kept out of git status by the repository's own info/exclude.
  const p=projectTargets(cwd);
  for(const f of [p.claudeSettings,p.codexConfig,p.devinConfig])assert.ok(fs.existsSync(f),f);
  assert.equal(JSON.parse(fs.readFileSync(p.claudeSettings,'utf8')).skipDangerousModePermissionPrompt,true);
  assert.equal(git('status','--porcelain','--untracked-files=all').stdout.trim(),'','the project files never dirty the checkout');
  const excludeFile=path.join(cwd,'.git','info','exclude');
  const exclude=fs.readFileSync(excludeFile,'utf8');
  for(const line of ['/.claude/settings.local.json','/.codex/config.toml','/.devin/config.local.json'])assert.ok(exclude.split(/\r?\n/).includes(line),line);
  ensureLaunchTrust({agent:'codex',cwd,env,codexAppServer:codexServer});
  assert.equal(fs.readFileSync(excludeFile,'utf8'),exclude,'a second launch adds nothing');
  assert.deepEqual(excludeFromGit(cwd,p.codexConfig),{file:'.codex/config.toml',state:'already'});
  // A file the repository tracks is never excluded, and a directory that is no checkout is left alone.
  fs.writeFileSync(path.join(cwd,'tracked.json'),'{}');
  assert.equal(git('add','tracked.json').status,0);
  assert.deepEqual(excludeFromGit(cwd,path.join(cwd,'tracked.json')),{file:'tracked.json',state:'tracked'});
  const plain=tmp(t,'starci-trust-scope-plain-');
  assert.equal(excludeFromGit(plain,path.join(plain,'.claude','settings.local.json')),null);
});

test('a Codex home gets the guard block in config.toml and Codex\'s own hash for it, the way Orca trusts its hooks',t=>{
  const home=tmp(t,'starci-trust-codex-guard-');const cwd=tmp(t,'starci-trust-codex-cwd-');
  const file=path.join(home,'config.toml');
  const command=toolGuardCommand();
  fs.writeFileSync(file,'model = "gpt"\r\n\r\n[projects."D:\\\\x"]\r\ntrust_level = "trusted"\r\n');
  assert.equal(writeCodexToolGuard({file,command}).written,true);
  const text=fs.readFileSync(file,'utf8');
  assert.ok(text.startsWith('model = "gpt"\r\n\r\n[projects."D:\\\\x"]\r\ntrust_level = "trusted"\r\n'),'the owner\'s tables stay');
  assert.ok(text.includes(codexGuardBlock(command,'\r\n')),text);
  assert.equal(writeCodexToolGuard({file,command}).written,false);
  // Another runtime path: the block is replaced in place, a table after it kept.
  fs.writeFileSync(file,`${codexGuardBlock('node "D:/old/scripts/guards/command-guard.mjs"')}\n[notice]\nhide_rate_limit_model_nudge = true\n`);
  assert.equal(writeCodexToolGuard({file,command}).written,true);
  assert.equal(fs.readFileSync(file,'utf8'),`${codexGuardBlock(command)}\n[notice]\nhide_rate_limit_model_nudge = true\n`);
  // Trust: hooks/list names the hash, config/batchWrite records it under hooks.state, hooks/list proves it.
  const calls=[];let trusted=false;
  const listed=()=>({data:[{cwd,hooks:[{key:`${file}:pre_tool_use:0:0`,eventName:'preToolUse',command,currentHash:'sha256:abc',trustStatus:trusted?'trusted':'untrusted'},
    {key:'x:pre_tool_use:0:0',eventName:'preToolUse',command:'owner',currentHash:'sha256:zzz',trustStatus:'untrusted'}]}]});
  const appServer=({home:h,requests})=>requests.map(r=>{calls.push({home:h,...r});if(r.method==='config/batchWrite'){trusted=true;return {};}return listed();});
  assert.deepEqual(trustCodexToolGuard({home,cwd,command,appServer}),{home,ok:true,trusted:'written'});
  assert.deepEqual(calls.find(c=>c.method==='config/batchWrite').params,{edits:[{keyPath:'hooks.state',value:{[`${file}:pre_tool_use:0:0`]:{trusted_hash:'sha256:abc'}},mergeStrategy:'upsert'}],reloadUserConfig:true},'only the guard hook is trusted, never the owner\'s');
  assert.deepEqual(trustCodexToolGuard({home,cwd,command,appServer}),{home,ok:true,trusted:'already'});
  assert.equal(trustCodexToolGuard({home,cwd,command:'node "elsewhere"',appServer}).ok,false,'a guard hook Codex does not list is a failure, never assumed');
  // Through ensureLaunchTrust, with the app-server injected (a spec never starts the real Codex).
  const trustHome=tmp(t,'starci-trust-codex-home-');
  const env={NODE_TEST_CONTEXT:'child-v8',STARCI_AGENT_TRUST_HOME:trustHome};
  fs.mkdirSync(path.join(trustHome,'.codex'),{recursive:true});
  const r=ensureLaunchTrust({agent:'codex',cwd,env,codexAppServer:({requests})=>requests.map(q=>q.method==='config/batchWrite'?{}:{data:[{hooks:[{key:'k',eventName:'preToolUse',command,currentHash:'h',trustStatus:'trusted'}]}]})});
  const projectFile=path.join(cwd,'.codex','config.toml');
  assert.deepEqual(r.toolGuard,[{file:projectFile,written:true,trustedIn:[{home:path.join(trustHome,'.codex'),trusted:'already'}]}],'the hook lives in the worktree\'s project layer; the home only trusts it');
  assert.ok(fs.readFileSync(projectFile,'utf8').includes(codexGuardBlock(command)));
  assert.doesNotMatch(fs.readFileSync(path.join(trustHome,'.codex','config.toml'),'utf8'),/command-guard/,'no guard hook in the Codex home');
  assert.deepEqual(ensureLaunchTrust({agent:'codex',cwd,env}).toolGuard,[{file:projectFile,trustedIn:[{home:path.join(trustHome,'.codex'),trusted:'not-checked'}]}],'no app-server injected under a trust home: the hash step waits');
});

/* -------------------------------------------------- gate menu reading */

test('the menu cursor is read from the screen, not assumed',()=>{
  const menu=cursor=>['Quick safety check: Is this a project you created or one you trust?','',...['No, exit','Yes, I trust this folder'].map((o,i)=>(i===cursor?'❯ ':'  ')+o),'','Enter to confirm · Esc to cancel'].join('\n');
  assert.deepEqual(gateMenuPosition(menu(0),'Yes, I trust this folder'),{onTarget:false,direction:1});
  assert.deepEqual(gateMenuPosition(menu(1),'Yes, I trust this folder'),{onTarget:true,direction:0});
  assert.equal(gateMenuPosition('Do you trust the contents of this directory? › 1. Yes, continue 2. No, quit','Yes, continue'),null,'no cursor row, no answer');
});

/* ------------------------------------------- launch trust: op dispatch */

const opFixture=(t,extra={})=>{
  const root=tmp(t,'starci-gate-op-');
  if(process.env.STARCI_TEST_TEMP_DIR)t.after(()=>fs.rmSync(path.join(process.env.STARCI_TEST_TEMP_DIR,'starci-job-scratch'),
    {recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const savedMachine=process.env.STARCI_TEST_MACHINE_FILE,savedProjects=process.env.STARCI_PROJECTS_ROOT;
  process.env.STARCI_TEST_MACHINE_FILE=path.join(root,'machine.sqlite');
  process.env.STARCI_PROJECTS_ROOT=path.join(root,'projects');
  t.after(()=>{if(savedMachine===undefined)delete process.env.STARCI_TEST_MACHINE_FILE;else process.env.STARCI_TEST_MACHINE_FILE=savedMachine;
    if(savedProjects===undefined)delete process.env.STARCI_PROJECTS_ROOT;else process.env.STARCI_PROJECTS_ROOT=savedProjects;});
  const repo=path.join(root,'repo');fs.mkdirSync(repo,{recursive:true});fs.mkdirSync(path.join(repo,'docs'),{recursive:true});
  const trustHome=path.join(root,'trust-home');fs.mkdirSync(path.join(trustHome,'.codex'),{recursive:true});
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),STARCI_FAKE_ORCA_STATE:path.join(root,'state.json'),
    STARCI_AGENT_TRUST_HOME:trustHome,...extra};
  const run=(...args)=>spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
  const orcaState=()=>json(fs.readFileSync(path.join(root,'state.json'),'utf8'))??{};
  const workflowId='wf-gate',jobId='job-gate';
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    seedWorkflow(ledger,{id:workflowId,goal:{revision:1,markdown:'Trust gate fixture',json:{}},jobs:[
      {jobId:`kernel-${workflowId}`,kind:'kernel',role:'kernel',status:'running',workerId:'fake-kernel-terminal',
        payload:{hierarchy:{schema:'starci/agent-hierarchy@1',nodeId:`agent:kernel:${workflowId}`,parentNodeId:`workflow:${workflowId}`,role:'kernel'}}},
      {jobId,opId:'code.refactor',status:'queued',payload:{opId:'code.refactor',owned_paths:['docs/'],model:'codex-agent',difficulty:'hard'}},
    ]});
  }finally{ledger.close();}
  const dispatch=()=>run('dispatch','--repo',repo,'--job',jobId,'--model','codex-agent','--spawn','--json');
  const events=kind=>{
    const l=inspectLedger({file:ledgerFileFor(repo)});
    try{return l.db.prepare('SELECT payload_json FROM events WHERE entity_id=? AND kind=? ORDER BY seq').all(jobId,kind).map(r=>json(r.payload_json));}
    finally{l.close();}
  };
  const job=()=>{const l=inspectLedger({file:ledgerFileFor(repo)});try{return l.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId);}finally{l.close();}};
  return {repo,trustHome,dispatch,events,job,orcaState};
};

// Every launch is orchestration worker-start: Orca answers nothing on the owner's behalf and the runtime types
// nothing into a starting agent, so the launch pre-trusts its directory and the receipt rides the dispatch.
test('a Codex op dispatch pre-trusts its worktree and the trust receipt rides op-dispatched',t=>{
  const fx=opFixture(t);
  const r=fx.dispatch();
  assert.equal(r.status,0,`dispatch failed: ${r.stderr||r.stdout}`);
  assert.equal(fx.job()?.status,'running');
  const [dispatched]=fx.events('op-dispatched');
  assert.equal(dispatched?.trust?.agent,'codex');
  assert.equal(dispatched.trust.status,'written');
  assert.deepEqual(dispatched.trust.paths,[path.resolve(fx.repo)]);
  const toml=fs.readFileSync(path.join(fx.trustHome,'.codex','config.toml'),'utf8');
  for(const k of codexKeyForms(fx.repo))assert.equal(codexProjectTables(toml).get(k)?.trust,'trusted');
  assert.equal(fx.events('gate-auto-approved').length,0,'nothing is typed into a starting worker');
});

/* ----------------------------------------------- launch trust: kernel */

const kernelFixture=(t,kernelLine,extra={})=>{
  const root=tmp(t,'starci-gate-kernel-');
  const repo=path.join(root,'repo');fs.mkdirSync(repo);fs.mkdirSync(path.join(repo,'docs'),{recursive:true});
  const fake=path.join(root,'fake-orca.mjs'),state=path.join(root,'orca-state.json');
  const ownerRoot=path.join(root,'owner');fs.mkdirSync(ownerRoot);
  const trustHome=path.join(root,'trust-home');fs.mkdirSync(trustHome);
  fs.writeFileSync(path.join(ownerRoot,'config.yaml'),`language: vi\neffort: medium\n${kernelLine}\n`);
  fs.writeFileSync(state,JSON.stringify({sends:0,counter:0,terminals:{},commands:[]}));
  fs.writeFileSync(fake,FAKE_ORCA);
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([fake]),
    STARCI_FAKE_ORCA_STATE:state,STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),STARCI_FAKE_ORCA_UNIQUE_TERMINALS:'1',
    STARCI_OWNER_ROOT:ownerRoot,STARCI_AGENT_TRUST_HOME:trustHome,...extra};
  const run=(script,args)=>spawnSync(process.execPath,[script,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
  const defined=run(DEFINE_GOAL,['--repo',repo,'--text','boot the kernel','--json']);
  assert.equal(defined.status,0,defined.stderr);
  const workflowId=json(defined.stdout)?.workflowId;
  const boot=()=>run(START_WORKFLOW,['--repo',repo,'--goal',workflowId,'--json']);
  const events=()=>{
    const l=inspectLedger({file:ledgerFileFor(repo)});
    try{return l.db.prepare("SELECT kind,payload_json FROM events WHERE workflow_id=? AND (kind LIKE 'kernel-%' OR kind='gate-auto-approved') ORDER BY seq").all(workflowId)
      .map(row=>({kind:row.kind,payload:json(row.payload_json)}));}finally{l.close();}
  };
  const orcaState=()=>json(fs.readFileSync(state,'utf8'));
  return {repo,trustHome,boot,events,orcaState};
};

const CLAUDE_KERNEL='kernel: {agent: claude, model: claude-opus-5-5, effort: high}';

test('a Claude kernel boot pre-trusts the repository and asserts the bypass consent before worker-start',t=>{
  const f=kernelFixture(t,CLAUDE_KERNEL);
  const r=f.boot();
  assert.equal(r.status,0,r.stderr||r.stdout);
  const booted=f.events().find(e=>e.kind==='kernel-booted');
  assert.equal(booted?.payload.launch,'worker');
  assert.equal(booted.payload.trust?.agent,'claude');
  assert.equal(booted.payload.trust.status,'written');
  assert.equal(booted.payload.trust.bypassConsent,'written');
  const doc=JSON.parse(fs.readFileSync(path.join(f.trustHome,'.claude.json'),'utf8'));
  for(const k of claudeKeyForms(f.repo))assert.equal(doc.projects[k].hasTrustDialogAccepted,true,k);
});

// A new Codex release put an "Update available! ... Press enter to continue"
// menu in front of every fresh Codex op launch; eighteen launches failed.
test('the Codex update check is pinned off at top level, before any table, and is idempotent',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'codex-update-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'config.toml');
  fs.writeFileSync(file,'model = "gpt-6-sol"\n\n[projects."D:/x"]\ntrust_level = "trusted"\n');
  assert.equal(writeCodexNoUpdateCheck({file}).ok,true);
  assert.equal(writeCodexNoUpdateCheck({file}).written,false,'the second call writes nothing');
  const text=fs.readFileSync(file,'utf8');
  assert.ok(text.startsWith('model = "gpt-6-sol"'),'the owner leading keys stay first');
  assert.ok(text.indexOf('check_for_update_on_startup = false')<text.indexOf('[projects'),'a top-level key must precede every table');
  fs.writeFileSync(file,'check_for_update_on_startup = true\n[projects."D:/x"]\n');
  writeCodexNoUpdateCheck({file});
  assert.equal((fs.readFileSync(file,'utf8').match(/check_for_update_on_startup/g)??[]).length,1,'an existing key is flipped, not duplicated');
  assert.match(fs.readFileSync(file,'utf8'),/^check_for_update_on_startup = false$/m);
});

// Owner 2026-09-24: Codex's "Approaching rate limits - Switch to <cheaper model>?" nudge stopped an op; always
// keep the current model, never show it again - pinned in every Codex home.
test('the Codex rate-limit model nudge is pinned off in a [notice] table and is idempotent',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'codex-nudge-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'config.toml');
  fs.writeFileSync(file,'check_for_update_on_startup = false\n[projects."D:/x"]\ntrust_level = "trusted"\n');
  assert.equal(writeCodexNoModelNudge({file}).written,true);
  assert.equal(writeCodexNoModelNudge({file}).written,false,'the second call writes nothing');
  assert.match(fs.readFileSync(file,'utf8'),/\[notice\]\r?\nhide_rate_limit_model_nudge = true/);
  fs.writeFileSync(file,'[notice]\nhide_rate_limit_model_nudge = false\nother = 1\n[projects."D:/x"]\n');
  writeCodexNoModelNudge({file});
  const text=fs.readFileSync(file,'utf8');
  assert.equal((text.match(/hide_rate_limit_model_nudge/g)??[]).length,1,'an existing key is flipped, not duplicated');
  assert.match(text,/^hide_rate_limit_model_nudge = true$/m);
  assert.ok(text.indexOf('hide_rate_limit_model_nudge')<text.indexOf('[projects'),'the key stays inside [notice]');
});
