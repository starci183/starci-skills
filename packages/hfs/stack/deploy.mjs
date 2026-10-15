// deploy.mjs - the whole release (deployRelease) and the redeploy of a stored release (rollbackRelease).
// deploy: render, provision, store the release record, pre-pull, `docker stack deploy`, converge, verify, accept, prune. A failure at or
// after the stack deploy redeploys the previous accepted release from its STORED bytes; a failure before it leaves the services untouched.
// Without `execute` a deploy renders locally and prints the plan: NO remote call at all. A rollback cannot undo data effects.
//
// `deps` are the collaborators, all factories or functions with the signature of their module, defaulting to lazy dynamic imports so this
// module never needs render.mjs / provision.mjs / remote.mjs at load time (the specs inject stubs):
//   renderRelease, provisionRelease, convergeStack, verifyStack, pruneStack     (ctx, config, options) -> { ok, lines, data }
//   releaseStore  (config, ssh) -> store          ssh  (ctx, config, { sshCmd }) -> runner(command, { input })
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findInOrder } from '../runtime/scripts/lib/in-order.mjs';
import { convergeStack } from './converge.mjs';
import { firstLine, tool } from './context.mjs';
import { hasPlaceholderDigest, isReleaseId } from './digest.mjs';
import { failure, refusal } from './errors.mjs';
import { pruneStack } from './prune.mjs';
import { createReleaseStore } from './release-store.mjs';
import { verifyStack } from './verify.mjs';

/** Loads `file` (relative to this module). Split out so a spec can load a real sibling module through `lazy`. */
export const importModule = (file) => import(file);

/** A function that imports `file` on first call and forwards its arguments to the export `name`. */
export const lazy = (file, name) => async (...args) => (await importModule(file))[name](...args);

export const DEFAULT_DEPS = Object.freeze({
  renderRelease: lazy('./render.mjs', 'renderRelease'),
  provisionRelease: lazy('./provision.mjs', 'provisionRelease'),
  convergeStack,
  verifyStack,
  pruneStack,
  releaseStore: createReleaseStore,
  ssh: lazy('./remote.mjs', 'sshRunner'),
});

