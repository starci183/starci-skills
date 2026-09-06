// Publish a decision candidate through its operator gate, existing lease and shared registry lock.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { businessesRootFor, headDirectory } from './business-head.mjs';
import { openStore, planHeadPublication, applyHeadPublication, archivedHashOf, verifyHeadPublication, objectRef, contentAddress } from './business-registry.mjs';
import { readSessionState, workflowOwnerErrors, workflowRootOf, sameRoot } from './workflow-root.mjs';
import { withSessionLock, withOwnedFileLock } from './session-lock.mjs';
import { normalizeResource } from './resource-locks.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = file => JSON.parse(readFileSync(file, 'utf8'));
const sha = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

export function businessWorktreeIdentity(storeRoot, workflowRoot) {
  const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    if (!sameRoot(git(storeRoot, 'rev-parse', '--show-toplevel'), storeRoot)) throw Error('businesses directory is not its own Git worktree');
    const common = cwd => path.resolve(cwd, git(cwd, 'rev-parse', '--git-common-dir'));
    if (!sameRoot(common(storeRoot), common(workflowRoot))) throw Error('businesses worktree belongs to another Workflow repository');
    const entries = git(workflowRoot, 'worktree', 'list', '--porcelain').replaceAll('\r', '').split('\n\n').map(block => Object.fromEntries(block.split('\n').map(line => { const cut = line.indexOf(' '); return cut < 0 ? [line, true] : [line.slice(0, cut), line.slice(cut + 1)]; })));
    const registration = entries.find(entry => entry.worktree && sameRoot(entry.worktree, storeRoot));
    if (!registration || registration.bare || registration.detached || registration.prunable) throw Error('businesses worktree has no available registered branch');
    // A Git worktree lock protects its registration; publishing files never removes that lock.
    return { branch: registration.branch, head: registration.HEAD, locked: registration.locked ?? null };
  } catch (error) { throw Error(`BUSINESS_AUTHORITY_INVALID: ${error.message.split('\n')[0]}`); }
}

export async function publishBusinessHead(branch, { root = ROOT } = {}) {
  const owner = readSessionState(branch);
  if (!owner) throw Error('SESSION_MISSING: publication requires its active owning attempt');
  return withSessionLock(owner.session, async () => {
    const names = ['request/request.json', 'response/response.json', 'response/response.md', 'response/data/model.json', 'response/data/claims.json', 'response/data/coverage-matrix.json', 'response/restatement.md'];
    const bytes = new Map(names.map(name => [name, existsSync(path.join(branch, name)) ? readFileSync(path.join(branch, name)) : null]));
    const unchanged = () => {
      for (const [name, before] of bytes) {
        const file = path.join(branch, name), after = existsSync(file) ? readFileSync(file) : null;
        if (before === null ? after !== null : after === null || !before.equals(after)) throw Error(`SOURCE_DRIFT: publication candidate changed during validation: ${name}`);
      }
    };
    const state = load(path.join(owner.session, 'state.json'));
    const { validateRequest } = await import('./validate-request.mjs');
    const { errors, request } = await validateRequest(root, branch);
    errors.push(...workflowOwnerErrors(root, owner.session, state, { dispatch: true }));
    if (errors.length) throw Error(errors.join('\n'));
    if (request.operatorId !== 'business.decide') throw Error('business head publication requires business.decide');
    if (load(path.join(branch, 'response/response.json')).status !== 'done') throw Error('publication requires a complete done candidate response');
    const key = `${request.step}/${request.parallel}`, attempt = state.attempts?.[key];
    if (attempt?.status !== 'running' || attempt.id !== request.attempt?.id) throw Error('publication requires the opened running attempt');
    if (state.requestHashes?.[key] !== sha(readFileSync(path.join(branch, 'request/request.json')))) throw Error('publication request differs from its frozen bytes');
    const storeRoot = businessesRootFor(root, state);
    const input = Object.fromEntries(['model', 'claims', 'coverage-matrix'].map(name => [name === 'coverage-matrix' ? 'coverage' : name, load(path.join(branch, `response/data/${name}.json`))]));
    const target = normalizeResource(headDirectory(storeRoot, input.model, root));
    const covers = item => { const base = normalizeResource(item); return path.isAbsolute(base) && (target === base || target.startsWith(`${base}/`)); };
    const lease = state.workerSlots?.find(slot => slot.branch === key && slot.attemptId === attempt.id);
    if (!lease?.exclusive.some(covers)) throw Error('publication requires the concrete feature directory exclusive lease');
    if (!(request.environment?.writes ?? []).some(item => covers(item) || item === `@worktrees/businesses/${input.model.featureId}`)) throw Error('publication feature is absent from the declared write set');
    const { validateBusinessStep } = await import('../operators/business-decide/validate.mjs');
    const candidate = await validateBusinessStep(branch, root, { publication: 'candidate' });
    if (candidate.errors.length) throw Error(candidate.errors.join('\n'));
    unchanged();
    const initial = openStore(storeRoot);
    if (!initial.present) throw Error('businesses registry is absent at the Workflow alias; resolve authority ownership before publication');
    if (initial.registry.project !== state.project) throw Error('businesses registry project differs from its owning session');
    const worktree = businessWorktreeIdentity(storeRoot, workflowRootOf(root, state));
    return withOwnedFileLock(path.join(storeRoot, '.publication-lock'), async () => {
      unchanged();
      if (JSON.stringify(businessWorktreeIdentity(storeRoot, workflowRootOf(root, state))) !== JSON.stringify(worktree)) throw Error('SOURCE_DRIFT: businesses worktree identity or lock changed');
      const store = openStore(storeRoot), previous = store.entry(input.model.featureId);
      if (store.registry.project !== state.project) throw Error('SOURCE_DRIFT: businesses registry project changed');
      if ((previous?.head ?? null) !== archivedHashOf(input.model.lineage.previousHeadRef)) throw Error('SOURCE_DRIFT: the current registered head differs from the candidate lineage');
      if (previous && (input.model.lineage.previousHeadRef.replaceAll('\\', '/') !== objectRef(storeRoot, previous.head).replaceAll('\\', '/') || store.readObject(previous.head)?.state !== input.model.lineage.previousState)) throw Error('SOURCE_DRIFT: candidate lineage differs from its archived project head');
      if (previous && contentAddress(store.readObject(previous.head)) !== previous.head) throw Error('SOURCE_DRIFT: previous archived object does not hash to its lineage address');
      const plan = planHeadPublication({ store, featureId: input.model.featureId, ...input });
      applyHeadPublication(store, plan);
      const checked = verifyHeadPublication({ store: openStore(storeRoot), featureId: input.model.featureId, ...input });
      if (checked.length) throw Error(checked.join('\n'));
      if (JSON.stringify(businessWorktreeIdentity(storeRoot, workflowRootOf(root, state))) !== JSON.stringify(worktree)) throw Error('SOURCE_DRIFT: businesses worktree identity or lock changed');
      return { head: plan.entry.head, directory: plan.bundle.directory, files: Object.keys(plan.bundle.files), worktree };
    }, { requiredFile: initial.registryFile });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const branch = process.argv[2];
  if (!branch || !existsSync(branch)) { process.stderr.write('usage: node scripts/publish-business-head.mjs <session>/step-N/parallel-M\n'); process.exitCode = 2; }
  else try { process.stdout.write(`${JSON.stringify(await publishBusinessHead(path.resolve(branch)), null, 2)}\n`); }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
