export const queuedDependencyDetail = ({ priorId, prior, seam, seamHold, payload, recordDeps, jobId, dead }) => {
  let detail;
  if (priorId === seam) {
    detail = seamHold?.hold ? seamHold.detail : `cut ${payload.cut.id} seam ${prior.job_id} is ${prior.status}; the other ordinals wait for it`;
  } else if ((recordDeps.get(jobId) ?? []).includes(priorId)) {
    detail = `a Work record this job owns dependsOn a record owned by ${prior.job_id}, which is ${prior.status}`;
  } else {
    detail = `declared --after job ${prior.job_id} is ${prior.status}`;
  }
  if (prior.job_id !== priorId) detail += ` (the retry lineage of ${priorId})`;
  if (dead) detail += '; it will not succeed on its own, so the Kernel retries it, re-points this job, or drops it';
  return detail;
};
