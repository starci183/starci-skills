import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Offline evaluation: observations come from saved agent runs, never estimated token counts.
const metrics = ['inputTokens', 'outputTokens', 'cachedInputTokens', 'elapsedMs', 'interventions', 'harnessRetries', 'regressions'];
const outcomes = ['delivered', 'correct-refusal', 'incorrect-refusal', 'failed', 'unknown'];
function requireThat(condition, message) { if (!condition) throw new Error(message); }
export function summarizeBenchmark(data) {
  requireThat(data.version === 1 && ['agent-trials', 'fixture-tests'].includes(data.kind), 'expected version 1 and explicit evidence kind');
  requireThat(Array.isArray(data.runs), 'runs must be an array');
  const ids = new Set();
  for (const run of data.runs) {
    requireThat(typeof run.id === 'string' && run.id && !ids.has(run.id), 'run ids must be nonempty and unique'); ids.add(run.id);
    requireThat(['full', 'lite'].includes(run.profile), `${run.id}: invalid profile`);
    for (const key of ['task', 'repeat', 'model', 'reasoning', 'environment', 'baselineSha256', 'promptSha256', 'skillRevision']) requireThat(typeof run[key] === 'string' && run[key].length > 0, `${run.id}: missing ${key}`);
    requireThat(outcomes.includes(run.outcome), `${run.id}: invalid outcome`);
    requireThat(Array.isArray(run.evidence) && run.evidence.every(ref => typeof ref === 'string' && ref.length), `${run.id}: evidence must be an array of references`);
    for (const key of metrics) requireThat(run[key] === null || (Number.isSafeInteger(run[key]) && run[key] >= 0), `${run.id}: ${key} must be a nonnegative integer or null`);
    requireThat(run.outcome === 'unknown' || run.evidence.length > 0, `${run.id}: judged outcome requires evidence`);
    requireThat(run.outcome !== 'delivered' || run.regressions === 0, `${run.id}: delivery requires verified zero regressions`);
  }
  const profiles = Object.fromEntries(['full', 'lite'].map(profile => {
    const runs = data.runs.filter(run => run.profile === profile);
    return [profile, {
      runs: runs.length,
      outcomes: Object.fromEntries(outcomes.map(outcome => [outcome, runs.filter(run => run.outcome === outcome).length])),
      metrics: Object.fromEntries(metrics.map(key => {
        const known = runs.filter(run => run[key] !== null).map(run => run[key]);
        return [key, { known: known.length, unknown: runs.length - known.length, mean: known.length ? known.reduce((a, b) => a + b, 0) / known.length : null }];
      }))
    }];
  }));
  const groups = new Map();
  for (const run of data.runs) {
    const key = JSON.stringify(['task', 'repeat', 'model', 'reasoning', 'environment', 'baselineSha256', 'promptSha256', 'skillRevision'].map(field => run[field]));
    const group = groups.get(key) ?? {};
    requireThat(!group[run.profile], `${run.id}: duplicate profile in matched trial`);
    group[run.profile] = run; groups.set(key, group);
  }
  const pairs = [...groups.values()].filter(group => group.full && group.lite).map(({ full, lite }) => ({
    full: full.id, lite: lite.id, task: full.task,
    outcomes: { full: full.outcome, lite: lite.outcome },
    // Efficiency comparisons are meaningful only when both delivered the requested product.
    deliveryComparable: full.outcome === 'delivered' && lite.outcome === 'delivered',
    liteMinusFull: Object.fromEntries(metrics.map(key => [key, full.outcome === 'delivered' && lite.outcome === 'delivered' && full[key] !== null && lite[key] !== null ? lite[key] - full[key] : null]))
  }));
  return { version: 1, kind: data.kind, performanceEvidence: data.kind === 'agent-trials' && pairs.some(pair => pair.deliveryComparable), profiles, pairs, unmatchedRuns: data.runs.length - pairs.length * 2 };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    requireThat(process.argv.length === 3, 'usage: node scripts/benchmark-profiles.mjs <observations.json>');
    console.log(JSON.stringify(summarizeBenchmark(JSON.parse(readFileSync(process.argv[2], 'utf8'))), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
