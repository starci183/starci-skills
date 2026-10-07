// release-l4.mjs - the L4 row of the test ladder (docs/source-process.md), what the release cut runs exactly once before the tag:
//   specs   ALL: the runtime suite, and per example app its unit, contract, integration and e2e runs
//   lint    the whole repository and stylelint (the example apps' `lint` is the one eslint + stylelint + starci app lint)
//   checks  the full runtime check, the app format check, and the Sonar and coverage proof of every example (a proof seam)
//   tsc     every project: each example's typecheck and test typecheck, and the builds
//   images  every image of every example builds (`docker:build`)
//   deps    before any step: a real `npm ci` in every example app (never a link into another checkout: a node_modules link is removed as a link first)
//   linux   the CI-equivalent light jobs in a Linux container (scripts/supervisor/release-linux-parity.mjs): derived from .github/workflows, never the spec suites
// The Sonar proof is wired to the existing gate (scripts/supervisor/release-l4-sonar.mjs); the whole row runs inside the host lock of cutRelease.
// Every step logs to a file the result records. A step the repository does not define, or a proof nothing supplies, is `absent` and FAILS L4: nothing is skipped by silence.
// Skips are judged too (evidence rule: every test must have passed in at least one leg, the host run or the Linux container run): every skipped test is reported with its reason; the spec files that hold a
// test the host run skipped are run by the Linux leg (its shells installed inside the container only) and the two legs' results are merged by test name: a skip that passed in the other leg is COVERED and listed with
// where it passed; a skip nothing covered (missing infrastructure on both legs, a platform neither has, a title no spec file holds) fails L4; only the declared browser-conditional skips (draw-render,
// draw-rationale, draw-layer) may remain, listed by name in the record.
import fs from 'node:fs';
import path from 'node:path';
import { planFor, runStep } from './push-git.mjs';
import { unlinkNodeModulesLink } from '../api/fs/unlink-node-modules-link.mjs';
import { LINUX_SPECS_LABEL, runParity } from './release-linux-parity.mjs';
import { sonarSupplier } from './release-l4-sonar.mjs';
import { resolveTestConcurrency } from '../machine/test-concurrency.mjs';
import { byCodeUnit } from '../lib/list.mjs';

/** The only skips a release may keep: tests that need a browser the host may lack, matched by name. */
const BROWSER_SKIPS = Object.freeze(['draw-render', 'draw-rationale', 'draw-layer']);
const INFRASTRUCTURE = /\b(?:docker|postgres(?:ql)?|supabase|kafka|redis|minio|keycloak|compose|stack|orca|port|socket|network|database|infrastructure|unavailable|not installed|not reachable)\b/i;
const EXAMPLE_SCRIPTS = Object.freeze(['codegen', 'typecheck', 'typecheck:tests', 'lint', 'format:check', 'test', 'test:contract', 'test:integration', 'test:e2e', 'build:be', 'build:fe', 'docker:build']);
/** A lite app holds no tests (lite holds no tests): its row is the full row without them; the lite scaffold e2e inside the spec run is its behaviour proof. */
const LITE_NO_SCRIPTS = Object.freeze(['typecheck:tests', 'test', 'test:contract', 'test:integration', 'test:e2e']);
export const scriptsOf = (app) => (app.edition === 'lite' ? EXAMPLE_SCRIPTS.filter((script) => !LITE_NO_SCRIPTS.includes(script)) : EXAMPLE_SCRIPTS);
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

/** The passed tests of a node:test log, spec reporter (`✔ name (1ms)`) or TAP (`ok 3 - name`, excluding skipped or pending cases): the names. Pure. */
export function passesOf(text) {
  const found = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const m = /^\s*✔\s+(.*?)\s+\([\d.]+m?s\)\s*$/u.exec(line);
    if (m) { found.push(m[1]); continue; }
    const tap = /^\s*ok \d+ - (.*?)\s*$/.exec(line);
    if (tap && !/#\s*(?:SKIP|TODO)/i.test(tap[1])) found.push(tap[1]);
  }
  return found;
}

/** The part of a parity container log that one marked step printed (between its `##STEP` line and the next marker), '' when it did not run. Pure. */
export function sectionOf(text, label) {
  const lines = String(text ?? '').split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith('##STEP ') && line.slice(7).startsWith(label));
  if (start < 0) return '';
  const end = lines.findIndex((line, i) => i > start && /^##(?:STEP|FAILED|DONE)\b/.test(line));
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n');
}

/**
 * The spec files that hold the tests named `names`: {files, unmatched}. A name is matched as the literal text of a test title in a spec file under tests/ (a title built from a template
 * literal has no literal text and stays unmatched, which the evidence rule then fails by name). Reads the checkout; no process is started.
 */
