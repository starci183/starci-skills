// sup-log.mjs — the Supervisor's typed log rows: "log gốc của machine" (owner, 2026-09-28). Every observation,
// decision, action, message and experiment of the Supervisor is one typed row (scripts/kernel/typed-logs.mjs) in the
// `logs` table of the SUPERVISOR ledger (<supervisor home>/.starciwork/runtime.sqlite, the machine-wide ledger), on its
// one workflow wf-supervisor, actor `runtime` (the schema's actor set; the ledger holds nothing but the Supervisor).
// Kinds: supervisor.action (an owed-action act: item, action, reason, class), decision, narration, cmd.run,
// check.result, warning, error. The product workflow / job / repo / commit a row concerns rides in `refs`
// (`workflow:<id>`, `job:<id>`, `repo:<path>`, `commit:<sha>`, `item:<owed-action key>`, `experiment:<id>`) and in
// data.workflowId. The ui serves them read-only at /api/supervisor/logs (ui/CONTRACT.md).
// Best effort: a log write never fails the Supervisor's own step.
import { appendLog, openLogs } from '../kernel/typed-logs.mjs';
import { SUPERVISOR_WF, openSupervisorLedger, supervisorHome } from './home.mjs';
import { slash } from '../lib/path-key.mjs';

export const SUP_ACTOR = 'runtime';

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

/**
 * Append rows ({kind, msg, data?, refs?, level?, at?}) to the supervisor ledger's logs. Returns {ok, written} or
 * {ok: false, error}; never throws.
 */
export function supLogRows(rows, { env = process.env } = {}) {
  const list = (Array.isArray(rows) ? rows : [rows]).filter(Boolean);
  if (!list.length) return { ok: true, written: 0 };
  let logs = null;
  try {
    openSupervisorLedger({ env }).close(); // the ledger, its schema (logs) and wf-supervisor exist
    logs = openLogs(supervisorHome(env));
    let written = 0;
    for (const r of list) {
      try { appendLog(logs, { workflowId: SUPERVISOR_WF, actor: SUP_ACTOR, ...r }, { clip: true }); written += 1; } catch { /* one bad row never blocks the rest */ }
    }
    return { ok: true, written };
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error).slice(0, 200) };
  } finally { try { logs?.close(); } catch { /* closed */ } }
}
export const supLog = (row, options) => supLogRows([row], options);

/** The row of one owed-action act (actions.mjs recordAction, notify.mjs --item). Pure. */
export const actionRow = ({ item, action, reason, klass = null, workflowId = null, repo = null, refs = [], delivered = null, at }) => ({
  kind: 'supervisor.action', at, level: delivered === false ? 'warn' : 'info',
  msg: `${action} ${item}: ${String(reason ?? '').replace(/\s+/g, ' ').slice(0, 200)}`,
  data: { action, item, ...(reason ? { reason: String(reason) } : {}), ...(klass ? { class: klass } : {}), ...(workflowId ? { workflowId } : {}), ...(repo ? { repo } : {}), ...(delivered != null ? { delivered } : {}) },
  refs: refsOf({ workflowId, repo, item, extra: refs }),
});
