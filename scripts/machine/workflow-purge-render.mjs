// workflow-purge-render.mjs - the text of a workflow purge plan and of its apply: every ref with its tip (so the owner can recover one by sha), every
// tree, worker and terminal that goes, and everything listed and left alone.
const short = (sha) => String(sha ?? '').slice(0, 12);
const section = (title, rows, line) => (rows.length ? [`  ${title} (${rows.length}):`, ...rows.map((row) => `    ${line(row)}`)] : []);

function planBody(plan) {
  const deleted = plan.refs.filter((ref) => ref.action === 'delete'), kept = plan.refs.filter((ref) => ref.action === 'keep');
  return [
    ...section('trees to remove', plan.trees, (t) => [t.action, t.path, t.branch ? '(branch ' + t.branch + ')' : ''].filter(Boolean).join(' ')),
    ...section('refs to delete (recover one with git branch <name> <tip>)', deleted, (r) => `${r.name} ${short(r.tip)} in ${r.repoRoot} [${r.proof}]`),
    ...section('refs kept', kept, (r) => `${r.name} ${short(r.tip)} in ${r.repoRoot}: ${r.why}`),
    ...section('workers to release and close', plan.workers, (w) => `${w.dispatchId} (Run ${w.runId}, ${w.state}, liveness ${w.liveness ?? 'none'})`),
    ...section('terminals to close', plan.terminals, (t) => `${t.handle} in ${t.cwd}`),
    ...section('listed, never touched', plan.listed, (l) => `${l.kind} ${l.id}: ${l.why}`),
    ...section('files to remove', [...plan.guards, ...plan.prompts], (file) => file),
    ...section('machine Decision Items to resolve', plan.decisions, (id) => id),
  ];
}

const openRowsNote = (plan) => {
  const open = plan.ledger.openRows ?? {};
  return Object.values(open).some((n) => n > 0) ? ' (still open in it: ' + Object.entries(open).filter(([, n]) => n > 0).map(([name, n]) => name + ' ' + n).join(', ') + ')' : '';
};

const ledgerLine = (plan) => (plan.ledger.mode === 'purge'
  ? '  ledger: its rows are archived to a verified zip, then dropped (--ledger)'
  : '  ledger: kept (its rows stay as history' + openRowsNote(plan) + '; add --ledger to archive and drop them)');

/** The plan as text. */
export function renderPlan(plan) {
  const head = `workflow purge plan for ${plan.workflowId} in ${plan.repo} (plan ${short(plan.sha)})`;
  const refusals = plan.blockers.map((b) => `  REFUSED ${b.code}: ${b.detail}`);
  if (plan.already) return [head, '  already purged: the journal holds the purge and nothing of it remains'].join('\n');
  const next = plan.ok ? [`  apply: starci workflow purge --repo ${plan.repo} --workflow ${plan.workflowId} --apply${plan.ledger.mode === 'purge' ? ' --ledger' : ''} --expect ${short(plan.sha)}`] : [];
  return [head, ...refusals, ...planBody(plan), ledgerLine(plan), ...next].join('\n');
}

const tally = (name, list) => `${name} ${list.filter((item) => item.ok !== false).length}/${list.length}`;

/** The apply result as text. */
export function renderApply(plan, applied) {
  const r = applied.results;
  const head = `workflow purge ${applied.ok ? 'done' : 'INCOMPLETE'} for ${plan.workflowId}${applied.resumed ? ' (resumed)' : ''}: ${[tally('trees', r.trees), tally('refs', r.refs), tally('workers', r.workers),
    tally('terminals', r.terminals), tally('files', [...r.guards, ...r.prompts]), tally('decisions', r.decisions)].join(', ')}`;
  const ledgerText = r.ledger?.ok ? 'archived to ' + r.ledger.archive : r.ledger?.error;
  const ledger = r.ledger ? ['  ledger: ' + ledgerText] : [];
  const errors = applied.errors.map((error) => `  FAILED ${error}`);
  const event = applied.event ? [`  journal: workflow-purged event ${applied.event.seq}`] : ['  journal: not written; run the same apply again to resume'];
  return [head, ...errors, ...ledger, ...event].join('\n');
}
