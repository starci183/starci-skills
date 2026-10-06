import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { classifyAgentScreen } from '../../scripts/lib/terminal-liveness.mjs';
import { buildWakePrompt, wakePromptOf } from '../../scripts/kernel/kernel-watchdog.mjs';
import { KERNEL_REV_ACKED_EVENT, currentRuntimeRev } from '../../scripts/kernel/runtime-rev.mjs';
import { FAKE_ORCA } from '../helpers/fake-orca.mjs';
import { openLedger, inspectLedger, ledgerFileFor } from '../../engine/db/ledger.mjs';
const F = path.parse(os.tmpdir()).root.replace(/\\/g, '/');

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
  assert.equal(classifyAgentScreen('○ Running command\n│ $ node cli.mjs status\n❭ Guide Devin while it works').state,'active','a real status line still wins');
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
// "esc to interrupt"; a working Claude kernel read turn-idle.
test('a Claude Code star spinner with a timer is active; its idle prompt is not',()=>{
  const busy=['  keep the model turn alive.','✶ Osmosing… (1m 0s · ↓ 2.7k tokens)','  ⎿  Tip: Use /btw to ask a quick side question','─────','❯','─────','  ⏵⏵ bypass permissions on (shift+tab to cycle) · ← for agents'].join('\n');
  assert.equal(classifyAgentScreen(busy).state,'active');
  assert.equal(classifyAgentScreen('✻ Cogitating… (12s · ↑ 300 tokens)\n❯').state,'active');
  const idle=[' Yielding — waiting on the scope.define report.','─────','❯','─────','  ⏵⏵ bypass permissions on (shift+tab to cycle) · ← for agents'].join('\n');
  assert.equal(classifyAgentScreen(idle).state,'turn-idle');
});

// claude-agent ops read turn-idle while their spinner ran a hook
// ("(running PreToolUse hook …)", "(running PostToolUse hook …)") or a todo
// activeForm, and while a tool call was still executing; status called them
// worker-nudge-ready and the nudges landed as queued messages.
test('any Claude spinner row and a still-executing tool call are active; finished scrollback is not',()=>{
  const chrome=['─────','❯','─────','  ⏵⏵ bypass permissions on (shift+tab to cycle) · ← for agents'];
  const pre=['● Bash(starci kernel op-contract --job op-provision.ask-9a2c8f0c8d)',
    '✢ Transmuting… (running PreToolUse hook · 1m 26s · ↓ 3.9k tokens)',
    "  ⎿  Tip: Use /btw to ask a quick side question without interrupting Claude's current work",...chrome].join('\n');
  assert.equal(classifyAgentScreen(pre).state,'active','PreToolUse hook spinner');
  const post=[`❯ Read ${F}Repositories/shop-be/.orca/orca-dispatch-ctx_3dedd02ae7c5.md completely and follow it exactly.`,
    '✻ Moseying… (running PostToolUse hook · 3s)',...chrome].join('\n');
  assert.equal(classifyAgentScreen(post).state,'active','PostToolUse hook spinner right after launch');
  assert.equal(classifyAgentScreen(['✳ Moseying… (running SessionStart hook)',...chrome].join('\n')).state,'active','a hook spinner with no timer yet');
  assert.equal(classifyAgentScreen(['✽ Reading owned records… (45s · ↓ 1.2k tokens)','  ⎿  ☐ Reading owned records',...chrome].join('\n')).state,'active','a todo activeForm spinner');
  assert.equal(classifyAgentScreen(['· Reading owned records… (running PreToolUse hook)',...chrome].join('\n')).state,'active','the dim first spinner frame');
  const tool=['● Reading owned records','  ⎿  Running…',...chrome].join('\n');
  assert.equal(classifyAgentScreen(tool).state,'active','a tool call still executing');
  assert.equal(classifyAgentScreen(['● Bash(node cli.mjs status)','  ⎿  Running PreToolUse hook…',...chrome].join('\n')).state,'active');
  // Captured from a running claude-agent op.
  const live=['  ⎿  $ cd /d/Repositories/shop-be;',
    '     E=.starciwork/features/workspace-provision/impl/shop-be/purchase-orchestrator/E; npx jest --config',
    '     src/tests/e2e/jest-e2e.js --runInBand --testMatch',
    '     "<rootDir>/src/tests/e2e/shop-be/workspace-provision/purchase-orchestrator/*.e2e-spec.ts" > $E/r7/e2e-output.txt …',
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
  assert.match(prompt,/Host controller\) owns the ~5-minute cadence/i);
  assert.match(prompt,/yield the model turn immediately/i);
  assert.match(prompt,/Never run Start-Sleep/i);
  assert.doesNotMatch(prompt,/poll canonical status again/i);
  assert.doesNotMatch(prompt,/Do not yield/i);
  assert.doesNotMatch(prompt,/grants no new approval/);
  assert.doesNotMatch(prompt,/Runtime wake for Kernel attempt/,'no seat attempt known, no identity');
});

