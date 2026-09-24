// introducer.mjs — which workflow introduced the code behind a shared blocker.
//
// A blocker that stops several workflows at once — the served-app boot failing
// on ModuleRecoveryClientService's DI (nivo WSPV inc-be78a39b6b50, Modules
// inc-b6f66a0d29ce) — was raised by each victim and owned by nobody: each
// said "not ours" and waited for the owner to assign one. The rule
// (modules/kernel/api.yaml commands.incident sharedBlocker): a Kernel raising
// `--kind shared-blocker --introduced-by <commit>` gets the blocker routed, as
// a typed `follow-up` peer message, to the workflow whose code introduced it;
// that workflow fixes it like its own defect. Ledger and git reads only.
//
// resolveIntroducer order — the first that answers wins:
//  1. --introducer <workflow>        the reporting Kernel (or supervisor) names it
//  2. report head                    an op report of the ledger filed that commit as its head
//  3. workflow id in the message     the commit message names a workflow of the ledger
//  4. cut id in the message          "(cut <id> n/m)" names a cut one workflow's jobs carry
//  5. conventional-commit scope      "type(scope):" matches the title of exactly one workflow line
// A resolved workflow that is no longer running hands the follow-up to the
// running workflow with the same title (its successor run).
import { spawnSync } from 'node:child_process';

const git = (cwd, args) => {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true, timeout: 20_000 });
  return r.status === 0 ? r.stdout : null;
};
const tokens = (text) => String(text ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
const LIVE = (wf) => wf && wf.phase !== 'finished' && !wf.archived_at;

/** The commit as git knows it in one of `roots`: {sha, subject, message, root} or null. */
export function commitInfo(roots, ref) {
  for (const root of roots) {
    const out = git(root, ['show', '-s', '--format=%H%x00%s%x00%B', `${ref}^{commit}`]);
    if (!out) continue;
    const [sha, subject, message] = out.split('\0');
    return { sha: sha.trim(), subject: subject.trim(), message: message.trim(), root };
  }
  return null;
}

const successorOf = (workflows, wf) => {
  if (LIVE(wf)) return wf;
  const same = workflows.filter((w) => LIVE(w) && w.title && w.title === wf.title);
  return same.length === 1 ? same[0] : null;
};

/**
 * resolveIntroducer(db, {commits, roots, explicit}) ->
 *   {workflowId, via, commit, introducedBy, successorOf?} | {unresolved: true, why, commit}
 */
export function resolveIntroducer(db, { commits = [], roots = [], explicit = null }) {
  const workflows = db.prepare('SELECT workflow_id,title,phase,archived_at FROM workflows').all();
  const byId = new Map(workflows.map((w) => [w.workflow_id, w]));
  const answer = (wf, via, commit) => {
    const live = successorOf(workflows, wf);
    if (!live) return { unresolved: true, why: `introduced by ${wf.workflow_id} (${via}), which has no running successor`, commit, introducedBy: wf.workflow_id };
    return { workflowId: live.workflow_id, via, commit, introducedBy: wf.workflow_id, ...(live.workflow_id !== wf.workflow_id ? { successorOf: wf.workflow_id } : {}) };
  };
  if (explicit) {
    const wf = byId.get(explicit);
    if (!wf) return { unresolved: true, why: `--introducer ${explicit} is not a workflow of this ledger`, commit: null };
    return answer(wf, 'explicit', null);
  }
  for (const ref of commits) {
    const info = commitInfo(roots, ref);
    const sha = info?.sha ?? String(ref);
    const short = sha.slice(0, 7);
    const reported = db.prepare(`SELECT r.workflow_id, json_extract(r.report_json,'$.head') AS head FROM reports r
      WHERE json_extract(r.report_json,'$.head') IS NOT NULL ORDER BY r.created_at DESC`).all()
      .find((row) => { const h = String(row.head).trim().toLowerCase(); return h.length >= 7 && (sha.toLowerCase().startsWith(h) || h.startsWith(sha.toLowerCase())); });
    if (reported && byId.has(reported.workflow_id)) return answer(byId.get(reported.workflow_id), 'report-head', sha);
    if (!info) continue;
    const named = workflows.filter((w) => info.message.includes(w.workflow_id));
    if (named.length === 1) return answer(named[0], 'commit-message-workflow', sha);
    const cut = /\bcut\s+([A-Za-z0-9._-]+)\s+\d+\s*\/\s*\d+/i.exec(info.message)?.[1] ?? null;
    if (cut) {
      const owners = [...new Set(db.prepare("SELECT workflow_id FROM jobs WHERE json_extract(payload_json,'$.cut.id')=?").all(cut).map((r) => r.workflow_id))];
      if (owners.length === 1 && byId.has(owners[0])) return answer(byId.get(owners[0]), 'commit-message-cut', sha);
    }
    const scope = /^[a-z]+\(([^)]+)\)!?:/i.exec(info.subject)?.[1] ?? null;
    if (scope) {
      const want = tokens(scope);
      const lines = new Map();
      for (const w of workflows) {
        const have = new Set([...tokens(w.title), ...tokens(w.workflow_id)]);
        if (want.length && want.every((t) => have.has(t))) lines.set(w.title ?? w.workflow_id, [...(lines.get(w.title ?? w.workflow_id) ?? []), w]);
      }
      if (lines.size === 1) {
        const [candidates] = [...lines.values()];
        const wf = candidates.find(LIVE) ?? candidates.at(-1);
        return answer(wf, 'commit-scope', sha);
      }
    }
    return { unresolved: true, why: `no workflow of this ledger is tied to ${short} (no report head, workflow id, cut or unique scope in its message)`, commit: sha };
  }
  return { unresolved: true, why: 'no --introduced-by commit resolves in the workflow source roots', commit: null };
}

/** The typed follow-up message a shared blocker becomes for its introducing workflow. */
export function followUpMessage({ incidentId, reporter, detail, commit, via, fix = null }) {
  const subject = `shared blocker ${incidentId}: fix the code your workflow introduced`;
  const body = [
    `${reporter} is blocked by code this workflow introduced${commit ? ` (commit ${commit.slice(0, 12)}, resolved via ${via})` : ` (named via ${via})`}.`,
    `Blocker: ${detail}`,
    ...(fix ? [`Fix: ${fix}`] : []),
    'Treat it as your own defect: enqueue the repair on the owning code, land it, then notify the reporter so it resolves its incident (api notify --kind reply).',
  ].join('\n');
  return { subject, body };
}
