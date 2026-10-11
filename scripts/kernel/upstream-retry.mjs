// upstream-retry.mjs — the retry a failed job's route placed behind the leg that cures its blocker (route-failure.mjs, route upstream-lands-first).
// The curing leg is the new input of that retry, so the retry is not a repeat of the shape that failed.

/** The route name recorded on the step of a job that runs again behind its curing leg. */
export const UPSTREAM_ROUTE = 'upstream-lands-first';

/** Whether a failed job's recorded result routed it to a retry behind its curing leg (its shape is then new work, as a partial-work continuation is). Pure. */
export const routedBehindUpstream = (result) => result?.nextStep?.kind === 'retry' && result.nextStep.route === UPSTREAM_ROUTE;
