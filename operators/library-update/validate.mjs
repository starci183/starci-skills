// library.update's own law over one branch, on top of the shared step check: two halves, and the
// requirement `mode` says which of them this branch runs — `full` both in one routed checkout (two
// commits, package first), `publish` the package half alone on an owner route (one commit, ending at
// the recorded release), `consume` the consumer half alone on a consumer route (one commit, against
// the library-release another branch produced). Every gate below reads only the half its mode names,
// the preflight resolves a package path only where a package half runs, and a section belonging to
// the other half is refused in the receipt: it is work the branch had no authority to do.
//
// The package half (moved from the former library source operator): the plan names a distributable
// owner package whose manifest at the base proves its identity; every declared file is inside that
// package and the route's write roots, is an existing behavior file, its paired regression test, the
// manifest or the changelog, and behavior repairs change no presentation; the package commit is one
// single-parent commit after the base whose change set is exactly the declared set; the before proof
// fails on the declared assertion against base bytes, the after proof and every declared gate pass on
// the committed bytes, and each proof's log hash matches the log on disk. Under `publish` the archive
// packed from that commit also ends where it belongs: the release record's publication names the
// registry that serves exactly this version under exactly this archive's integrity, on proofs that
// passed, and it stays pending only where the request preset publish false.
//
// The consumer half (moved from the former dependency operator): the release is the tarball packed
// from the package commit, identified by its sha512 integrity and the bumped version; the consumer
// manifests' pin moves from the base version to the next patch and nothing else in them changes; the
// lock changes only those pins and the installed entries of the same package, a workspace link entry
// staying what it was; the installed files match the release byte for byte; the consumer commit is one
// single-parent commit after the package commit whose change set is exactly the metadata set; the
// consumer-before proof fails on the unchanged regression at the old version and consumer-after and
// every consumer gate pass at the new one, each with its log on disk.
import { existsSync, readFileSync, lstatSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAgainst } from '../../scripts/json-schema.mjs';
import { credentialShaped } from '../../scripts/sweep-secrets.mjs';
import { validateRequest, sessionRootOf } from '../../scripts/validate-request.mjs';
import { validateStep } from '../../scripts/validate-step.mjs';
import { tableUnder } from '../../scripts/validate-response.mjs';
import { sourceWriteErrors } from '../../scripts/workspace-checkout.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const OPERATOR_ID = 'library.update';
export const hash = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
export const integrityOf = (bytes) => `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
export const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
export const schema = (root, kind) => json(path.join(root, 'templates/kinds', `${kind}.schema.json`));
export const slash = (value) => value.replaceAll('\\', '/');
export const git = (cwd, args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trimEnd();
const inside = (root, target) => { const rel = path.relative(root, target); return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel)); };
export function safeRelative(value) { return typeof value === 'string' && value.length > 0 && !/[\\:\x00-\x1f]/.test(value) && !path.posix.isAbsolute(value) && value.split('/').every((part) => part && part !== '..' && part !== '.'); }
export function safePath(checkout, relative, allowMissing = true) {
  if (!safeRelative(relative)) throw new Error(`unsafe relative path: ${relative}`);
  let cur = checkout;
  for (const part of relative.split('/')) {
    cur = path.join(cur, part);
    let stat;
    try { stat = lstatSync(cur); } catch (error) { if (error.code === 'ENOENT' && allowMissing) continue; throw new Error(`missing path: ${relative}`); }
    if (stat.isSymbolicLink() || !inside(realpathSync(checkout), realpathSync(cur))) throw new Error(`symlink or escaped path: ${relative}`);
  }
  return cur;
}
export const fileHash = (file) => existsSync(file) ? hash(readFileSync(file)) : null;
export function baseBytes(checkout, base, file) {
  try { return execFileSync('git', ['-C', checkout, 'show', `${base}:${file}`], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); } catch { return null; }
}
export function baseWorkingBytes(checkout, base, file) {
  try { return execFileSync('git', ['-C', checkout, 'cat-file', '--filters', `${base}:${file}`], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); } catch { return null; }
}
export const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// The declared regression failed when the runner printed a failure marker and the assertion — the failing
// test's title as the runner prints it, or a sentence the failing block contains — appears in that output;
// runners wrap titles and print the block over several lines, so the match reads the whole output with
// its whitespace collapsed, never one line.
const collapse = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const FAIL_MARK = /FAIL|×|✕|✗|not ok/;
const PASS_MARK = /^\s*(?:ok\b|✓|✔|PASS\b)/;
export const regressionFailed = (output, assertion) => {
  const lines = String(output ?? '').split(/\r?\n/);
  const want = collapse(assertion);
  for (let i = 0; i < lines.length; i += 1) {
    if (!FAIL_MARK.test(lines[i])) continue;
    // The failing block: the marker line and what follows until the next test result.
    const block = [lines[i]];
    for (let j = i + 1; j < lines.length && !FAIL_MARK.test(lines[j]) && !PASS_MARK.test(lines[j]); j += 1) block.push(lines[j]);
    if (collapse(block.join(' ')).includes(want)) return true;
  }
  return false;
};
export function nextPatch(version) { const [a, b, c] = version.split('.').map(Number); return `${a}.${b}.${c + 1}`; }
// The modes, and which half each of them runs. `full` is the default, so a request that names no mode
// is the two-halves-one-checkout job this operator has always done.
export const MODES = ['full', 'publish', 'consume'];
export const DEFAULT_MODE = 'full';
export const modeOf = (request) => request?.requirements?.mode ?? DEFAULT_MODE;
export const runsPackageHalf = (mode) => mode === 'full' || mode === 'publish';
export const runsConsumerHalf = (mode) => mode === 'full' || mode === 'consume';
// Which receipt sections belong to which half. A done branch declares the sets of the halves its mode
// runs and no others; a package section under `consume` or a consumer section under `publish` is a
// claim about work the branch was not authorized to do, whatever its files say.
export const PACKAGE_FIELDS = ['library-source-application', 'library-proof', 'library-release', 'library-archive'];
export const CONSUMER_FIELDS = ['dependency-update', 'dependency-proof', 'dependency-log'];
export function modeSectionErrors(mode, fields = {}) {
  const errors = [];
  const present = (kind) => { const v = fields[kind]; return Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && v !== ''; };
  for (const [half, kinds, runs] of [['package', PACKAGE_FIELDS, runsPackageHalf(mode)], ['consumer', CONSUMER_FIELDS, runsConsumerHalf(mode)]]) {
    for (const kind of kinds) {
      if (runs && !present(kind)) errors.push(`mode ${mode} runs the ${half} half and the receipt declares no ${kind}`);
      if (!runs && present(kind)) errors.push(`mode ${mode} runs no ${half} half and the receipt declares ${kind}; a section of a half this branch had no authority to run cannot stand in its receipt`);
    }
  }
  return errors;
}
// Where the release record and its archive live in the branch that packed them.
export const RELEASE_RECORD_REF = 'response/data/release.json';

// ---------------------------------------------------------------------------------------------------
// The publication. Under `publish` the packed archive is what the registry must end up serving, so the
// release record is judged against the archive rather than against a claim: the version and the
// integrity the registry answered with are the ones this branch packed, the proofs that stand behind
// them are green, and the registry that serves them is named. `pending` says the archive reached no
// registry, and that is an outcome a request asks for (`publish: false`, because a person will publish
// it) — never the quiet ending of a run that meant to publish and did not.
const isFalse = (value) => value === false || value === 'false' || value === 'no';
const isTrue = (value) => value === true || value === 'true' || value === 'yes';
export const PUBLISH_FIELD_VALUES = 'true or false';
export const publishRequested = (request) => !isFalse(request?.requirements?.publish);
export const publishFieldErrors = (request) => {
  const value = request?.requirements?.publish;
  return value === undefined || value === null || isTrue(value) || isFalse(value) ? [] : [`publish is the choice ${PUBLISH_FIELD_VALUES}`];
};
export const PUBLISH_STOP = 'LIBRARY_PUBLISH_REJECTED';
// A refused publication is answered by whoever reads the receipt, and what they answer from is the
// registry's own text: a version it already serves, a credential it would not take, a policy it names.
// The answer travels; the credential that carried it never does.
export function publishStopErrors(response) {
  if (response?.status !== 'blocked' || response?.stop !== PUBLISH_STOP) return [];
  const reason = String(response.reason ?? '').trim();
  if (!reason) return [`response/response.json: ${PUBLISH_STOP} carries the registry's own refusal as its reason; a stop nobody can read is a stop nobody can answer`];
  return credentialShaped(reason) ? [`response/response.json: ${PUBLISH_STOP} reason carries a credential-shaped value; the registry's answer is recorded, the credential that resolved it never is`] : [];
}
// `red` is every package phase that did not pass, the `before` regression excepted: it is meant to fail.
export const redPhases = (proofs = {}) => Object.entries(proofs).filter(([phase, proof]) => phase !== 'before' && proof && proof.exitCode !== 0).map(([phase]) => phase);
export function publicationErrors({ mode, publish, version, integrity }, record, proofs = {}) {
  const errors = [];
  const publication = record?.publication ?? {};
  if (publication.state === 'published') {
    if (mode !== 'publish') errors.push(`mode ${mode} sends no archive to a registry, so its release record cannot claim a publication`);
    if (!publication.registry) errors.push('a published release names the registry that serves it');
    if (publication.version !== version) errors.push('the published version is not the version this branch packed');
    if (publication.integrity !== integrity) errors.push('the published integrity is not the integrity of the archive this branch packed');
    const red = redPhases(proofs);
    if (red.length) errors.push(`the package proofs are red (${red.join(', ')}); a release published on proofs that did not pass is refused`);
    return errors;
  }
  if (mode === 'publish' && publish) errors.push(`mode publish ends at a published release: the packed archive reaches the registry the package manifest names, or the branch stops with ${PUBLISH_STOP}; a pending publication is the record of a request that preset publish false`);
  return errors;
}