export function specFilesFor(repo, names) {
  const paths = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (entry.name !== 'node_modules') walk(full); } else if (entry.name.endsWith('.spec.mjs')) paths.push(full);
    }
  };
  const root = path.join(repo, 'tests');
  if (fs.existsSync(root)) walk(root);
  const texts = paths.map((file) => ({ file: path.relative(repo, file).split(path.sep).join('/'), text: fs.readFileSync(file, 'utf8') }));
  const found = new Set(), unmatched = [];
  for (const name of new Set(names)) {
    const hits = texts.filter((entry) => entry.text.includes(name) || entry.text.includes(name.replaceAll("'", String.raw`\'`)));
    if (hits.length) hits.forEach((entry) => found.add(entry.file)); else unmatched.push(name);
  }
  return { files: [...found].sort(byCodeUnit), unmatched };
}

/** What a skip is, for L4: 'declared' (a browser-conditional skip by name), 'infrastructure' or 'undeclared'. Pure. */
export function classifySkip(skip, { declared = BROWSER_SKIPS } = {}) {
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

/** The example apps of `repo` (examples/<name>/hfs.json of kind app): [{name, dir, edition}], the edition `lite` or `full`. */
export function exampleApps(repo) {
  const root = path.join(repo, 'examples');
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).flatMap((e) => {
    try {
      const hfs = JSON.parse(fs.readFileSync(path.join(root, e.name, 'hfs.json'), 'utf8'));
      return hfs.kind === 'app' ? [{ name: e.name, dir: path.join(root, e.name), edition: hfs.edition === 'lite' ? 'lite' : 'full' }] : [];
    } catch { return []; }
  });
}

/**
 * The env of the runtime's own spec run (`npm test`): the example apps' installs (the real `npm ci` steps that run first) are what the scaffold specs borrow their framework packages from
 * (STARCI_APP_INSTALLS), and a missing install fails the spec instead of skipping it (STARCI_REQUIRE_APP_INSTALLS=1): the scaffold lint, typecheck and api boot proofs never pass silently. The live Orca
 * specs run on the release host (STARCI_REQUIRE_ORCA_LIVE=1: a run outside an Orca terminal fails them by name through the evidence rule, it never skips them quietly).
 */
export const specEnv = (apps) => ({ STARCI_REQUIRE_APP_INSTALLS: '1', STARCI_REQUIRE_ORCA_LIVE: '1', STARCI_APP_INSTALLS: apps.map((app) => path.join(app.dir, 'node_modules')).join(path.delimiter) });

