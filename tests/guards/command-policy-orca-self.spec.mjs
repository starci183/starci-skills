// Calibration: a bound seat's own Orca lifecycle was wrongly blocked as RIGHTS_RAW_TOOL.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { hookDecision } from '../../scripts/guards/command-guard.mjs';
import { loadCommandPolicy, policyVerdict, shimDecision } from '../../scripts/guards/command-policy.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const POLICY = loadCommandPolicy({ root: ROOT });
const HANDLE = 'term-orca-self';
const send = (type, from = HANDLE) => ['orchestration', 'send', '--from', from, '--type', type,
  '--subject', 'status', '--body', 'own lifecycle', '--task-id', 'task_self', '--dispatch-id', 'ctx_self'];
const verdict = (args, role = 'op', handle = HANDLE, policy = POLICY) => policyVerdict({
  role, command: { program: 'orca', args }, handle, policy,
});

test('wrongly blocked: every bound rights role can send its own heartbeat, worker_done, escalation and ask', () => {
  for (const role of POLICY.roles.bound) {
    for (const type of ['heartbeat', 'worker_done', 'escalation']) {
      const args = send(type);
      if (type === 'heartbeat') args.push('--phase', 'reviewing');
      if (type === 'worker_done') args.push('--outcome', 'succeeded', '--files-modified', 'a.mjs', '--report-path', 'report.json');
      assert.equal(verdict(args, role), null, `${role}: ${type}`);
      assert.equal(verdict(['orchestration', 'send', `--from=${HANDLE}`, `--type=${type}`, '--subject=alive'], role), null);
    }
    assert.equal(verdict(['orchestration', 'ask', '--from', HANDLE, '--question', 'What next?', '--options', 'a,b', '--timeout-ms', '600000'], role), null);
    assert.equal(verdict(['orchestration', 'ask', `--from=${HANDLE}`, '--resume', 'msg_self', '--json'], role), null);
    assert.equal(verdict(['orchestration', 'check', '--terminal', HANDLE, '--json'], role), null);
  }
});

test('lifecycle calibration keeps impersonation, other message types and all other Orca mutations refused', () => {
  const cases = [
    send('heartbeat', 'term_other'), send('worker_done', 'term_other'), send('escalation', 'term_other'),
    send('question'), send('reply'), send('heartbeat', ''),
    ['orchestration', 'send', '--type', 'heartbeat'],
    [...send('heartbeat'), '--from', 'term_other'], [...send('heartbeat'), '--from', HANDLE],
    [...send('heartbeat'), '--type=reply'], [...send('heartbeat'), '--', '--from', 'term_other'],
    [...send('heartbeat'), '--environment', 'other'],
    ['orchestration', 'send', '--type', 'heartbeat', '--body', `--from=${HANDLE}`],
    ['orchestration', 'ask', '--from', 'term_other', '--question', 'x'],
    ['orchestration', 'ask', '--question', 'x'],
    ['orchestration', 'ask', '--from', HANDLE, `--from=${HANDLE}`, '--question', 'x'],
    ['orchestration', 'check', '--terminal', 'term_other', '--json'],
    ['orchestration', 'check', '--terminal', HANDLE, '--terminal=term_other'],
    ['orchestration', 'worker-start', '--agent', 'codex'], ['orchestration', 'run-create', '--objective', 'x'],
    ['orchestration', 'reply', '--from', HANDLE, '--id', 'message', '--body', 'x'],
    ['terminal', 'close', '--terminal', HANDLE], ['terminal', 'send', '--terminal', HANDLE, '--text', 'x'],
  ];
  for (const role of POLICY.roles.bound) for (const args of cases) {
    assert.equal(verdict(args, role)?.code, 'RIGHTS_RAW_TOOL', `${role}: ${args.join(' ')}`);
  }
  assert.equal(verdict(send('heartbeat'), 'op', null)?.code, 'RIGHTS_RAW_TOOL', 'no caller identity');
});

