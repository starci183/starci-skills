// api product-land — land a workflow branch (wf/<wf>) into a product repository's main through the serial per-repo
// product-land (scripts/kernel/product-land.mjs, DESIGN §16.7). The Kernel decides WHEN (per wave, or when a leg
// completes); a conflict with another workflow's land is refused with files + hunks and is the Supervisor's to order.
//
//   product-land --workflow <wf> [--repository <role|path>] [--dry-run] [--push] [--json]   land (dry-run: preflight only)
//   product-land --workflow <wf> --abandon --reason <text> [--repository <r>]              record the branch abandoned
//                                                                                           (its worktree then goes)
//   product-land --workflow <wf> --show [--json]                                            the workflow's branches
import path from 'node:path';
import fs from 'node:fs';
import { projectBinding, bindingRepo } from '../target-repo.mjs';
import { productLand, landPreflight, EVENTS } from '../product-land.mjs';
import { isolatedJobs, layoutOf, workflowLanded, git } from '../product-worktree.mjs';

const refuse = (message, code) => Object.assign(new Error(message), { code });

/** The product repositories a workflow's isolated jobs used, or the one --repository names. */
export function workflowRepos(db, { workflowId, repository = null, repo }) {
  if (repository) {
    const bound = bindingRepo(projectBinding(repo), String(repository));
    const root = bound?.appRoot ?? (path.isAbsolute(String(repository)) ? path.resolve(String(repository)) : null);
    if (!root || !fs.existsSync(path.join(root, '.git'))) throw refuse(`--repository ${repository} names no bound product checkout`, 'repository-unknown');
    return [root];
  }
  return [...new Set(isolatedJobs(db, { workflowId }).map((j) => j.record.repoRoot))];
}

export default {
  verb: 'product-land',
  required: ['workflow'],
  kernelOnly: true,
  flags: ['dry-run', 'push', 'abandon', 'show'],
  usage: '  product-land --workflow <id> [--repository <role|path>] [--dry-run] [--push] | --abandon --reason <t> | --show   land wf/<wf> into the product main (serial per repo, preflight first)',
  run({ ledger, args, repo, emit }) {
    const db = ledger.db, workflowId = String(args.workflow);
    const repos = workflowRepos(db, { workflowId, repository: args.repository ?? null, repo });
    if (!repos.length) return emit({ ok: true, workflowId, repos: [], note: 'no product worktree was ever made for this workflow' }, `product-land ${workflowId}: no product worktree/branch`, args.json);
    const ev = (kind, payload) => ledger.transaction(() => ledger.appendEvent({ workflowId, entityType: 'workflow', entityId: workflowId, kind, payload }));
    if (args.show) {
      const rows = repos.map((repoRoot) => {
        const lay = layoutOf({ repoRoot, workflowId });
        const ahead = git(repoRoot, ['rev-list', '--count', `main..${lay.workflow.branch}`]).stdout;
        const behind = git(repoRoot, ['rev-list', '--count', `${lay.workflow.branch}..main`]).stdout;
        return { repoRoot, branch: lay.workflow.branch, path: lay.workflow.path, exists: fs.existsSync(lay.workflow.path),
          ahead: Number(ahead) || 0, behind: Number(behind) || 0, landed: workflowLanded(repoRoot, lay.workflow.branch), preflight: landPreflight({ repoRoot, branch: lay.workflow.branch }) };
      });
      return emit({ ok: true, workflowId, repos: rows }, rows.map((r) => `${r.branch} @ ${r.repoRoot}: +${r.ahead}/-${r.behind} ${r.landed.landed ? 'landed' : 'unlanded'}${r.preflight.ok ? '' : ` CONFLICT ${(r.preflight.conflicts ?? []).map((c) => c.file).join(', ')}`}`).join('\n'), args.json);
    }
    if (args.abandon) {
      if (!args.reason) throw refuse('--abandon needs --reason <text>', 'reason-required');
      for (const repoRoot of repos) ev('workflow-branch-abandoned', { repoRoot, branch: layoutOf({ repoRoot, workflowId }).workflow.branch, reason: String(args.reason) });
      return emit({ ok: true, workflowId, abandoned: repos }, `product-land ${workflowId}: branch recorded abandoned in ${repos.length} repo(s); its worktree goes once the workflow finishes`, args.json);
    }
    const results = repos.map((repoRoot) => ({ repoRoot, ...productLand({ repoRoot, workflowId, dryRun: Boolean(args['dry-run']), push: args.push ? true : null, onEvent: ev }) }));
    const ok = results.every((r) => r.ok);
    const line = (r) => (r.ok ? `${r.branch ?? ''} @ ${path.basename(r.repoRoot)}: ${r.already ? `already landed (${r.why})` : r.dryRun ? 'preflight clean' : `LANDED main -> ${String(r.landed).slice(0, 9)} (${r.changed?.length ?? 0} files)`}`
      : `${path.basename(r.repoRoot)}: REFUSED ${r.reason}${r.conflicts?.length ? ` - ${r.conflicts.map((c) => c.file).join(', ')}` : ''}${r.dirty?.length ? ` dirty: ${r.dirty.slice(0, 5).join(', ')}` : ''}${r.hint ? `; next: ${r.hint}` : ''}`);
    emit({ ok, workflowId, results, events: EVENTS }, results.map(line).join('\n'), args.json);
    if (!ok) process.exitCode = 1;
  },
};
