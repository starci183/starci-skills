// debug-roles.mjs — the per-role table of the digest: the Supervisor, each Kernel, each Op attempt, the Critic runs and the Runtime,
// every row a verdict of `none` (no error), `happy` (stops the design handles, counted) or `bug` (a role did not do what its contract
// says: the broken duty, the evidence and the state of the remedy). A role the stores cannot be read for is `unobserved` with the
// signal it needs. Pure over the findings of debug-verdicts.mjs.

const departureOf = (p) => (p.code === 'departure' ? p.params.departure : p.code);
const bugOf = (p) => ({ code: departureOf(p), duty: p.duty, key: p.key, workflowId: p.workflowId ?? null, remedy: p.remedy, blocks: p.blocks });

const tally = (list) => {
  const counts = new Map();
  for (const h of list) counts.set(h.kind, (counts.get(h.kind) ?? 0) + 1);
  return [...counts].map(([kind, count]) => ({ kind, count }));
};

function verdictOf(bugs, happy) {
  if (bugs.length) return 'bug';
  return happy.length ? 'happy' : 'none';
}

function row(role, subject, bugs, happy, extra = {}) {
  const verdict = verdictOf(bugs, happy);
  return { role, subject, verdict, bugs: bugs.map(bugOf), happy: tally(happy), ...extra };
}

/** The latest attempt of a job in a workflow's attempts, or null. */
const attemptOfJob = (attempts, jobId) => attempts.filter((a) => a.jobId === jobId).pop() ?? null;

function opRows(view, bugs, happy) {
  const mine = bugs.filter((b) => b.role === 'op' && b.workflowId === view.id);
  const attached = (a) => mine.filter((b) => (b.evidence?.attemptId ?? attemptOfJob(view.source.attempts, b.evidence?.jobId)?.attemptId) === a.attemptId);
  return view.source.attempts.map((a) => row('op', `${view.name} / ${a.op} try ${a.tryNo} (attempt ${a.attemptId})`, attached(a),
    happy.filter((h) => h.role === 'op' && h.workflowId === view.id && h.attemptId === a.attemptId), { workflowId: view.id, attemptId: a.attemptId, op: a.op }));
}

/** [{role, subject, verdict, bugs, happy}] for one digest. */
export function roleRows({ bugs, happy, views, supervisorName = 'Supervisor' }) {
  const supervisor = row('supervisor', supervisorName, bugs.filter((b) => b.role === 'supervisor'), happy.filter((h) => h.role === 'supervisor'));
  const perWorkflow = views.flatMap((view) => [
    row('kernel', `Kernel of ${view.name}`, bugs.filter((b) => b.role === 'kernel' && b.workflowId === view.id), happy.filter((h) => h.role === 'kernel' && h.workflowId === view.id), { workflowId: view.id }),
    ...opRows(view, bugs, happy)]);
  const critic = { role: 'critic', subject: 'Critic runs', verdict: 'unobserved', bugs: [], happy: [], signal: 'critic-run event on the attempt it judged' };
  return [supervisor, ...perWorkflow, critic, row('runtime', 'Runtime', bugs.filter((b) => b.role === 'runtime'), happy.filter((h) => h.role === 'runtime'))];
}
