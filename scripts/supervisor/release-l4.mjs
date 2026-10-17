// release-l4.mjs - the L4 row of the test ladder (docs/source-process.md), what the release cut runs exactly once before the tag:
//   tests   the runtime's real tests (the package clean-test, the scaffold e2e: the runtime has no specs, owner ruling no-runtime-specs), and per example app its unit, contract, integration and e2e runs
//   lint    the whole repository and stylelint (the example apps' `lint` is the one eslint + stylelint + starci app lint)
//   checks  the full runtime check, the app format check, and the Sonar and coverage proof of every example (a proof seam)
//   tsc     every project: each example's typecheck and test typecheck, and the builds
//   images  every image of every example builds (`docker:build`)
//   deps    before any step: a real `npm ci` in every example app (never a link into another checkout: a node_modules link is removed as a link first), then the build of packages/test-world (untracked output the spec run borrows: a stale one types the example apps against an old API)
//   linux   the CI-equivalent light jobs in a Linux container (scripts/supervisor/release-linux-parity.mjs): derived from .github/workflows, never the spec suites
// The Sonar proof is wired to the existing gate (scripts/supervisor/release-l4-sonar.mjs); the whole row runs inside the host lock of cutRelease.
// The rows run as a schedule (release-l4-graph.mjs, release-l4-schedule.mjs, modules/supervisor/release-cut.yaml): installs together, the Linux container from the start and beside everything, the root rows one after another,
// the example apps' chains and their Sonar proofs together once the suite has ended; a row already green for this commit, or reused from another (release-reuse.mjs), stands in as `carry`.
// Every step logs to a file the result records. A step the repository does not define, or a proof nothing supplies, is `absent` and FAILS L4: nothing is skipped by silence.
// Skips are judged too (evidence rule: every test must have passed in at least one leg): every skipped test is reported with its reason; a skip that passed in another row is COVERED and listed
// with where it passed; any other skip fails L4; only the declared browser-conditional skips (draw-render, draw-rationale, draw-layer) may remain, listed by name in the record.
import fs from 'node:fs';
import path from 'node:path';
import { planFor } from './push-git.mjs';
import { unlinkNodeModulesLink } from '../api/fs/unlink-node-modules-link.mjs';
import { parityInWorker, stepInWorker } from './release-l4-offload.mjs';
import { l4Graph, LINUX_ROW } from './release-l4-graph.mjs';
import { runGraph, scheduleSettings } from './release-l4-schedule.mjs';
import { sonarSupplier } from './release-l4-sonar.mjs';
import { byCodeUnit } from '../lib/list.mjs';
import { idleScripts, stepEnv, testLayersOf } from './release-l4-layers.mjs';
import { ciPlan, ciSettings } from './release-ci-rows.mjs';

/** The only skips a release may keep: tests that need a browser the host may lack, matched by name. */
const BROWSER_SKIPS = Object.freeze(['draw-render', 'draw-rationale', 'draw-layer']);
const INFRASTRUCTURE = /\b(?:docker|postgres(?:ql)?|supabase|kafka|redis|minio|keycloak|compose|stack|port|socket|network|database|infrastructure|unavailable|not installed|not reachable)\b/i;
const EXAMPLE_SCRIPTS = Object.freeze(['codegen', 'typecheck', 'typecheck:tests', 'lint', 'format:check', 'test', 'test:contract', 'test:integration', 'test:e2e', 'build:be', 'build:fe', 'docker:build']);
/** A lite app has the unit run and optional integration specs but no e2e or contract world (owner ruling 2026-10-12): its row is the full row without those two scripts. */
const LITE_NO_SCRIPTS = Object.freeze(['test:contract', 'test:e2e']);
/** The scripts of an app's row: none for a test layer the app holds no spec file in (`layers`, read from the checkout by exampleApps; absent means every layer), and a lite app never has the e2e or contract script. */
export const scriptsOf = (app) => EXAMPLE_SCRIPTS.filter((script) => !(app.edition === 'lite' && LITE_NO_SCRIPTS.includes(script)) && !idleScripts(app.layers).some((idle) => idle.script === script));
/** The scripts that judge an app's sealed members: run in a disposable copy with fresh nondeployable envelopes (release-sealed-run.mjs), as the app's own ci.yml runs its lint; the runtime tracks no ciphertext. */
const SEALED_SCRIPTS = Object.freeze(['lint']);
/** The command of one app script row: `npm run <script>`, through release-sealed-run.mjs for SEALED_SCRIPTS. */
const scriptCommand = (runtime, app, script) => (SEALED_SCRIPTS.includes(script)
  ? { cmd: 'node', args: [path.join(runtime, 'scripts', 'supervisor', 'release-sealed-run.mjs'), app.dir, '--', 'npm', 'run', script] }
  : { cmd: 'npm', args: ['run', script] });