test('watchdog wake names the Kernel seat it is for, checkable with starci kernel status, and claims no approval',()=>{
  const prompt=buildWakePrompt('wf-example',2);
  assert.match(prompt,/^Watchdog liveness wake for wf-example: .*act on it now\./);
  assert.match(prompt,/Runtime wake for Kernel attempt 2 of wf-example: starci kernel status --workflow wf-example shows kernel\.attempt 2 and kernel\.you true on your terminal\.$/);
  assert.doesNotMatch(prompt,/already approved|needs no confirmation/);
});

test('watchdog wakes a turn-idle Kernel only when status says the frontier is actionable',()=>{
  const supervise=fs.readFileSync(new URL('../../modules/supervisor/supervise.yaml',import.meta.url),'utf8');
  assert.match(supervise,/starci machine kernel-watchdog --repo <repo> --workflow <id> --once --repair/,'the recovery recipe runs a liveness pass that can wake');
});

// Every watchdog imported the liveness classifier once, hours before the
// night's classifier fixes, and kept calling yielded Kernels active. The loop
// now runs each tick as a fresh `--once` child, so a fix lands on the next tick.
test('the watchdog is one --once pass the Host controller runs; there is no loop mode', async t => {
  const { withLedger, seedWorkflow } = await import('../helpers/ledger-fixture.mjs');
  const { spawnSync } = await import('node:child_process');
  const path = await import('node:path');
  const WATCHDOG = path.resolve(import.meta.dirname, '..', '..', 'scripts', 'kernel', 'kernel-watchdog.mjs');
  await withLedger(t, async ({ repoRoot, ledger }) => {
    seedWorkflow(ledger, { id: 'wf-watchdog-once', state: { phase: 'finished' } });
    ledger.db.prepare("UPDATE workflows SET phase='finished' WHERE workflow_id='wf-watchdog-once'").run();
    const r = spawnSync(process.execPath, [WATCHDOG, '--repo', repoRoot, '--workflow', 'wf-watchdog-once', '--once', '--repair', '--json'],
      { encoding: 'utf8', windowsHide: true, timeout: 60000 });
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.equal(JSON.parse(r.stdout.trim().split(/\r?\n/).pop()).action, 'finished');
    const loop = spawnSync(process.execPath, [WATCHDOG, '--repo', repoRoot, '--workflow', 'wf-watchdog-once', '--repair', '--json'],
      { encoding: 'utf8', windowsHide: true, timeout: 60000 });
    assert.equal(loop.status, 2, 'no loop mode: without --once it is refused');
    assert.match(loop.stderr, /there is no loop/);
    assert.equal(loop.stdout.trim(), '', 'no tick ran');
  });
});

// The watchdog repairs the sidebar tab title through the public Orca wrapper (proved end to
// end below: a drifted tab title is renamed to the seat's [Kernel] title on a repair tick).

// A Codex release put its update menu in front of every fresh op launch for
// three hours; it is a named gate the Codex card lets the runtime answer.
test('the Codex update menu is an interactive gate the Codex card auto-answers with Skip until next version', async () => {
  const menu = ['  ✨ Update available! 0.155.1 -> 0.156.1', '  Release notes: https://github.com/openai/codex/releases/latest',
    '› 1. Update now (runs `npm install -g @openai/codex`)', '  2. Skip', '  3. Skip until next version', '  Press enter to continue'].join('\n');
  const v = classifyAgentScreen(menu);
  assert.equal(v.state, 'interactive-gate');
  assert.equal(v.gate, 'codex-update-prompt');
  const { parseYaml } = await import('../../engine/yaml.mjs');
  const card = parseYaml(fs.readFileSync(new URL('../../modules/models/agents/codex.yaml', import.meta.url), 'utf8'));
  assert.equal(card.gateAutoAnswer.gates['codex-update-prompt'].select, 'Skip until next version');
});

