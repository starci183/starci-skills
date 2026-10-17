#!/usr/bin/env node
// release-check.mjs - `starci release check`: the one release gate. It folds the readiness checklist and the batch-publish
// plan into runtime code; it prints GREEN only when every proof of the checklist holds, and it NEVER publishes (publishing is
// `starci release publish --publish`, a human step).
//
//   starci release check [--final] [--only <id>,<id>] [--json]
//
// Proofs, in order (id: what it proves; the checklist row it replaces):
//   publish-plan   B1  every published package is at its pin and matches the registry (integrity, or content); nothing is left to publish
//   canon-pins     B2  scripts/checks/check-canon-pins.mjs: every pin valid, every code-pattern profile bound to its published canon
//   app-installs   B3  scripts/gates/release-app-installs.mjs: the published hfs scaffolds an app that installs fresh and runs, none skipped
//   package-clean  B4  scripts/gates/package-clean-test.mjs: every published package passes its own tests from a clean install
//   check          C1  `npm run check` of the runtime
//   scaffold-e2e   C3  scripts/gates/scaffold-e2e.mjs: the scaffold e2e, every test ran and passed (the runtime has no specs of its own, owner ruling no-runtime-specs)
//   checkout       C6  the checkout is on a clean tree and its node_modules are intact
//   identity       A1,A2,A4  (with --final only) package.json version heads a dated CHANGELOG section with no open markers, on main
// The land gate is the land wrapper's: it runs before a lane lands, not in this release read. `--only` runs a subset and ends
// PARTIAL, never GREEN. Exit 0 GREEN, 1 a proof is red, 2 a proof could not run. Every external call goes through a seam
// (`deps`), so specs judge the gate on fakes at the npm and process edge.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runNode } from '../api/node/run-node.mjs';
import { runNpm } from '../api/npm/run-npm.mjs';
import { porcelainStatus } from '../api/git/porcelain-status.mjs';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { isMain } from '../lib/is-main.mjs';
import { buildPlan } from './release-plan.mjs';
import { npmRegistry } from './release-registry.mjs';
import { appInstallsStep, canonPinsStep, checkStep, STEP_STATUS } from './release-proof.mjs';
import { tailLines } from '../lib/clip.mjs';

const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PROOFS = Object.freeze(['publish-plan', 'canon-pins', 'app-installs', 'package-clean', 'check', 'scaffold-e2e', 'checkout']);
const FINAL_PROOFS = Object.freeze(['identity']);
const tail = (text, n = 3) => tailLines(text, n, { join: ' | ', max: 500 });
const result = (id, ok, detail, extra = {}) => ({ id, status: ok ? STEP_STATUS.pass : STEP_STATUS.red, detail, ...extra });
const unrun = (id, detail) => ({ id, status: STEP_STATUS.toolFailed, detail });

/** B1: the plan against the registry has no blocker and nothing left to publish. */
function publishPlanProof({ root, registry }) {
  let plan;
  try { plan = buildPlan({ root, registry }); } catch (error) { return unrun('publish-plan', String(error?.message ?? error)); }
  const pending = plan.toPublish.map((r) => `${r.name}@${r.version}`);
  const problems = [...plan.blockers, ...(pending.length ? [`${pending.length} package(s) still to publish: ${pending.join(', ')} (starci release publish --publish)`] : [])];
  return result('publish-plan', problems.length === 0, problems.length ? problems.slice(0, 6).join(' | ') : `${plan.rows.length} package(s) at their pins and on the registry`, { plan });
}

/** B4: the clean-install proof of every published package. */
function packageCleanProof({ root, node }) {
  const run = node([path.join(root, 'scripts', 'gates', 'package-clean-test.mjs')], { cwd: root });
  const out = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
  const summary = /package-clean-test: (\d+) green, (\d+) red, (\d+) not run, of (\d+)/.exec(out);
  if (run.error || run.status === null) return unrun('package-clean', tail(out));
  return result('package-clean', run.status === 0 && Boolean(summary) && summary[2] === '0' && summary[3] === '0', summary ? summary[0] : tail(out));
}

/** C3: the scaffold e2e; a failed, cancelled or skipped test, or a run that printed no summary, is red. */
function scaffoldE2eProof({ root, node }) {
  const run = node([path.join(root, 'scripts', 'gates', 'scaffold-e2e.mjs')], { cwd: root, maxBuffer: 1024 * 1024 * 1024 });
  const out = `${run.stdout ?? ''}
${run.stderr ?? ''}`;
  const summary = /scaffold-e2e: (\d+) of (\d+) passed, (\d+) failed, (\d+) skipped/.exec(out);
  if (run.error || run.status === null || run.status === 2) return unrun('scaffold-e2e', tail(out));
  return result('scaffold-e2e', run.status === 0 && Boolean(summary), summary ? summary[0] : tail(out));
}

