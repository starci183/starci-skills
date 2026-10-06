#!/usr/bin/env node
// Existing publication owner: dependency-ordered canon packages, or the final --runtime-package phase.
// Root publication follows finished notes and committed canon bindings, proves its actual archive
// through a private native install, rechecks immutable inputs, and confirms the registry integrity.
// Plan mode performs registry reads only. The catalog owns flags, roles and exit semantics.
import path from 'node:path';
import { createHash } from 'node:crypto';
import { sriSha512 } from '../lib/hash.mjs';
import { isLinkLike } from '../api/fs/is-link-like.mjs';
import { tarFiles } from '../lib/tar-files.mjs';
import { fileURLToPath } from 'node:url';
import { ci } from '../api/npm/ci.mjs';
import { runNode } from '../api/node/run-node.mjs';
import { porcelainStatus } from '../api/git/porcelain-status.mjs';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { isMain } from '../lib/is-main.mjs';
import { sleepSync } from '../lib/sleep-sync.mjs';
import { buildPlan } from './release-plan.mjs';
import { npmRegistry } from './release-registry.mjs';
import { proveRuntimePackage } from './runtime-package-clean.mjs';
import { releaseNotesFindings } from '../hfs/runtime-rules/release-notes.mjs';
import fs from 'node:fs';

const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const USAGE = 'usage: starci release publish [--runtime-package] [--publish --npm-user <name> [--poll-minutes <n>] [--pre-land-ref <sha>]]';
export const EXIT = Object.freeze({ done: 0, failed: 1, usage: 2, unbound: 3, blocked: 4 });
const POLL_STEP_MS = 20_000;

/** Admit only the cold owner's exact regular tarball for this committed root identity. */
function runtimeArchive(proof, row, root, head, expectedIntegrity) {
  if (proof.name !== row.name || proof.version !== row.version || proof.inputRoot !== path.resolve(root) || proof.inputSha !== head)
    throw new Error('cold proof is not bound to this root and committed identity');
  const archive = proof.archive;
  if (!archive || !path.isAbsolute(archive.file ?? '') || !archive.file.endsWith('.tgz')) throw new Error('cold proof has no absolute tarball');
  const stat = fs.lstatSync(archive.file);
  if (!stat.isFile() || isLinkLike(archive.file, {stat})) throw new Error('cold archive is not a regular file');
  const bytes = fs.readFileSync(archive.file);
  if (bytes.length !== archive.bytes || createHash('sha256').update(bytes).digest('hex') !== archive.sha256
    || sriSha512(bytes) !== archive.integrity || archive.integrity !== expectedIntegrity)
    throw new Error('cold archive bytes changed before publication');
  const manifest = JSON.parse(tarFiles(bytes).get('package/package.json')?.toString() ?? '{}');
  if (manifest.name !== row.name || manifest.version !== row.version) throw new Error('cold tarball identity differs from the publication row');
  return archive.file;
}