// The consumer phases sit beside the package phases under their own prefix.
export const CONSUMER = 'consumer-';
export const consumerPhase = (phase) => `${CONSUMER}${phase}`;
export const bareConsumerPhase = (phase) => (phase.startsWith(CONSUMER) ? phase.slice(CONSUMER.length) : phase);
export const packagePhases = (plan) => ['before', 'after', ...plan.gates.map((g) => g.id)];
// Which shape the consume's before-and-after authority takes. A spec regression is run, so it has the
// `before` and `after` proof phases; an audit authority was already run by two branches of this
// session, so those two phases have nowhere to go and the gates are the only proofs this branch runs.
export const isAuditRegression = (regression) => regression?.kind === 'audit';
export const consumerPhases = (consumer) => [...(isAuditRegression(consumer.regression) ? [] : ['before', 'after']), ...consumer.gates.map((g) => g.id)].map(consumerPhase);
export const metadataPaths = (consumer) => [...consumer.manifests, consumer.lockfile];

// ---------------------------------------------------------------------------------------------------
// The package half.

export function planErrors(plan, manifest) {
  const errors = [];
  if (manifest.name !== plan.packageName || manifest.version !== plan.baseVersion) errors.push('package name/version differs from the frozen manifest');
  if (manifest.private === true || !(manifest.exports || manifest.main || manifest.module)) errors.push('the bound manifest does not identify a distributable owner library');
  if (plan.targetVersion !== nextPatch(plan.baseVersion)) errors.push('targetVersion must be exactly the next patch');
  const seen = new Set();
  for (const file of plan.files) {
    if (seen.has(file.path)) errors.push(`duplicate file: ${file.path}`); seen.add(file.path);
    if (!safeRelative(file.path)) errors.push(`unsafe file: ${file.path}`);
    // A package ships its behavior as script, or as the style sheet its recipes live in: both are behavior files a paired regression can read.
    if (file.kind === 'behavior' && (!/\.(?:[cm]?[jt]sx?|s?css)$/.test(file.path) || /\.(spec|test)\./.test(file.path))) errors.push(`invalid behavior file: ${file.path}`);
    if (file.kind === 'test' && !/\.(?:spec|test)\.[cm]?[jt]sx?$/.test(file.path)) errors.push(`invalid test file: ${file.path}`);
    if (file.kind === 'docs' && path.posix.basename(file.path) !== 'CHANGELOG.md') errors.push('only the package changelog is a docs write');
    if (file.kind === 'lockfile' && path.posix.basename(file.path) !== 'package-lock.json') errors.push('only package-lock.json metadata may be synchronized');
  }
  const behaviors = plan.files.filter((f) => f.kind === 'behavior').map((f) => f.path);
  const tests = plan.files.filter((f) => f.kind === 'test').map((f) => f.path);
  if (!behaviors.length || !tests.length) errors.push('a behavior repair needs source and regression test files');
  for (const pair of plan.pairs) if (!behaviors.includes(pair.source) || !tests.includes(pair.test)) errors.push('every pair must identify declared behavior and test files');
  for (const file of behaviors) if (!plan.pairs.some((p) => p.source === file)) errors.push(`unpaired source: ${file}`);
  for (const file of tests) if (!plan.pairs.some((p) => p.test === file)) errors.push(`unpaired test: ${file}`);
  const root = plan.packageRoot === '.' ? '' : `${plan.packageRoot}/`;
  if (!plan.files.some((f) => f.kind === 'manifest' && f.path === `${root}package.json`) || plan.files.filter((f) => f.kind === 'manifest').length !== 1) errors.push('exactly the owner package manifest must be declared');
  const gateIds = plan.gates.map((g) => g.id);
  if (new Set(gateIds).size !== gateIds.length || gateIds.some((id) => ['before', 'after'].includes(id))) errors.push('gate ids must be unique and not regression phases');
  const required = ['test', 'typecheck', 'build'].filter((name) => manifest.scripts?.[name]);
  if (!required.includes('test')) errors.push('the package must declare a complete test script');
  for (const name of required) if (!plan.gates.some((g) => g.command.kind === 'npm-script' && g.command.name === name && g.command.args.length === 0)) errors.push(`missing unfiltered package gate: ${name}`);
  for (const gate of plan.gates) if (gate.command.kind !== 'npm-script' || !manifest.scripts?.[gate.command.name] || gate.command.args.length) errors.push(`gate ${gate.id} must run a complete existing package script`);
  return errors;
}