const IMAGE_LINE = /^[ \t]+image:[ \t]*(\S+)[ \t]*$/gmu;
const QUOTE = /^["']|["']$/gu;
const IMAGE_REF = /^[A-Za-z0-9][A-Za-z0-9./_:@-]*$/u;

/** The release id (first 16 hex of the sha256 of the rendered stack bytes) and the distinct images of a rendered release. */
function inspectRendered(out) {
  const bytes = fs.readFileSync(path.join(out, 'stack.yaml'), 'utf8');
  if (hasPlaceholderDigest(bytes)) throw refusal('STACK_DEPLOY_PLACEHOLDER', 'the rendered stack still carries a placeholder digest; nothing was changed');
  const images = [...new Set([...bytes.matchAll(IMAGE_LINE)].map((match) => match[1].replaceAll(QUOTE, '')))];
  const unsafe = images.find((image) => !IMAGE_REF.test(image));
  if (unsafe) throw refusal('STACK_DEPLOY_IMAGE', `the rendered stack names an image that is not a plain reference (${unsafe}); nothing was changed`);
  return { releaseId: createHash('sha256').update(bytes).digest('hex').slice(0, 16), images };
}

function renderOptions(options, out, previous) {
  return { images: options.images ?? {}, sourceSha: options.sourceSha, previous, out, allowUnpinned: false, extraCompose: [] };
}

/** A step that returns { ok, lines } whatever happens: an exception becomes a failed step (used once the services may have changed). */
async function attempt(action) {
  try {
    return await action();
  } catch (error) {
    return { ok: false, lines: [String(error.message)] };
  }
}

/** `docker stack deploy` of a stored or rendered file. */
function stackDeploy(ctx, config, file) {
  const run = tool(ctx, 'docker', ['stack', 'deploy', '--prune', '--with-registry-auth', '--resolve-image', 'always', '--detach=true', '-c', file, config.stack]);
  if (run.status !== 0) return { ok: false, lines: [`docker stack deploy failed: ${firstLine(run.stderr)}`] };
  return { ok: true, lines: [`deploy: requested ${config.stack} from ${path.basename(path.dirname(file))}/${path.basename(file)}`] };
}

/** Runs [name, action] steps in order until one fails; records { step, ok } and collects the lines. Returns the failed step name or ''. */
async function runSteps(plan, lines, steps) {
  const failed = await findInOrder(plan, async ([step, action]) => {
    const result = await attempt(action);
    lines.push(...result.lines);
    steps.push({ step, ok: result.ok });
    return !result.ok;
  });
  return failed ? failed[0] : '';
}

const isoBefore = (ctx, seconds) => new Date(ctx.now() - seconds * 1000).toISOString();

async function openStore(ctx, config, options, d) {
  return d.releaseStore(config, await d.ssh(ctx, config, { sshCmd: options.sshCmd ?? null }));
}

/** Redeploys a stored release after a failed deploy: fetch, stack deploy, converge. Returns the lines to print. */
async function redeployStored(ctx, config, d, store, previous, out, steps) {
  const dir = path.join(out, 'previous');
  const lines = [`ROLLING BACK to the previous accepted release ${previous}`];
  const failed = await runSteps([
    ['rollback-fetch', async () => { await store.fetch(previous, dir); return { ok: true, lines: [] }; }],
    ['rollback-deploy', () => stackDeploy(ctx, config, path.join(dir, 'stack.yaml'))],
    ['rollback-converge', () => d.convergeStack(ctx, config, { since: isoBefore(ctx, 30), timeoutSeconds: 600 })],
  ], lines, steps);
  lines.push(failed ? 'ROLLBACK DID NOT CONVERGE: follow the stack runbook, Rollback' : `rolled back to ${previous}`);
  return { lines, ok: !failed };
}

/** After the accept: prune with both release records (non-fatal) and drop dangling images (failure ignored). */
async function housekeeping(ctx, config, d, store, { previous, out }, lines) {
  const outcome = await attempt(async () => {
    const keepFiles = [path.join(out, 'release.json')];
    if (previous) {
      await store.fetch(previous, path.join(out, 'previous'));
      keepFiles.push(path.join(out, 'previous', 'release.json'));
    }
    return d.pruneStack(ctx, config, { keepFiles, execute: true });
  });
  lines.push(...outcome.lines);
  if (!outcome.ok) lines.push('prune failed (non-fatal; superseded objects stay until the next release)');
  tool(ctx, 'docker', ['image', 'prune', '-f']);
}

function prePull(ctx, images) {
  const lines = [];
  for (const image of images) {
    const run = tool(ctx, 'docker', ['pull', '--quiet', image]);
    if (run.status !== 0) throw failure('STACK_DEPLOY_PULL', `docker pull ${image} failed: ${firstLine(run.stderr)}`);
    lines.push(`pulled ${image}`);
  }
  return lines;
}

/** Everything before the stack deploy: any failure here leaves the services untouched. Returns { ok, lines, releaseId, images, previous }. */
async function prepareRelease(ctx, config, options, d, out) {
  const store = await openStore(ctx, config, options, d);
  const previous = await store.current();
  const rendered = await d.renderRelease(ctx, config, renderOptions(options, out, previous || null));
  const { releaseId, images } = inspectRendered(out);
  const lines = [...(rendered.lines ?? [])];
  const provisioned = await d.provisionRelease(ctx, config, { execute: true, out, releaseFile: path.join(out, 'release.json') });
  lines.push(...(provisioned.lines ?? []));
  if (provisioned.ok === false) return { ok: false, lines, releaseId, previous, store, stepsDone: [{ step: 'render', ok: true }, { step: 'provision', ok: false }] };
  await store.store(out, releaseId);
  lines.push(...prePull(ctx, images));
  return { ok: true, lines, releaseId, previous, store, stepsDone: [{ step: 'render', ok: true }, { step: 'provision', ok: true }, { step: 'store', ok: true }, { step: 'pre-pull', ok: true }] };
}

async function deployExecute(ctx, config, options, d, out) {
  const prepared = await prepareRelease(ctx, config, options, d, out);
  const { releaseId, previous, store } = prepared;
  const lines = [...prepared.lines];
  const steps = [...prepared.stepsDone];
  const data = { releaseId, previous: previous || null, steps, rolledBack: false };
  if (!prepared.ok) return { ok: false, lines: [...lines, 'deploy not started; the services are untouched'], data };
  const since = isoBefore(ctx, 60);
  const { skipPublic } = options;
  const failed = await runSteps([
    ['deploy', () => stackDeploy(ctx, config, path.join(out, 'stack.yaml'))],
    ['converge', () => d.convergeStack(ctx, config, { since, timeoutSeconds: options.timeoutSeconds })],
    ['verify', () => d.verifyStack(ctx, config, { retrySeconds: options.retrySeconds, skipPublic: skipPublic === true })],
    ...(skipPublic ? [] : [['accept', async () => { await store.accept(releaseId); return { ok: true, lines: [`accepted release ${releaseId}`] }; }]]),
  ], lines, steps);
  if (!failed && skipPublic) {
    data.pendingAccept = true;
    return { ok: true, lines: [...lines, `deployed release ${releaseId}: converged and verified inside the stack; the public hosts were NOT checked and the release is NOT accepted yet`, `next: starci app stack ingress publish, then starci app stack accept --release ${releaseId} --execute`], data };
  }
  if (!failed) {
    await housekeeping(ctx, config, d, store, { previous, out }, lines);
    return { ok: true, lines: [...lines, `deployed release ${releaseId}`], data };
  }
  lines.push(`deploy failed at ${failed}`);
  if (!previous) return { ok: false, lines: [...lines, 'no previous accepted release; services were rolled back by update_config where they had a previous spec'], data };
  const back = await redeployStored(ctx, config, d, store, previous, out, steps);
  data.rolledBack = back.ok;
  return { ok: false, lines: [...lines, ...back.lines], data };
}

/**
 * Deploys a release: `options` = { images, sourceSha, execute, out, timeoutSeconds, retrySeconds, skipPublic, sshCmd }.
 * skipPublic (the first deploy into a shared ingress, whose public routes exist only after `ingress publish`): the verification checks only what runs
 * inside the stack, and the release stays PENDING (stored and deployed, pointer not moved) until `acceptRelease` has verified it in full.
 * Returns { ok, lines, data: { releaseId, previous, steps: [{ step, ok }], rolledBack } }.
 */
export async function deployRelease(ctx, config, options = {}, deps = {}) {
  const d = { ...DEFAULT_DEPS, ...deps };
  if (!options.sourceSha) throw refusal('STACK_DEPLOY_SOURCE_SHA', '--source-sha is required (the git commit being deployed)');
  const made = options.out ? null : fs.mkdtempSync(path.join(os.tmpdir(), 'stack-release-'));
  const out = options.out ?? made;
  try {
    const rendered = await d.renderRelease(ctx, config, renderOptions(options, out, null));
    const { releaseId } = inspectRendered(out);
    if (options.execute !== true) {
      const plan = options.skipPublic
        ? `dry run: release ${releaseId} would be provisioned, stored, pre-pulled, deployed, converged and verified inside the stack (public hosts skipped); it would stay pending until ingress publish and stack accept`
        : `dry run: release ${releaseId} would be provisioned, stored, pre-pulled, deployed, converged, verified, accepted`;
      return { ok: true, lines: [...(rendered.lines ?? []), plan], data: { releaseId, steps: [{ step: 'render', ok: true }], executed: false } };
    }
    return await deployExecute(ctx, config, options, d, out);
  } finally {
    if (made) fs.rmSync(made, { recursive: true, force: true });
  }
}

/**
 * Redeploys a stored release (default: the `previous` pointer): `options` = { release, execute, timeoutSeconds, sshCmd }.
 * `release` is read from `options` only and must be null or 16 lowercase hex.
 */
export async function rollbackRelease(ctx, config, options = {}, deps = {}) {
  const d = { ...DEFAULT_DEPS, ...deps };
  const release = options.release ?? null;
  if (release !== null && !isReleaseId(release)) throw refusal('STACK_RELEASE_ID', 'the release must be 16 lowercase hex characters');
  const store = await openStore(ctx, config, options, d);
  const target = release ?? await store.previous();
  if (!target) throw refusal('STACK_ROLLBACK_NO_TARGET', 'no previous accepted release is recorded; name one with --release');
  if (options.execute !== true) return { ok: true, lines: [`dry run: would redeploy release ${target}`], data: { release: target, executed: false } };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stack-rollback-'));
  try {
    const lines = [];
    const steps = [];
    const since = isoBefore(ctx, 30);
    const failed = await runSteps([
      ['fetch', async () => { await store.fetch(target, dir); return { ok: true, lines: [] }; }],
      ['deploy', () => stackDeploy(ctx, config, path.join(dir, 'stack.yaml'))],
      ['converge', () => d.convergeStack(ctx, config, { since, timeoutSeconds: options.timeoutSeconds ?? 600 })],
      ['verify', () => d.verifyStack(ctx, config, { retrySeconds: 180 })],
      ['accept', async () => { await store.accept(target); return { ok: true, lines: [] }; }],
    ], lines, steps);
    lines.push(failed ? `rollback to ${target} failed at ${failed}` : `rolled back to release ${target}; a rollback cannot undo data effects`);
    return { ok: !failed, lines, data: { release: target, executed: true, steps } };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Accepts a release that a `skipPublic` deploy left pending: the FULL verification (public hosts and checks inside the stack) must pass first, then the
 * pointer moves and the superseded secrets and configs are pruned. `options` = { release, execute, retrySeconds, sshCmd }.
 */
export async function acceptRelease(ctx, config, options = {}, deps = {}) {
  const d = { ...DEFAULT_DEPS, ...deps };
  const release = options.release ?? null;
  if (!isReleaseId(release)) throw refusal('STACK_RELEASE_ID', 'accept needs --release <16 lowercase hex characters> (the id the deploy printed)');
  const store = await openStore(ctx, config, options, d);
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'stack-accept-'));
  try {
    try { await store.fetch(release, out); } catch { throw refusal('STACK_ACCEPT_UNKNOWN', `release ${release} has no stored record on the manager`); }
    const previous = await store.current();
    if (previous === release) return { ok: true, lines: [`release ${release} is already the accepted release`], data: { release, accepted: true, executed: options.execute === true } };
    if (options.execute !== true) return { ok: true, lines: [`dry run: would run the full verification (public hosts and checks inside the stack) and then accept release ${release}`], data: { release, accepted: false, executed: false } };
    const verified = await d.verifyStack(ctx, config, { retrySeconds: options.retrySeconds });
    const lines = [...(verified.lines ?? [])];
    if (!verified.ok) return { ok: false, lines: [...lines, `release ${release} is NOT accepted: the full verification failed`], data: { release, accepted: false, executed: true } };
    await store.accept(release);
    lines.push(`accepted release ${release}`);
    await housekeeping(ctx, config, d, store, { previous: previous || null, out }, lines);
    return { ok: true, lines, data: { release, accepted: true, executed: true } };
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
}
