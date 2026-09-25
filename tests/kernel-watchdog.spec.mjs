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

// Claude Code 2.1.280 spins with "✶ Osmosing… (1m 0s · ↓ 2.7k tokens)" and no
// "esc to interrupt"; a working nivo Claude kernel read turn-idle.
test('a Claude Code star spinner with a timer is active; its idle prompt is not',()=>{
  const busy=['  keep the model turn alive.','✶ Osmosing… (1m 0s · ↓ 2.7k tokens)','  ⎿  Tip: Use /btw to ask a quick side question','─────','❯','─────','  ⏵⏵ bypass permissions on (shift+tab to cycle) · ← for agents'].join('\n');
  assert.equal(classifyAgentScreen(busy).state,'active');
  assert.equal(classifyAgentScreen('✻ Cogitating… (12s · ↑ 300 tokens)\n❯').state,'active');
  const idle=[' Yielding — waiting on the scope.define report.','─────','❯','─────','  ⏵⏵ bypass permissions on (shift+tab to cycle) · ← for agents'].join('\n');
  assert.equal(classifyAgentScreen(idle).state,'turn-idle');
});

// nivo claude-agent ops read turn-idle while their spinner ran a hook
// ("(running PreToolUse hook …)", "(running PostToolUse hook …)") or a todo
// activeForm, and while a tool call was still executing; status called them
// worker-nudge-ready and the nudges landed as queued messages
// (inc-dd8b95e58762, inc-a579fa590ed8, inc-786c9372e7a2, inc-dbdb4244ee2a, inc-5d6556105a98).
test('any Claude spinner row and a still-executing tool call are active; finished scrollback is not',()=>{
  const chrome=['─────','❯','─────','  ⏵⏵ bypass permissions on (shift+tab to cycle) · ← for agents'];
  const pre=['● Bash(node scripts/kernel/api.mjs op-contract --job op-provision.ask-9a2c8f0c8d)',
    '✢ Transmuting… (running PreToolUse hook · 1m 26s · ↓ 3.9k tokens)',
    "  ⎿  Tip: Use /btw to ask a quick side question without interrupting Claude's current work",...chrome].join('\n');
  assert.equal(classifyAgentScreen(pre).state,'active','PreToolUse hook spinner');
  const post=['❯ Read D:/Repositories/nivo-backend/.orca/orca-dispatch-ctx_3dedd02ae7c5.md completely and follow it exactly.',
    '✻ Moseying… (running PostToolUse hook · 3s)',...chrome].join('\n');
  assert.equal(classifyAgentScreen(post).state,'active','PostToolUse hook spinner right after launch');
  assert.equal(classifyAgentScreen(['✳ Moseying… (running SessionStart hook)',...chrome].join('\n')).state,'active','a hook spinner with no timer yet');
  assert.equal(classifyAgentScreen(['✽ Reading owned records… (45s · ↓ 1.2k tokens)','  ⎿  ☐ Reading owned records',...chrome].join('\n')).state,'active','a todo activeForm spinner');
  assert.equal(classifyAgentScreen(['· Reading owned records… (running PreToolUse hook)',...chrome].join('\n')).state,'active','the dim first spinner frame');
  const tool=['● Reading owned records','  ⎿  Running…',...chrome].join('\n');
  assert.equal(classifyAgentScreen(tool).state,'active','a tool call still executing');
  assert.equal(classifyAgentScreen(['● Bash(node api.mjs status)','  ⎿  Running PreToolUse hook…',...chrome].join('\n')).state,'active');
  // Captured from a running nivo claude-agent op (op-backend.implement-c8cae00a7d) on 2026-09-23.
  const live=['  ⎿  $ cd /d/Repositories/nivo-backend;',
    '     E=.starciwork/features/workspace-provision/impl/nivo-backend/purchase-orchestrator/E; npx jest --config',
    '     src/tests/e2e/jest-e2e.js --runInBand --testMatch',
    '     "<rootDir>/src/tests/e2e/nivo/workspace-provision/purchase-orchestrator/*.e2e-spec.ts" > $E/r7/e2e-output.txt …',
    '     (32s · 11 lines)','     (ctrl+b to run in background)',
    '· Newspapering… (5m 7s · ↓ 20.8k tokens)',
    "  ⎿  Tip: Use /btw to ask a quick side question without interrupting Claude's current work",...chrome];
  assert.equal(classifyAgentScreen(live.join('\n')).state,'active');
  assert.equal(classifyAgentScreen(live.map(row=>row.replace('(5m 7s · ↓ 20.8k tokens)','(running PostToolUse hook · 5m 7s)')).join('\n')).state,'active');
  assert.equal(classifyAgentScreen(live.filter(row=>!row.startsWith('· ')).join('\n')).state,'active','the running Bash row alone');
  // A finished turn stays turn-idle: its summary has no ellipsis, and an old
  // hook spinner followed by the answer is scrollback.
  assert.equal(classifyAgentScreen(['● Report filed; yielding.','✻ Brewed for 1m 3s',...chrome].join('\n')).state,'turn-idle');
  assert.equal(classifyAgentScreen(['✢ Transmuting… (running PreToolUse hook · 1m 26s · ↓ 3.9k tokens)','● Report filed with outcome done.',...chrome].join('\n')).state,'turn-idle');
  assert.equal(classifyAgentScreen(['● Reading owned records','  ⎿  Read 3 files','● Done: report filed.',...chrome].join('\n')).state,'turn-idle');
});

