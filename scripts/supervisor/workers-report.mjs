// Report validation and ledger recording for one Supervisor worker job.
export function resolveReportCommit(job, outcome, commit, root, git) {
  if (outcome !== 'done') return { sha: null };
  if (!commit) return { error: 'a done report names --commit <sha>' };
  const resolved = git(['rev-parse', '--verify', '--quiet', `${commit}^{commit}`], { cwd: root });
  if (!resolved.ok) return { error: `commit ${commit} does not exist` };
  const sha = resolved.stdout;
  const branch = job.payload.staging?.branch;
  if (branch && !git(['merge-base', '--is-ancestor', sha, branch], { cwd: root }).ok) return { error: `commit ${sha.slice(0, 9)} is not on ${branch}` };
  if (job.payload.staging?.base && sha === job.payload.staging.base) return { error: 'the commit is the base: nothing was committed' };
  return { sha };
}

export function recordWorkerReport(m, job, jobId, outcome, report, sha, summary, needs, now, { attemptIdOf, releaseLeases, setJob, supervisorEvent }) {
  m.transaction(() => {
    const attemptId = attemptIdOf(m, jobId);
    m.recordSupReport({ attemptId, jobId, outcome, report });
    m.updateSupAttempt(attemptId, { reportedAt: now, reportOutcome: outcome, ...(sha ? { headSha: sha } : {}) });
    let status = 'failed'; if (outcome === 'done') status = 'reported'; else if (outcome === 'diagnosed') status = 'succeeded';
    if (outcome !== 'done') releaseLeases(m, jobId);
    setJob(m, jobId, { status, payload: outcome === 'done' ? undefined : { ...job.payload, result: { reason: `worker-${outcome}`, summary, needs } } });
    supervisorEvent(m, { entityType: 'job', entityId: jobId, kind: 'worker-reported', payload: { outcome, commit: sha, specs: report.specs, needs }, now });
  });
}
