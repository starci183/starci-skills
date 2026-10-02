#!/usr/bin/env node
// release-publish.mjs - publish the @starci packages whose local version is not on the npm registry: leaves first, the
// packages that bundle the runtime's canon-pins copy last, each after its clean proof, each confirmed on the registry with a
// matching shasum, then the canon binding must be green. The ONE publishing path of the runtime, and a human step.
//
//   node scripts/gates/release-publish.mjs                              the plan only (default): registry state, blockers, steps
//   node scripts/gates/release-publish.mjs --publish --npm-user <name>  runs the plan; <name> must be the logged-in npm account
//       [--poll-minutes <n>]     registry confirmation deadline per package (default 15)
//       [--pre-land-ref <sha>]   publish a checkout whose HEAD is exactly that commit (the one a land is about to merge)
//
// Without --publish nothing is installed, proved or published. With it, a blocker, a dirty tracked tree under packages/,
// knowledge/hfs or modules/models, a checkout off main (unless --pre-land-ref names HEAD) or a wrong npm account refuses the
// run before anything is published. `npm run release:check` (release-check.mjs) is the read that must be GREEN afterwards.
// Exit: 0 done (or a plan without blockers), 1 a step failed, 2 bad usage or environment, 3 published but the canon binding
// is not green (rebind modules/models/code-patterns.yaml), 4 a plan with blockers.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ci } from '../api/npm/ci.mjs';
import { runNode } from '../api/node/run-node.mjs';
import { porcelainStatus } from '../api/git/porcelain-status.mjs';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { isMain } from '../lib/is-main.mjs';
import { sleepSync } from '../lib/sleep-sync.mjs';
import { buildPlan } from './release-plan.mjs';
import { npmRegistry } from './release-registry.mjs';

const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const USAGE = 'usage: release-publish.mjs [--publish --npm-user <name> [--poll-minutes <n>] [--pre-land-ref <sha>]]';
export const EXIT = Object.freeze({ done: 0, failed: 1, usage: 2, unbound: 3, blocked: 4 });
const POLL_STEP_MS = 20_000;

/** The plan as printed lines. */
export function planLines(plan) {
  const lines = ['== publish set, in publish order'];
  plan.rows.forEach((row, i) => lines.push(`  ${i + 1}. ${row.name}@${row.version} (pin ${row.pin}, ${row.last ? 'last' : 'leaf'}): registry ${row.registry.state}; ${row.action}${row.note ? ` - ${row.note}` : ''}`));
  for (const row of plan.others) lines.push(`  skip ${row.name} (${row.dir}): ${row.kind}`);
  if (plan.blockers.length) lines.push('== BLOCKERS', ...plan.blockers.map((b) => `  - ${b}`));
  lines.push(`${plan.toPublish.length} to publish, ${plan.blockers.length} blocker(s)`);
  return lines;
}

/**
 * Run the plan or publish it. deps (seams of a spec): registry, node (process runner), ci (npm ci), git ({status, branch, head}),
 * sleep, out (a line writer). Returns the exit code; every line goes through `out`.
 */
