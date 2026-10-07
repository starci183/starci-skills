// The trust per-record concepts of the example Work standard (check-example-work.mjs): proof cannot outrun what it
// proves, owner paths exist, an sds-component binds to a module and a frontend implementation waits for its ui
// direction. Each rule is `(ctx, rec)` and appends to ctx.problems, ctx.warnings or ctx.infos.
import path from 'node:path';
import { resolveOwnedDirs, ownerPathProblems, appRootOf, missingOwnedDirs, declaresOwnPaths } from '../record-ownership.mjs';

// ---- trust concept 3: proves and owners are checked ----
// A done record whose `proves` names a target that is itself not done is refused: proof cannot outrun
// what it proves. A dangling `proves` target is already caught by the generic ref-resolution check
// above, so only a resolving-but-not-done target is new here.
function checkProvesTargetDone({ problems, recOf }, rec) {
  const data = rec.data;
  if (!Array.isArray(data.proves) || data.state !== 'done') return;
  for (const targetId of data.proves) {
    const target = recOf(targetId);
    if (target && target.state !== 'done') {
      problems.push(`${rec.shown}: state is done but proves ${targetId}, which is ${target.state ?? '(no state)'}, not done [PROVES_TARGET_NOT_DONE]`);
    }
  }
}

// `owners[].path` / `module` name module-root directories (schemas/work-layout.yaml's `impl` shape
// entry; scripts/work/record-ownership.mjs's moduleRootOf normalises a file or `/**` glob path down
// to that root). A done record naming one that does not exist on disk is refused; a todo one is only
// warned, since the module a todo record targets may not have been built yet.
// Every owner path is app-relative (be/<path>, fe/<path> or an app-root directory); any other spelling is refused.
function checkOwnerPaths({ problems, warnings, records, workspaceDoc, resolveRoot }, rec) {
  const data = rec.data;
  for (const {problem} of ownerPathProblems(data, appRootOf(resolveRoot))) problems.push(`${rec.shown}: ${problem} [OWNER_PATH_NOT_APP_RELATIVE]`);
  if (!declaresOwnPaths(data)) return;
  const dirs = resolveOwnedDirs(data.id, rec, records, workspaceDoc, resolveRoot);
  const missing = missingOwnedDirs(dirs);
  if (!missing.length) return;
  const list = missing.map(m => m.rel).join(', ');
  const message = `${rec.shown}: owners/module names a directory that does not exist on disk: ${list} [OWNER_PATH_MISSING]`;
  if (data.state === 'done') problems.push(message); else warnings.push(message);
}

// ---- trust concept 4: an sds-component binds to a module ----
// A design component's read-scope boundary is a module boundary, but architecture.decide writes the
// component with no repository roles or paths: `owners` stays absent until an implementation leg has
// run, and review.verify's final reconciliation writes the module roots the done implementation records
// proving the component own (inc-96ff77d86a77). So a missing `owners` is refused only once a done
// work/implementation@1 proves the component and the component itself is done; before that it is
// pending (info), and a todo component an implementation already proved is warned (reconciliation owes
// it). Named owners are checked for existence by the OWNER_PATH_MISSING rule above.
function checkSdsComponentOwners({ problems, warnings, infos, sdsProvers }, rec) {
  const data = rec.data;
  if (rec.schema !== 'work/sds-component@1') return;
  if (Array.isArray(data.owners) && data.owners.some(o => o?.path)) return;
  const provers = sdsProvers.get(data.id) ?? [];
  if (!provers.length) {
    infos.push(`${rec.shown}: work/sds-component@1 has no owners yet - no done implementation proves it, and architecture.decide never writes repository paths [SDS_OWNERS_PENDING]`);
    return;
  }
  const message = `${rec.shown}: work/sds-component@1 ${data.state === 'done' ? 'is done but carries' : 'carries'} no owners although ${provers.join(', ')} implemented it - review.verify's reconciliation writes the module roots those implementation records own [SDS_OWNERS_MISSING]`;
  if (data.state === 'done') problems.push(message); else warnings.push(message);
}

/** The ui-screen ids a done implementation must wait for: the ones it proves, else every ui-screen of its own feature. */
function relevantUiOf({ workRoot, resolveMap }, rec, provesUi) {
  if (provesUi.length) return provesUi;
  const featureOf = dir => path.relative(workRoot, dir).replaceAll('\\', '/').split('/')[1];
  const feature = featureOf(rec.dir);
  return [...resolveMap.entries()]
    .filter(([, r]) => r.schema === 'work/ui-screen@1' && featureOf(r.dir) === feature)
    .map(([uid]) => uid);
}

// ---- trust concept 8: implementation is held until its ui direction is drawn ----
// modules/models/kinds.yaml's `implementation/frontend` lane is "held until the feature's ui node is done" -
// drawing precedes implementing. A done work/implementation@1 that names a work/ui-screen@1 in its own
// `proves`, or whose `repository` is the workspace's frontend repository, is refused
// (IMPL_BEFORE_DIRECTION) unless every relevant ui-screen is itself done: the ones it explicitly
// proves, or - when it proves none by id - every ui-screen its own feature owns (a frontend
// implementation is for some screen even when it did not name one via proves).
function checkImplementationAfterDirection(ctx, rec) {
  const { problems, workspaceDoc, recOf } = ctx;
  const data = rec.data;
  if (rec.schema !== 'work/implementation@1' || data.state !== 'done') return;
  const provesUi = (Array.isArray(data.proves) ? data.proves : []).filter(pid => recOf(pid)?.schema === 'work/ui-screen@1');
  const repos = Array.isArray(workspaceDoc?.repositories) ? workspaceDoc.repositories : [];
  const isFrontendRepo = data.repository ? repos.find(r => r?.name === data.repository)?.role === 'fe' : false;
  if (!provesUi.length && !isFrontendRepo) return;
  const relevantUi = relevantUiOf(ctx, rec, provesUi);
  const notDone = relevantUi.filter(uid => recOf(uid)?.state !== 'done');
  if (relevantUi.length && notDone.length) {
    problems.push(`${rec.shown}: state is done but its ui direction is not - ${notDone.join(', ')} ${notDone.length > 1 ? 'are' : 'is'} not done yet (modules/models/kinds.yaml's implementation/frontend lane is held until the feature's ui node is done) [IMPL_BEFORE_DIRECTION]`);
  }
}

/** The trust rules in the order they run for each record. */
export const trustRules = [checkProvesTargetDone, checkOwnerPaths, checkSdsComponentOwners, checkImplementationAfterDirection];
