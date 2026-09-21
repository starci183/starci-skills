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
// the card's bypass flags (qwen --yolo, devin --permission-mode dangerous) can
// never be forgotten because no caller assembles an agent command by hand.

test('qwen op command carries the credential-refresh prefix and --yolo',()=>{
  const r=buildSpawnCommand({provider:'qwen'});
  assert.ok(!r.error,r.error);
  // The env-key name is platform-proof: win32 says Remove-Item Env:NAME, posix says unset NAME.
  assert.match(r.command,/BAILIAN_TOKEN_PLAN_API_KEY/,'credentialRefresh prefix missing — a stale key 401s qwen');
  assert.match(r.command,/--yolo\b/,'qwen without --yolo stalls on per-kind permission menus');
  assert.equal(r.commandSource,'modules/models/agents/qwen.yaml');
});

test('devin kernel command uses kernelCommandRequirements (dangerous)',()=>{
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
  const qwen=buildSpawnCommand({provider:'qwen'});
  const devin=buildSpawnCommand({provider:'devin'});
  const codex=buildSpawnCommand({provider:'codex',model:'gpt-5.6-sol',effort:'high'});
  const claude=buildSpawnCommand({provider:'claude',model:'claude-opus-5',effort:'high'});
  for(const launch of [qwen,devin,codex,claude]) assert.ok(!launch.error,launch.error);
  assert.match(qwen.command,/--yolo\b/);
  assert.match(devin.command,/--permission-mode dangerous\b/);
  assert.match(codex.command,/--ask-for-approval never\b/);
  assert.match(codex.command,/--sandbox danger-full-access\b/);
  assert.match(claude.command,/--dangerously-skip-permissions\b/);
  assert.match(claude.command,/--model\s+'claude-opus-5'/);
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
  for(const target of ['qwen-agent','qwen3.8-max','deepseek-v4-pro']){
    const r=buildSpawnCommand({provider:'qwen',command:profileCommand(target)});
    assert.ok(!r.error,`${target}: ${r.error}`);
    assert.match(r.command,/--yolo\b/,`${target}: explicit profile command bypassed Qwen yolo`);
    assert.match(r.command,/--exclude-tools agent\b/,`${target}: nested-agent exclusion was dropped`);
  }
  const devin=buildSpawnCommand({provider:'devin',command:profileCommand('devin-agent')});
  assert.ok(!devin.error,devin.error);
  assert.match(devin.command,/--permission-mode dangerous\b/);
  assert.match(devin.command,/--respect-workspace-trust false\b/);
});

test('explicit Codex and Claude commands cannot bypass terminal unattended flags',()=>{
  const codex=buildSpawnCommand({provider:'codex',command:'codex --model gpt-5.6-sol'});
  const claude=buildSpawnCommand({provider:'claude',command:'claude --model claude-opus-5'});
  assert.ok(!codex.error,codex.error);assert.ok(!claude.error,claude.error);
  assert.match(codex.command,/--ask-for-approval never\b/);
  assert.match(codex.command,/--sandbox danger-full-access\b/);
  assert.match(claude.command,/--dangerously-skip-permissions\b/);
});

test('unknown provider returns a typed error, never a partial command',()=>{
  const r=buildSpawnCommand({provider:'no-such-agent'});
  assert.equal(typeof r.error,'string');
  assert.match(r.error,/no (?:adapter|agent) card/);
  assert.equal(r.command,undefined);
});

test('loadAdapter names the card file it parsed',()=>{
  const r=loadAdapter('qwen');
  assert.ok(!r.error,r.error);
  assert.equal(r.file,'modules/models/agents/qwen.yaml');
  assert.equal(r.card.kind,'command-terminal-agent');
});