test('lifecycle admission comes from policy data and leaves unrelated Orca reads available', () => {
  const policy = structuredClone(POLICY);
  delete policy.orca['self-lifecycle'];
  assert.equal(verdict(send('heartbeat'), 'op', HANDLE, policy)?.code, 'RIGHTS_RAW_TOOL');
  for (const args of [['terminal', 'list'], ['orchestration', 'worker-show', '--dispatch', 'ctx_self']]) {
    assert.equal(verdict(args), null);
  }
});

test('wrongly blocked own lifecycle passes both hook and shim for op, Kernel, Supervisor seat/worker and coordinator', async (t) => {
  const cwd = mkdtemp(t, 'starci-orca-self-');
  const guards = path.join(cwd, 'guards');
  const bindings = [
    { name: 'op', role: 'op', guard: { role: 'op', workflowId: 'wf-self' } },
    { name: 'kernel', role: 'lead', guard: { role: 'kernel', workflowId: 'wf-self' } },
    { name: 'supervisor-worker', role: 'supervisor', guard: { role: 'op', workflowId: 'supervisor' } },
    { name: 'supervisor-seat', role: 'supervisor', seat: { role: 'supervisor' } },
    { name: 'coordinator', role: 'coordinator', claimed: 'coordinator' },
  ];
  for (const binding of bindings) {
    const handle = `${HANDLE}-${binding.name}`;
    for (const [family, body] of [['terminals', binding.guard], ['seats', binding.seat]]) {
      if (!body) continue;
      fs.mkdirSync(path.join(guards, family), { recursive: true });
      fs.writeFileSync(path.join(guards, family, `${handle}.json`), JSON.stringify({ ...body, terminal: handle, owned: [] }));
    }
    const env = { ...process.env, STARCI_GUARDS_ROOT: guards, ORCA_TERMINAL_HANDLE: handle, STARCI_ROLE: binding.claimed ?? '' };
    const cases = ['heartbeat', 'worker_done', 'escalation'].map((type) => ({ args: send(type, handle), code: null }));
    cases.push(
      { args: ['orchestration', 'ask', '--from', handle, '--question', 'x'], code: null },
      { args: ['orchestration', 'check', '--terminal', handle, '--json'], code: binding.name === 'kernel' ? 'KERNEL_ORCA_CHECK' : null },
      { args: ['orchestration', 'check', '--terminal', handle, '--ack', 'delivery'], code: binding.name === 'kernel' ? 'KERNEL_ORCA_CHECK' : null },
      { args: send('heartbeat', 'term_other'), code: 'RIGHTS_RAW_TOOL' },
      { args: ['orchestration', 'worker-start', '--agent', 'codex'], code: 'RIGHTS_RAW_TOOL' },
    );
    for (const row of cases) {
      const command = ['orca', ...row.args.map((word) => /\s/.test(word) ? `'${word}'` : word)].join(' ');
      const hook = await hookDecision({ tool_name: 'Bash', cwd, tool_input: { command } }, { env, root: ROOT });
      const shim = await shimDecision({ program: 'orca', args: row.args, cwd, env, root: ROOT });
      const powershell = await hookDecision({ tool_name: 'PowerShell', cwd, tool_input: { command } }, { env, root: ROOT });
      assert.equal(shim.role, binding.role);
      assert.equal(hook?.verdict?.code ?? null, row.code, `hook ${binding.name}: ${command}`);
      assert.equal(powershell?.verdict?.code ?? null, row.code, `PowerShell ${binding.name}: ${command}`);
      assert.equal(shim.verdict?.code ?? null, row.code, `shim ${binding.name}: ${command}`);
    }
    const chain = `orca orchestration send --from ${handle} --type heartbeat --subject alive; orca orchestration worker-start --agent codex`;
    const decision = await hookDecision({ tool_name: 'Bash', cwd, tool_input: { command: chain } }, { env, root: ROOT });
    assert.equal(decision?.verdict?.code, 'RIGHTS_RAW_TOOL', 'each command in a shell chain is still judged');
  }
});
