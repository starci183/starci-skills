// sonar-quality-gate.mjs - the verdict of the release gate's sonar row after the scanner exits 0. The scanner's exit code says only
// that the report was uploaded; the server computes the analysis afterwards. This reads the task the scanner wrote
// (`.scannerwork/report-task.txt`), polls `api/ce/task` until the compute-engine task ends, then reads the quality gate of that
// analysis from `api/qualitygates/project_status` with the same token. OK passes; ERROR is red and names every failed condition;
// a task that ends FAILED or CANCELED, an unreadable answer and a deadline passed are typed refusals in the row's detail.
import fs from 'node:fs';
import path from 'node:path';

const SONAR_GATE_FAILED = 'RELEASE_SONAR_GATE_FAILED';
const SONAR_GATE_TIMEOUT = 'RELEASE_SONAR_GATE_TIMEOUT';
const SONAR_GATE_UNREADABLE = 'RELEASE_SONAR_GATE_UNREADABLE';
const REPORT_TASK = path.join('.scannerwork', 'report-task.txt');
const DONE = new Set(['SUCCESS', 'FAILED', 'CANCELED']);
/** The bound of one compute-engine wait and the pause between polls (milliseconds). */
const QUALITY_GATE_WAIT = Object.freeze({ deadline: 600_000, interval: 5_000 });

/** The `key=value` lines of the scanner's report-task.txt under `cwd`, or null when the scanner wrote none. */
function reportTask(cwd) {
  let text;
  try { text = fs.readFileSync(path.join(cwd, REPORT_TASK), 'utf8'); } catch { return null; }
  return Object.fromEntries(text.split(/\r?\n/u).map((line) => line.split('=')).filter(([key, ...rest]) => key && rest.length).map(([key, ...rest]) => [key.trim(), rest.join('=').trim()]));
}

/** One authenticated JSON GET; a failed request or a non-JSON body throws. */
async function getJson(ctx, url, token) {
  const response = await ctx.fetch(url, { headers: { Authorization: `Basic ${Buffer.from(`${token}:`).toString('base64')}` }, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url.split('?')[0]}`);
  return response.json();
}

/** The failed conditions of a quality gate answer, as `metric comparator threshold (actual value)` lines. */
const failedConditions = (status) => (status?.conditions ?? []).filter((condition) => condition.status === 'ERROR')
  .map((condition) => `${condition.metricKey} ${condition.comparator ?? ''} ${condition.errorThreshold ?? ''} (actual ${condition.actualValue ?? '?'})`.replace(/\s+/gu, ' '));

/**
 * The quality-gate verdict of the analysis the scanner just uploaded from `cwd`: `{ pass, detail, conditions? }`. `token` is the
 * scanner's token, `host` the declared server. `ctx.fetch`, `ctx.now` and `ctx.sleep` are the seams; `wait` bounds the poll.
 */
export async function sonarQualityGate(ctx, { cwd, host, token, wait = QUALITY_GATE_WAIT }) {
  const task = reportTask(cwd);
  if (!task?.ceTaskId) return { pass: false, detail: `${SONAR_GATE_UNREADABLE}: the scanner wrote no ${REPORT_TASK.replaceAll('\\', '/')} with a ceTaskId` };
  const server = String(task.serverUrl || host).replace(/\/$/u, '');
  const sleep = ctx.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const deadline = ctx.now() + wait.deadline;
  let analysisId = null;
  try {
    for (;;) {
      const state = (await getJson(ctx, `${server}/api/ce/task?id=${encodeURIComponent(task.ceTaskId)}`, token))?.task;
      if (DONE.has(state?.status)) {
        if (state.status !== 'SUCCESS') return { pass: false, detail: `${SONAR_GATE_FAILED}: compute-engine task ${task.ceTaskId} ended ${state.status}${state.errorMessage ? `: ${state.errorMessage}` : ''}` };
        analysisId = state.analysisId;
        break;
      }
      if (ctx.now() >= deadline) return { pass: false, detail: `${SONAR_GATE_TIMEOUT}: compute-engine task ${task.ceTaskId} is still ${state?.status ?? 'unknown'} after ${Math.round(wait.deadline / 1000)}s` };
      await sleep(wait.interval);
    }
    const query = analysisId ? `analysisId=${encodeURIComponent(analysisId)}` : `projectKey=${encodeURIComponent(task.projectKey ?? '')}`;
    const status = (await getJson(ctx, `${server}/api/qualitygates/project_status?${query}`, token))?.projectStatus;
    if (status?.status === 'OK') return { pass: true, detail: 'exit 0, quality gate OK' };
    if (status?.status === 'ERROR') {
      const conditions = failedConditions(status);
      return { pass: false, detail: `${SONAR_GATE_FAILED}: quality gate ERROR (${conditions.join('; ') || 'no condition listed'})${task.dashboardUrl ? ` ${task.dashboardUrl}` : ''}`, conditions };
    }
    return { pass: false, detail: `${SONAR_GATE_UNREADABLE}: quality gate status ${status?.status ?? 'missing'}` };
  } catch (error) {
    return { pass: false, detail: `${SONAR_GATE_UNREADABLE}: ${String(error?.message ?? error)}` };
  }
}