/** The proofs of the checks column that only a tool outside npm scripts can give (Sonar: release-l4-sonar.mjs): each must answer {ok, log}. */
const L4_PROOFS = Object.freeze(['sonar']);
const STEP_TIMEOUT_MS = 60 * 60_000;

// Log line shapes, built from named parts: a spec-reporter skip, a TAP skip, a spec-reporter pass and a TAP pass.
const LINE_START = String.raw`^\s*`;
const TEST_NAME = '(.*?)';
const DURATION = String.raw`\s+\([\d.]+m?s\)`;
const SKIPPED_SPEC_LINE = new RegExp([LINE_START, '﹣', String.raw`\s+`, TEST_NAME, DURATION, String.raw`(?:\s+#\s*(.*))?`, '$'].join(''), 'u');
const SKIPPED_TAP_LINE = new RegExp([LINE_START, String.raw`(?:not )?ok \d+ - `, TEST_NAME, String.raw`\s+#\s*SKIP\S*\s*(.*)`, '$'].join(''), 'i');
const PASSED_SPEC_LINE = new RegExp([LINE_START, '✔', String.raw`\s+`, TEST_NAME, DURATION, String.raw`\s*`, '$'].join(''), 'u');
const PASSED_TAP_LINE = new RegExp([LINE_START, String.raw`ok \d+ - `, TEST_NAME, String.raw`\s*`, '$'].join(''));

/** The skipped tests of a node:test log, spec reporter (`﹣ name (1ms) # reason`) or TAP (`ok 3 - name # SKIP reason`): [{name, reason}]. Pure. */
function skipsOf(text) {
  const found = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const m = SKIPPED_SPEC_LINE.exec(line);
    if (m) { found.push({ name: m[1], reason: (m[2] ?? '').replace(/^SKIP\S*\s*/i, '').trim() }); continue; }
    const tap = SKIPPED_TAP_LINE.exec(line);
    if (tap) found.push({ name: tap[1], reason: tap[2].trim() });
  }
  return found;
}

/** The passed tests of a node:test log, spec reporter (`✔ name (1ms)`) or TAP (`ok 3 - name`, excluding skipped or pending cases): the names. Pure. */
function passesOf(text) {
  const found = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const m = PASSED_SPEC_LINE.exec(line);
    if (m) { found.push(m[1]); continue; }
    const tap = PASSED_TAP_LINE.exec(line);
    if (tap && !/#\s*(?:SKIP|TODO)/i.test(tap[1])) found.push(tap[1]);
  }
  return found;
}


/** What a skip is, for L4: 'declared' (a browser-conditional skip by name), 'infrastructure' or 'undeclared'. Pure. */
function classifySkip(skip, { declared = BROWSER_SKIPS } = {}) {
  const text = `${skip.name} ${skip.reason}`;
  if (declared.some((name) => text.includes(name))) return 'declared';
  return INFRASTRUCTURE.test(text) ? 'infrastructure' : 'undeclared';
}