test('watchdog wake transfers cadence ownership outside the Kernel model turn',()=>{
  const prompt=buildWakePrompt('wf-example');
  assert.match(prompt,/external watchdog owns the 5-minute cadence/i);
  assert.match(prompt,/yield the model turn immediately/i);
  assert.match(prompt,/Never run Start-Sleep/i);
  assert.doesNotMatch(prompt,/poll canonical status again/i);
  assert.doesNotMatch(prompt,/Do not yield/i);
  // A replacement Claude kernel read "This wake grants no new approval" as "wait for one"
  // and asked the owner to reply 'Run it' on every wake (2026-09-24).
  assert.match(prompt,/already approved this workflow: this wake is the runtime's authorized cadence and needs no confirmation/);
  assert.doesNotMatch(prompt,/grants no new approval/);
});

test('watchdog wakes a turn-idle Kernel only when status says the frontier is actionable',()=>{
  const src=fs.readFileSync(new URL('../scripts/kernel/watchdog.mjs',import.meta.url),'utf8');
  const idle=src.indexOf("classified.state === 'turn-idle'"),gate=src.indexOf('frontier?.actionable',idle),send=src.indexOf('sendWakeWithProof(',idle);
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
    const r = spawnSync(process.execPath, [WATCHDOG, '--repo', repoRoot, '--workflow', 'wf-watchdog-loop', '--repair', '--interval-ms', '10000', '--json'],
      { encoding: 'utf8', windowsHide: true, timeout: 60000 });
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const last = JSON.parse(r.stdout.trim().split(/\r?\n/).pop());
    assert.equal(last.action, 'finished', 'the child tick reported finished and the loop ended');
    // LC-8: a loop without --repair held the workflow's singleton lock and only reported, so a
    // dead kernel under it was never replaced and resume-all counted it as coverage.
    const probeLoop = spawnSync(process.execPath, [WATCHDOG, '--repo', repoRoot, '--workflow', 'wf-watchdog-loop', '--interval-ms', '10000', '--json'],
      { encoding: 'utf8', windowsHide: true, timeout: 60000 });
    assert.equal(probeLoop.status, 2, 'a loop without --repair is refused before it takes the lock');
    assert.match(probeLoop.stderr, /--once \[--repair\]/, 'the usage names the read-only --once probe');
    assert.equal(probeLoop.stdout.trim(), '', 'no tick ran');
  });
  const source = fs.readFileSync(WATCHDOG, 'utf8');
  assert.match(source, /spawnSync\(process\.execPath, \[self, \.\.\.argv, '--once'/, 'the loop re-executes itself per tick');
});

// Orca's sidebar shows the tab title set at creation or by rename, while the
// listed `title` is the pane title the agent CLI rewrites every turn; a
// per-tick rename chased the wrong field, so the watchdog renames nothing.
test('the watchdog never renames terminals', () => {
  const src = fs.readFileSync(new URL('../scripts/kernel/watchdog.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /terminalRename|keepTitles/);
});

// A Codex release put its update menu in front of every fresh op launch for
// three hours; it is a named gate the Codex card lets the runtime answer.
test('the Codex update menu is an interactive gate the Codex card auto-answers with Skip until next version', async () => {
  const menu = ['  ✨ Update available! 0.155.1 -> 0.156.1', '  Release notes: https://github.com/openai/codex/releases/latest',
    '› 1. Update now (runs `npm install -g @openai/codex`)', '  2. Skip', '  3. Skip until next version', '  Press enter to continue'].join('\n');
  const v = classifyAgentScreen(menu);
  assert.equal(v.state, 'interactive-gate');
  assert.equal(v.gate, 'codex-update-prompt');
  const { parseYaml } = await import('../engine/yaml.mjs');
  const card = parseYaml(fs.readFileSync(new URL('../modules/models/agents/codex.yaml', import.meta.url), 'utf8'));
  assert.equal(card.gateAutoAnswer.gates['codex-update-prompt'].select, 'Skip until next version');
});

// Owner 2026-09-24: Codex's quota nudge is a gate the card answers 'Keep current model (never show again)', never 'Switch'.
test('the Codex rate-limit model nudge is a gate the Codex card answers by keeping the current model', async () => {
  const menu = ['  Approaching rate limits', '  Switch to gpt-5.6-luna for lower credit usage?',
    '› 1. Switch to gpt-5.6-luna   Older fast and efficient model.', '  2. Keep current model',
    '  3. Keep current model (never show again)   Hide future rate limit reminders about switching models.',
    '  Press enter to confirm or esc to go back'].join('\n');
  const v = classifyAgentScreen(menu);
  assert.equal(v.state, 'interactive-gate');
  assert.equal(v.gate, 'codex-rate-limit-model-nudge');
  const { parseYaml } = await import('../engine/yaml.mjs');
  const card = parseYaml(fs.readFileSync(new URL('../modules/models/agents/codex.yaml', import.meta.url), 'utf8'));
  assert.equal(card.gateAutoAnswer.gates['codex-rate-limit-model-nudge'].select, 'Keep current model (never show again)');
});
