// The Kernel seat's shell (the `kernel` table of modules/kernel/command-policy.yaml, scripts/guards/kernel-seat.mjs): starci read verbs,
// `starci kernel decide` and `kernel-ack-rev`; every other `starci kernel` verb is the runtime's and a program that is not starci or
// a pure read is refused. A Kernel that started under the old contract meets the same table at its next command: the habit command
// is refused with the menu and the decide spelling.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { hookDecision } from '../../scripts/guards/command-guard.mjs';
import { bindGuardTerminal, guardLaunch } from '../../scripts/guards/hook-install.mjs';
import { loadCommandPolicy, policyVerdict } from '../../scripts/guards/command-policy.mjs';
import { kernelSeatAllowsVerb, menuHintOf } from '../../scripts/guards/kernel-seat.mjs';
import { openDecisionRow } from '../../scripts/machine/decisions.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const WF = 'wf-seat';
const T0 = Date.now() - 3_600_000;
const JOB = 'op-work.author-seat0001';

const seatOf = (t, ledgerRepo) => {
  const skillRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-kseat-root-')));
  t.after(() => fs.rmSync(skillRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const { receipt } = guardLaunch({ skillRoot, jobId: `kernel-${WF}`, workflowId: WF, ledgerRepo, owned: [], repos: [], role: 'kernel', workflowWorktree: ledgerRepo });
  const handle = `term_kseat-${process.pid}`;
  bindGuardTerminal({ skillRoot, handle, jobFile: receipt.jobFile });
  const env = { ...process.env, ORCA_TERMINAL_HANDLE: handle };
  return (command) => hookDecision({ tool_name: 'Bash', cwd: ledgerRepo, tool_input: { command } }, { env, root: skillRoot });
};

const seedStuck = (world) => {
  const { ledger } = world;
  seedWorkflow(ledger, { id: WF, state: { phase: 'running', job: 'seat' }, goalIdentity: 'seat-goal', goal: { revision: 0, identity: 'seat-goal', markdown: '# goal', json: {} },
    jobs: [{ jobId: JOB, unitId: JOB, opId: 'work.author', status: 'failed', createdAt: T0, dispatchedAt: T0 + 1000, updatedAt: T0 + 120_000, payload: { opId: 'work.author', records: [], owned_paths: ['.starciwork/x'] }, result: { verdict: 'fail' } }] });
  openDecisionRow(ledger, { workflowId: WF, kind: 'retry-decision', entity: { type: 'job', id: JOB }, summary: `${JOB} failed: nothing follows it`, by: 'reconciler/job' }, { now: T0 });
  ledger.close();
};

test('the seat table allows the read verbs, decide and kernel-ack-rev, and nothing that mutates', () => {
  const { kernel: table } = loadCommandPolicy({ root: ROOT });
  for (const verb of ['status', 'logs', 'questions', 'survey', 'decide', 'kernel-ack-rev', 'log', 'decisions', 'inbox']) assert.equal(kernelSeatAllowsVerb(table, 'kernel', verb).allowed, true, verb);
  for (const verb of ['enqueue', 'settle', 'dispatch', 'dispatch-ready', 'route', 'reconcile', 'reply', 'graph-edit', 'op-override', 'redesign', 'incident', 'record-checks', 'finish', 'nudge', 'notify', 'consume-report']) {
    assert.equal(kernelSeatAllowsVerb(table, 'kernel', verb).allowed, false, verb);
  }
  assert.equal(kernelSeatAllowsVerb(table, 'workflow', 'status').allowed, true);
  assert.equal(kernelSeatAllowsVerb(table, 'gate', 'read').allowed, true);
  assert.equal(kernelSeatAllowsVerb(table, 'workflow', 'stop').allowed, false);
  assert.equal(kernelSeatAllowsVerb(table, 'kernel', 'decisions', new Set(['list'])).allowed, true, 'decisions --list is a read');
  for (const flag of ['resolve', 'claim', 'escalate', 'open']) assert.equal(kernelSeatAllowsVerb(table, 'kernel', 'decisions', new Set([flag])).allowed, false, `decisions --${flag}`);
  assert.equal(kernelSeatAllowsVerb(table, 'kernel', 'inbox', new Set(['ack'])).allowed, false);
});

test('a Kernel seat runs starci reads and decide; node, git, npm, orca, sleep and a mutating verb are refused with typed codes', async (t) => {
  const decide = seatOf(t, ROOT);
  for (const command of ['starci kernel status --workflow wf-seat', 'starci kernel decide --workflow wf-seat --item x --choice y --reason z', 'starci kernel kernel-ack-rev --workflow wf-seat --plan',
    'starci workflow status --workflow wf-seat', 'starci gate read --knowledge knowledge/op-gate.yaml', 'cat modules/kernel/kernel-menu.yaml', 'starci kernel status --workflow wf-seat --json | jq .menu']) {
    assert.equal(await decide(command), null, command);
  }
  const refused = async (command) => (await decide(command))?.verdict?.code;
  assert.equal(await refused('starci kernel enqueue --workflow wf-seat --op x --paths y'), 'KERNEL_USE_DECIDE');
  assert.equal(await refused('starci kernel decisions --workflow wf-seat --resolve di-1 --by kernel --verb x'), 'KERNEL_USE_DECIDE');
  assert.equal(await refused('starci kernel op-override --workflow wf-seat --op x --set {}'), 'KERNEL_USE_DECIDE');
  assert.equal(await refused('starci kernel incident --workflow wf-seat --kind supervisor-gate'), 'KERNEL_USE_DECIDE');
  assert.equal(await refused('node -e "console.log(1)"'), 'KERNEL_STARCI_ONLY');
  assert.equal(await refused('git status --short'), 'KERNEL_STARCI_ONLY');
  assert.equal(await refused('npm test'), 'KERNEL_STARCI_ONLY');
  assert.equal(await refused('orca orchestration worker-show --dispatch d-1'), 'KERNEL_STARCI_ONLY');
  assert.equal(await refused('sleep 30'), 'KERNEL_STARCI_ONLY');
});

test('an old-habit mutating verb is refused with the decide spelling and the Kernel\'s own menu', (t) => withLedger(t, async (world) => {
  seedStuck(world);
  const decide = seatOf(t, world.repoRoot);
  const verdict = (await decide(`starci kernel enqueue --workflow ${WF} --op work.author --paths .starciwork/x --retry-of ${JOB}`)).verdict;
  assert.equal(verdict.code, 'KERNEL_USE_DECIDE');
  const text = `${verdict.reason}\n${verdict.remedy}\n${verdict.use ?? ''}`;
  assert.match(text, /starci kernel decide --workflow <workflow> --item <id> --choice <choice> --reason <why>/);
  assert.match(text, new RegExp(`job-decision:${JOB}`), 'the refusal carries the menu item');
  assert.match(text, /a\) continue/, 'and its options');
}));

test('the menu hint says the menu is empty when nothing waits on the Kernel, and nothing when the seat has no ledger', (t) => withLedger(t, (world) => {
  seedWorkflow(world.ledger, { id: WF, state: { phase: 'running', job: 'seat' }, goalIdentity: 'seat-goal', goal: { revision: 0, identity: 'seat-goal', markdown: '# goal', json: {} }, jobs: [] });
  world.ledger.close();
  assert.match(menuHintOf({ ledgerRepo: world.repoRoot, workflowId: WF }), /menu is empty/);
  assert.equal(menuHintOf({ ledgerRepo: null, workflowId: WF }), '');
}));

test('the owner and the lead role are unaffected: the same mutating verb passes the policy without a Kernel guard', () => {
  const policy = loadCommandPolicy({ root: ROOT });
  const command = { program: 'starci', args: ['kernel', 'enqueue', '--workflow', WF, '--op', 'x', '--paths', 'y'] };
  assert.equal(policyVerdict({ role: 'lead', command, guard: null, policy }), null, 'a lead session (STARCI_ROLE=lead) runs the runtime verbs');
  assert.equal(policyVerdict({ role: null, command, guard: null, policy }), null, 'the owner is never restricted');
  assert.equal(policyVerdict({ role: 'lead', command, guard: { role: 'kernel' }, policy })?.code, 'KERNEL_USE_DECIDE', 'only the bound Kernel guard is restricted');
  assert.equal(policyVerdict({ role: 'op', command: { program: 'node', args: ['-e', '1'] }, guard: { role: 'op', op: 'x' }, policy })?.code, 'RIGHTS_RAW_TOOL', 'an op keeps its own table');
});

test('a Kernel seat redirecting output into a file is refused; the null devices and stream merges are not files', (t) => withLedger(t, async (world) => {
  seedStuck(world);
  const decide = seatOf(t, world.repoRoot);
  for (const command of ['starci kernel logs --seq 595 --json > 0', 'starci kernel status --json 2>0', 'starci kernel status >> out.txt']) {
    assert.equal((await decide(command))?.verdict?.code, 'KERNEL_NO_FILE_WRITE', command);
  }
  for (const command of ['starci kernel status --json 2>&1', 'starci kernel status --json 2>/dev/null', 'starci kernel status --json > /dev/null']) {
    assert.equal((await decide(command))?.verdict?.code ?? null, null, command);
  }
}));
