// starci kernel rename — set the workflow's display name (workflow_id unchanged); the owner or the
// supervisor runs it, never a Kernel and never an op. One transaction sets
// workflows.display_name and appends workflow-renamed {from, to, by, at}; then, best effort,
// every live tab that shows the name is renamed through the host's terminal-rename call: the
// Kernel's `[Kernel] <name>` and each open op worker's `[Op] <op label> · <what> · <name>`.
// --no-terminals leaves the tabs to the next boot/dispatch. Split out of cli.mjs (lane
// slim-api); its help line stays in cli.mjs usage() (usageInCore).
//
//   rename --workflow <id> --title "<name>" [--by owner|supervisor] [--no-terminals] [--dry-run]
import { ARCHIVED_BY, getWorkflow, jobPayloadOf } from './shared/rows.mjs';
import { updateWorkflow } from '../../../engine/db/ledger.mjs';
import { kernelCustodyOf } from './shared/kernel-seat.mjs';
import { jobDisplayNameOf, normalizeDisplayName } from '../../lib/display-names.mjs';
import { terminalRename } from '../../api/orca/terminal-rename.mjs';

export default {
  verb: 'rename',
  required: ['workflow', 'title'],
  kernelOnly: true,
  usageInCore: true,
  usage: '  rename   --workflow <id> --title "<name>" [--by owner|supervisor] [--no-terminals] [--dry-run]   set the workflow\'s display name (workflow_id unchanged); renames its live [Kernel] and [Op] tabs',
  run({ ledger, args, repo, emit }) {
    const db = ledger.db, workflowId = args.workflow;
    const wf = getWorkflow(db, workflowId);
    if (!wf) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
    const by = args.by ?? 'owner';
    if (!ARCHIVED_BY.includes(by)) throw Object.assign(new Error(`rename --by must be ${ARCHIVED_BY.join('|')}, got '${by}'`), { code: 'rename-bad-by' });
    const name = normalizeDisplayName(args.title);
    const from = wf.display_name ?? null;
    const now = Date.now();
    const changed = from !== name;
    if (args['dry-run']) {
      const kernelTerminal = kernelCustodyOf(db, workflowId).terminal;
      const out = { ok: true, dryRun: true, workflowId, title: name, from, slug: wf.title ?? null, by, changed, kernelTerminal };
      return emit(out, `dry run: workflow ${workflowId} ${changed ? `would be renamed "${from ?? wf.title ?? workflowId}" -> "${name}"` : `is already named "${name}"`} (by ${by}); kernel tab ${kernelTerminal ?? '-'}; nothing written`, args.json);
    }
    if (changed) {
      ledger.transaction(() => {
        updateWorkflow(db, { workflowId, displayName: name, at: now });
        ledger.appendEvent({ workflowId, entityType: 'workflow', entityId: workflowId, kind: 'workflow-renamed',
          payload: { from, to: name, slug: wf.title ?? null, by, at: now } });
      });
    }
    const terminals = [];
    if (!args['no-terminals'] && wf.phase !== 'finished' && wf.archived_at == null) {
      const apply = (terminal, title, extra) => {
        let r;
        try { r = terminalRename({ terminal, title }); } catch (e) { r = { ok: false, error: String(e?.message ?? e) }; }
        terminals.push({ terminal, title, ok: r?.ok === true, ...extra, ...(r?.ok ? {} : { error: String(r?.error?.message ?? r?.error ?? 'terminal-rename failed').slice(0, 200) }) });
      };
      const kernelTerminal = kernelCustodyOf(db, workflowId).terminal;
      if (kernelTerminal) apply(kernelTerminal, `[Kernel] ${name}`, { role: 'kernel' });
      const cache = new Map();
      const open = db.prepare("SELECT * FROM jobs WHERE workflow_id=? AND kind<>'kernel' AND status IN ('running','answering') ORDER BY created_at,job_id").all(workflowId);
      for (const job of open) {
        const payload = jobPayloadOf(job);
        const handle = payload.managed?.assignee ?? payload.orca?.agentTerminalHandle ?? payload.managed?.agentTerminalHandle ?? job.worker_id ?? payload.hierarchy?.runtime?.terminalHandle ?? null;
        if (!handle || handle === kernelTerminal) continue;
        apply(handle, `[Op] ${jobDisplayNameOf(db, job, { repo, workflowName: name, cache })}`, { role: 'op', jobId: job.job_id });
      }
    }
    const out = { ok: true, workflowId, title: name, from, slug: wf.title ?? null, by, changed, terminals };
    emit(out, `workflow ${workflowId} ${changed ? `renamed "${from ?? wf.title ?? workflowId}" -> "${name}"` : `already named "${name}"`} (by ${by}); tabs renamed ${terminals.filter((t) => t.ok).length}/${terminals.length}${terminals.some((t) => !t.ok) ? ` — failed: ${terminals.filter((t) => !t.ok).map((t) => `${t.terminal} (${t.error})`).join('; ')}` : ''}`, args.json);
  },
};
