import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSpawnCommand,loadAdapter} from '../scripts/agent/lib.mjs';

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

test('devin op command uses commandRequirements (accept-edits)',()=>{
  const r=buildSpawnCommand({provider:'devin'});
  assert.ok(!r.error,r.error);
  assert.match(r.command,/--permission-mode accept-edits\b/);
  assert.doesNotMatch(r.command,/--permission-mode dangerous\b/,'an op lane must never inherit kernel bypass');
});

test('an explicit command override still gets the card prefix (ACP strip)',()=>{
  const r=buildSpawnCommand({provider:'devin',command:'devin --model swe-2 --some-flag'});
  assert.ok(!r.error,r.error);
  assert.match(r.command,/devin --model swe-2 --some-flag/,'explicit command body was dropped');
  assert.match(r.command,/ACP_BACKEND/,'commandPrefix ACP strip must wrap even an explicit command');
  // The override replaces the card body — requirement flags belong to the card's own bodies.
  assert.ok(!r.command.endsWith('dangerous')&&!r.command.endsWith('accept-edits'),
    'requirement flags must not be glued onto an explicit command');
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