export function releasePublish({ root = runtimeRoot, publish = false, npmUser = null, pollMinutes = 15, preLandRef = null, deps = {} } = {}) {
  const out = deps.out ?? ((line) => process.stdout.write(`${line}\n`));
  const registry = deps.registry ?? npmRegistry({ root });
  const node = deps.node ?? ((args, opts) => runNode(args, { stdio: 'inherit', ...opts }));
  const install = deps.ci ?? ((dir) => ci(path.resolve(root, dir)));
  const sleep = deps.sleep ?? sleepSync;
  const git = deps.git ?? {
    dirty: () => porcelainStatus(root, { untracked: 'no', pathspecs: ['packages', 'knowledge/hfs', 'modules/models'] }),
    branch: () => revParseQuery(['--abbrev-ref', 'HEAD'], { cwd: root }),
    head: (ref = 'HEAD') => revParseQuery([ref], { cwd: root }),
  };
  if (publish && !npmUser) { out(`release-publish: --publish needs --npm-user <name>; ${USAGE}`); return EXIT.usage; }
  const plan = buildPlan({ root, registry });
  planLines(plan).forEach(out);
  if (!publish) return plan.blockers.length ? EXIT.blocked : EXIT.done;
  if (plan.blockers.length) { out('release-publish: refusing to publish with blockers'); return EXIT.failed; }
  const who = registry.whoami();
  if (who !== npmUser) { out(`release-publish: the npm user is '${who ?? 'none'}', expected '${npmUser}'`); return EXIT.usage; }
  const dirty = git.dirty();
  if (!dirty.ok || dirty.stdout) { out(`release-publish: tracked changes under packages/, knowledge/hfs or modules/models; publish only committed work\n${dirty.stdout || dirty.stderr}`); return EXIT.usage; }
  if (preLandRef) {
    if (String(git.head('HEAD').stdout).trim() !== String(git.head(preLandRef).stdout).trim()) { out(`release-publish: HEAD is not the pre-land ref ${preLandRef}`); return EXIT.usage; }
  } else if (String(git.branch().stdout).trim() !== 'main') { out('release-publish: the checkout is not on main'); return EXIT.usage; }

  for (const row of plan.toPublish) {
    out(`== ${row.name}@${row.version}`);
    const proof = node([path.join(root, 'scripts', 'gates', 'package-clean-test.mjs'), '--changed', `${row.dir}/package.json`], { cwd: root });
    if (proof.status !== 0) { out(`release-publish: ${row.name}: clean proof not green`); return EXIT.failed; }
    if (row.prepack && row.lock) {
      const installed = install(row.dir);
      if (!installed.ok) { out(`release-publish: ${row.name}: npm ci failed: ${installed.stderr}`); return EXIT.failed; }
    }
    const published = registry.publish(row.dir);
    if (!published.ok) { out(`release-publish: ${row.name}: npm publish failed (exit ${published.status}): ${published.stderr}`); return EXIT.failed; }
    const deadline = Date.now() + pollMinutes * 60_000;
    let seen = registry.state(row.name, row.version);
    while (seen.state !== 'present') {
      if (Date.now() >= deadline) { out(`release-publish: ${row.name}@${row.version} is not on the registry after ${pollMinutes} min (last: ${seen.state})`); return EXIT.failed; }
      sleep(POLL_STEP_MS);
      seen = registry.state(row.name, row.version);
    }
    const local = registry.localShasum(row.dir);
    if (local !== seen.shasum) { out(`release-publish: ${row.name}@${row.version} shasum mismatch: registry ${seen.shasum}, local pack ${local}`); return EXIT.failed; }
    out(`  published and confirmed (shasum ${local})`);
  }
  const bound = node([path.join(root, 'scripts', 'checks', 'check-canon-pins.mjs')], { cwd: root });
  if (bound.status !== 0) {
    out(`release-publish: published ${plan.toPublish.length} package(s) but the canon binding is NOT green: rebind modules/models/code-patterns.yaml (canon.version and contentDigest), land it, then run npm run release:check`);
    return EXIT.unbound;
  }
  out(`release-publish: done; ${plan.toPublish.length} package(s) published and confirmed; canon binding green`);
  return EXIT.done;
}

export function parseArgs(argv) {
  const opts = { publish: false, npmUser: null, pollMinutes: 15, preLandRef: null };
  const need = (i, flag) => { if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) throw new Error(`${flag} needs a value; ${USAGE}`); return argv[i + 1]; };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--publish') opts.publish = true;
    else if (arg === '--npm-user') opts.npmUser = need(i++, arg);
    else if (arg === '--poll-minutes') opts.pollMinutes = Number(need(i++, arg));
    else if (arg === '--pre-land-ref') opts.preLandRef = need(i++, arg);
    else throw new Error(`unknown argument ${arg}; ${USAGE}`);
  }
  if (!Number.isFinite(opts.pollMinutes) || opts.pollMinutes <= 0) throw new Error(`--poll-minutes must be a positive number; ${USAGE}`);
  return opts;
}

if (isMain(import.meta.url)) {
  try {
    process.exitCode = releasePublish(parseArgs(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`release-publish: ${error.message}\n`);
    process.exitCode = EXIT.usage;
  }
}