/** C6: a clean tracked tree and both node_modules still holding their entries (a removal through a link would empty them). */
function checkoutProof({ root, git = { status: (cwd) => porcelainStatus(cwd, { untracked: 'no' }) } }) {
  const status = git.status(root);
  if (!status.ok) return unrun('checkout', `git status failed: ${status.stderr}`);
  const empty = ['node_modules', 'packages/node_modules'].filter((dir) => { try { return fs.readdirSync(path.join(root, dir)).length === 0; } catch { return true; } });
  const problems = [...(status.stdout ? [`${status.stdout.split(/\r?\n/).length} tracked change(s)`] : []), ...empty.map((dir) => `${dir} is missing or empty`)];
  return result('checkout', problems.length === 0, problems.length ? problems.join('; ') : 'tracked tree clean; node_modules intact');
}

/** A1, A2, A4 (--final): the version heads a dated CHANGELOG section with no open marker, and the checkout is on main. */
function identityProof({ root, branch = (cwd) => revParseQuery(['--abbrev-ref', 'HEAD'], { cwd }) }) {
  const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
  const heading = changelog.split(/\r?\n/).find((line) => line.startsWith(`## [${version}]`)) ?? null;
  const problems = [];
  if (!heading) problems.push(`CHANGELOG.md has no section for ${version}`);
  else if (/in preparation/i.test(heading)) problems.push(`the ${version} section is still "in preparation"`);
  const markers = (changelog.match(/\b(TODO|PENDING|TBD)\(/g) ?? []).length;
  if (markers) problems.push(`CHANGELOG.md holds ${markers} open marker(s)`);
  const head = branch(root);
  const name = String(head.stdout ?? '').trim();
  if (name !== 'main') problems.push(`the checkout is on '${name || 'unknown'}', not main`);
  return result('identity', problems.length === 0, problems.length ? problems.join('; ') : `${version} is released on main`);
}

/** The proofs of `ids` (a subset of PROOFS + FINAL_PROOFS) run in order against `root`; `deps` are the process and npm seams of a spec. */
function runProofs({ root = runtimeRoot, ids = PROOFS, deps = {} } = {}) {
  const node = deps.node ?? ((args, opts) => runNode(args, { maxBuffer: 512 * 1024 * 1024, ...opts }));
  const npm = deps.npm ?? ((args, opts) => runNpm(args, { maxBuffer: 512 * 1024 * 1024, ...opts }));
  const registry = deps.registry ?? npmRegistry({ root });
  const run = {
    'publish-plan': () => publishPlanProof({ root, registry }),
    'canon-pins': () => canonPinsStep({ runtime: root, node }),
    'app-installs': () => appInstallsStep({ runtime: root, node }),
    'package-clean': () => packageCleanProof({ root, node }),
    check: () => checkStep({ runtime: root, npm }),
    'scaffold-e2e': () => scaffoldE2eProof({ root, node }),
    checkout: () => checkoutProof({ root, git: deps.git }),
    identity: () => identityProof({ root, branch: deps.branch }),
  };
  return ids.map((id) => ({ id, ...run[id]() }));
}

/** GREEN | RED | UNRUN | PARTIAL over proof rows; PARTIAL when `complete` is false (a subset never reads GREEN). */
export function verdictOf(rows, { complete = true } = {}) {
  if (rows.some((r) => r.status === STEP_STATUS.toolFailed)) return 'UNRUN';
  if (rows.some((r) => r.status !== STEP_STATUS.pass)) return 'RED';
  return complete ? 'GREEN' : 'PARTIAL';
}

export function parseArgs(argv) {
  const opts = { final: false, only: null, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--final') opts.final = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--only') opts.only = String(argv[++i] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    else throw new Error(`unknown argument ${arg}; usage: starci release check [--final] [--only <id>,<id>] [--json]`);
  }
  const known = [...PROOFS, ...FINAL_PROOFS];
  const bad = (opts.only ?? []).filter((id) => !known.includes(id));
  if (bad.length) throw new Error(`unknown proof ${bad.join(', ')} (known: ${known.join(', ')})`);
  return opts;
}

if (isMain(import.meta.url)) {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const all = opts.final ? [...PROOFS, ...FINAL_PROOFS] : [...PROOFS];
    const ids = opts.only ?? all;
    const rows = runProofs({ ids });
    const verdict = verdictOf(rows, { complete: ids.length === all.length && all.every((id) => ids.includes(id)) });
    if (opts.json) process.stdout.write(`${JSON.stringify({ verdict, rows: rows.map(({ plan, ...row }) => row) }, null, 2)}\n`);
    else {
      for (const row of rows) process.stdout.write(`${row.status === STEP_STATUS.pass ? 'ok  ' : 'RED '} ${row.id}: ${row.detail}\n`);
      process.stdout.write(`release-check ${verdict}: ${rows.filter((r) => r.status === STEP_STATUS.pass).length} of ${rows.length} proof(s) hold\n`);
    }
    let exitCode = 2;
    if (verdict === 'GREEN' || verdict === 'PARTIAL') exitCode = 0;
    else if (verdict === 'RED') exitCode = 1;
    process.exitCode = exitCode;
  } catch (error) {
    process.stderr.write(`release-check: ${error.message}\n`);
    process.exitCode = 2;
  }
}
