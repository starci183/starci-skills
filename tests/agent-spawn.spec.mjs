import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {buildSpawnCommand,loadAdapter} from '../scripts/agent/lib.mjs';
import {parseYaml} from '../engine/yaml.mjs';

const ROOT=path.resolve(import.meta.dirname,'..');
const profileCommand=target=>parseYaml(fs.readFileSync(path.join(ROOT,'modules','models','profiles',`${target}.yaml`),'utf8'))?.launch?.orca?.command;

// Lane m13: pure command assembly — no real orca spawn. The contract under
// test: agent differences are DATA (modules/models/agents/<name>.yaml) and
// the card's bypass flags (devin --permission-mode dangerous) can
// never be forgotten because no caller assembles an agent command by hand.

test('devin on Windows runs with a copy of its config whose Orca hook path Git Bash can execute',()=>{
  // Orca writes the devin-hook as a bare backslash path; Devin runs hook commands through Git Bash, which
  // drops the backslashes and exits 127, so the tab never left Idle (agents/devin.yaml statusHookReason).
  const prefix=loadAdapter('devin').card.commandPrefix.win32;
  assert.match(prefix,/Join-Path \$env:APPDATA 'devin\\config\.json'/);
  assert.match(prefix,/starci-devin-config-' \+ \$PID/);
  assert.match(prefix,/\$starciDevinArgs=@\('--config', \$starciDevinCfg\)/);
  assert.match(prefix,/function devin \{ & \$devinExe @starciDevinArgs @args \}/);
  assert.doesNotMatch(prefix,/Set-Alias -Name devin/,'an alias would shadow the function and drop --config');
});

test('devin kernel command carries the card commandRequirements (dangerous)',()=>{
  const r=buildSpawnCommand({provider:'devin',kernel:true});
  assert.ok(!r.error,r.error);
  assert.match(r.command,/--permission-mode dangerous\b/,'kernel must not stall on per-command menus');
  assert.doesNotMatch(r.command,/accept-edits/,'kernel lane must not degrade to the op permission mode');
});

test('devin op command is unattended and uses commandRequirements (dangerous)',()=>{
  const r=buildSpawnCommand({provider:'devin'});
  assert.ok(!r.error,r.error);
  assert.match(r.command,/--permission-mode dangerous\b/,'an approved Op must never stall at a per-command permission menu');
  assert.doesNotMatch(r.command,/accept-edits/,'accept-edits still asks before shell commands and deadlocks unattended Ops');
});

test('every supported terminal launch shape is unattended',()=>{
  const devin=buildSpawnCommand({provider:'devin'});
  const codex=buildSpawnCommand({provider:'codex',model:'gpt-6-sol',effort:'high'});
  const claude=buildSpawnCommand({provider:'claude',model:'claude-opus-5-5',effort:'high'});
  for(const launch of [devin,codex,claude]) assert.ok(!launch.error,launch.error);
  assert.match(devin.command,/--permission-mode dangerous\b/);
  assert.match(codex.command,/--ask-for-approval never\b/);
  assert.match(codex.command,/--sandbox danger-full-access\b/);
  assert.match(claude.command,/--dangerously-skip-permissions\b/);
  assert.match(claude.command,/--model\s+'claude-opus-5-5'/);
  assert.match(claude.command,/--effort\s+'high'/);
});

test('an explicit command override still gets the card prefix and unattended requirements',()=>{
  const r=buildSpawnCommand({provider:'devin',command:'devin --model swe-2 --some-flag'});
  assert.ok(!r.error,r.error);
  assert.match(r.command,/devin --model swe-2 --some-flag/,'explicit command body was dropped');
  assert.match(r.command,/ACP_BACKEND/,'commandPrefix ACP strip must wrap even an explicit command');
  assert.match(r.command,/--permission-mode dangerous\b/,
    'an explicit profile command must not bypass the card-owned unattended requirement');
  assert.match(r.command,/--respect-workspace-trust false\b/);
});

test('every command-terminal profile keeps its card-owned unattended mode',()=>{
  const devin=buildSpawnCommand({provider:'devin',command:profileCommand('devin-agent')});
  assert.ok(!devin.error,devin.error);
  assert.match(devin.command,/--permission-mode dangerous\b/);
  assert.match(devin.command,/--respect-workspace-trust false\b/);
});

test('explicit Codex and Claude commands cannot bypass terminal unattended flags',()=>{
  const codex=buildSpawnCommand({provider:'codex',command:'codex --model gpt-6-sol'});
  const claude=buildSpawnCommand({provider:'claude',command:'claude --model claude-opus-5-5'});
  assert.ok(!codex.error,codex.error);assert.ok(!claude.error,claude.error);
  assert.match(codex.command,/--ask-for-approval never\b/);
  assert.match(codex.command,/--sandbox danger-full-access\b/);
  assert.match(claude.command,/--dangerously-skip-permissions\b/);
});

// Every seat runs the one npm-global claude.exe, whose self-update fails while any seat holds it
// (update_apply_exe_locked): each runtime-launched Claude seat starts with the updater off (claude.yaml launchEnv).
test('every Claude terminal launch - kernel, op, explicit command - carries DISABLE_AUTOUPDATER=1 before the binary',()=>{
  const plat=process.platform==='win32'?'win32':'posix';
  const setVar=plat==='win32'?"$env:DISABLE_AUTOUPDATER='1';":"export DISABLE_AUTOUPDATER='1';";
  for(const launch of [
    buildSpawnCommand({provider:'claude',kernel:true,model:'claude-opus-5-5'}),
    buildSpawnCommand({provider:'claude',env:{STARCI_ROLE:'op',STARCI_OP_JOB:'op-x-1'}}),
    buildSpawnCommand({provider:'claude',command:'claude --model claude-opus-5-5'}),
  ]){
    assert.ok(!launch.error,launch.error);
    const at=launch.command.indexOf(setVar);
    assert.ok(at>=0,launch.command);
    assert.ok(at<launch.command.indexOf('claude --'),'the variable is set before claude starts: '+launch.command);
  }
  assert.doesNotMatch(buildSpawnCommand({provider:'devin'}).command,/DISABLE_AUTOUPDATER/,'only the claude card declares it');
  assert.deepEqual(loadAdapter('claude').card.launchEnv,{DISABLE_AUTOUPDATER:'1'});
});

test('unknown provider returns a typed error, never a partial command',()=>{
  const r=buildSpawnCommand({provider:'no-such-agent'});
  assert.equal(typeof r.error,'string');
  assert.match(r.error,/no (?:adapter|agent) card/);
  assert.equal(r.command,undefined);
});

test('loadAdapter names the card file it parsed',()=>{
  const r=loadAdapter('devin');
  assert.ok(!r.error,r.error);
  assert.equal(r.file,'modules/models/agents/devin.yaml');
  assert.equal(r.card.kind,'command-terminal-agent');
});