// Owner ruling: Codex's quota nudge is a gate the card answers 'Keep current model (never show again)', never 'Switch'.
test('the Codex rate-limit model nudge is a gate the Codex card answers by keeping the current model', async () => {
  const menu = ['  Approaching rate limits', '  Switch to gpt-5.6-luna for lower credit usage?',
    '› 1. Switch to gpt-5.6-luna   Older fast and efficient model.', '  2. Keep current model',
    '  3. Keep current model (never show again)   Hide future rate limit reminders about switching models.',
    '  Press enter to confirm or esc to go back'].join('\n');
  const v = classifyAgentScreen(menu);
  assert.equal(v.state, 'interactive-gate');
  assert.equal(v.gate, 'codex-rate-limit-model-nudge');
  const { parseYaml } = await import('../../engine/yaml.mjs');
  const card = parseYaml(fs.readFileSync(new URL('../../modules/models/agents/codex.yaml', import.meta.url), 'utf8'));
  assert.equal(card.gateAutoAnswer.gates['codex-rate-limit-model-nudge'].select, 'Keep current model (never show again)');
});

// Host housekeeping (the host's C: drive once sat at 9 GB free): the watchdog never sweeps itself - on a low
// edge of the scripts/machine/host-resources.mjs probe it starts ONE detached housekeeping.mjs --apply
// child, and the edge in runtime/guards/host-resources.json keeps a fresh --once child from
// starting it again while the host stays low. The probe is stubbed here (the contract is
// {lowDisk, lowRam, drive, freeDiskGb, freeRamPct}); a spec run never measures the real host.

/* --------------------------------------------------------- e2e: --once --repair ticks */