/**
 * The skip report of an L4 run (the evidence rule, owner ruling 10:36): every test must have executed and passed in at least one leg (the Windows host run and the Linux container run).
 * A skipped test whose name passed in another step is COVERED (reported with where it passed); a declared browser skip stays declared; every other skip fails L4.
 * {skips: [{step, name, reason, class, passedIn?}], failures: [...], declared: [names kept], covered: [{name, skippedIn, passedIn}]}. Pure.
 */
export function skipReport(steps, opts) {
  const passedIn = new Map();
  for (const s of steps) {
    for (const name of s.passes ?? []) {
      if (!passedIn.has(name)) passedIn.set(name, []);
      if (!passedIn.get(name).includes(s.name)) passedIn.get(name).push(s.name);
    }
  }
  const skips = steps.flatMap((s) => (s.skips ?? []).map((k) => {
    const elsewhere = (passedIn.get(k.name) ?? []).filter((step) => step !== s.name);
    return { step: s.name, ...k, class: elsewhere.length ? 'covered' : classifySkip(k, opts), ...(elsewhere.length ? { passedIn: elsewhere[0] } : {}) };
  }));
  const failures = skips.filter((k) => k.class !== 'declared' && k.class !== 'covered');
  const covered = skips.filter((k) => k.class === 'covered').map((k) => ({ name: k.name, skippedIn: k.step, passedIn: k.passedIn }));
  return { skips, failures, covered, declared: [...new Set(skips.filter((k) => k.class === 'declared').map((k) => k.name))].sort(byCodeUnit) };
}

/** The example apps of `repo` (examples/<name>/hfs.json of kind app): [{name, dir, edition, layers}], the edition `lite` or `full`, the test layers the app holds (testLayersOf). */
export function exampleApps(repo) {
  const root = path.join(repo, 'examples');
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).flatMap((e) => {
    try {
      const hfs = JSON.parse(fs.readFileSync(path.join(root, e.name, 'hfs.json'), 'utf8'));
      if (hfs.kind !== 'app') return [];
      const dir = path.join(root, e.name), edition = hfs.edition === 'lite' ? 'lite' : 'full';
      return [{ name: e.name, dir, edition, layers: testLayersOf(dir) }];
    } catch { return []; }
  });
}

/** The L4 plan of `repo`: {steps: [{name, cmd, args, cwd, absent?, install?, nextBuild?}], notPlanned: [{name, why}], proofs: [names], linux: true}: the installs first, then the npm steps, the proofs and the Linux step; `notPlanned` names each test row a full app has no spec file for (release-l4-layers.mjs). */
export function planL4(repo, { runtimeRoot, mode = 'local' } = {}) {
  const apps = exampleApps(repo);
  const installs = apps.map((app) => {
    const name = `${app.name}: npm ci`;
    return fs.existsSync(path.join(app.dir, 'package-lock.json')) ? { name, cmd: 'npm', args: ['ci', '--no-audit', '--no-fund'], cwd: app.dir, install: true } : { name, absent: true, cwd: app.dir, install: true };
  });
  const notPlanned = [];
  const testWorld = path.join(repo, 'packages', 'test-world');
  const builds = fs.existsSync(path.join(testWorld, 'package.json')) ? [{ name: 'test-world: npm run build', cmd: 'npm', args: ['run', 'build'], cwd: testWorld, prep: true }] : [];
  const steps = [...installs, ...builds, ...planFor(repo, runtimeRoot ? { runtimeRoot } : {}).steps.map((s) => ({ ...s, cwd: repo }))];
  for (const app of apps) {
    let scripts = {};
    try { scripts = JSON.parse(fs.readFileSync(path.join(app.dir, 'package.json'), 'utf8')).scripts ?? {}; } catch { scripts = {}; }
    for (const script of scriptsOf(app)) {
      const name = `${app.name}: npm run ${script}`;
      steps.push(scripts[script] ? { name, ...scriptCommand(runtimeRoot ?? repo, app, script), cwd: app.dir, nextBuild: true } : { name, absent: true, cwd: app.dir });
    }
    notPlanned.push(...idleScripts(app.layers).filter((idle) => !(app.edition === 'lite' && LITE_NO_SCRIPTS.includes(idle.script))).map((idle) => ({ name: `${app.name}: npm run ${idle.script}`, why: idle.why })));
  }
  const planned = { steps, notPlanned, proofs: apps.flatMap((app) => L4_PROOFS.map((proof) => `${app.name}: ${proof}`)), linux: true, mode: 'local', delegated: [] };
  return mode === 'ci' ? ciPlan({ plan: planned }) : planned;
}


