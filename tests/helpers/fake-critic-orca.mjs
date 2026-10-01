// fake-critic-orca.mjs — a fake Orca client for the draw-loop critic worker (scripts/work/draw-critic.mjs runCritic
// `orca`): every wrapper the critic launch and supervision call, recorded, nothing reaching a host. Each worker-start is
// one critic worker (dispatch ctx_critic_<n>, terminal term_critic_<n>) whose behaviour is `mode`:
//   judge            writes `verdict` (an object, or a function of the start args) to <clean dir>/verdict.json and
//                    sends worker_done
//   done-no-verdict  sends worker_done and writes nothing
//   escalate         sends an escalation and writes nothing
//   ended            writes nothing; worker-show reports the worker failed after its attestation
//   silent           never answers (the critic's timeout)
//   launch-failed    worker-start refuses before any effect
import fs from 'node:fs';
import path from 'node:path';

export function fakeCriticOrca({ verdict = null, mode = 'judge', onStart = null } = {}) {
  const calls = [];
  const messages = [];
  const workers = new Map();
  let n = 0;
  const rec = (name, fn) => (args = {}) => { calls.push([name, args]); return fn(args); };
  const client = {
    calls,
    names: () => calls.map((c) => c[0]),
    runShow: rec('run-show', () => ({ ok: false })),
    runCreate: rec('run-create', () => ({ ok: true, runId: 'run_critic' })),
    taskCreate: rec('task-create', () => ({ ok: true, taskId: `task_critic_${n + 1}` })),
    trust: rec('trust', () => ({ status: 'ok', paths: [] })),
    workerStart: rec('worker-start', (a) => {
      if (mode === 'launch-failed') return { ok: false, outcome: 'failed', effectState: 'none', dispatchId: null, errorCode: 'agent_unavailable', error: 'worker_start_failed' };
      n += 1;
      const dispatchId = `ctx_critic_${n}`;
      const terminal = `term_critic_${n}`;
      workers.set(dispatchId, { agent: a.agent, model: a.model ?? null, shows: 0 });
      onStart?.(a);
      if (mode === 'judge') fs.writeFileSync(path.join(a.worktree, 'verdict.json'), JSON.stringify(typeof verdict === 'function' ? verdict(a) : verdict));
      if (mode === 'judge' || mode === 'done-no-verdict') messages.unshift({ id: `m_done_${n}`, type: 'worker_done', from_handle: terminal, payload: JSON.stringify({ dispatchId }) });
      if (mode === 'escalate') messages.unshift({ id: `m_esc_${n}`, type: 'escalation', from_handle: terminal, subject: 'Escalation', body: 'the images cannot be opened' });
      return { ok: true, outcome: 'ok', effectState: 'committed', dispatchId, state: 'ready' };
    }),
    dispatchShow: rec('dispatch-show', () => ({ ok: true, assigneeHandle: `term_critic_${n}` })),
    terminalRename: rec('terminal-rename', () => ({ ok: true })),
    workerShow: rec('worker-show', ({ dispatch }) => {
      const w = workers.get(dispatch);
      if (!w) return { ok: false, state: null };
      w.shows += 1;
      // The first read is spawnAgent's attestation; an `ended` worker fails after it.
      const state = mode === 'ended' && w.shows > 1 ? 'failed' : 'ready';
      return { ok: true, state, effective: { agent: w.agent, model: w.model } };
    }),
    workerStop: rec('worker-stop', () => ({ ok: true })),
    workerRelease: rec('worker-release', () => ({ ok: true })),
    inbox: rec('inbox', () => ({ ok: true, messages: [...messages] })),
    taskUpdate: rec('task-update', ({ id, status }) => ({ ok: true, taskId: id, status })),
  };
  return client;
}

/** A verdict that passes every check of `rubric` with `beauty`. */
export const passingVerdict = (rubric, beauty) => ({ schema: 'starci/draw-critique@1', checks: rubric.checks.map((c) => ({ id: c.id, pass: true, evidence: 'ok' })), beauty, anchor: String(beauty) });