// The consumer plan against the consumer's root manifest at the base and the lock it pins the package
// in: manifests are package.json files that pin the package at the base version, the regression is an
// existing source test outside the metadata set, and the gates are complete existing root scripts.
export function consumerPlanErrors(consumer, plan, rootManifest, { manifestAt = () => null, lockAt = () => null, exists = () => true } = {}) {
  const errors = [];
  const files = metadataPaths(consumer);
  if (new Set(files).size !== files.length) errors.push('metadata file paths must be distinct');
  for (const file of files) { if (!safeRelative(file)) errors.push(`unsafe metadata path: ${file}`); else if (!exists(file)) errors.push(`metadata must already exist at base: ${file}`); }
  for (const file of consumer.manifests) {
    if (path.posix.basename(file) !== 'package.json') errors.push('consumer manifest must be package.json');
    const manifest = manifestAt(file);
    if (manifest && manifest.dependencies?.[plan.packageName] !== plan.baseVersion) errors.push(`consumer manifest does not pin ${plan.packageName} at ${plan.baseVersion}: ${file}`);
  }
  const lock = lockAt(consumer.lockfile);
  if (lock && !lock.packages) errors.push('npm lock requires a packages map');
  // The ordinary authority is a consumer test that already exists and is not part of what this branch
  // writes. An audit authority names no file here at all: it names two branches of this session, and
  // `auditProofErrors` is where they are read.
  if (isAuditRegression(consumer.regression)) {
    if (!plan.family) errors.push(`an audit is the consume authority only for a presentation release, and the release this branch installs of ${plan.packageName} names no family; a package a consumer can call is proved by a consumer regression`);
    if (consumer.regression.before === consumer.regression.after) errors.push('the before and after audits must be two branches; one branch cannot have measured both versions');
  } else if (!safeRelative(consumer.regression.file) || files.includes(consumer.regression.file) || !exists(consumer.regression.file)) errors.push('regression must be an existing unchanged source test');
  const requiredScripts = ['test:ci', 'typecheck', 'lint:check', 'build'].filter((name) => rootManifest.scripts?.[name]);
  if (!rootManifest.scripts?.['test:ci'] && rootManifest.scripts?.test) requiredScripts.push('test');
  for (const name of requiredScripts) if (!consumer.gates.some((g) => g.command.kind === 'npm-script' && g.command.name === name && g.command.args.length === 0)) errors.push(`missing complete delivery gate: ${name}`);
  if (!requiredScripts.some((name) => name === 'test:ci' || name === 'test')) errors.push('consumer needs a complete test gate');
  if (new Set(consumer.gates.map((g) => g.id)).size !== consumer.gates.length || consumer.gates.some((g) => ['before', 'after'].includes(g.id))) errors.push('gate ids must be distinct from regression phases');
  for (const gate of consumer.gates) if (gate.command.kind !== 'npm-script' || gate.command.args.length || !rootManifest.scripts?.[gate.command.name]) errors.push(`gate must use a complete existing root script: ${gate.id}`);
  return errors;
}

// The release a `consume` branch installs, read from the library-release its request binds: the record
// against its schema, the archive it names inside the producing branch, and the digest against the
// bytes on disk. Nothing here resolves a package path, because a consumer route holds no package.
export function loadReleaseInput(root, session, ref) {
  if (!ref) throw new Error('mode consume installs a release, so the request binds a library-release input');
  const match = /^(step-\d+\/parallel-\d+)\/(response\/data\/[A-Za-z0-9_.-]+\.json)$/.exec(ref);
  if (!match) throw new Error(`library-release input must be a step-N/parallel-M release record: ${ref}`);
  const producer = safePath(session, match[1], false);
  const record = json(safePath(session, ref, false));
  const errors = validateAgainst(schema(root, 'library-release'), record, 'library-release');
  if (errors.length) throw new Error(errors.join('\n'));
  const archive = safePath(producer, record.artifact, false);
  if (integrityOf(readFileSync(archive)) !== record.digest) throw new Error('the bound library-release digest does not match the archive beside it');
  return { ref, producer, record, archive };
}

