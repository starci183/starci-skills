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
  // Any line that ends in a colon is a heading of the Kernel's own prose (WSPV
  // later yielded under " Running (codex):" and sat 20 minutes unwoken).
  assert.equal(classifyAgentScreen(' Running (codex):\n   •  ctx_f38 — payment-pending audit\n Yielding — wait reason: audit reports.\n❭ Ask Devin to build features').state,'turn-idle');
  assert.equal(classifyAgentScreen('• Working (4m 36s · esc to interrupt) · 1 background terminal running\n› Ask Codex').state,'active');
  // A wrapped prose line that happens to start with lowercase "running." is not a spinner.
  assert.equal(classifyAgentScreen(' Yield state:  backend.implement — 3/8 settled; wave 4 (routing)\n running. Remaining: tasks → approval ∥ notification → gateway.\n❭ Ask Devin to build features').state,'turn-idle');
  assert.equal(classifyAgentScreen('○ Running command\n│ $ node api.mjs status\n❭ Guide Devin while it works').state,'active','a real status line still wins');
  assert.equal(classifyAgentScreen('• Running canonical status\n› Ask Codex to do anything').state,'active');
});

// A Collab worker sat 60 minutes on `... | xargs grep` reading stdin; the
// moving spinner read as active and nothing flagged it.
test('a turn past the wedge threshold on a command with no output is wedged, a long busy turn is not',()=>{
  const wedged=[
    ' ○ Running command',
    ' │ $ grep -rln "work/implementation@1" .starciwork/ | head -10 | xargs grep -l "state:"',
    ' │ No output yet (still running)',
    '⠙⠀ Thinking · 60m 34s (esc twice to interrupt)',
    '❭ Guide Devin while it works',
  ].join('\n');
  const v=classifyAgentScreen(wedged);
  assert.equal(v.state,'wedged');
  assert.equal(v.minutes,60);
  assert.equal(classifyAgentScreen(wedged.replace('60m 34s','12m 3s')).state,'active','a young turn is still working');
  assert.equal(classifyAgentScreen(wedged.replace(' │ No output yet (still running)\n','')).state,'active','a long turn that produces output is working');
  assert.equal(classifyAgentScreen('• Working (1h 5m · esc to interrupt)\n│ No output yet\n› Ask Codex').state,'wedged','hours count too');
});

// A supervisor message reached a WSPV Kernel mid-turn; Devin queued it and the
// idle prompt then waited for Enter while nothing else happened.
test('an idle prompt holding queued messages is queued-input; a running turn is not',()=>{
  const idle=' Yielding.\n─────\n❭ Press Enter to send queued messages now\n─────\nSWE-2 Max   Context: 97k / 262k tokens (37%)';
  assert.equal(classifyAgentScreen(idle).state,'queued-input');
  const busy='⠉⠁ Thinking · 4m 46s (esc twice to interrupt)\n❭ Press Enter to send queued messages now';
  assert.equal(classifyAgentScreen(busy).state,'active','Enter during a running turn would cut into it');
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

// Every nivo watchdog imported the liveness classifier once, hours before the
// night's classifier fixes, and kept calling yielded Kernels active. The loop
// now runs each tick as a fresh `--once` child, so a fix lands on the next tick.
test('the watchdog loop runs each tick in a fresh child and stops on a finished workflow', async t => {
  const { withLedger, seedWorkflow } = await import('./_ledger-fixture.mjs');
  const { spawnSync } = await import('node:child_process');
  const path = await import('node:path');
  const WATCHDOG = path.resolve(import.meta.dirname, '..', 'scripts', 'kernel', 'watchdog.mjs');
  await withLedger(t, async ({ repoRoot, ledger }) => {
    seedWorkflow(ledger, { id: 'wf-watchdog-loop', state: { phase: 'finished' } });
    ledger.db.prepare("UPDATE workflows SET phase='finished' WHERE workflow_id='wf-watchdog-loop'").run();
    const r = spawnSync(process.execPath, [WATCHDOG, '--repo', repoRoot, '--workflow', 'wf-watchdog-loop', '--interval-ms', '10000', '--json'],
      { encoding: 'utf8', windowsHide: true, timeout: 60000 });
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const last = JSON.parse(r.stdout.trim().split(/\r?\n/).pop());
    assert.equal(last.action, 'finished', 'the child tick reported finished and the loop ended');
  });
  const source = fs.readFileSync(WATCHDOG, 'utf8');
  assert.match(source, /spawnSync\(process\.execPath, \[self, \.\.\.argv, '--once'/, 'the loop re-executes itself per tick');
});

// Devin and Codex overwrite terminal titles with their own session summaries;
// the nivo sidebar showed no [Kernel]/[Op] name at all. The repair tick puts
// the semantic titles back when they drift.
test('a kernel or op title an agent CLI overwrote counts as drifted', async () => {
  const { kernelTitleOf, opTitleOf, titleDrifted } = await import('../scripts/kernel/watchdog.mjs');
  assert.equal(kernelTitleOf('wf-a'), '[Kernel] wf-a');
  assert.equal(opTitleOf('interface.audit', 'wf-a'), '[Op] interface.audit · wf-a');
  assert.equal(titleDrifted('devin.exe: Kernel orchestration for nivo', kernelTitleOf('wf-a')), true);
  assert.equal(titleDrifted('⠸ Report dispatched task status | nivo-backend', opTitleOf('interface.audit', 'wf-a')), true);
  assert.equal(titleDrifted('[Kernel] wf-a', kernelTitleOf('wf-a')), false);
  assert.equal(titleDrifted('[Op] interface.audit a3 · wf-a', opTitleOf('interface.audit', 'wf-a')), false, 'the dispatch-time title with its attempt stays');
  const src = fs.readFileSync(new URL('../scripts/kernel/watchdog.mjs', import.meta.url), 'utf8');
  assert.match(src, /repair \? keepTitles\(/, 'only a repair watchdog renames');
});