/** Bind the host budget to the owning direct Node test script, retaining its preloads and file selection. Pure apart from reading package.json. */
export function runtimeSpecStep(repo, step, decision) {
  const { scripts = {} } = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8'));
  if (scripts.pretest || scripts.posttest) throw new Error('L4 runtime test script has unsupported pretest/posttest lifecycle hooks');
  const words = [];
  let rest = String(scripts.test ?? '').trim();
  if (/[\r\n]/u.test(rest)) throw new Error('L4 runtime test script must not contain shell line breaks');
  while (rest) {
    const token = /^(?:"([^"\r\n\\`$]*)"|'([^'\r\n\\`$]*)'|([^\s"'\\;&|<>`$]+))(?:\s+|$)/u.exec(rest);
    if (!token) throw new Error('L4 runtime test script must be a direct Node command without shell composition');
    words.push(token[1] ?? token[2] ?? token[3]);
    rest = rest.slice(token[0].length);
  }
  const [command, ...args] = words;
  if (command !== 'node' || !args.includes('--test')) throw new Error('L4 runtime test script must be a direct node --test command');
  if (args.some((arg) => arg === '--test-concurrency' || arg.startsWith('--test-concurrency=') || arg === '--test-isolation=none')) {
    throw new Error('L4 runtime test script must leave file concurrency to the release host budget');
  }
  args.splice(args.indexOf('--test') + 1, 0, `--test-concurrency=${decision.concurrency}`);
  return { ...step, cmd: 'node', args };
}

/** The L4 plan of `repo`: {steps: [{name, cmd, args, cwd, absent?, install?}], proofs: [names], linux: true}: the installs first, then the npm steps, the proofs and the Linux step. */
export function planL4(repo, { runtimeRoot } = {}) {
  const apps = exampleApps(repo);
  const installs = apps.map((app) => {
    const name = `${app.name}: npm ci`;
    return fs.existsSync(path.join(app.dir, 'package-lock.json')) ? { name, cmd: 'npm', args: ['ci', '--no-audit', '--no-fund'], cwd: app.dir, install: true } : { name, absent: true, cwd: app.dir };
  });
  const env = specEnv(apps);
  const steps = [...installs, ...planFor(repo, runtimeRoot ? { runtimeRoot } : {}).steps.map((s) => ({ ...s, cwd: repo, ...(s.name === 'npm test' && !s.absent ? { env, evidence: true } : {}) }))];
  for (const app of apps) {
    let scripts = {};
    try { scripts = JSON.parse(fs.readFileSync(path.join(app.dir, 'package.json'), 'utf8')).scripts ?? {}; } catch { scripts = {}; }
    for (const script of scriptsOf(app)) {
      const name = `${app.name}: npm run ${script}`;
      steps.push(scripts[script] ? { name, cmd: 'npm', args: ['run', script], cwd: app.dir } : { name, absent: true, cwd: app.dir });
    }
  }
  return { steps, proofs: apps.flatMap((app) => L4_PROOFS.map((proof) => `${app.name}: ${proof}`)), linux: true };
}

/**
 * The Linux leg: the CI-equivalent jobs, plus the spec files that hold a test the host run SKIPPED (a shell, a symlink privilege or a platform the Windows host lacks), run in the container with
 * their shells installed INSIDE it. The log of that part is read back: the tests that passed there (`passes`) and the ones it skipped (`skips`) join the host run's, so a test that executed in
 * neither leg is a failure by name (skipReport). A skipped name no spec file holds the text of is returned as `unmatched` and stays a failure.
 */
async function linuxLeg(repo, { parity, apps, ran, parityDeps }) {
  const hostSkips = ran.filter((s) => s.passes).flatMap((s) => s.skips).filter((k) => classifySkip(k) !== 'declared');
  const { files, unmatched } = parityDeps.specs ? { files: parityDeps.specs, unmatched: [] } : specFilesFor(repo, hostSkips.map((k) => k.name));
  const leg = await parity(repo, { apps: () => apps.map((a) => a.name), ...parityDeps, specs: files });
  if (!files.length || !leg.log || !fs.existsSync(leg.log)) return { ...leg, specs: files, unmatched };
  const section = sectionOf(fs.readFileSync(leg.log, 'utf8'), LINUX_SPECS_LABEL);
  return { ...leg, specs: files, unmatched, skips: [...(leg.skips ?? []), ...skipsOf(section)], passes: passesOf(section) };
}

/**
 * Run the L4 plan once (async: the Sonar gate is): a Promise of [{name, ok, log, ms, skips, absent?}]. `proofs` supplies the {ok, log} of each proof by name (default: the Sonar gate of every example, the stack
 * brought up and put back by `supplier.close`); a missing one is absent and fails. `parity` runs the Linux step (default runParity); `parity: null` leaves it out of a stand-in run.
 */
export async function runL4(repo, { proofs, parity = runParity, step = runStep, plan = planL4(repo), apps = exampleApps(repo), supplier = null, unlink = unlinkNodeModulesLink, parityDeps = {}, concurrencyDeps = {} } = {}) {
  const sup = proofs === undefined ? (supplier ?? sonarSupplier(apps)) : { proofs, close: () => {} };
  try {
    const ran = plan.steps.map((s) => {
      if (s.absent) return { name: s.name, ok: false, absent: true, log: null, ms: 0, skips: [] };
      // A real install, never through a link into another checkout: a node_modules link is removed as a link first.
      if (s.install && !unlink(s.cwd)) return { name: s.name, ok: false, log: null, ms: 0, skips: [], why: 'a node_modules link could not be removed' };
      // cutRelease already holds the release host lock. Probe afresh here, after installs, for this actual spec process only.
      const decision = s.evidence ? resolveTestConcurrency(undefined, concurrencyDeps) : null;
      const actual = decision ? runtimeSpecStep(s.cwd ?? repo, s, decision) : s;
      const r = step(actual, { cwd: s.cwd, timeoutMs: STEP_TIMEOUT_MS, tag: 'release', ...(s.env ? { env: { ...process.env, ...s.env } } : {}) });
      if (decision && r.log && fs.existsSync(r.log)) fs.appendFileSync(r.log, `\n[concurrency]\n${JSON.stringify(decision)}\n`);
      return { name: s.name, ok: r.ok, log: r.log, ms: r.ms, skips: skipsOf(r.text), ...(s.evidence ? { passes: passesOf(r.text), concurrency: decision, command: { cmd: actual.cmd, args: actual.args } } : {}) };
    });
    const proved = [];
    for (const name of plan.proofs) {
      const p = await sup.proofs[name]?.();
      proved.push(p ? { name, ok: p.ok === true, log: p.log ?? null, ms: p.ms ?? 0, skips: [] } : { name, ok: false, absent: true, log: null, ms: 0, skips: [] });
    }
    const linux = plan.linux && parity ? [await linuxLeg(repo, { parity, apps, ran, parityDeps })] : [];
    return [...ran, ...proved, ...linux];
  } finally { sup.close?.(); }
}
