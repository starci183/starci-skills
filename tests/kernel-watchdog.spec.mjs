import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyAgentScreen } from '../scripts/kernel/terminal-liveness.mjs';
import { buildWakePrompt } from '../scripts/kernel/watchdog.mjs';

test('provider input prompt is turn-idle even when it carries an Orca message',()=>{
  const screen=`Worked for 18m 4s · done 6:56 AM
─ Conversation recap ─
› You have 4 orchestration messages. Run the canonical check.`;
  assert.equal(classifyAgentScreen(screen).state,'turn-idle');
});

test('current activity wins over the provider input row kept visible by the TUI',()=>{
  const screen=`• Ran canonical status
• Working (4m 36s · esc to interrupt) · 1 background terminal running
› Ask Codex to do anything`;
  assert.equal(classifyAgentScreen(screen).state,'active');
});

test('quoted child activity does not strand a turn-idle Kernel',()=>{
  const screen=` │ • Working (28s · esc to interrupt) · Running hook
 │ › Ask Codex to do anything
 └ Exited with code 0
Seam worker filed its report; the Kernel must consume it.
› Ask Devin to build features, fix bugs, or work on your code`;
  assert.equal(classifyAgentScreen(screen).state,'turn-idle');
});

test('permission and process failures are not treated as safe wake prompts',()=>{
  assert.equal(classifyAgentScreen('1 Yes (Approve once)\n2 No\nconfirm · esc Cancel').state,'interactive-gate');
  assert.equal(classifyAgentScreen('ERROR: Not logged in\n› Ask Codex to do anything').state,'failed');
});

// A Collab Kernel opened Devin's own question dialog; its "❭" selection cursor
// read as an input prompt and every watchdog wake was typed into "Other".
test('an agent CLI question dialog is an interactive gate, never a turn-idle prompt',()=>{
  const devin=`── Read scope ✓ · Safe mode ✓ · Quality targets ──
  Decision 2 (decision.collab.safe-mode-defaults): Which actions does V1 safe mode hold?
  · Mandatory gate (recommended)
  · Owner-configurable
  ❭ Other (type your own)
↑↓ navigate · ↵ select · ←→ switch question · ? help me out · esc cancel
? Not ready to answer, help me out!`;
  const verdict=classifyAgentScreen(devin);
  assert.equal(verdict.state,'interactive-gate');
  assert.equal(verdict.gate,'agent-question-dialog');
  const claude=`Which layout?
❯ 1. Grid
  2. List
Enter to select · Tab/Arrow keys to navigate · Esc to cancel`;
  assert.equal(classifyAgentScreen(claude).state,'interactive-gate');
  assert.equal(classifyAgentScreen('● Canceled. What should Devin do?\n❭ Ask Devin to build features').state,'turn-idle','a cancelled dialog back at the prompt is idle again');
});

// A WSPV Kernel yielded with a summary headed "Running now:"; the word read as a
// spinner, so the report wake and the watchdog both skipped it for 13 minutes.
test('a Kernel yield summary that says "Running now:" is turn-idle, not active',()=>{
  const screen=[
    ' Running now:',
    '   •  ctx_0a4ab01608a3  — draw-lineage binding repair',
    ' After they settle: fresh audit cells.',
    ' Yielding — wait reason: reports from the 3 running workers.',
    '───── (bypass permissions on) ─',
    '❭ Ask Devin to build features, fix bugs, or work on your code',
    '─────',
    'SWE-2 Max   Context: 140k / 262k tokens (53%)',
    '3 shells · ↓ select',
  ].join('\n');
  assert.equal(classifyAgentScreen(screen).state,'turn-idle');
  assert.equal(classifyAgentScreen('Running: provisioning r3\n❭ Ask Devin to build features').state,'turn-idle');
  assert.equal(classifyAgentScreen('○ Running command\n│ $ node api.mjs status\n❭ Guide Devin while it works').state,'active','a real status line still wins');
  assert.equal(classifyAgentScreen('• Running canonical status\n› Ask Codex to do anything').state,'active');
});

test('watchdog wake transfers cadence ownership outside the Kernel model turn',()=>{
  const prompt=buildWakePrompt('wf-example');
  assert.match(prompt,/external watchdog owns the 5-minute cadence/i);
  assert.match(prompt,/yield the model turn immediately/i);
  assert.match(prompt,/Never run Start-Sleep/i);
  assert.doesNotMatch(prompt,/poll canonical status again/i);
  assert.doesNotMatch(prompt,/Do not yield/i);
});

test('watchdog wakes a turn-idle Kernel only when status says the frontier is actionable',()=>{
  const src=fs.readFileSync(new URL('../scripts/kernel/watchdog.mjs',import.meta.url),'utf8');
  const idle=src.indexOf("classified.state === 'turn-idle'"),gate=src.indexOf('frontier?.actionable',idle),send=src.indexOf('terminalSend(',idle);
  assert.ok(idle>0&&gate>idle&&send>gate,'the actionable gate sits between the turn-idle branch and the wake send');
  assert.match(src,/action: 'idle-waiting'/);
  const supervise=fs.readFileSync(new URL('../modules/supervisor/supervise.yaml',import.meta.url),'utf8');
  assert.match(supervise,/watchdog\.mjs --repo <repo> --workflow <id> --repair/,'the recovery recipe spawns a watchdog that can wake');
});
