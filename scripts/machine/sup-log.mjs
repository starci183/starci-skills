// sup-log.mjs — the Supervisor's typed log rows: "the machine's root log" (owner, 2026-09-28). Every observation,
// decision, action, message and experiment of the Supervisor is one row of machine.sqlite `machine_logs`
// (engine/db/machine.mjs log), actor `supervisor`. Kinds: supervisor.action (an owed-action act: item, action, reason,
// class), decision, narration, cmd.run, check.result, warning, error. The product workflow / job / repo / commit a row
// concerns rides in `refs` (refs_json: `workflow:<id>`, `job:<id>`, `repo:<path>`, `commit:<sha>`, `item:<owed-action
// key>`, `experiment:<id>`) and in data.workflowId (data_json).
// Best effort: a log write never fails the Supervisor's own step.
import { withMachine } from '../../engine/db/machine.mjs';
import { slash } from '../lib/path-key.mjs';

const SUP_ACTOR = 'supervisor';
const LEVELS = new Set(['debug', 'info', 'warn', 'error']);

/** refs for a row: workflow/job/repo/commit/item/experiment, deduped, strings only. Pure. */
export function refsOf({ workflowId = null, jobId = null, repo = null, commits = [], item = null, experiment = null, extra = [] } = {}) {
  const out = [];
  for (const wf of String(workflowId ?? '').split(',').filter(Boolean)) out.push(`workflow:${wf}`);
  if (jobId) out.push(`job:${jobId}`);
  if (repo) out.push(`repo:${slash(repo)}`);
  for (const c of commits ?? []) if (c) out.push(`commit:${c}`);
  if (item) out.push(`item:${item}`);
  if (experiment) out.push(`experiment:${experiment}`);
  for (const e of extra ?? []) if (e) out.push(String(e));
  return [...new Set(out)];
}

/** One typed row ({kind, msg, data?, refs?, level?, at?}) as a machine_logs row of actor supervisor. Pure. */
export const machineRow = (r) => ({
  actor: SUP_ACTOR, kind: String(r.kind), msg: String(r.msg ?? '').slice(0, 4000), level: LEVELS.has(r.level) ? r.level : 'info',
  data: r.data ?? null, refs: Array.isArray(r.refs) && r.refs.length ? r.refs.map(String) : null, at: Number.isFinite(r.at) ? r.at : Date.now(),
  workflowId: r.data?.workflowId && !String(r.data.workflowId).includes(',') ? String(r.data.workflowId) : null,
});

/**
 * Append rows ({kind, msg, data?, refs?, level?, at?}) to machine_logs. Returns {ok, written} or {ok: false, error};
 * never throws. One bad row never blocks the rest.
 */
function supLogRows(rows, { env = process.env } = {}) {
  const list = (Array.isArray(rows) ? rows : [rows]).filter((r) => r?.kind);
  if (!list.length) return { ok: true, written: 0 };
  try {
    return withMachine((m) => {
      let written = 0;
      for (const r of list) { try { written += m.log(machineRow(r)); } catch { /* skipped */ } }
      return { ok: true, written };
    }, { env });
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error).slice(0, 200) };
  }
}
export const supLog = (row, options) => supLogRows([row], options);

/** The row of one owed-action act (actions.mjs recordAction, notify.mjs --item). Pure. */
export const actionRow = ({ item, action, reason, klass = null, workflowId = null, repo = null, refs = [], delivered = null, at }) => ({
  kind: 'supervisor.action', at, level: delivered === false ? 'warn' : 'info',
  msg: `${action} ${item}: ${String(reason ?? '').replace(/\s+/g, ' ').slice(0, 200)}`,
  data: { action, item, ...(reason ? { reason: String(reason) } : {}), ...(klass ? { class: klass } : {}), ...(workflowId ? { workflowId } : {}), ...(repo ? { repo } : {}), ...(delivered != null ? { delivered } : {}) },
  refs: refsOf({ workflowId, repo, item, extra: refs }),
});