/** The work of one planned step: its row {name, ok, log, ms, skips, passes}. */
function stepWork({ step, unlink }) {
  return async (s) => {
    if (s.absent) return { name: s.name, ok: false, absent: true, log: null, ms: 0, skips: [] };
    // A real install, never through a link into another checkout: a node_modules link is removed as a link first.
    if (s.install && !unlink(s.cwd)) return { name: s.name, ok: false, log: null, ms: 0, skips: [], why: 'a node_modules link could not be removed' };
    const r = await step(s, { cwd: s.cwd, timeoutMs: STEP_TIMEOUT_MS, tag: 'release', ...(s.env || s.nextBuild ? { env: stepEnv(s) } : {}) });
    return { name: s.name, ok: r.ok, log: r.log, ms: r.ms, skips: skipsOf(r.text), passes: passesOf(r.text) };
  };
}

/** The proof rows: each supplier proof answers {ok, log, ms}; a name nothing supplies is absent and fails. */
const proofWork = (sup) => async (name) => {
  const p = await sup.proofs[name]?.();
  return p ? { name, ok: p.ok === true, log: p.log ?? null, ms: p.ms ?? 0, skips: [] } : { name, ok: false, absent: true, log: null, ms: 0, skips: [] };
};

/**
 * Run the L4 plan once (async: the Sonar gate is) as a schedule (release-l4-graph.mjs): a Promise of [{name, ok, log, ms, skips, absent?}] in plan order, the proofs, then the Linux row.
 * `proofs` supplies the {ok, log} of each proof by name (default: the Sonar gate of every example, the stack brought up and put back by `supplier.close`); a missing one is absent and fails.
 * `parity` runs the Linux container (default: in a worker thread); `parity: null` leaves it out of a stand-in run. `carry` maps a row name to a result that stands in for running it
 * (a row already green for this commit, or reused from another one). A red row never cancels another; a row that throws stops the rest from starting and is raised once the running rows settled.
 */
export async function runL4(repo, { proofs, parity = parityInWorker, step = stepInWorker, plan = planL4(repo), apps = exampleApps(repo), supplier = null, unlink = unlinkNodeModulesLink, parityDeps = {}, concurrencyDeps = {}, carry = {}, settings = scheduleSettings() } = {}) {
  const sup = proofs === undefined ? (supplier ?? sonarSupplier(apps)) : { proofs, close: () => {} };
  const tasks = {
    step: stepWork({ step, unlink }),
    proof: proofWork(sup),
    ...(parity ? { parity: async () => parity(repo, { apps: () => apps.map((a) => a.name), ...parityDeps }) } : {}),
  };
  try {
    const { rows, limits } = l4Graph({ plan, apps, settings: ciSettings(plan, settings), tasks, carry, deps: concurrencyDeps });
    const results = await runGraph(rows, limits);
    const ordered = [...plan.steps.map((s) => s.name), ...plan.proofs].map((name) => results.get(name));
    return [...ordered, ...(results.has(LINUX_ROW) ? [results.get(LINUX_ROW)] : [])];
  } finally { sup.close?.(); }
}
