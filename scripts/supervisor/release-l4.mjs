// release-l4.mjs - the L4 row of the test ladder (docs/source-process.md), what the release cut runs exactly once before the tag:
//   specs   ALL: the runtime suite, and per example app its unit, contract, integration and e2e runs
//   lint    the whole repository and stylelint (the example apps' `lint` is the one eslint + stylelint + hfs lint)
//   checks  the full runtime check, the app format check, and the Sonar and coverage proof of every example (a proof seam)
//   tsc     every project: each example's typecheck and test typecheck, and the builds
//   images  every image of every example builds (`docker:build`)
//   deps    before any step: a real `npm ci` in every example app (never a link into another checkout: a node_modules link is removed as a link first)
//   linux   the CI-equivalent light jobs in a Linux container (scripts/supervisor/release-linux-parity.mjs): derived from .github/workflows, never the spec suites
// The Sonar proof is wired to the existing gate (scripts/supervisor/release-l4-sonar.mjs); the whole row runs inside the host lock of cutRelease.
// Every step logs to a file the result records. A step the repository does not define, or a proof nothing supplies, is `absent` and FAILS L4: nothing is skipped by silence.
// Skips are judged too: every skipped test is reported with its reason; a skip caused by missing infrastructure (Docker, Postgres, Supabase, Kafka, Redis, a port, Orca) on the
// release host fails L4, and so does any other skip; only the declared browser-conditional skips (draw-render, draw-rationale, draw-layer) may remain, listed by name in the record.
import fs from 'node:fs';
import path from 'node:path';
import { planFor, runStep } from './push-git.mjs';
import { unlinkNodeModulesLink } from '../api/fs/unlink-node-modules-link.mjs';
import { runParity } from './release-linux-parity.mjs';
import { sonarSupplier } from './release-l4-sonar.mjs';

/** The only skips a release may keep: tests that need a browser the host may lack, matched by name. */
const BROWSER_SKIPS = Object.freeze(['draw-render', 'draw-rationale', 'draw-layer']);
const INFRASTRUCTURE = /\b(?:docker|postgres(?:ql)?|supabase|kafka|redis|minio|keycloak|compose|stack|orca|port|socket|network|database|infrastructure|unavailable|not installed|not reachable)\b/i;
const EXAMPLE_SCRIPTS = Object.freeze(['typecheck', 'typecheck:tests', 'lint', 'format:check', 'test', 'test:contract', 'test:integration', 'test:e2e', 'build:be', 'build:fe', 'docker:build']);
/** The proofs of the checks column that only a tool outside npm scripts can give (Sonar: release-l4-sonar.mjs): each must answer {ok, log}. */
const L4_PROOFS = Object.freeze(['sonar']);
const STEP_TIMEOUT_MS = 60 * 60_000;

/** The skipped tests of a node:test log, spec reporter (`﹣ name (1ms) # reason`) or TAP (`ok 3 - name # SKIP reason`): [{name, reason}]. Pure. */
export function skipsOf(text) {
  const found = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const m = /^\s*﹣\s+(.*?)\s+\([\d.]+m?s\)(?:\s+#\s*(.*))?$/u.exec(line);
    if (m) { found.push({ name: m[1], reason: (m[2] ?? '').replace(/^SKIP\S*\s*/i, '').trim() }); continue; }
    const tap = /^\s*(?:not )?ok \d+ - (.*?)\s+#\s*SKIP\S*\s*(.*)$/i.exec(line);
    if (tap) found.push({ name: tap[1], reason: tap[2].trim() });
  }
  return found;
}

/** What a skip is, for L4: 'declared' (a browser-conditional skip by name), 'infrastructure' or 'undeclared'. Pure. */
export function classifySkip(skip, { declared = BROWSER_SKIPS } = {}) {
  const text = `${skip.name} ${skip.reason}`;
  if (declared.some((name) => text.includes(name))) return 'declared';
  return INFRASTRUCTURE.test(text) ? 'infrastructure' : 'undeclared';
}