export async function loadContext(branch, root = ROOT) {
  const req = await validateRequest(root, branch);
  if (req.errors.length) throw new Error(req.errors.join('\n'));
  const request = req.request;
  const mode = modeOf(request);
  if (!MODES.includes(mode)) throw new Error(`mode must be one of ${MODES.join(', ')}`);
  const plan = request.requirements.plan ?? null;
  const consumer = request.requirements.consumer ?? null;
  const errors = [];
  if (runsPackageHalf(mode)) errors.push(...validateAgainst(schema(root, 'library-behavior-plan'), plan, 'plan'));
  else if (plan) errors.push(`mode ${mode} writes no package source, so it carries no plan`);
  if (runsConsumerHalf(mode)) errors.push(...validateAgainst(schema(root, 'dependency-plan'), consumer, 'consumer'));
  else if (consumer) errors.push(`mode ${mode} touches no consumer metadata, so it carries no consumer plan`);
  if (mode !== 'consume' && request.inputs['library-release']) errors.push(`mode ${mode} packs its own release, so it binds no library-release input`);
  errors.push(...publishFieldErrors(request));
  if (errors.length) throw new Error(errors.join('\n'));
  const session = sessionRootOf(branch);
  const routeRef = request.inputs.route;
  if (!session || !safeRelative(routeRef)) throw new Error('route must be a session-relative typed input');
  const route = json(safePath(session, routeRef, false));
  const routeErrors = validateAgainst(schema(root, 'route'), route, 'route');
  if (routeErrors.length) throw new Error(routeErrors.join('\n'));
  const routeCheckout = route.checkout.diskPath;
  const wantedBranch = `refs/heads/session/${request.sessionId}`;
  const worktrees = git(routeCheckout, ['worktree', 'list', '--porcelain']).split(/\r?\n\r?\n/).map((record) => Object.fromEntries(record.split(/\r?\n/).filter(Boolean).map((line) => { const split = line.indexOf(' '); return split < 0 ? [line, true] : [line.slice(0, split), line.slice(split + 1)]; })));
  const matches = worktrees.filter((record) => record.branch === wantedBranch && !record.bare);
  if (matches.length !== 1) throw new Error('exactly one worktree of the routed repository must own this session branch');
  const checkout = matches[0].worktree;
  const base = route.sourceHead;
  if (route.role !== 'fe' || route.mutationReadiness !== 'ready' || route.gitPolicy.worktreeBranches !== 'session-only') throw new Error('route is not a writable owner session binding');
  if (!request.contexts.some((c) => c.alias === '@workspaces/fe' && c.head === base)) throw new Error('frozen context must match the route base');
  if (git(checkout, ['branch', '--show-current']) !== `session/${request.sessionId}`) throw new Error('checkout is not this session branch');
  if (path.resolve(git(checkout, ['rev-parse', '--show-toplevel'])) !== path.resolve(checkout)) throw new Error('checkout must be the routed Git root');
  const writable = (file) => (route.writeRoots ?? []).some((r) => (r === '.' || safeRelative(r)) && inside(path.resolve(checkout, r), safePath(checkout, file)));
  const at = (file) => { const bytes = baseBytes(checkout, base, file); return bytes ? JSON.parse(bytes) : null; };
  // The package half of the binding. A mode that writes no package source resolves no package path,
  // so a consumer route that has never held the owner package is a lawful checkout here, not a
  // `missing path` before the first write.
  let packageDir = null, manifestPath = null, manifest = null, identity = plan, releaseInput = null;
  if (runsPackageHalf(mode)) {
    packageDir = plan.packageRoot === '.' ? checkout : safePath(checkout, plan.packageRoot, false);
    manifestPath = slash(path.relative(checkout, path.join(packageDir, 'package.json')));
    const original = baseBytes(checkout, base, manifestPath);
    if (!original) throw new Error('owner manifest must exist at the frozen base');
    manifest = JSON.parse(original);
    errors.push(...planErrors(plan, manifest));
    for (const file of plan.files) {
      const full = safePath(checkout, file.path);
      const specialLock = file.kind === 'lockfile' && file.path === plan.workspaceLockfile;
      if (!inside(packageDir, full) && !specialLock) errors.push(`file outside package: ${file.path}`);
      if (!writable(file.path)) errors.push(`file outside bound write roots: ${file.path}`);
      if (file.kind !== 'test' && !baseBytes(checkout, base, file.path)) errors.push(`only a new paired test may be created: ${file.path}`);
      if (!specialLock) {
        let parent = path.dirname(full);
        while (inside(packageDir, parent) && parent !== packageDir) {
          if (existsSync(path.join(parent, 'package.json'))) errors.push(`nested package boundary: ${file.path}`);
          parent = path.dirname(parent);
        }
      }
    }
    if (plan.workspaceLockfile && !plan.files.some((f) => f.path === plan.workspaceLockfile && f.kind === 'lockfile')) errors.push('workspaceLockfile must be in the exact file set');
  } else {
    // Under `consume` the package identity is the bound release's, and the version it moves from is
    // what every declared consumer manifest pins at the base: one pin, or the manifests disagree
    // about which package this route consumes.
    releaseInput = loadReleaseInput(root, session, request.inputs['library-release']);
    const pins = new Set((consumer.manifests ?? []).map((file) => at(file)?.dependencies?.[releaseInput.record.name]));
    if (pins.size !== 1 || pins.has(undefined)) errors.push(`the declared consumer manifests do not pin ${releaseInput.record.name} at one version at the frozen base`);
    const [baseVersion] = [...pins];
    if (baseVersion === releaseInput.record.version) errors.push('the consumer already pins the bound release version; there is nothing to consume');
    identity = { packageName: releaseInput.record.name, baseVersion, targetVersion: releaseInput.record.version, family: releaseInput.record.family ?? null };
  }
  // The consumer half: the root manifest names the gates, every metadata path exists at the base and is
  // writable, and a consumer manifest is never a file of the package half.
  let rootManifest = { scripts: {} };
  if (runsConsumerHalf(mode)) {
    const rootBytes = baseBytes(checkout, base, 'package.json');
    if (!rootBytes) errors.push('the consumer root manifest must exist at the frozen base');
    rootManifest = rootBytes ? JSON.parse(rootBytes) : { scripts: {} };
    errors.push(...consumerPlanErrors(consumer, identity, rootManifest, { manifestAt: at, lockAt: at, exists: (file) => Boolean(baseBytes(checkout, base, file)) }));
    for (const file of metadataPaths(consumer)) {
      if (!writable(file)) errors.push(`metadata path lacks route write authority: ${file}`);
      if (runsPackageHalf(mode) && plan.files.some((f) => f.path === file) && file !== plan.workspaceLockfile) errors.push(`metadata path is also a package file: ${file}`);
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return { root, branch, session, request, mode, publish: publishRequested(request), plan: identity, consumer, releaseInput, route, checkout, base, packageDir, manifestPath, manifest, rootManifest, planHash: runsPackageHalf(mode) ? hash(JSON.stringify(plan)) : null, consumerPlanHash: runsConsumerHalf(mode) ? hash(JSON.stringify(consumer)) : null };
}

export function snapshots(ctx) { return Object.fromEntries(ctx.plan.files.map(({ path: file }) => [file, fileHash(safePath(ctx.checkout, file))])); }
export function consumerSnapshots(ctx) { return Object.fromEntries(metadataPaths(ctx.consumer).map((file) => [file, hash(readFileSync(safePath(ctx.checkout, file, false)))])); }

// Dirty files outside the phase's own set. `phase` is `package` (the declared package files may be
// dirty), `consumer` (the metadata files may be dirty) or `pristine` (nothing may be).
export function worktreeErrors(ctx, { phase = 'package', head = ctx.base } = {}) {
  const errors = [];
  const dirty = git(ctx.checkout, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--no-renames']).split('\0').filter(Boolean).map((row) => row.slice(3));
  const allowed = new Set(phase === 'package' ? ctx.plan.files.map((f) => f.path) : phase === 'consumer' ? metadataPaths(ctx.consumer) : []);
  for (const file of dirty) if (!allowed.has(file)) errors.push(`dirty file outside the allowed phase: ${file}`);
  if (git(ctx.checkout, ['rev-parse', 'HEAD']) !== head) errors.push(`head differs from the ${phase === 'consumer' ? 'package commit' : 'base'} this phase runs on`);
  return errors;
}

export function presentationProjection(ts, text, file) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if (source.parseDiagnostics.length) throw new Error(`cannot parse behavior source: ${file}`);
  const result = [];
  const valueNames = new Set();
  const collectNames = (node) => { if (ts.isIdentifier(node)) valueNames.add(node.text); ts.forEachChild(node, collectNames); };
  const visit = (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxClosingElement(node)) result.push(`${node.kind}:${node.tagName.getText(source)}`);
    if (ts.isJsxText(node)) result.push(`text:${node.getText(source).trim()}`);
    // The projection is what a node paints and how the tree is shaped: its classes, its inline style, its tag
    // and its text. A `data-contract` claim is what the node says it paints, proved by the package's own claim
    // gate and by the audit that measures the node; correcting a claim the render contradicts is the repair a
    // grammar gap asks of the owner, so a claim is not frozen here.
    if (ts.isJsxAttribute(node) && ['className', 'style'].includes(node.name.getText(source))) { result.push(node.getText(source)); collectNames(node); }
    if ((ts.isPropertyAssignment(node) || ts.isPropertyDeclaration(node)) && /^(?:className|style|styles|css|sx)$/.test(node.name?.getText(source) ?? '')) result.push(node.getText(source));
    if (ts.isImportDeclaration(node) && /\.(?:css|scss|sass|less)["']$/.test(node.moduleSpecifier.getText(source))) result.push(node.getText(source));
    if (ts.isBinaryExpression(node) && /\.(?:className|style|classList)(?:\.|\[|$)/.test(node.left.getText(source))) result.push(node.getText(source));
    if (ts.isCallExpression(node)) {
      const call = node.expression.getText(source);
      if (/\.(?:createElement|appendChild|prepend|append|replaceChildren|insertBefore|removeChild)$/.test(call) || /\.classList\./.test(call)) result.push(node.getText(source));
      if (/\.(?:setAttribute|removeAttribute)$/.test(call) && node.arguments[0] && /^['"](?:class|style)['"]$/.test(node.arguments[0].getText(source))) result.push(node.getText(source));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  const recorded = new Set();
  const visitValues = (node) => {
    if (ts.isVariableDeclaration(node) && valueNames.has(node.name.getText(source)) && node.initializer && !recorded.has(node.name.getText(source))) { recorded.add(node.name.getText(source)); result.push(node.getText(source)); collectNames(node.initializer); }
    ts.forEachChild(node, visitValues);
  };
  let previous;
  do { previous = recorded.size; visitValues(source); } while (previous !== recorded.size);
  return result;
}

export function changeErrors(ctx) {
  const errors = [];
  const current = json(safePath(ctx.checkout, ctx.manifestPath, false));
  const expected = { ...ctx.manifest, version: ctx.plan.targetVersion };
  if (!same(current, expected)) errors.push('manifest may change only to the next patch version');
  const require = createRequire(path.join(ctx.packageDir, 'package.json'));
  const ts = require('typescript');
  for (const file of ctx.plan.files) {
    const full = safePath(ctx.checkout, file.path, false);
    const old = baseBytes(ctx.checkout, ctx.base, file.path);
    // A script repair changes no presentation: its projection stays what it was. A style sheet is the presentation
    // the family ships as its law (planErrors admits it as a behavior file), so the sheet itself is the repair and no
    // script projection reads it.
    if (file.kind === 'behavior' && /\.[cm]?[jt]sx?$/.test(file.path) && !same(presentationProjection(ts, old.toString(), file.path), presentationProjection(ts, readFileSync(full, 'utf8'), file.path))) errors.push(`presentation changed in behavior repair: ${file.path}`);
    if (file.kind === 'lockfile') {
      const original = JSON.parse(old);
      const expectedLock = structuredClone(original);
      const key = file.path === ctx.plan.workspaceLockfile ? (ctx.plan.packageRoot === '.' ? '' : ctx.plan.packageRoot) : '';
      if (!expectedLock.packages?.[key]) { errors.push('lockfile must already declare the owner package'); continue; }
      expectedLock.packages[key].version = ctx.plan.targetVersion;
      if (key === '' && Object.hasOwn(expectedLock, 'version')) expectedLock.version = ctx.plan.targetVersion;
      if (!same(json(full), expectedLock)) errors.push('lockfile may change only the owner package version metadata');
    }
  }
  return errors;
}

export function resolveCommand(ctx, command, manifest = ctx.manifest, dir = ctx.packageDir) {
  if (command.kind === 'npm-script') {
    const body = manifest.scripts?.[command.name];
    if (!body) throw new Error('command is not an existing package script');
    const require = createRequire(path.join(process.execPath, '..', 'node_modules', 'npm', 'package.json'));
    let npmCli;
    for (const candidate of [process.env.npm_execpath, path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')]) if (candidate && existsSync(candidate) && path.basename(candidate) === 'npm-cli.js') { npmCli = candidate; break; }
    if (!npmCli) { try { npmCli = require.resolve('npm/bin/npm-cli.js'); } catch { throw new Error('npm CLI JS path unavailable; do not substitute a shell command'); } }
    return { exe: process.execPath, args: [npmCli, 'run', command.name, '--', ...command.args], commandHash: hash(body) };
  }
  if (!manifest.devDependencies?.[command.name] && !manifest.dependencies?.[command.name]) throw new Error('regression binary must be a declared package dependency');
  const require = createRequire(path.join(dir, 'package.json'));
  const metadataFile = require.resolve(`${command.name}/package.json`);
  const metadata = json(metadataFile);
  const bin = typeof metadata.bin === 'string' ? metadata.bin : metadata.bin?.[command.name];
  if (!bin || !safeRelative(bin.replace(/^\.\//, ''))) throw new Error('package binary is not declared');
  const binary = path.resolve(path.dirname(metadataFile), bin);
  return { exe: process.execPath, args: [binary, ...command.args], commandHash: hash(readFileSync(binary)) };
}
export const consumerCommand = (ctx, command) => resolveCommand(ctx, command, ctx.rootManifest, ctx.checkout);
export const proofEnvironment = (ctx, command) => (command.kind === 'npm-script' && command.name === 'test:ci' ? { COVERAGE_BASE_SHA: ctx.packageCommit ?? ctx.base } : {});

export function proofErrors(ctx, proofs, finalHashes) {
  const errors = [];
  for (const phase of packagePhases(ctx.plan)) {
    const proof = proofs[phase];
    if (!proof) { errors.push(`missing proof: ${phase}`); continue; }
    errors.push(...validateAgainst(schema(ctx.root, 'library-proof'), proof, `proof.${phase}`));
    const command = ['before', 'after'].includes(phase) ? ctx.plan.regression.command : ctx.plan.gates.find((g) => g.id === phase).command;
    if (proof.phase !== phase || !same(proof.command, command) || proof.commandHash !== resolveCommand(ctx, command).commandHash || proof.planHash !== ctx.planHash || proof.base !== ctx.base) errors.push(`proof binding mismatch: ${phase}`);
    if (proof.head !== ctx.base) errors.push(`proof must run before the single delivery commit: ${phase}`);
    let output = '';
    try {
      if (proof.outputRef !== `response/artifacts/proofs/${phase}.log`) throw new Error('unexpected log reference');
      output = readFileSync(safePath(ctx.branch, proof.outputRef, false), 'utf8');
    } catch { errors.push(`missing or unsafe proof log: ${phase}`); }
    if (proof.outputHash !== hash(output) || !output.trim()) errors.push(`missing or changed proof output: ${phase}`);
    const start = Date.parse(proof.startedAt), end = Date.parse(proof.finishedAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) errors.push(`invalid proof timestamps: ${phase}`);
    if (phase === 'before') {
      if (proof.exitCode <= 0 || !regressionFailed(output, ctx.plan.regression.assertion)) errors.push('before proof must fail on the declared regression assertion');
      for (const file of ctx.plan.files) {
        const expected = file.kind === 'test' ? finalHashes[file.path] : hash(baseWorkingBytes(ctx.checkout, ctx.base, file.path));
        if (proof.files[file.path] !== expected) errors.push(`before proof tested different source/test bytes: ${file.path}`);
      }
    } else {
      if (proof.exitCode !== 0) errors.push(`gate did not pass: ${phase}`);
      if (!same(proof.files, finalHashes)) errors.push(`proof is stale: ${phase}`);
    }
  }
  if (proofs.before && proofs.after && Date.parse(proofs.before.finishedAt) > Date.parse(proofs.after.startedAt)) errors.push('before proof must precede after proof');
  return errors;
}

// ---------------------------------------------------------------------------------------------------
// The consumer half.

const packageEntry = (key, name) => key === `node_modules/${name}` || key.endsWith(`/node_modules/${name}`);
const canonical = (value) => (value && typeof value === 'object' ? Array.isArray(value) ? value.map(canonical) : Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value);
const equalJson = (a, b) => same(canonical(a), canonical(b));
const workspaceKey = (file) => (path.posix.dirname(file) === '.' ? '' : path.posix.dirname(file));

// The metadata delta: the pin moves in every consumer manifest and in the lock's workspace entries, an
// installed entry of the package carries the bumped version under the release integrity (a workspace
// link entry stays exactly what it was), and nothing else in the lock changes. `release` is
// { version, integrity } of the tarball this run packed.
export function metadataErrors({ packageName, fromVersion, toVersion, manifests, release }, oldManifests, newManifests, oldLock, newLock) {
  const errors = [];
  for (const file of manifests) {
    const old = oldManifests[file], current = newManifests[file];
    if (old?.dependencies?.[packageName] !== fromVersion) { errors.push(`old dependency pin does not match: ${file}`); continue; }
    const expected = structuredClone(old); expected.dependencies[packageName] = toVersion;
    if (!equalJson(expected, current)) errors.push(`manifest changed outside the named dependency: ${file}`);
  }
  const remainingOld = structuredClone(oldLock), remainingNew = structuredClone(newLock);
  if (!remainingOld.packages || !remainingNew.packages) return [...errors, 'npm lock requires a packages map'];
  for (const file of manifests) {
    const key = workspaceKey(file);
    if (remainingOld.packages[key]?.dependencies?.[packageName] !== fromVersion || remainingNew.packages[key]?.dependencies?.[packageName] !== toVersion) errors.push(`lock workspace pin differs: ${file}`);
    if (remainingOld.packages[key]?.dependencies) delete remainingOld.packages[key].dependencies[packageName];
    if (remainingNew.packages[key]?.dependencies) delete remainingNew.packages[key].dependencies[packageName];
  }
  const oldEntries = Object.entries(oldLock.packages).filter(([key]) => packageEntry(key, packageName));
  const targetEntries = [];
  for (const [key, value] of Object.entries(newLock.packages)) if (packageEntry(key, packageName)) {
    const original = oldLock.packages[key];
    if (original && equalJson(original, value)) { if (value.link === true) targetEntries.push(key); delete remainingOld.packages[key]; delete remainingNew.packages[key]; continue; }
    if (value.link === true) { errors.push(`a workspace link entry changed: ${key}`); continue; }
    if (value.version !== toVersion || value.integrity !== release.integrity) errors.push(`new lock entry is not the packed release: ${key}`);
    const stripped = structuredClone(value); delete stripped.version; delete stripped.resolved; delete stripped.integrity;
    const identicalMetadata = oldEntries.some(([, old]) => { const source = structuredClone(old); delete source.version; delete source.resolved; delete source.integrity; return equalJson(stripped, source); });
    if (!identicalMetadata) errors.push(`new package metadata changes dependency closure: ${key}`);
    targetEntries.push(key); delete remainingNew.packages[key]; if (original) delete remainingOld.packages[key];
  }
  for (const [key] of oldEntries) if (!newLock.packages[key]) errors.push(`an existing package installation was removed: ${key}`);
  if (!targetEntries.length) errors.push('lock contains no installed entry of the consumed package');
  // The package's own workspace entry moved to the next patch in the package commit; that move is the
  // package half's and is not a consumer change.
  for (const [key, value] of Object.entries(remainingNew.packages)) {
    const old = remainingOld.packages[key];
    if (old && value?.name === packageName && old.version === fromVersion && value.version === toVersion && equalJson({ ...old, version: toVersion }, value)) { delete remainingOld.packages[key]; delete remainingNew.packages[key]; }
  }
  if (!equalJson(remainingOld, remainingNew)) errors.push('lock changed another dependency or package-manager option');
  return errors;
}

// tar is run beside the archive on its base name: a GNU tar on Windows reads a drive letter in an absolute path as a remote host.
const tarAt = (artifact) => ({ file: path.basename(artifact), cwd: path.dirname(artifact) });
export const archiveFile = (artifact, file) => { const t = tarAt(artifact); return execFileSync('tar', ['-xOf', t.file, file], { cwd: t.cwd, windowsHide: true, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }); };
export const releaseFileName = (plan) => `${plan.packageName.replace(/^@/, '').replace('/', '-')}-${plan.targetVersion}.tgz`;
export const releaseRef = (plan) => `response/artifacts/release/${releaseFileName(plan)}`;

// The packed release: a safe tarball whose package.json names the package at the bumped version.
export function releaseErrors(ctx, artifact) {
  const errors = [];
  if (!existsSync(artifact)) return [`packed release is missing: ${releaseRef(ctx.plan)}`];
  const verbose = execFileSync('tar', ['-tvf', tarAt(artifact).file], { cwd: tarAt(artifact).cwd, encoding: 'utf8', windowsHide: true });
  if (verbose.split(/\r?\n/).some((line) => /^[lh]/.test(line))) errors.push('release tarball cannot contain linked entries');
  const entries = execFileSync('tar', ['-tf', tarAt(artifact).file], { cwd: tarAt(artifact).cwd, encoding: 'utf8', windowsHide: true }).split(/\r?\n/).filter((file) => file && !file.endsWith('/'));
  if (entries.some((file) => !file.startsWith('package/') || !safeRelative(file.slice(8)))) errors.push('release tarball has an unsafe package path');
  let packaged = null;
  try { packaged = JSON.parse(archiveFile(artifact, 'package/package.json')); } catch { errors.push('release tarball carries no package.json'); }
  if (packaged && (packaged.name !== ctx.plan.packageName || packaged.version !== ctx.plan.targetVersion)) errors.push('packed release carries a different package or version');
  return { errors, entries };
}

// What the consumer resolves the package to, and, after the release, that every packed file is
// installed byte for byte.
export function installedIdentity(ctx, phase, artifact) {
  const identities = {};
  let entries = [];
  if (phase !== 'before') { const r = releaseErrors(ctx, artifact); if (r.errors?.length) throw new Error(r.errors.join('\n')); entries = r.entries; }
  for (const file of ctx.consumer.manifests) {
    const require = createRequire(safePath(ctx.checkout, file, false));
    const packageManifest = require.resolve(`${ctx.plan.packageName}/package.json`);
    const metadata = json(packageManifest), expected = phase === 'before' ? ctx.plan.baseVersion : ctx.plan.targetVersion;
    if (metadata.name !== ctx.plan.packageName || metadata.version !== expected) throw new Error(`consumer resolves wrong package version: ${file}`);
    const resolvedDir = realpathSync(path.dirname(packageManifest));
    if (phase !== 'before') for (const entry of entries) { const installed = safePath(resolvedDir, entry.slice(8), false); if (hash(readFileSync(installed)) !== hash(archiveFile(artifact, entry))) throw new Error(`installed package bytes differ from the packed release: ${entry}`); }
    identities[file] = { name: metadata.name, version: metadata.version, integrity: phase === 'before' ? null : ctx.release.integrity };
  }
  return identities;
}

export function consumerChangeErrors(ctx) {
  const oldManifests = Object.fromEntries(ctx.consumer.manifests.map((file) => [file, JSON.parse(baseBytes(ctx.checkout, ctx.packageCommit, file))]));
  const newManifests = Object.fromEntries(ctx.consumer.manifests.map((file) => [file, json(safePath(ctx.checkout, file, false))]));
  return metadataErrors({ packageName: ctx.plan.packageName, fromVersion: ctx.plan.baseVersion, toVersion: ctx.plan.targetVersion, manifests: ctx.consumer.manifests, release: ctx.release }, oldManifests, newManifests, JSON.parse(baseBytes(ctx.checkout, ctx.packageCommit, ctx.consumer.lockfile)), json(safePath(ctx.checkout, ctx.consumer.lockfile, false)));
}

// The audit-shaped before-and-after half of a `consume`. A presentation release repairs behaviour that
// exists only once rendered, so a consumer that calls none of it has no spec to fail before and pass
// after — and writing one to satisfy the shape proves the stamp, not the surface. Two audits of that
// surface are the proof instead: one at the version the consumer still runs, where the family's own
// claims fail and are routed to the family owner as a grammar gap, and one at the version this branch
// bumped to, where the same claims pass. Both are branches of this session, so both were already held
// to `interface.audit`'s own law; what is checked here is that they are the two halves of this
// consume — the same claims, the two versions, and the after-audit measuring the commit this branch
// made rather than some other head.
export function auditProofErrors(ctx, { session = ctx.session, branchOf = (ref) => safePath(session, ref, true) } = {}) {
  const errors = [];
  const { claims, before, after } = ctx.consumer.regression;
  const halves = { before: { ref: before, version: ctx.plan.baseVersion }, after: { ref: after, version: ctx.plan.targetVersion } };
  for (const [half, { ref, version }] of Object.entries(halves)) {
    let dir; try { dir = branchOf(ref); } catch { errors.push(`the ${half} audit ${ref} is not a branch of this session`); continue; }
    let verdicts, receipt;
    try { verdicts = json(path.join(dir, 'response', 'data', 'verdicts.json')); } catch { errors.push(`the ${half} audit ${ref} has no verdicts to read`); continue; }
    try { receipt = readFileSync(path.join(dir, 'response', 'response.md'), 'utf8'); } catch { errors.push(`the ${half} audit ${ref} has no receipt to read`); continue; }
    const served = Object.fromEntries((tableUnder(receipt, '## Served surface') ?? []).map(([k, v]) => [k, String(v ?? '').replace(/^`|`$/g, '').trim()]));
    if (served['Family version observed'] !== version) errors.push(`the ${half} audit ${ref} observed family version ${served['Family version observed'] ?? '—'} and this consume moves ${ctx.plan.baseVersion} to ${ctx.plan.targetVersion}; a half that measured another version proves nothing about this one`);
    const results = (verdicts.entries ?? []).flatMap((e) => e.results ?? []).filter((r) => r.owner === 'grammar' && claims.includes(r.rule));
    for (const claim of claims) {
      const found = results.filter((r) => r.rule === claim);
      if (!found.length) { errors.push(`the ${half} audit ${ref} carries no family-owned result for ${claim}; both halves judge the same claims or they are not two halves of one proof`); continue; }
      if (half === 'before') {
        if (!found.some((r) => r.verdict === 'fail')) errors.push(`${claim} passes on the before audit ${ref}; the before half is the gap this release repairs, and a claim that already passed was never repaired here`);
        if (!found.some((r) => r.verdict === 'fail' && r.routeTo === 'grammar-gap')) errors.push(`${claim} fails on the before audit ${ref} and is not routed to the family owner as a grammar gap; a claim the delivery owns is not a reason to consume a release`);
      } else if (found.some((r) => r.verdict === 'fail')) errors.push(`${claim} still fails on the after audit ${ref}; the release did not repair what this consume says it repaired`);
    }
    if (half === 'after' && served['Applied commit'] !== ctx.consumerCommit) errors.push(`the after audit ${ref} measured the surface at applied commit ${served['Applied commit'] ?? '—'} and this branch committed ${ctx.consumerCommit}; the after half is the bumped head or it is an audit of something else`);
  }
  return errors;
}

export function consumerProofErrors(ctx, proof, phase, finalHashes) {
  const errors = validateAgainst(schema(ctx.root, 'dependency-proof'), proof, `proof.${phase}`);
  const bare = bareConsumerPhase(phase);
  const command = ['before', 'after'].includes(bare) ? ctx.consumer.regression.command : ctx.consumer.gates.find((g) => g.id === bare).command;
  if (proof.phase !== phase || proof.base !== ctx.packageCommit || proof.planHash !== ctx.consumerPlanHash || !same(proof.command, command) || proof.commandHash !== consumerCommand(ctx, command).commandHash) errors.push(`proof binding differs: ${phase}`);
  if (!same(proof.environment ?? {}, proofEnvironment(ctx, command))) errors.push(`proof coverage base differs: ${phase}`);
  // An audit authority has no consumer file to bind a gate proof to: the two audits are the before and
  // after, and what is unchanged about them is the claims, checked in auditProofErrors.
  if (isAuditRegression(ctx.consumer.regression)) {
    if (proof.regressionHash !== null) errors.push(`the consume is proved by two audits, so ${phase} binds no consumer regression file and its regressionHash is null`);
  } else if (proof.regressionHash !== hash(baseWorkingBytes(ctx.checkout, ctx.packageCommit, ctx.consumer.regression.file))) errors.push('proof did not use the unchanged regression');
  if (proof.outputRef !== `response/artifacts/proofs/${phase}.log`) errors.push('proof log must belong to its phase');
  let output = ''; try { output = readFileSync(safePath(ctx.branch, proof.outputRef, false), 'utf8'); } catch { errors.push(`missing proof log: ${phase}`); }
  if (!output.trim() || hash(output) !== proof.outputHash) errors.push(`proof output missing or changed: ${phase}`);
  const expectedHashes = bare === 'before' ? Object.fromEntries(metadataPaths(ctx.consumer).map((file) => [file, hash(baseWorkingBytes(ctx.checkout, ctx.packageCommit, file))])) : finalHashes;
  if (!same(proof.files, expectedHashes)) errors.push(`stale dependency metadata proof: ${phase}`);
  for (const file of ctx.consumer.manifests) { const identity = proof.installed?.[file]; if (identity?.name !== ctx.plan.packageName || identity?.version !== (bare === 'before' ? ctx.plan.baseVersion : ctx.plan.targetVersion) || (bare !== 'before' && identity?.integrity !== ctx.release.integrity)) errors.push(`proof installed package mismatch: ${phase}`); }
  if (bare === 'before' ? (proof.exitCode <= 0 || !regressionFailed(output, ctx.consumer.regression.assertion)) : proof.exitCode !== 0) errors.push(`required regression/gate outcome not proved: ${phase}`);
  const start = Date.parse(proof.startedAt), end = Date.parse(proof.finishedAt); if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) errors.push('invalid proof timing');
  return errors;
}

// The release the consumer half installs, and the commit that half runs on — `packageCommit`, because
// under `full` and `publish` it is the package delivery this branch committed. Under `consume` no
// package half ran here: the release is the bound library-release of another branch, its archive sits
// beside that record, and the commit the consumer half starts from is the frozen route base.
export function bindRelease(ctx) {
  if (runsPackageHalf(ctx.mode)) {
    const delivery = json(path.join(ctx.branch, 'response/data/library.json'));
    ctx.packageCommit = delivery.commit;
    ctx.artifact = path.join(ctx.branch, releaseRef(ctx.plan));
    ctx.release = { version: ctx.plan.targetVersion, integrity: existsSync(ctx.artifact) ? integrityOf(readFileSync(ctx.artifact)) : null, artifact: releaseRef(ctx.plan) };
    return ctx;
  }
  ctx.packageCommit = ctx.base;
  ctx.artifact = ctx.releaseInput.archive;
  ctx.release = { version: ctx.releaseInput.record.version, integrity: ctx.releaseInput.record.digest, artifact: ctx.releaseInput.record.artifact };
  return ctx;
}

// ---------------------------------------------------------------------------------------------------
// The whole branch.

export async function validateLibraryUpdateStep(branch, root = ROOT, preflight = false) {
  const errors = [];
  try {
    // A blocked branch is judged on its stop, not on the checkout its plan could not resolve: the shared
    // step check and the status come first, and the context is loaded only for a done receipt or a preflight.
    const base = preflight ? null : await validateStep(root, branch);
    if (base) {
      errors.push(...base.errors);
      if (base.response?.status !== 'done') { errors.push(...publishStopErrors(base.response)); return { errors }; }
    }
    const ctx = await loadContext(branch, root);
    if (preflight) return { errors: worktreeErrors(ctx, { phase: 'pristine' }) };
    const fields = base.response.fields ?? {};
    // The receipt carries the sections of the halves this mode ran, and no others.
    errors.push(...modeSectionErrors(ctx.mode, fields));
    const commits = base.response.commits ?? [];
    const expectedCommits = ctx.mode === 'full' ? 2 : 1;
    if (commits.length !== expectedCommits) errors.push(`response.json records ${commits.length} commits; mode ${ctx.mode} commits ${expectedCommits === 2 ? 'the package delivery and then the consumer metadata, in that order' : ctx.mode === 'publish' ? 'the package delivery alone' : 'the consumer metadata alone'}`);
    let declared = [];
    let packageCommit = null;
    const proofs = {};
    // The package half.
    if (runsPackageHalf(ctx.mode)) {
      const delivery = json(path.join(branch, 'response/data/library.json'));
      packageCommit = commits[0];
      if (delivery.commit !== packageCommit || delivery.base !== ctx.base || delivery.planHash !== ctx.planHash || delivery.packageName !== ctx.plan.packageName) errors.push('package delivery does not match the committed plan');
      if (git(ctx.checkout, ['rev-list', '--parents', '-n', '1', packageCommit]) !== `${packageCommit} ${ctx.base}`) errors.push('package delivery must be exactly one single-parent commit after the base');
      const changed = git(ctx.checkout, ['diff', '--name-only', '--no-renames', ctx.base, packageCommit]).split('\n').filter(Boolean).sort();
      declared = ctx.plan.files.map((f) => f.path).sort();
      if (!same(changed, declared)) errors.push('package Git changes must equal the exact declared file set');
      const finalHashes = Object.fromEntries(ctx.plan.files.map(({ path: file }) => { const bytes = baseWorkingBytes(ctx.checkout, packageCommit, file); return [file, bytes ? hash(bytes) : null]; }));
      if (!same(delivery.files.map((f) => f.path).sort(), declared)) errors.push('delivery file set differs from plan');
      for (const file of delivery.files) {
        const old = baseBytes(ctx.checkout, ctx.base, file.path);
        if (file.before !== (old ? hash(old) : null) || file.after !== finalHashes[file.path]) errors.push(`delivery hash mismatch: ${file.path}`);
      }
      const expectedRefs = packagePhases(ctx.plan).map((phase) => `response/data/proofs/${phase}.json`);
      if (!same([...delivery.proofs].sort(), [...expectedRefs].sort()) || !same([...(fields['library-proof'] ?? [])].sort(), [...expectedRefs].sort())) errors.push('delivery and response must list the complete package proof set');
      for (const ref of expectedRefs) if (existsSync(path.join(branch, ref))) proofs[path.basename(ref, '.json')] = json(path.join(branch, ref));
      // Package proofs ran on the working tree before the package commit; the committed bytes are what
      // they must have measured.
      errors.push(...proofErrors(ctx, proofs, finalHashes));
    }
    // The release: packed here under the package half, bound from another branch under `consume`.
    bindRelease(ctx);
    if (runsPackageHalf(ctx.mode)) {
      if (fields['library-archive'] !== releaseRef(ctx.plan)) errors.push(`response must list the packed archive as ${releaseRef(ctx.plan)}`);
      if (fields['library-release'] !== RELEASE_RECORD_REF) errors.push(`response must list the release record as ${RELEASE_RECORD_REF}`);
      const record = json(path.join(branch, RELEASE_RECORD_REF));
      if (record.name !== ctx.plan.packageName || record.version !== ctx.plan.targetVersion || record.artifact !== releaseRef(ctx.plan) || record.packageCommit !== packageCommit || record.digest !== ctx.release.integrity) errors.push('the release record does not identify the archive this branch packed from its package commit');
      errors.push(...publicationErrors({ mode: ctx.mode, publish: ctx.publish, version: ctx.plan.targetVersion, integrity: ctx.release.integrity }, record, proofs));
    }
    const release = releaseErrors(ctx, ctx.artifact);
    errors.push(...(release.errors ?? release));
    // The consumer half.
    if (runsConsumerHalf(ctx.mode)) {
      const consumerCommit = commits[expectedCommits - 1];
      const consumerDelivery = json(path.join(branch, 'response/data/dependency.json'));
      if (consumerDelivery.base !== ctx.packageCommit || consumerDelivery.commit !== consumerCommit || consumerDelivery.planHash !== ctx.consumerPlanHash) errors.push('consumer delivery binding mismatch');
      if (consumerDelivery.release?.integrity !== ctx.release.integrity || consumerDelivery.release?.version !== ctx.plan.targetVersion || consumerDelivery.release?.artifact !== ctx.release.artifact) errors.push('consumer delivery does not name the release this branch consumed');
      if (git(ctx.checkout, ['rev-list', '--parents', '-n', '1', consumerCommit]) !== `${consumerCommit} ${ctx.packageCommit}`) errors.push(`consumer delivery must be exactly one single-parent commit after the ${ctx.mode === 'consume' ? 'frozen base' : 'package commit'}`);
      if (git(ctx.checkout, ['rev-parse', 'HEAD']) !== consumerCommit) errors.push('the session branch head is not the consumer commit');
      const consumerChanged = git(ctx.checkout, ['diff', '--name-only', '--no-renames', ctx.packageCommit, consumerCommit]).split('\n').filter(Boolean).sort();
      if (!same(consumerChanged, metadataPaths(ctx.consumer).sort())) errors.push('consumer Git diff changed outside the exact dependency metadata set');
      errors.push(...consumerChangeErrors(ctx));
      installedIdentity(ctx, 'after', ctx.artifact);
      const hashes = consumerSnapshots(ctx);
      if (!same(consumerDelivery.files, hashes)) errors.push('consumer delivery metadata hashes differ');
      const phases = consumerPhases(ctx.consumer);
      const refs = phases.map((phase) => `response/data/proofs/${phase}.json`), logs = phases.map((phase) => `response/artifacts/proofs/${phase}.log`);
      if (!same([...consumerDelivery.proofs].sort(), [...refs].sort()) || !same([...(fields['dependency-proof'] ?? [])].sort(), [...refs].sort()) || !same([...(fields['dependency-log'] ?? [])].sort(), [...logs].sort())) errors.push('response must declare every consumer proof and log');
      const consumerProofs = {};
      for (const phase of phases) { const proof = json(path.join(branch, `response/data/proofs/${phase}.json`)); consumerProofs[phase] = proof; errors.push(...consumerProofErrors(ctx, proof, phase, hashes)); }
      if (isAuditRegression(ctx.consumer.regression)) {
        ctx.consumerCommit = consumerCommit;
        errors.push(...auditProofErrors(ctx));
      } else if (Date.parse(consumerProofs[consumerPhase('before')].finishedAt) > Date.parse(consumerProofs[consumerPhase('after')].startedAt)) errors.push('consumer before proof must precede consumer after proof');
    } else if (git(ctx.checkout, ['rev-parse', 'HEAD']) !== packageCommit) errors.push('the session branch head is not the package commit');
    if (git(ctx.checkout, ['status', '--porcelain=v1', '--untracked-files=all'])) errors.push('delivery working tree must be clean');
    const md = readFileSync(path.join(branch, 'response/changes.md'), 'utf8');
    // What the branch did to the checkout, beside what it wrote into it: the preflight that ran before
    // the first write, and the reflog entries the checkout gained while the branch held it — its own
    // one or two commits and nothing else (scripts/workspace-checkout.mjs#sourceWriteErrors,
    // orchestrator.json#sourceWrites).
    errors.push(...sourceWriteErrors({
      at: 'response/changes.md', binding: Object.fromEntries(tableUnder(md, '## Binding') ?? []),
      base: ctx.base, branch: `session/${ctx.request.sessionId}`, commits, checkout: ctx.checkout,
    }));
    const receiptFiles = [...new Set([...declared, ...(runsConsumerHalf(ctx.mode) ? metadataPaths(ctx.consumer) : [])])].sort();
    if (!same((tableUnder(md, '## Files') ?? []).map(([file]) => file).sort(), receiptFiles)) errors.push('changes receipt differs from the file sets this mode committed');
  } catch (error) { errors.push(error.message); }
  return { errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const branch = process.argv[2];
  if (!branch) { process.stderr.write('usage: node validate.mjs <branch> [--preflight]\n'); process.exitCode = 2; }
  else { const { errors } = await validateLibraryUpdateStep(path.resolve(branch), ROOT, process.argv.includes('--preflight')); if (errors.length) { process.stderr.write(errors.join('\n') + '\n'); process.exitCode = 1; } else process.stdout.write('valid library.update branch\n'); }
}