// One real --once --repair tick against a fake Orca (the world shape of
// tests/kernel/kernel-wake-delivery-proof.spec.mjs), seeded with a live kernel seat.
const ROOT = path.resolve(import.meta.dirname, '..', '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'cli.mjs');
const WATCHDOG_E2E = path.join(ROOT, 'scripts', 'kernel', 'kernel-watchdog.mjs');
const KERNEL = 'kernel-terminal-1';
const json = (text) => { try { return JSON.parse(text); } catch { return null; } };
const KERNEL_IDLE = [' Yielding — waiting on the code.refactor report.', '✻ Brewed for 3m 2s', '─────', '❯', '─────',
  '  ⏵⏵ bypass permissions on (shift+tab to cycle) · ← for agents'].join('\n');

const watchdogWorld = async (t, { jobs = [], events = [], tabTitle = null, signalValue = null } = {}) => {
  const { seedWorkflow } = await import('../helpers/ledger-fixture.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-watchdog-e2e-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const repo = path.join(root, 'repo'); fs.mkdirSync(repo, { recursive: true });
  const stubFile = path.join(root, 'fake-orca.mjs'); fs.writeFileSync(stubFile, FAKE_ORCA);
  const stateFile = path.join(root, 'state.json'), logFile = path.join(root, 'calls.jsonl');
  const env = { ...process.env, STARCI_ORCA_COMMAND: process.execPath, STARCI_ORCA_ARGS: JSON.stringify([stubFile]),
    STARCI_FAKE_ORCA_LOG: logFile, STARCI_FAKE_ORCA_STATE: stateFile, STARCI_FAKE_ORCA_UNIQUE_TERMINALS: '1',
    // The fake Orca echoes a typed wake onto the screen only in this mode: the watchdog proves a delivery from the screen, never from the send receipt.
    STARCI_FAKE_ORCA_SEND_STALLED: 'landed',
    STARCI_LOCAL_ROOT: path.join(root, 'localappdata'), STARCI_TEST_MACHINE_FILE: path.join(root, 'machine.sqlite') };
  const workflowId = 'wf-watchdog-e2e';
  const ledger = openLedger({ file: ledgerFileFor(repo, { env }) });
  try {
    seedWorkflow(ledger, { id: workflowId, state: { phase: 'running' }, goal: { markdown: '# goal' },
      jobs: [{ jobId: `kernel-${workflowId}`, kind: 'kernel', status: 'running', workerId: KERNEL,
        payload: { hierarchy: { attempt: 2, runtime: { terminalHandle: KERNEL } } } }, ...jobs],
      events: [{ kind: 'kernel-booted', entityType: 'kernel', payload: { terminal: KERNEL, launchedBy: 'supervisor', attempt: 2 } },
        // The Kernel acked the current runtime rev: an unacked seat gets a rev paragraph that pushes the wake past the delivery proof's window.
        { kind: KERNEL_REV_ACKED_EVENT, entityType: 'kernel', payload: { rev: currentRuntimeRev(), files: [], source: 'ack', attempt: 2 } }, ...events],
      signals: [{ key: workflowId, value: signalValue ?? { terminal: KERNEL, dispatch: 'dispatch-kernel-1', host: 'orca', agent: 'claude', launch: 'worker' } }] });
    // A replaced seat re-binds the workflow's claimed goal: with none, start-workflow answers queue-empty and launches nothing.
    ledger.db.prepare("INSERT INTO inbox(workflow_id,kind,key,payload_json,status,created_at) VALUES(?,'goal',?,'{}','claimed',?)").run(workflowId, workflowId, Date.now());
  } finally { ledger.close(); }
  fs.writeFileSync(stateFile, JSON.stringify({ terminals: { [KERNEL]: { handle: KERNEL, connected: true, writable: true,
    sent: false, prompt: null, command: 'claude --model claude-opus-5-5', screen: KERNEL_IDLE, ...(tabTitle ? { tabTitle } : {}) } } }));
  const run = (script, args, more = {}) => spawnSync(process.execPath, [script, ...args],
    { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000, env: { ...env, ...more } });
  const tick = (more = {}) => { const r = run(WATCHDOG_E2E, ['--repo', repo, '--workflow', workflowId, '--once', '--repair', '--json'], more);
    return { status: r.status, result: json(r.stdout.trim().split('\n').at(-1)), stderr: r.stderr, stdout: r.stdout }; };
  const api = (...args) => json(run(API, [...args, '--repo', repo, '--workflow', workflowId, '--json']).stdout);
  const orcaCalls = () => (fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean).map(json) : []).map((e) => e.argv);
  const kernelWakes = () => orcaCalls().filter((a) => a[0] === 'terminal' && a[1] === 'send' && a[a.indexOf('--terminal') + 1] === KERNEL)
    .map((a) => ({ text: a.includes('--text') ? a[a.indexOf('--text') + 1] : '', enter: a.includes('--enter') }));
  const orcaState = () => (fs.existsSync(stateFile) ? json(fs.readFileSync(stateFile, 'utf8')) : null) ?? {};
  const eventsOf = (kind) => { const l = inspectLedger({ file: ledgerFileFor(repo, { env }) });
    try { return l.db.prepare('SELECT payload_json FROM events WHERE workflow_id=? AND kind=? ORDER BY seq').all(workflowId, kind).map((r) => json(r.payload_json)); }
    finally { l.close(); } };
  return { root, repo, env, workflowId, tick, api, orcaCalls, kernelWakes, orcaState, eventsOf };
};

// The liveness wake a tick types is built from the starci kernel status read that same tick did: its seat
// attempt, its launcher and its runtime rev are the status values, not watchdog constants.
test('a liveness tick types exactly the wake starci kernel status implies', async (t) => {
  const fx = await watchdogWorld(t);
  const { status, result, stderr } = fx.tick();
  assert.equal(status, 0, stderr);
  assert.equal(result.action, 'woken', JSON.stringify(result));
  const wakes = fx.kernelWakes();
  assert.equal(wakes.length, 1, 'exactly one wake typed');
  const statusValue = fx.api('status');
  assert.equal(wakes[0].text, result.nextWake ?? wakePromptOf(fx.workflowId, statusValue),
    'the typed wake is the wake built from the status read');
  assert.match(wakes[0].text, /Runtime wake for Kernel attempt 2 of wf-watchdog-e2e/,
    'the Kernel attempt starci kernel status names rides in the wake');
});

// A Kernel idle at its prompt with nothing actionable for it (an owner-gate is open, the frontier
// is awaiting-owner) is left alone: the tick answers idle-waiting and types nothing.
test('a turn-idle Kernel behind a non-actionable frontier is left alone', async (t) => {
  const fx = await watchdogWorld(t);
  const incident = fx.api('incident', '--kind', 'owner-gate', '--detail', 'the owner decides the scope');
  assert.equal(incident.ok, true, JSON.stringify(incident));
  assert.equal(fx.api('status').frontier.actionable, false);
  const { status, result, stderr } = fx.tick();
  assert.equal(status, 0, stderr);
  assert.equal(result.action, 'idle-waiting', JSON.stringify(result));
  assert.equal(fx.kernelWakes().length, 0, 'nothing typed while the frontier waits on the owner');
});

// The repair tick restores a moved tab's sidebar title through the Orca `terminal rename` call -
// the answer carries the repair and the host saw one rename for the Kernel terminal.
test('a repair tick renames a drifted Kernel tab title through Orca', async (t) => {
  const fx = await watchdogWorld(t, { tabTitle: 'restored session' });
  const { status, result, stderr } = fx.tick();
  assert.equal(status, 0, stderr);
  assert.equal(result.action, 'woken', JSON.stringify(result));
  const expected = `[Kernel] ${fx.api('status').title ?? fx.workflowId}`;
  assert.equal(result.titleRepair?.title, expected, JSON.stringify(result.titleRepair));
  assert.equal(result.titleRepair?.ok, true);
  const renames = fx.orcaCalls().filter((a) => a[0] === 'terminal' && a[1] === 'rename');
  assert.equal(renames.length, 1, 'one terminal rename call');
  assert.equal(renames[0][renames[0].indexOf('--terminal') + 1], KERNEL);
  assert.equal(renames[0][renames[0].indexOf('--title') + 1], expected);
});

test('a repair retains a seat whose missing worker Dispatch leaves its execution identity unverified', async (t) => {
  const fx = await watchdogWorld(t, { signalValue: { terminal: KERNEL, host: 'orca', agent: 'claude', launch: 'worker' } });
  const { status, result, stderr, stdout } = fx.tick();
  t.diagnostic(JSON.stringify({ status, result, stderr, stdout }));
  assert.equal(status, 1, JSON.stringify({ status, result, stderr, stdout }));
  assert.equal(result.action, 'restart-failed', JSON.stringify(result));
  assert.equal(result.ok, false);
  assert.equal(result.detail?.step, 'kernel-terminal-unverified');
  assert.equal(result.terminal, KERNEL);
  const restarts = fx.eventsOf('kernel-restarted');
  assert.equal(restarts.length, 0, 'unknown identity does not authorize a replacement');
  assert.equal(fx.eventsOf('kernel-stale-cleared').length, 0, 'the original singleton remains bound');
  assert.equal(fx.orcaCalls().filter(a=>a[0]==='orchestration'&&a[1]==='worker-start').length, 0);
});

// An idle Kernel due for replacement (3 delivered wakes with no move, the first past the window)
// whose seat cannot be fenced - Orca refuses worker-release - is replaced by nothing: the tick
// answers kernel-terminal-close-failed, no kernel-replaced-idle is recorded and no start-workflow ran.
test('an idle Kernel whose release is refused is close-failed, not replaced', async (t) => {
  const minute = 60_000, now = Date.now();
  const fx = await watchdogWorld(t, { events: [
    { kind: 'kernel-woken', entityType: 'kernel', created_at: now - 12 * minute, payload: { terminal: KERNEL } },
    { kind: 'kernel-woken', entityType: 'kernel', created_at: now - 11.5 * minute, payload: { terminal: KERNEL } },
    { kind: 'kernel-woken', entityType: 'kernel', created_at: now - 11 * minute, payload: { terminal: KERNEL } },
  ] });
  const { result } = fx.tick({ STARCI_FAKE_ORCA_RELEASE_FAILS: '1' });
  assert.equal(result.action, 'kernel-terminal-close-failed', JSON.stringify(result));
  assert.equal(result.ok, false);
  assert.equal(fx.eventsOf('kernel-replaced-idle').length, 0, 'a close that failed counted no replacement');
  assert.equal(fx.eventsOf('kernel-restarted').length, 0, 'start-workflow never ran');
  assert.equal(fx.orcaCalls().filter((a) => a[0] === 'orchestration' && a[1] === 'worker-start').length, 0, 'no worker started');
});
