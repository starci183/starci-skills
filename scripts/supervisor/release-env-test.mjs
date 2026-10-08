#!/usr/bin/env node
// release-env-test.mjs - `starci release env-test` (npm run test:release-env): the runtime spec suite under the exact conditions of the release cut's L4 row (release-l4.mjs), so a red the cut would find shows
// in everyday verification first. What differs between a plain `npm test` and the cut's run is what this script carries over, never copies by hand:
//   env       the app-install and live-Orca requirements and the example installs (specEnv), so a scaffold spec or a live Orca spec fails instead of skipping
//   installs  a real `npm ci` in every example app, then the build of packages/test-world, before the suite
//   budget    the host concurrency decision and the direct node --test command of package.json scripts.test (runtimeSpecStep)
//   host      the same prerequisites the cut refuses on (release-host.mjs): an Orca terminal, a reachable Orca, a Docker daemon
//   verdict   the failing tests, and every skip judged by the cut's evidence rule (the Linux leg is not run here: a skip another leg covers shows as `infrastructure`)
// Flags: --lane  a lane clone is no Orca terminal: the live-Orca requirement and the host check are left out, everything else is the cut's (use it to see the rest of the cut's red).
//        --reuse-installs  keep an example app whose node_modules exists (the cut always installs afresh).
// Exit 0 = the suite is green and no skip fails the evidence rule; 1 = red; 2 = the host is not ready or bad usage. Logs are printed by path.
import fs from 'node:fs';
import path from 'node:path';
import { isMain } from '../lib/is-main.mjs';
import { planL4, runL4, skipReport } from './release-l4.mjs';
import { releaseHostMissing, releaseHostWhy } from './release-host.mjs';
import { SKILL_ROOT } from '../machine/home.mjs';

const USAGE = 'usage: starci release env-test [--lane] [--reuse-installs]';
const FLAGS = new Set(['--lane', '--reuse-installs']);
const isInstall = (step) => step.install === true || (step.absent === true && step.name.endsWith(': npm ci'));

/** The steps of the cut's spec leg: the example installs, the test-world build and the runtime suite. Pure over the L4 plan. */
export function releaseEnvPlan(repo, { lane = false, reuseInstalls = false, runtimeRoot = repo } = {}) {
  const full = planL4(repo, { runtimeRoot });
  const keep = full.steps.filter((step) => isInstall(step) || step.name === 'test-world: npm run build' || step.name === 'npm test');
  const steps = keep.filter((step) => !(reuseInstalls && step.install && fs.existsSync(path.join(step.cwd, 'node_modules'))));
  const laneEnv = (env) => Object.fromEntries(Object.entries(env).filter(([key]) => !key.includes('ORCA')));
  return { steps: steps.map((step) => (lane && step.env ? { ...step, env: laneEnv(step.env) } : step)), proofs: [], linux: false };
}

/** Run the cut's spec leg for `repo`: {ok, host, steps, failed, skips}. `deps` replaces the host check and the step runner in specs. */
export async function releaseEnvTest({ repo = SKILL_ROOT, lane = false, reuseInstalls = false, deps = {} } = {}) {
  const missing = lane ? [] : (deps.host ?? releaseHostMissing)({});
  if (missing.length) return { ok: false, refused: true, why: releaseHostWhy(missing), steps: [], failed: [], skips: [] };
  const plan = releaseEnvPlan(repo, { lane, reuseInstalls });
  const steps = await runL4(repo, { plan, proofs: {}, parity: null, ...(deps.step ? { step: deps.step } : {}) });
  const failed = steps.filter((step) => !step.ok).map((step) => ({ name: step.name, log: step.log, absent: step.absent === true }));
  const report = skipReport(steps);
  const skips = lane ? [] : report.failures;
  return { ok: !failed.length && !skips.length, refused: false, steps: steps.map((step) => ({ name: step.name, ok: step.ok, log: step.log, ms: step.ms })), failed, skips, declared: report.declared, covered: report.covered };
}

/** CLI: prints the verdict, returns the exit code. */
export async function main(argv = process.argv.slice(2), write = (text) => process.stdout.write(text)) {
  const bad = argv.filter((arg) => !FLAGS.has(arg));
  if (bad.length) { write(`release env-test: unknown argument ${bad[0]}\n${USAGE}\n`); return 2; }
  const result = await releaseEnvTest({ lane: argv.includes('--lane'), reuseInstalls: argv.includes('--reuse-installs') });
  if (result.refused) { write(`release env-test: ${result.why}\n`); return 2; }
  for (const step of result.steps) write(`${step.ok ? 'ok  ' : 'RED '} ${step.name} (${Math.round(step.ms / 1000)}s) ${step.log ?? ''}\n`);
  for (const skip of result.skips) write(`SKIP fails the evidence rule: ${skip.name} [${skip.class}: ${skip.reason || 'no reason'}]\n`);
  write(result.ok ? 'release env-test: green\n' : `release env-test: red (${result.failed.length} step(s), ${result.skips.length} skip(s))\n`);
  return result.ok ? 0 : 1;
}

if (isMain(import.meta.url)) process.exitCode = await main();