/** The skip report of an L4 run: {skips: [{step, name, reason, class}], failures: [...], declared: [names kept]}. Pure. */
export function skipReport(steps, opts) {
  const skips = steps.flatMap((s) => (s.skips ?? []).map((k) => ({ step: s.name, ...k, class: classifySkip(k, opts) })));
  const failures = skips.filter((k) => k.class !== 'declared');
  return { skips, failures, declared: [...new Set(skips.filter((k) => k.class === 'declared').map((k) => k.name))].sort() };
}

/** The example apps of `repo` (examples/<name>/hfs.json of kind app): [{name, dir}]. */
export function exampleApps(repo) {
  const root = path.join(repo, 'examples');
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).flatMap((e) => {
    try { return JSON.parse(fs.readFileSync(path.join(root, e.name, 'hfs.json'), 'utf8')).kind === 'app' ? [{ name: e.name, dir: path.join(root, e.name) }] : []; } catch { return []; }
  });
}

/** The L4 plan of `repo`: {steps: [{name, cmd, args, cwd, absent?, install?}], proofs: [names], linux: true}: the installs first, then the npm steps, the proofs and the Linux step. */
export function planL4(repo, { runtimeRoot } = {}) {
  const apps = exampleApps(repo);
  const installs = apps.map((app) => {
    const name = `${app.name}: npm ci`;
    return fs.existsSync(path.join(app.dir, 'package-lock.json')) ? { name, cmd: 'npm', args: ['ci', '--no-audit', '--no-fund'], cwd: app.dir, install: true } : { name, absent: true, cwd: app.dir };
  });
  const steps = [...installs, ...planFor(repo, runtimeRoot ? { runtimeRoot } : {}).steps.map((s) => ({ ...s, cwd: repo }))];
  for (const app of apps) {
    let scripts = {};
    try { scripts = JSON.parse(fs.readFileSync(path.join(app.dir, 'package.json'), 'utf8')).scripts ?? {}; } catch { scripts = {}; }
    for (const script of EXAMPLE_SCRIPTS) {
      const name = `${app.name}: npm run ${script}`;
      steps.push(scripts[script] ? { name, cmd: 'npm', args: ['run', script], cwd: app.dir } : { name, absent: true, cwd: app.dir });
    }
  }
  return { steps, proofs: apps.flatMap((app) => L4_PROOFS.map((proof) => `${app.name}: ${proof}`)), linux: true };
}

/**
 * Run the L4 plan once: [{name, ok, log, ms, skips, absent?}]. `proofs` supplies the {ok, log} of each proof by name (default: the Sonar gate of every example, the stack
 * brought up and put back by `supplier.close`); a missing one is absent and fails. `parity` runs the Linux step (default runParity); `parity: null` leaves it out of a stand-in run.
 */
export function runL4(repo, { proofs, parity = runParity, step = runStep, plan = planL4(repo), apps = exampleApps(repo), supplier = null, unlink = unlinkNodeModulesLink, parityDeps = {} } = {}) {
  const sup = proofs === undefined ? (supplier ?? sonarSupplier(apps)) : { proofs, close: () => {} };
  try {
    const ran = plan.steps.map((s) => {
      if (s.absent) return { name: s.name, ok: false, absent: true, log: null, ms: 0, skips: [] };
      // A real install, never through a link into another checkout: a node_modules link is removed as a link first.
      if (s.install && !unlink(s.cwd)) return { name: s.name, ok: false, log: null, ms: 0, skips: [], why: 'a node_modules link could not be removed' };
      const r = step(s, { cwd: s.cwd, timeoutMs: STEP_TIMEOUT_MS, tag: 'release' });
      return { name: s.name, ok: r.ok, log: r.log, ms: r.ms, skips: skipsOf(r.text) };
    });
    const proved = plan.proofs.map((name) => {
      const p = sup.proofs[name]?.();
      return p ? { name, ok: p.ok === true, log: p.log ?? null, ms: p.ms ?? 0, skips: [] } : { name, ok: false, absent: true, log: null, ms: 0, skips: [] };
    });
    const linux = plan.linux && parity ? [parity(repo, { apps: () => apps.map((a) => a.name), ...parityDeps })] : [];
    return [...ran, ...proved, ...linux];
  } finally { sup.close?.(); }
}