/** The plan as printed lines. */
function planLines(plan) {
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
export function releasePublish({ root = runtimeRoot, publish = false, runtimePackage = false, npmUser = null, pollMinutes = 15, preLandRef = null, env = process.env, deps = {} } = {}) {
  const out = deps.out ?? ((line) => process.stdout.write(`${line}\n`));
  const registry = deps.registry ?? npmRegistry({ root });
  const node = deps.node ?? ((args, opts) => runNode(args, { stdio: 'inherit', ...opts }));
  const install = deps.ci ?? ((dir) => ci(path.resolve(root, dir)));
  const sleep = deps.sleep ?? sleepSync;
  const git = deps.git ?? {
    dirty: () => porcelainStatus(root, { untracked: runtimePackage ? 'all' : 'no', ...(runtimePackage ? {} : { pathspecs: ['packages', 'knowledge/hfs', 'modules/models'] }) }),
    branch: () => revParseQuery(['--abbrev-ref', 'HEAD'], { cwd: root }),
    head: (ref = 'HEAD') => revParseQuery([ref], { cwd: root }),
  };
  if (publish && !npmUser) { out(`release-publish: --publish needs --npm-user <name>; ${USAGE}`); return EXIT.usage; }
  const plan = buildPlan({ root, registry, scope: runtimePackage ? 'runtime' : 'packages' });
  const rootManifest = runtimePackage ? JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) : null;
  const publicationTag = runtimePackage ? (rootManifest.publishConfig?.tag ?? 'latest') : 'latest';
  if (runtimePackage && (!/^[a-z][a-z0-9-]*$/i.test(publicationTag)
    || (rootManifest.version.includes('-') && publicationTag === 'latest')))
    plan.blockers.push('root prerelease publication requires an explicit non-latest publishConfig.tag');
  if (runtimePackage) {
    const version = plan.rows[0].version;
    const findings = releaseNotesFindings({ tags: [`v${version}`], changelog: fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8') });
    plan.blockers.push(...findings.map((finding) => finding.message));
  }
  for (const line of planLines(plan)) out(line);
  if (!publish) return plan.blockers.length ? EXIT.blocked : EXIT.done;
  if (plan.blockers.length) { out('release-publish: refusing to publish with blockers'); return EXIT.failed; }
  const who = registry.whoami();
  if (who !== npmUser) { out(`release-publish: the npm user is '${who ?? 'none'}', expected '${npmUser}'`); return EXIT.usage; }
  const dirty = git.dirty();
  if (!dirty.ok || dirty.stdout) { out(`release-publish: tracked changes in the publication inputs; publish only committed work\n${dirty.stdout || dirty.stderr}`); return EXIT.usage; }
  const frozenHead = git.head('HEAD');
  if (frozenHead.ok === false || (frozenHead.status !== undefined && frozenHead.status !== 0)) { out('release-publish: Git could not read the publication HEAD'); return EXIT.usage; }
  const head = String(frozenHead.stdout ?? '').trim();
  if (runtimePackage && !/^[0-9a-f]{40}$/.test(head)) { out('release-publish: root publication needs an exact committed HEAD'); return EXIT.usage; }
  if (preLandRef) {
    if (String(git.head('HEAD').stdout).trim() !== String(git.head(preLandRef).stdout).trim()) { out(`release-publish: HEAD is not the pre-land ref ${preLandRef}`); return EXIT.usage; }
  } else if (String(git.branch().stdout).trim() !== 'main') { out('release-publish: the checkout is not on main'); return EXIT.usage; }

  if (runtimePackage) {
    const bound = node([path.join(root, 'scripts', 'checks', 'check-canon-pins.mjs')], { cwd: root, env });
    if (bound.status !== 0) { out('release-publish: finish and commit the package rebind before the runtime package phase'); return EXIT.failed; }
  }

  for (const row of plan.toPublish) {
    out(`== ${row.name}@${row.version}`);
    const localBefore = runtimePackage ? registry.localIntegrity(row.dir) : null;
    const proof = runtimePackage
      ? (deps.runtimeProof ?? proveRuntimePackage)({ root, sourceSha: head, expectedIntegrity: localBefore, env, deps: deps.runtimeProofDeps ?? {} })
      : node([path.join(root, 'scripts', 'gates', 'package-clean-test.mjs'), '--changed', `${row.dir}/package.json`], { cwd: root, env });
    if (runtimePackage) out(`  runtime clean proof ${proof.status}; receipt ${proof.attempt ?? 'unavailable'}: ${proof.detail ?? ''}`);
    if (runtimePackage ? proof.status !== 'green' : proof.status !== 0) { out(`release-publish: ${row.name}: clean proof not green`); return EXIT.failed; }
    if (row.prepack && row.lock) {
      const installed = install(row.dir);
      if (!installed.ok) { out(`release-publish: ${row.name}: npm ci failed: ${installed.stderr}`); return EXIT.failed; }
    }
    if (runtimePackage) {
      const currentHead = git.head('HEAD'), currentDirty = git.dirty();
      if (currentHead.ok === false || (currentHead.status !== undefined && currentHead.status !== 0) || String(currentHead.stdout ?? '').trim() !== head || !currentDirty.ok || currentDirty.stdout || registry.localIntegrity(row.dir) !== localBefore) { out('release-publish: runtime inputs changed during the cold proof; publication refused'); return EXIT.failed; }
      const refreshed = buildPlan({ root, registry, scope: 'runtime' });
      if (refreshed.blockers.length) { out(`release-publish: runtime registry changed during the cold proof: ${refreshed.blockers.join('; ')}`); return EXIT.failed; }
      if (refreshed.rows[0].action !== 'publish') { out('release-publish: runtime version appeared during the cold proof; review the fresh immutable registry receipt before publication'); return EXIT.failed; }
    }
    let archive = null;
    if (runtimePackage) {
      try { archive = runtimeArchive(proof, row, root, head, localBefore); }
      catch (error) { out(`release-publish: ${error.message}; publication refused`); return EXIT.failed; }
    }
    // Upload the proved archive, so npm cannot repack mutable source or rerun its lifecycle after qualification.
    const published = registry.publish(row.dir, { ...(archive ? {archive} : {}), tag: publicationTag });
    if (!published.ok) { out(`release-publish: ${row.name}: npm publish failed (exit ${published.status}): ${published.stderr}`); return EXIT.failed; }
    const deadline = Date.now() + pollMinutes * 60_000;
    let seen = registry.state(row.name, row.version);
    while (seen.state !== 'present') {
      if (Date.now() >= deadline) { out(`release-publish: ${row.name}@${row.version} is not on the registry after ${pollMinutes} min (last: ${seen.state})`); return EXIT.failed; }
      sleep(POLL_STEP_MS);
      seen = registry.state(row.name, row.version);
    }
    const local = runtimePackage ? proof.archive.integrity : registry.localIntegrity(row.dir);
    if (local !== seen.integrity) { out(`release-publish: ${row.name}@${row.version} integrity mismatch: registry ${seen.integrity}, local pack ${local}`); return EXIT.failed; }
    out(`  published and confirmed (integrity ${local})`);
  }
  if (runtimePackage) {
    out(`release-publish: done; ${plan.toPublish.length} runtime package(s) published and confirmed; no binding writes`);
    return EXIT.done;
  }
  const bound = node([path.join(root, 'scripts', 'checks', 'check-canon-pins.mjs')], { cwd: root });
  if (bound.status !== 0) {
    out(`release-publish: published ${plan.toPublish.length} package(s) but the canon binding is NOT green: rebind modules/models/code-patterns.yaml (canon.version and contentDigest), land it, then run starci release check`);
    return EXIT.unbound;
  }
  out(`release-publish: done; ${plan.toPublish.length} package(s) published and confirmed; canon binding green`);
  return EXIT.done;
}

export function parseArgs(argv) {
  const opts = { publish: false, runtimePackage: false, npmUser: null, pollMinutes: 15, preLandRef: null };
  const need = (i, flag) => { if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) throw new Error(`${flag} needs a value; ${USAGE}`); return argv[i + 1]; };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--publish') opts.publish = true;
    else if (arg === '--runtime-package') opts.runtimePackage = true;
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
