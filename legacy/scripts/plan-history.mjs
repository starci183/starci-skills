// The planner's immutable forecasts and explicit replacement of unexecuted work. This module never
// changes an invocation coordinate, marks a forecast as delivered, or imports a historical result.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, lstatSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { execFileSync } from 'node:child_process';
import { retainContext, readContext, retainMission, invocationState } from './mission-history.mjs';
import { scopeHash } from './mission-scope.mjs';
import { mutateSession } from './session-lock.mjs';
import { evidenceManifestErrors } from './evidence-manifest.mjs';
import { waitingReviewBinding, resolvedWaitingReplanErrors } from './resolved-waiting.mjs';
import { routeObligation, unitObligation, obligationId, forecastObligations, partitionAdmissionErrors } from './goal-partitions.mjs';
import { editSourceReview, remapSourceReviews, carrySourceReviews, sourceReviewCoverage, sourceReviewAdmissionErrors } from './source-review.mjs';

const sha = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const fingerprint = value => sha(JSON.stringify(value));
const keyOf = cell => cell.split('/').slice(0, 2).join('/');
const branchPath = (session, cell) => { if (!/^[1-9][0-9]*\/[1-9][0-9]*$/.test(cell)) throw Error('PLAN_HISTORY_UNBOUND: retained coordinate is not a positive step/parallel cell'); const [n, m] = cell.split('/'); return path.join(session, `step-${n}`, `parallel-${m}`); };
export const activePlanCells = state => new Set((state.chain ?? []).flat());
export const retiredPlanCell = (state, cell) => Boolean(state.planHistory && state.steps?.[keyOf(cell)] && !activePlanCells(state).has(keyOf(cell)));

function inventory(session, cells) {
  const out = {};
  const scan = directory => {
    if (!existsSync(directory)) return;
    if (lstatSync(directory).isSymbolicLink()) throw Error('PLAN_HISTORY_UNBOUND: retained branch cannot be a symlink');
    for (const name of readdirSync(directory)) {
      const file = path.join(directory, name); const stat = lstatSync(file);
      if (stat.isSymbolicLink()) throw Error('PLAN_HISTORY_UNBOUND: retained execution evidence cannot contain a symlink');
      if (stat.isDirectory()) scan(file);
      else if (stat.isFile()) out[path.relative(session, file).split(path.sep).join('/')] = sha(readFileSync(file));
    }
  };
  for (const cell of cells) scan(branchPath(session, cell));
  return out;
}

export function offsetForecast(plan, offset) {
  const cell = value => `${Number(value.split('/')[0]) + offset}/${value.split('/')[1]}`;
  const out = structuredClone(plan);
  out.chain = plan.chain.map(step => step.map(cell));
  for (const field of ['steps', 'goals', 'reasons', 'dependencies', 'evidenceDependencies', 'handoffs', 'requestRefs', 'presets', 'fanout', 'imports', 'nodes', 'resumes', 'units', 'repairs', 'repairDependencies', 'reviewResumes', 'retries', 'rebinds', 'partitions']) out[field] = Object.fromEntries(Object.entries(plan[field] ?? {}).map(([key, value]) => [cell(key), structuredClone(value)]));
  for (const [key, goal] of Object.entries(out.goals)) if (goal.prerequisite) goal.prerequisite = cell(goal.prerequisite);
  for (const [key, deps] of Object.entries(out.dependencies)) out.dependencies[key] = deps.map(cell);
  for (const [key, deps] of Object.entries(out.evidenceDependencies)) out.evidenceDependencies[key] = deps.map(cell);
  for (const [key, owner] of Object.entries(out.handoffs)) out.handoffs[key] = cell(owner);
  for (const key of Object.keys(out.steps)) { const [n, m] = key.split('/'); out.requestRefs[key] = `step-${n}/parallel-${m}/request/request.json`; }
  for (const repair of Object.values(out.repairs ?? {})) { repair.source = cell(repair.source); repair.resume = cell(repair.resume); }
  for (const [key, dependency] of Object.entries(out.repairDependencies ?? {})) out.repairDependencies[key] = cell(dependency);
  return out;
}

const plannedOf = plan => Object.fromEntries(Object.keys(plan.steps).map(cell => [cell, { requirements: plan.presets[cell] ?? {}, ...(plan.imports[cell] ? { inputs: Object.fromEntries(Object.entries(plan.imports[cell]).map(([kind, value]) => [kind, value.input])) } : {}) }]));

async function acceptedCurrent(root, session, state, cell, status = 'matched') {
  const attempt = state.attempts?.[cell];
  if (attempt?.status !== status || !attempt.context || attempt.expected?.goalVersion !== state.mission.version) throw Error(`PLAN_PROOF_UNAVAILABLE: ${cell} has no sealed ${status} invocation for this exact mission`);
  const sealed = await evidenceManifestErrors(branchPath(session, cell), attempt.evidenceManifest);
  if (sealed.length) throw Error(sealed.join('\n'));
  const request = JSON.parse(readFileSync(path.join(branchPath(session, cell), 'request/request.json')));
  invocationState(session, state, request);
  const response = JSON.parse(readFileSync(path.join(branchPath(session, cell), 'response/response.json')));
  const statuses = { matched: 'done', mismatched: 'mismatch', inconclusive: 'mismatch', blocked: 'blocked', waiting: 'waiting' };
  if (!attempt.endedAt || response.status !== statuses[status] || response.operatorId !== attempt.operatorId || response.attempt?.id !== attempt.id || request.attempt?.id !== attempt.id || !isDeepStrictEqual(response.comparison, attempt.comparison)) throw Error(`PLAN_PROOF_UNAVAILABLE: retained receipt differs from the exact accepted ${status} attempt and comparison`);
  const { validateStep } = await import('./validate-step.mjs');
  const result = await validateStep(root, branchPath(session, cell), { operator: true, requestPhase: 'accept' });
  if (result.errors.length) throw Error(result.errors.join('\n'));
  return response;
}

const requestAt = (session, cell) => JSON.parse(readFileSync(path.join(branchPath(session, cell), 'request/request.json')));
const samePath = (a, b) => typeof a === 'string' && typeof b === 'string' && (process.platform === 'win32' ? path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase() : path.resolve(a) === path.resolve(b));
const safeRoot = value => typeof value === 'string' && value.length && !path.isAbsolute(value) && !/[:\\*?]/.test(value) && value.split('/').every(part => part && part !== '.' && part !== '..');
const coversRoot = (pattern, target) => pattern === target || pattern?.endsWith('/**') && (target === pattern.slice(0,-3) || target.startsWith(pattern.slice(0,-2)));

function assertRetryRequest(state, cell, original, request, retry) {
  if (request.operatorId !== original.operatorId || request.attempt?.previous !== original.attempt.id || request.attempt?.number !== original.attempt.number + 1 || !['retry','repair'].includes(request.attempt?.kind) || request.resume || !isDeepStrictEqual(request.requirements, original.requirements) || !isDeepStrictEqual(request.inputs, original.inputs) || request.unit !== original.unit) throw Error('PLAN_RETRY_UNAUTHORIZED: retry must retain the same operator, source unit, requirements and accepted inputs with exact prior attempt');
  if (Object.entries(state.attempts ?? {}).some(([other, value]) => other !== cell && value.previous === original.attempt.id)) throw Error('PLAN_RETRY_UNBOUND: the failed attempt already owns another successor invocation');
  const before = original.environment ?? {}, after = request.environment ?? {};
  for (const field of ['writes','exclusive','mode','outputRoot']) if (!isDeepStrictEqual(before[field], after[field])) throw Error('PLAN_RETRY_UNAUTHORIZED: a retry cannot expand effect or resource ownership');
  if (before.workspace && (after.workspace?.alias !== before.workspace.alias || !samePath(after.workspace?.worktree, before.workspace.worktree))) throw Error('PLAN_RETRY_UNAUTHORIZED: a retry cannot change its source role or checkout');
  if (!before.workspace && after.workspace) throw Error('PLAN_RETRY_UNAUTHORIZED: a retry cannot acquire a source checkout');
  if (retry.correction && (after.workspace.revision !== retry.revision || request.contexts?.find(context => context.alias === after.workspace.alias)?.head !== retry.revision)) throw Error('PLAN_RETRY_UNBOUND: source correction requires a freshly frozen current-HEAD base');
  if (retry.correction === 'source-proof-review') {
    const method = request.frozenInputs?.find(item => item.ref === retry.methodRef);
    if (!method || !/^sha256:[a-f0-9]{64}$/.test(method.sha256 ?? '') || method.sha256 === sha('') || (original.frozenInputs ?? []).some(item => item.sha256 === method.sha256)) throw Error('NO_PROGRESS: proof review requires a changed frozen verification method, not only a new source base or renamed old bytes');
  }
}

// A retry changes execution, not goal authority. Existing request fields carry the new method and
// checkout base; the forecast only records why this exact sealed attempt may be retried.
async function retryBinding(root, session, state, source, edit) {
  const status = state.attempts?.[source]?.status;
  if (!['mismatched', 'inconclusive', 'blocked'].includes(status)) throw Error('PLAN_RETRY_UNBOUND: retry requires one sealed failed attempt');
  const response = await acceptedCurrent(root, session, state, source, status), request = requestAt(session, source);
  if (response.interaction || request.exchange) throw Error('PLAN_RETRY_UNAUTHORIZED: an unanswered interaction or nested exchange uses its owning resolution gate');
  const { deliveryRequestErrors } = await import('./mission-scope.mjs');
  const authority = deliveryRequestErrors(state, request, root);
  if (authority.length) throw Error(authority.join('\n'));
  const binding = { source, attempt: request.attempt.id, requestHash: state.requestHashes[source], fingerprint: state.attempts[source].evidenceManifest.fingerprint };
  if (status === 'blocked') {
    if (response.stop !== 'INVALID_INPUT' || !['source-history','source-proof-review'].includes(edit.correction) || !request.environment?.workspace || !Array.isArray(request.requirements?.mutableFileRefs) || typeof response.fields?.changes !== 'string') throw Error('PLAN_RETRY_UNAUTHORIZED: blocked caller or external work has no generic retry route');
    if (edit.correction === 'source-proof-review') {
      const criterion = request.expected?.criteria?.find(item => item.id === edit.criterionId && item.required === true);
      const compared = response.comparison?.criteria?.find(item => item.criterionId === edit.criterionId);
      const observed = response.actual?.observations?.find(item => item.criterionId === edit.criterionId);
      if (!criterion || !['mismatched','inconclusive'].includes(compared?.verdict) || !compared.evidence?.includes(response.fields.changes) || !observed?.evidence?.includes(response.fields.changes)) throw Error('PLAN_RETRY_UNBOUND: proof review must name an original required nonpassing criterion observed and compared against its sealed declared source evidence');
      if (typeof edit.methodRef !== 'string' || !/^request\/(?:[a-zA-Z0-9_.-]+\/)*[a-zA-Z0-9_.-]+$/.test(edit.methodRef) || edit.methodRef.split('/').some(part => part === '.' || part === '..') || edit.methodRef === 'request/request.json') throw Error('PLAN_RETRY_UNBOUND: proof review must name its fresh request-side verification method artifact');
    }
    const { sourceCheckoutOf, reflogErrors, reflogWindow, REFLOG_MARK } = await import('./workspace-checkout.mjs');
    const { tableUnder } = await import('./validate-response.mjs');
    const text = readFileSync(path.join(branchPath(session, source), response.fields.changes), 'utf8');
    const marks = Object.fromEntries(tableUnder(text, '## Binding') ?? []);
    const before = REFLOG_MARK.exec(marks['Reflog before'] ?? ''), after = REFLOG_MARK.exec(marks['Reflog after'] ?? '');
    const checkout = sourceCheckoutOf(root, branchPath(session, source), request);
    if (!checkout || !samePath(checkout, request.environment.workspace.worktree) || !before || !after || before[2] !== request.environment.workspace.revision || before[2] === after[2]) throw Error('PLAN_RETRY_UNBOUND: technical correction requires the exact recorded source history window and owned checkout');
    const window = { since: before[2], until: after[2], sessionBranch: `session/${state.id}`, expected: Number(after[1]) - Number(before[1]) };
    const measured = reflogWindow(checkout, window);
    if (measured.errors.length || !measured.window?.length) throw Error('PLAN_RETRY_UNBOUND: the original source window must remain readable before it can justify a technical correction');
    const history = reflogErrors(checkout, window);
    if (edit.correction === 'source-history' && !history.length) throw Error('PLAN_RETRY_UNBOUND: recorded source history does not establish a failed technical window');
    if (edit.correction === 'source-proof-review' && (history.length || measured.window.length !== 1 || window.expected !== 1)) throw Error('PLAN_RETRY_UNBOUND: proof review requires an intact normal one-commit source window, not a history repair');
    const revision = execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true, stdio: ['ignore','pipe','pipe'], env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } }).trim();
    if (!/^[a-f0-9]{40}$/.test(edit.revision ?? '') || revision !== edit.revision || edit.correction === 'source-history' && revision !== after[2]) throw Error('PLAN_RETRY_STALE: technical correction must bind the observed current source head, not reuse the failed base');
    if (edit.correction === 'source-proof-review') try {
      execFileSync('git', ['-C', checkout, 'merge-base', '--is-ancestor', after[2], revision], { windowsHide: true, stdio: ['ignore','pipe','pipe'], env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } });
    } catch { throw Error('PLAN_RETRY_STALE: the fresh proof-review base must retain the original committed source by ancestry'); }
    Object.assign(binding, { correction: edit.correction, revision, workspace: request.environment.workspace,
      ...(edit.correction === 'source-proof-review' ? { criterionId: edit.criterionId, methodRef: edit.methodRef } : {}) });
  } else if (edit.correction || edit.revision || edit.criterionId || edit.methodRef) throw Error('PLAN_RETRY_UNBOUND: technical correction metadata belongs only to its verified blocked source window');
  return { binding, request };
}

async function rebindBinding(root, session, state, retryRequest, edit) {
  if (!edit || state.steps?.[edit.source] !== 'workspace.bind') throw Error('PLAN_REBIND_UNBOUND: name the exact earlier accepted workspace binding');
  const response = await acceptedCurrent(root, session, state, edit.source), request = requestAt(session, edit.source);
  const route = JSON.parse(readFileSync(path.join(branchPath(session, edit.source), response.fields.route)));
  const workspace = retryRequest.environment?.workspace, alias = `@workspaces/${request.requirements.role}`;
  if (request.requirements.checkout !== 'session' || workspace?.alias !== alias || !samePath(route.checkout.diskPath, workspace.worktree) || request.requirements.project !== state.project) throw Error('PLAN_REBIND_UNBOUND: repair cannot change project, role or registered source checkout');
  const roots = edit.writeRoots, priorRoots = request.requirements.declaredWriteRoots ?? [];
  if (!Array.isArray(roots) || !roots.length || roots.some(root => !safeRoot(root)) || new Set(roots).size !== roots.length || priorRoots.some(root => !roots.includes(root))) throw Error('PLAN_REBIND_UNBOUND: retain prior roots and name exact safe additional roots');
  const { refToRegExp } = await import('../operators/backend-generate/validate.mjs');
  const protectedMatchers = (retryRequest.requirements.protectedRefs ?? []).map(refToRegExp);
  for (const root of roots.filter(root => !priorRoots.includes(root))) {
    const file = path.join(workspace.worktree,root), concreteFile = existsSync(file) && lstatSync(file).isFile();
    if (!(retryRequest.requirements.mutableFileRefs ?? []).some(pattern => coversRoot(pattern, root) || concreteFile && refToRegExp(pattern).test(root)) || protectedMatchers.some(pattern => pattern.test(root) || pattern.test(root + '/'))) throw Error('PLAN_REBIND_UNAUTHORIZED: additional root exceeds the original mutable boundary or overlaps protected ownership');
  }
  const requirements = { ...request.requirements, declaredWriteRoots: roots };
  const { resolveWorkspaceCheckout, changedPathsOf } = await import('./workspace-checkout.mjs');
  const selected = resolveWorkspaceCheckout({ source: state.workflowOwner.sourceRoot, project: state.project, role: requirements.role, sessionId: state.id, checkout: 'session', declaredWriteRoots: roots, sharedInstall: requirements.sharedInstall ?? false });
  if (!samePath(selected.checkout?.diskPath ?? selected.diskPath, workspace.worktree)) throw Error('PLAN_REBIND_UNBOUND: current route resolves a different worktree');
  if (changedPathsOf(workspace.worktree).some(file => protectedMatchers.some(pattern => pattern.test(file)))) throw Error('PLAN_REBIND_UNAUTHORIZED: a protected dirty leaf cannot acquire ownership through a broader checkout root');
  return { source: edit.source, requirements };
}

async function runtimeRepairSource(root, session, state, source, wall, requirements) {
  if (state.steps[source] !== 'environment.preflight') throw Error('PLAN_REPAIR_UNBOUND: repair source must be the current preflight');
  const response = await acceptedCurrent(root, session, state, source, 'blocked');
  if (response.stop !== 'ENVIRONMENT_NOT_READY' || !response.next?.includes('runtime.serve')) throw Error('PLAN_REPAIR_UNBOUND: the accepted readiness stop must route to runtime.serve');
  const request = JSON.parse(readFileSync(path.join(branchPath(session, source), 'request/request.json')));
  const report = JSON.parse(readFileSync(path.join(branchPath(session, source), response.fields['readiness-report'])));
  const role = /^runtime\.(.+)\.head$/.exec(wall)?.[1];
  if (!role || report.walls.length !== 1 || report.walls[0].checkId !== wall || report.walls[0].owner !== 'runtime' || !report.checks.some(check => check.id === wall && check.status === 'wall' && check.owner === 'runtime')) throw Error('PLAN_REPAIR_UNBOUND: this attestation repair requires the exact sole runtime head wall');
  const repository = state.mission.discovery.repositories.find(repo => repo.project === report.project && repo.role === role);
  if (!repository || report.project !== state.project || report.project !== request.requirements.project || report.env !== request.requirements.env || !request.requirements.roles.includes(role) || !request.requirements.runtimeRoles.includes(role)) throw Error('PLAN_REPAIR_UNBOUND: runtime wall must bind the confirmed project, role and environment');
  const desired = requirements?.desiredState;
  if (requirements?.routeKey !== `${report.project}/${role}` || requirements.env !== report.env || requirements.operation !== 'serve' || requirements.commit !== repository.head || !isDeepStrictEqual(desired?.effects, ['attest-runtime-entry']) || desired.serviceKind !== 'runtime' || !isDeepStrictEqual(desired.resourceRefs, [requirements.routeKey]) || (desired.mutableResourceRefs ?? []).some(ref => ref !== requirements.routeKey) || (desired.observationOnlyResourceRefs ?? []).some(ref => ref !== requirements.routeKey) || (requirements.portClaims ?? []).length) throw Error('PLAN_REPAIR_UNBOUND: repair may only attest the exact approved route and frozen commit');
  const { platformAuthorityErrors } = await import('./platform-authority.mjs');
  const { loadEnvironmentSchema, parseDeclarationReference } = await import('./validate-request.mjs');
  if (!parseDeclarationReference(await loadEnvironmentSchema(root), requirements.approval)) throw Error('PLAN_REPAIR_AUTHORITY_REQUIRED: bind the current environment declaration for this attestation');
  const { operationClasses } = await import('../operators/runtime-serve/validate.mjs');
  const authority = await platformAuthorityErrors({ root, requirements, kind: 'runtime', desiredEffects: desired.effects, operationClasses, hostRoot: state.workflowOwner.sourceRoot });
  if (authority.length) throw Error(authority.join('\n'));
  return { source, wall, role, project: report.project, env: report.env, commit: repository.head, request };
}

// Re-entry edits the remaining execution mapping of the same forecast. The dispatched prefix and
// every request stay at their original coordinates; only unopened cells receive new coordinates.
export async function editForecast(root, session, state, original, edit, top) {
  const forecast = structuredClone(original);
  if (!edit || !['resume', 'expand', 'repair', 'retry', 'partition', 'review', 'source-repair'].includes(edit.kind) || !forecast.steps[edit.cell]) throw Error('PLAN_EDIT_INVALID: name one current resume, retry, unit expansion, route partition, source review or typed repair');
  for (const cell of forecast.chain.flat()) if (state.attempts?.[cell]) await acceptedCurrent(root, session, state, cell, state.attempts[cell].status);
  const cell = edit.cell, operator = forecast.steps[cell];
  if (['review','source-repair'].includes(edit.kind)) {
    await editSourceReview(root,session,state,forecast,edit);
  } else if (edit.kind === 'retry') {
    const { binding, request } = await retryBinding(root, session, state, cell, edit);
    if (Object.values(forecast.retries ?? {}).some(value => value.source === cell)) throw Error('PLAN_RETRY_UNBOUND: the failed attempt already has its unique retry');
    const next = `retry:${cell}`, rebind = edit.rebind ? `rebind:${cell}` : null;
    for (const field of ['steps','goals','reasons','dependencies','evidenceDependencies','presets','nodes','units','imports','partitions']) if (forecast[field]?.[cell] !== undefined) (forecast[field] ??= {})[next] = structuredClone(forecast[field][cell]);
    forecast.presets[next] = structuredClone(request.requirements);
    forecast.nodes[next] = `${forecast.nodes[cell]}:retry:${cell}`;
    (forecast.retries ??= {})[next] = { ...binding, ...(rebind ? { rebind } : {}) };
    const retryAncestors = new Set([cell]); let ancestor = cell;
    while (forecast.retries[ancestor]) {
      ancestor = forecast.retries[ancestor].source;
      if (retryAncestors.has(ancestor)) throw Error('PLAN_RETRY_UNBOUND: retry lineage contains a cycle');
      retryAncestors.add(ancestor);
    }
    if (rebind) {
      const bound = await rebindBinding(root, session, state, request, edit.rebind);
      forecast.steps[rebind] = 'workspace.bind'; forecast.goals[rebind] = { prerequisite: next };
      forecast.presets[rebind] = bound.requirements; forecast.nodes[rebind] = `${forecast.nodes[cell]}:rebind`;
      forecast.dependencies[rebind] = []; forecast.evidenceDependencies[rebind] = [];
      (forecast.rebinds ??= {})[rebind] = { source: bound.source, retry: next };
      forecast.dependencies[next] = [...(forecast.dependencies[next] ?? []), rebind];
      forecast.evidenceDependencies[next] = [...(forecast.evidenceDependencies[next] ?? []), rebind];
    }
    for (const target of Object.keys(forecast.dependencies)) if (![cell,next,rebind].includes(target) && !state.attempts?.[target]) {
      forecast.dependencies[target] = forecast.dependencies[target].map(dep => dep === cell ? next : dep);
      forecast.evidenceDependencies[target] = (forecast.evidenceDependencies[target] ?? []).map(dep => dep === cell ? next : dep);
      if (forecast.handoffs?.[target] === cell) forecast.handoffs[target] = next;
      if (forecast.units?.[target]) forecast.units[target].dependsOn = (forecast.units[target].dependsOn ?? []).map(dep => retryAncestors.has(dep) ? next : dep);
    }
    const index = Math.max(...forecast.chain.map((step,index) => step.some(value => state.attempts?.[value]) ? index : -1));
    forecast.chain.splice(index + 1, 0, ...(rebind ? [[rebind]] : []), [next]);
  } else if (edit.kind === 'repair') {
    const binding = await runtimeRepairSource(root, session, state, cell, edit.wall, edit.requirements);
    const repair = `repair:${cell}`, resume = `pending:${cell}`;
    for (const target of [repair, resume]) {
      for (const field of ['steps','goals','reasons','dependencies','evidenceDependencies','presets','nodes']) (forecast[field] ??= {})[target] = structuredClone(forecast[field]?.[cell] ?? (['dependencies','evidenceDependencies'].includes(field) ? [] : {}));
    }
    forecast.steps[repair] = 'runtime.serve'; forecast.goals[repair] = { prerequisite: resume };
    forecast.presets[repair] = structuredClone(edit.requirements);
    forecast.dependencies[repair] = [cell]; forecast.evidenceDependencies[repair] = [cell];
    forecast.nodes[repair] = `${forecast.nodes[cell]}:repair:${edit.wall}`;
    forecast.nodes[resume] = `${forecast.nodes[cell]}:resume:${cell}`;
    forecast.dependencies[resume] = [repair]; forecast.evidenceDependencies[resume] = [repair];
    forecast.presets[resume] = structuredClone(binding.request.requirements);
    (forecast.resumes ??= {})[resume] = cell;
    const { request: ignored, ...retained } = binding;
    (forecast.repairs ??= {})[repair] = { ...retained, resume };
    (forecast.repairDependencies ??= {})[resume] = repair;
    for (const target of Object.keys(forecast.dependencies)) if (![cell, repair, resume].includes(target)) {
      forecast.dependencies[target] = forecast.dependencies[target].map(dep => dep === cell ? resume : dep);
      forecast.evidenceDependencies[target] = (forecast.evidenceDependencies[target] ?? []).map(dep => dep === cell ? resume : dep);
      if (forecast.handoffs?.[target] === cell) forecast.handoffs[target] = resume;
    }
    const index = Math.max(...forecast.chain.map((step,index) => step.some(value => state.attempts?.[value]) ? index : -1));
    forecast.chain.splice(index + 1, 0, [repair], [resume]);
  } else if (edit.kind === 'resume') {
    const sourceCell = edit.source ?? cell;
    if (state.steps[sourceCell] !== operator || sourceCell !== cell && state.attempts?.[cell]) throw Error('PLAN_EDIT_INVALID: a prior reading can replace only an unopened node of the same operator');
    const waiting = state.attempts?.[sourceCell]?.status === 'waiting';
    const response = await acceptedCurrent(root, session, state, sourceCell, waiting ? 'waiting' : 'blocked');
    const review = waiting ? await waitingReviewBinding(root, session, state, sourceCell, edit.integrity) : null;
    if (!waiting && edit.integrity) throw Error('PLAN_EDIT_INVALID: integrity re-review must name an accepted waiting review');
    const originalRequest = JSON.parse(readFileSync(path.join(branchPath(session, sourceCell),'request/request.json')));
    if (sourceCell !== cell && !isDeepStrictEqual(originalRequest.goal, forecast.goals[cell])) throw Error('PLAN_EDIT_INVALID: the prior reading belongs to a different logical goal');
    const routing = JSON.parse(readFileSync(path.join(root, 'routing.json')));
    const { loadOperatorPackages } = await import('./operator-md.mjs');
    const packages = await loadOperatorPackages(root);
    const pkg = packages.find(p => p.manifest.id === operator);
    const stop = pkg?.en.tables.stops?.rows.find(row => String(row.code).replaceAll('`','') === response.stop);
    // Restatements require their exact content-bound decision. Other re-entries retain the
    // ordinary operator resume and typed stop gates at dispatch; an external stop cannot be edited.
    if (review) {
      // The awaited kind owns the return route; its sealed review binding is checked at admission.
    } else if (response.stop === 'RESTATEMENT_UNCONFIRMED') {
      const decisionId = response.interaction?.decisionId, choice = state.choices?.[decisionId];
      const reviewSource=JSON.parse(readFileSync(path.join(root,'resources/interaction.json'))).delegatedRestatement?.scopeReviewSource;
      if (['coordinator',reviewSource].filter(Boolean).includes(choice?.selectedBy)) {
        const { delegatedRestatementErrors } = await import('./restatement-delegation.mjs');
        const [step, parallel] = sourceCell.split('/').map(Number);
        const projected = { ...originalRequest, decisionId, selectedOption: choice.selected, resume: { step, parallel, token: decisionId } };
        const errors = await delegatedRestatementErrors(root, branchPath(session, sourceCell), state, projected, { phase: 'predispatch' });
        if (errors.length) throw Error('PLAN_REENTRY_UNAUTHORIZED: ' + errors.join('\n'));
      } else if (choice?.selectedBy !== 'user') throw Error('PLAN_REENTRY_UNAUTHORIZED: the rendered reading has no actual user answer or verified delegated review');
    } else if (operator === 'interface.draw' && response.stop === 'DIRECTION_CHOICE_REQUIRED') {
      const { artChoiceErrors } = await import('./art-direction.mjs');
      const decisionId = response.interaction?.decisionId, choice = state.choices?.[decisionId];
      const [step, parallel] = sourceCell.split('/').map(Number);
      const errors = await artChoiceErrors(root, branchPath(session, sourceCell), state, { ...originalRequest, decisionId, selectedOption: choice?.selected, resume: { step, parallel, token: decisionId } });
      if (errors.length) throw Error('PLAN_REENTRY_UNAUTHORIZED: ' + errors.join('\n'));
    } else {
      const shared = JSON.parse(readFileSync(path.join(root, 'operators/errors.json'))).codes;
      const own = JSON.parse(readFileSync(path.join(root, 'operators', operator.replaceAll('.','-'), 'errors.json'))).codes;
      const definition = own[response.stop] ?? shared[response.stop];
      if (!stop || routing.routes?.[operator]?.[definition?.domain]?.kind !== 'resume') throw Error('PLAN_REENTRY_UNAUTHORIZED: the accepted stop does not route to this operator resume');
    }
    const next = `pending:${cell}`;
    for (const field of ['steps','goals','reasons','dependencies','evidenceDependencies','presets','nodes']) (forecast[field] ??= {})[next] = structuredClone(forecast[field]?.[cell] ?? (['dependencies','evidenceDependencies'].includes(field) ? [] : {}));
    for (const field of ['units','partitions']) if (forecast[field]?.[cell]) (forecast[field] ??= {})[next] = structuredClone(forecast[field][cell]);
    forecast.nodes[next] = `${forecast.nodes[cell]}:resume:${sourceCell}`;
    forecast.resumes ??= {}; forecast.resumes[next] = sourceCell;
    if (review) (forecast.reviewResumes ??= {})[next] = review;
    for (const target of Object.keys(forecast.dependencies)) if (target !== next && target !== cell) {
      forecast.dependencies[target] = forecast.dependencies[target].map(dep => dep === cell ? next : dep);
      forecast.evidenceDependencies[target] = (forecast.evidenceDependencies[target] ?? []).map(dep => dep === cell ? next : dep);
      if (forecast.handoffs?.[target] === cell) forecast.handoffs[target] = next;
    }
    const index = sourceCell === cell ? Math.max(...forecast.chain.map((step,index)=>step.some(cell=>state.attempts?.[cell])?index:-1)) : forecast.chain.findIndex(step => step.includes(cell));
    if (sourceCell === cell) {
      // Preserve the unopened independent prefix: its authored Next edge may come from a
      // sealed parallel peer. Re-enter immediately before the first consumer of this owner.
      const consumesResume = target => [...(forecast.dependencies[target] ?? []), ...(forecast.evidenceDependencies[target] ?? []), ...(forecast.units?.[target]?.dependsOn ?? []), forecast.handoffs?.[target]].some(owner => owner === next || owner === cell);
      const consumer = forecast.chain.findIndex((step, position) => position > index && step.some(consumesResume));
      if (consumer < 0) forecast.chain.splice(index + 1, 0, [next]);
      else {
        const group = forecast.chain[consumer];
        const independent = group.filter(target => !consumesResume(target));
        const dependent = group.filter(consumesResume);
        forecast.chain.splice(consumer, 1, ...(independent.length ? [independent] : []), [next], dependent);
      }
    }
    else {
      // Replace the unopened logical node in place; its independent peers retain their work.
      // The mapping below still refuses a partially dispatched parallel step.
      forecast.chain[index] = forecast.chain[index].map(peer => peer === cell ? next : peer);
      for (const field of ['steps','goals','reasons','dependencies','evidenceDependencies','presets','nodes','fanout','handoffs']) delete forecast[field]?.[cell];
    }
  } else if (edit.kind === 'partition') {
    if (state.attempts?.[cell] || state.requestHashes?.[cell] || forecast.partitions?.[cell] || !Number.isInteger(forecast.goals[cell]?.doneWhen)) throw Error('PLAN_EDIT_INVALID: partition only an unopened, unsplit runtime delivery goal');
    const set = routeObligation(state, operator, edit.env, edit.routes, forecast.goals[cell].doneWhen), id = obligationId(set);
    if (Object.values(forecast.obligations ?? {}).some(prior => prior.kind === 'routes' && prior.goal === set.goal)) throw Error('GOAL_PARTITION_UNBOUND: the goal already has its immutable explicit route mapping');
    const selected = set.members.filter(member => member.goal === forecast.goals[cell].doneWhen);
    if (!selected.length) throw Error('PLAN_EDIT_INVALID: route partition must name the required routes of the unchanged goal');
    (forecast.obligations ??= {})[id] = set;
    const expanded = selected.map(member => `route:${cell}:${member.id}`);
    selected.forEach((member,index) => {
      const target = expanded[index];
      for (const field of ['steps','goals','reasons','dependencies','evidenceDependencies','presets','nodes','imports']) if (forecast[field]?.[cell] !== undefined) (forecast[field] ??= {})[target] = structuredClone(forecast[field][cell]);
      forecast.nodes[target] = `${forecast.nodes[cell]}:route:${member.id}`;
      // Route-local mutation plans, commits and approvals are frozen by each real invocation; never
      // copy a different route's desiredState or target head into its sibling.
      forecast.presets[target] = { routeKey: member.id, env: set.env, operation: 'serve' };
      (forecast.partitions ??= {})[target] = { set: id, member: member.id };
      if (forecast.handoffs?.[cell]) forecast.handoffs[target] = forecast.handoffs[cell];
    });
    for (const target of Object.keys(forecast.dependencies)) if (!expanded.includes(target)) {
      forecast.dependencies[target] = forecast.dependencies[target].flatMap(dep => dep === cell ? expanded : [dep]);
      forecast.evidenceDependencies[target] = (forecast.evidenceDependencies[target] ?? []).flatMap(dep => dep === cell ? expanded : [dep]);
      if (forecast.handoffs?.[target] === cell) forecast.handoffs[target] = expanded.at(-1);
    }
    for (const goal of Object.values(forecast.goals)) if (goal.prerequisite === cell) goal.prerequisite = expanded[0];
    const index = forecast.chain.findIndex(step => step.includes(cell));
    const peers = forecast.chain[index].filter(peer => peer !== cell);
    if (peers.some(peer => state.attempts?.[peer])) throw Error('PLAN_EDIT_BUSY: a dispatched parallel peer keeps its frozen coordinate');
    forecast.chain.splice(index, 1, ...(peers.length ? [peers] : []), ...expanded.map(target => [target]));
    for (const field of ['steps','goals','reasons','dependencies','evidenceDependencies','presets','nodes','fanout','handoffs','imports']) delete forecast[field]?.[cell];
  } else {
    if (state.attempts?.[cell] || forecast.fanout?.[cell] !== 'units') throw Error('PLAN_EDIT_INVALID: expand only an unopened declared unit fanout');
    const response = await acceptedCurrent(root, session, state, edit.producer);
    const { loadUnits, planOperatorOf } = await import('./validate-request.mjs');
    const { loadOperatorPackages } = await import('./operator-md.mjs');
    const packages = await loadOperatorPackages(root);
    const producer = planOperatorOf(operator, packages)?.manifest.id;
    if (state.steps[edit.producer] !== producer || !forecast.evidenceDependencies[cell]?.includes(edit.producer)) throw Error('PLAN_EDIT_INVALID: units must come from this fanout declared plan owner');
    const ref = response.fields?.units;
    if (typeof ref !== 'string') throw Error('PLAN_EDIT_INVALID: matched plan has no declared units output');
    const loaded = await loadUnits(root, path.join(branchPath(session, edit.producer), ref));
    if (loaded.errors.length) throw Error(loaded.errors.join('\n'));
    const targets = (state.mission.doneWhen ?? []).map((line,index)=>line.producedBy === operator ? index : null).filter(index=>index !== null);
    if (targets.length > 1 && loaded.units.units.some(unit=>!targets.includes(edit.goals?.[unit.id]))) throw Error('PLAN_UNIT_GOALS_REQUIRED: map every accepted unit to the exact confirmed done-when line this operator evidences');
    if (Object.keys(edit.goals ?? {}).some(id=>!loaded.units.units.some(unit=>unit.id === id)) || Object.values(edit.goals ?? {}).some(index=>!targets.includes(index))) throw Error('PLAN_UNIT_GOALS_INVALID: unit goal mapping must name accepted units and confirmed lines owned by this operator');
    const input = `step-${edit.producer.split('/')[0]}/parallel-${edit.producer.split('/')[1]}/${ref}`;
    const set = await unitObligation(root, session, state, operator, input, edit.goals ?? {}), id = obligationId(set);
    (forecast.obligations ??= {})[id] = set;
    const requiredIds = new Set(set.members.map(member => member.id));
    const ordered = [], pending = loaded.units.units.filter(unit => requiredIds.has(unit.id));
    while (pending.length) {
      const index = pending.findIndex(unit => unit.dependsOn.every(id => ordered.some(prior => prior.id === id)));
      if (index < 0) throw Error('PLAN_UNIT_CYCLE: accepted units cannot be scheduled in dependency order');
      ordered.push(pending.splice(index,1)[0]);
    }
    const expanded = ordered.map(unit => `unit:${cell}:${unit.id}`);
    ordered.forEach((unit, index) => {
      const target = expanded[index];
      for (const field of ['steps','goals','reasons','dependencies','evidenceDependencies','presets','nodes']) (forecast[field] ??= {})[target] = structuredClone(forecast[field]?.[cell] ?? {});
      forecast.nodes[target] = `${forecast.nodes[cell]}:unit:${unit.id}`;
      if (edit.goals?.[unit.id] !== undefined) forecast.goals[target] = { doneWhen: edit.goals[unit.id] };
      forecast.units ??= {}; forecast.units[target] = { id: unit.id, input: `step-${edit.producer.split('/')[0]}/parallel-${edit.producer.split('/')[1]}/${ref}` };
      (forecast.partitions ??= {})[target] = { set: id, member: unit.id };
      forecast.units[target].dependsOn = unit.dependsOn.map(id => expanded[ordered.findIndex(unit => unit.id === id)]);
      forecast.dependencies[target].push(...forecast.units[target].dependsOn);
      if (forecast.handoffs?.[cell]) forecast.handoffs[target] = forecast.handoffs[cell];
    });
    for (const target of Object.keys(forecast.dependencies)) if (!expanded.includes(target)) {
      forecast.dependencies[target] = forecast.dependencies[target].flatMap(dep => dep === cell ? expanded : [dep]);
      forecast.evidenceDependencies[target] = (forecast.evidenceDependencies[target] ?? []).flatMap(dep => dep === cell ? expanded : [dep]);
      if (forecast.handoffs?.[target] === cell) forecast.handoffs[target] = expanded.at(-1);
    }
    for (const goal of Object.values(forecast.goals)) if (goal.prerequisite === cell) goal.prerequisite = expanded[0];
    const index = forecast.chain.findIndex(step => step.includes(cell));
    if (forecast.chain[index].length !== 1) throw Error('PLAN_EDIT_INVALID: a fanout owns its whole planned step');
    forecast.chain.splice(index, 1, ...expanded.map(target => [target]));
    for (const field of ['steps','goals','reasons','dependencies','evidenceDependencies','presets','nodes','fanout','handoffs']) delete forecast[field]?.[cell];
  }
  // Execution coordinates are immutable. Pull independent retained groups ahead of work that
  // receives fresh coordinates, then project pending groups in stable dependency order.
  const groups = forecast.chain.map((cells, index) => ({ cells, index, fixed: cells.some(cell => state.attempts?.[cell]), before: new Set() }));
  const groupOf = new Map(groups.flatMap(group => group.cells.map(cell => [cell, group])));
  const edge = (source, target) => {
    const before = groupOf.get(source), after = groupOf.get(target);
    if (!before || !after) return;
    if (before === after) throw Error('PLAN_EDIT_DEPENDENCY: dependent cells cannot occupy the same parallel step');
    after.before.add(before);
  };
  for (const group of groups) for (const cell of group.cells) {
    if (group.fixed && !state.attempts?.[cell]) throw Error('PLAN_EDIT_BUSY: seal or explicitly reschedule every peer of a dispatched parallel step');
    for (const dependency of [...(forecast.dependencies[cell] ?? []), ...(forecast.evidenceDependencies[cell] ?? []), ...(forecast.units?.[cell]?.dependsOn ?? [])]) edge(dependency, cell);
    if (forecast.handoffs?.[cell]) edge(forecast.handoffs[cell], cell);
    if (forecast.goals?.[cell]?.prerequisite) edge(cell, forecast.goals[cell].prerequisite);
  }
  const ordered = [], emitted = new Set();
  const append = group => { ordered.push(group); emitted.add(group); };
  for (const group of groups.filter(group => group.fixed)) {
    if ([...group.before].some(dependency => !emitted.has(dependency))) throw Error('PLAN_EDIT_DEPENDENCY: retained execution cannot follow an unopened or later prerequisite');
    append(group);
  }
  const pending = groups.filter(group => !group.fixed);
  while (pending.length) {
    const index = pending.findIndex(group => [...group.before].every(dependency => emitted.has(dependency)));
    if (index < 0) throw Error('PLAN_EDIT_DEPENDENCY: pending forecast has no dependency-ordered projection');
    append(pending.splice(index, 1)[0]);
  }
  forecast.chain = ordered.map(group => group.cells);
  const mapping = new Map(); let nextStep = Math.max(0,...Object.keys(state.attempts ?? {}).map(cell=>Number(cell.split('/')[0])));
  const occupied = new Set(readdirSync(session).filter(name=>/^step-\d+$/.test(name)).map(name=>Number(name.slice(5))));
  for (const step of forecast.chain) {
    const fixed = step.filter(cell => state.attempts?.[cell]);
    if (fixed.length && fixed.length !== step.length) throw Error('PLAN_EDIT_BUSY: seal or explicitly reschedule every peer of a dispatched parallel step');
    if (fixed.length) for (const cell of fixed) mapping.set(cell, cell);
    else { do { nextStep += 1; } while (occupied.has(nextStep)); step.forEach((cell,index) => mapping.set(cell, `${nextStep}/${index+1}`)); }
  }
  const map = cell => mapping.get(cell) ?? cell;
  const result = structuredClone(forecast);
  result.chain = forecast.chain.map(step => step.map(map));
  for (const field of ['steps','goals','reasons','dependencies','evidenceDependencies','handoffs','requestRefs','presets','fanout','imports','nodes','resumes','units','repairs','repairDependencies','reviewResumes','retries','rebinds','partitions']) result[field] = Object.fromEntries(Object.entries(forecast[field] ?? {}).filter(([cell]) => mapping.has(cell)).map(([cell,value]) => [map(cell),structuredClone(value)]));
  for (const field of ['sourceReviews','sourceRepairs']) result[field] = Object.fromEntries(Object.entries(forecast[field] ?? {}).map(([cell,value]) => [map(cell),structuredClone(value)]));
  remapSourceReviews(result,map);
  for (const goal of Object.values(result.goals)) if (goal.prerequisite) goal.prerequisite = map(goal.prerequisite);
  for (const field of ['dependencies','evidenceDependencies']) for (const [cell,deps] of Object.entries(result[field])) result[field][cell] = deps.map(map);
  for (const [cell,owner] of Object.entries(result.handoffs)) result.handoffs[cell] = map(owner);
  for (const repair of Object.values(result.repairs ?? {})) { repair.source = map(repair.source); repair.resume = map(repair.resume); }
  for (const [cell, dependency] of Object.entries(result.repairDependencies ?? {})) result.repairDependencies[cell] = map(dependency);
  for (const retry of Object.values(result.retries ?? {})) if (retry.rebind) retry.rebind = map(retry.rebind);
  for (const rebind of Object.values(result.rebinds ?? {})) rebind.retry = map(rebind.retry);
  for (const unit of Object.values(result.units)) unit.dependsOn = (unit.dependsOn ?? []).map(map);
  for (const cell of Object.keys(result.steps)) result.requestRefs[cell] = `step-${cell.split('/')[0]}/parallel-${cell.split('/')[1]}/request/request.json`;
  return result;
}

export async function previewRevision(root, session, flags = {}) {
  const { planSession, previewChain } = await import('./plan-chain.mjs');
  const { state, plan } = await planSession(root, session, flags);
  const top = Math.max(0, ...Object.keys(state.attempts ?? {}).map(cell => Number(cell.split('/')[0])), ...readdirSync(session).filter(name => /^step-\d+$/.test(name) && !readdirSync(path.join(session,name)).some(parallel=>existsSync(path.join(session,name,parallel,'import.json')))).map(name => Number(name.slice(5))));
  const active = state.planHistory?.active ? readContext(session, state.planHistory.active, 'plans') : null;
  if (active?.missionVersion === state.mission.version && !flags.edit && !Object.keys(flags.requirements ?? {}).length && !flags.roles?.length) throw Error('PLAN_EDIT_REQUIRED: the unchanged goal keeps its current forecast; use an explicit resume or accepted unit expansion instead of restarting it');
  const forecast = flags.edit && active?.missionVersion === state.mission.version ? await editForecast(root, session, state, active.forecast, flags.edit, top) : offsetForecast(plan, top);
  if (active?.missionVersion === state.mission.version) {
    const previous = await forecastObligations(root, session, state, active.forecast);
    if (previous.errors.length) throw Error(previous.errors.join('\n'));
    for (const [id,set] of previous.sets) if (!isDeepStrictEqual(forecast.obligations?.[id], set)) {
      if (!active.forecast.obligations?.[id] && set.kind === 'routes') continue;
      // A pre-existing unit forecast derives the same obligation without changing its accepted
      // invocations. A new remaining-work forecast still owes every required member.
      (forecast.obligations ??= {})[id] = set;
    }
  }
  if(!flags.edit && active?.missionVersion === state.mission.version) {
    const review=await sourceReviewCoverage(root,session,state,active.forecast);
    if(review.errors.length) throw Error(review.errors.join('\n'));
    if(review.pending.length) throw Error('SOURCE_REVIEW_PENDING: resolve the exact source review before replacing its remaining forecast');
    carrySourceReviews(forecast,active.forecast);
  }
  const errors = await forecastErrors(root, session, state, forecast);
  if (errors.length) throw Error(errors.join('\n'));
  const basis = { mission: scopeHash(state.mission), active: state.planHistory?.active ?? null, chain: state.chain, steps: state.steps, planned: state.planned, choices: state.choices, attempts: state.attempts, requestHashes: state.requestHashes, forecast };
  return { state, forecast, previewHash: fingerprint(basis), preview: previewChain(forecast, state.mission) };
}

async function forecastErrors(root, session, state, forecast) {
  const { loadOperatorPackages } = await import('./operator-md.mjs');
  const { validateChain, loadOperatorGraph, loadMaxParallel, readImportedInputs } = await import('./validate-chain.mjs');
  const packages = await loadOperatorPackages(root), graph = await loadOperatorGraph(root, packages), planned = plannedOf(forecast);
  const offset = Number(forecast.chain[0][0].split('/')[0]) - 1;
  const plannedRequests = Object.fromEntries(Object.keys(forecast.steps).map(cell => [cell, { operatorId: forecast.steps[cell], goal: forecast.goals[cell], requirements: planned[cell].requirements }]));
  const errors = validateChain(root, packages, forecast.chain, forecast.steps, plannedRequests, { graph, forecast, resumeOwners: state.steps, mission: state.mission, maxParallel: await loadMaxParallel(root), planned, coordinateOffset: offset, imported: await readImportedInputs(root, session, {}, { planned }) });
  errors.push(...(await forecastObligations(root, session, state, forecast)).errors);
  const { effectiveBudget, budgetSteps } = await import('./validate-request.mjs');
  // A revision replaces unopened coordinates. Count retained dispatched history and the current
  // forecast, never the obsolete operator labels of displaced, still-unopened cells.
  const budget = effectiveBudget(state), combinedSteps = budgetSteps(state, forecast);
  if (budget && Math.max(...Object.keys(combinedSteps).map(cell => Number(cell.split('/')[0]))) > budget.maxSteps) errors.push('BUDGET_EXHAUSTED: the reviewed forecast exceeds the retained finite step budget');
  if (budget && budget.maxSameOperator !== null) for (const op of new Set(Object.values(combinedSteps))) if (new Set(Object.entries(combinedSteps).filter(([, value]) => value === op).map(([cell]) => cell.split('/')[0])).size > budget.maxSameOperator) errors.push(`BUDGET_EXHAUSTED: the forecast exceeds the retained same-operator budget for ${op}`);
  return errors;
}

export async function commitRevision(root, session, input) {
  if (typeof input?.reason !== 'string' || !input.reason.trim() || !/^sha256:[a-f0-9]{64}$/.test(input.previewHash ?? '')) throw Error('PLAN_REVIEW_REQUIRED: retain the displayed full forecast digest and the concrete reason for replanning');
  return mutateSession(session, async state => {
    const { missionCorrectionBusy } = await import('./session-open.mjs');
    const edit = input.flags?.edit, source = edit?.source ?? edit?.cell;
    const waitingReentry = edit?.kind === 'resume' && state.attempts?.[source]?.status === 'waiting' ? { source, integrity: edit.integrity } : null;
    if (await missionCorrectionBusy(session, state, { waitingReentry })) throw Error('PLAN_BUSY: finish or truthfully seal active invocations before superseding the remaining forecast');
    const beforeErrors = planHistoryErrors(session, state).filter(error => !error.startsWith('PLAN_SCOPE_CHANGED:'));
    if (beforeErrors.length) throw Error(beforeErrors.join('\n'));
    const { v22SessionErrors } = await import('./validate-session.mjs');
    const ledgerErrors = await v22SessionErrors(session, state, root);
    if (ledgerErrors.length) throw Error(ledgerErrors.join('\n'));
    const next = await previewRevision(root, session, input.flags ?? {});
    if (next.previewHash !== input.previewHash) throw Error('PLAN_PREVIEW_STALE: scope, attempts or forecast changed since the complete plan was displayed');
    const previousRecord = state.planHistory?.active ? readContext(session, state.planHistory.active, 'plans') : null;
    if (previousRecord && previousRecord.missionVersion === state.mission.version) {
      const normalized = forecast => offsetForecast(forecast, 1 - Number(forecast.chain[0][0].split('/')[0]));
      if (isDeepStrictEqual(normalized(previousRecord.forecast), normalized(next.forecast))) throw Error('NO_PROGRESS: an identical forecast does not justify replacing current execution; use the exact blocked resume or accepted unit expansion');
    }
    const mission = await retainMission(session, state, { root });
    const forecast = next.forecast, planned = plannedOf(forecast);
    const cells = Object.keys(state.steps ?? {});
    const inventoryCells = cells.filter(cell=>existsSync(branchPath(session,cell)));
    const retained = structuredClone({ chain: state.chain, steps: state.steps, planned: state.planned, choices: state.choices, attempts: state.attempts, requestHashes: state.requestHashes, brief: state.brief, inventoryCells, files: inventory(session, inventoryCells) });
    const prior = state.planHistory?.active ?? null;
    const previousForecast = prior ? readContext(session, prior, 'plans').forecast : null;
    const mappings = Object.entries(previousForecast?.nodes ?? {}).map(([from, node]) => ({ node, from, to: Object.keys(forecast.nodes ?? {}).find(cell => forecast.nodes[cell] === node) ?? null, disposition: state.attempts?.[from] ? 'retained-execution' : 'superseded-forecast' }));
    const record = { version: 1, sessionId: state.id, mission, missionVersion: state.mission.version, scopeHash: scopeHash(state.mission), previous: prior, reason: input.reason, choicesHash: fingerprint(state.choices), previewHash: input.previewHash, at: new Date().toISOString(), forecast, planned, mappings, retained };
    const address = await retainContext(session, 'plans', record);
    state.planHistory ??= { revisions: [] };
    state.planHistory.revisions.push(address); state.planHistory.active = address;
    state.chain = forecast.chain;
    state.steps = { ...state.steps, ...forecast.steps };
    state.planned = { ...state.planned, ...planned };
    for (const [cell, target] of Object.entries(forecast.resumes ?? {})) (state.resumes ??= {})[cell] = { resumes: target, stop: forecast.reviewResumes?.[cell]?.stop ?? JSON.parse(readFileSync(path.join(branchPath(session, target), 'response/response.json'))).stop };
    state.current = forecast.chain.flat().find(cell => !state.attempts?.[cell]) ?? forecast.chain.at(-1)[0];
    state.brief = { ...state.brief, proven: [], blocked: [], next: `Forecast ${state.planHistory.revisions.length} is planned, not executed or verified. Open ${state.current} with its exact request before work.` };
    state.transitions ??= [];
    state.transitions.push({ branch: state.current, event: 'replanned', at: new Date().toISOString(), goalVersion: state.mission.version, note: input.reason, logged: true });
    return { status: 'planned', active: address, forecast, retainedExecutions: Object.keys(retained.attempts ?? {}).length, historicalReuse: 'none' };
  });
}

export function planHistoryErrors(session, state) {
  if (!state.planHistory) return [];
  const errors = []; const history = state.planHistory;
  let previous = null;
  for (const address of history.revisions ?? []) {
    try {
      const record = readContext(session, address, 'plans');
      if (record.sessionId !== state.id || !isDeepStrictEqual(record.previous, previous)) errors.push('PLAN_HISTORY_UNBOUND: forecast lineage differs from its sealed predecessor');
      for (const [id, choice] of Object.entries(record.retained.choices ?? {})) if (!isDeepStrictEqual(choice, state.choices?.[id])) errors.push(`PLAN_HISTORY_TAMPERED: retained user answer ${id} changed`);
      for (const [cell, attempt] of Object.entries(record.retained.attempts ?? {})) if (!isDeepStrictEqual(attempt, state.attempts?.[cell])) errors.push(`PLAN_HISTORY_TAMPERED: retained attempt ${cell} changed`);
      for (const [cell, hash] of Object.entries(record.retained.requestHashes ?? {})) if (state.requestHashes?.[cell] !== hash) errors.push(`PLAN_HISTORY_TAMPERED: retained request commitment ${cell} changed`);
      for (const [cell, operator] of Object.entries(record.retained.steps ?? {})) if ((record.retained.attempts?.[cell] || record.retained.requestHashes?.[cell] || record.retained.inventoryCells?.includes(cell)) && state.steps?.[cell] !== operator) errors.push(`PLAN_HISTORY_TAMPERED: retained coordinate ${cell} changed owner`);
      if (!isDeepStrictEqual(inventory(session, record.retained.inventoryCells ?? []), record.retained.files)) errors.push('PLAN_HISTORY_TAMPERED: retained forecast/request/response inventory changed');
      previous = address;
    } catch (error) { errors.push(error.message); }
  }
  if (!previous || !isDeepStrictEqual(history.active, previous)) errors.push('PLAN_HISTORY_UNBOUND: active forecast must be the sealed final revision');
  if (previous) try {
    const active = readContext(session, previous, 'plans');
    if (active.missionVersion !== state.mission?.version || active.scopeHash !== scopeHash(state.mission)) errors.push('PLAN_SCOPE_CHANGED: derive and seal a new complete forecast for the confirmed scope');
    if (!isDeepStrictEqual(active.forecast.chain, state.chain)) errors.push('PLAN_HISTORY_TAMPERED: active chain differs from its sealed forecast');
    for (const [cell, operator] of Object.entries(active.forecast.steps)) if (state.steps?.[cell] !== operator || !isDeepStrictEqual(state.planned?.[cell], active.planned[cell])) errors.push(`PLAN_HISTORY_TAMPERED: active planned cell ${cell} changed`);
  } catch (error) { errors.push(error.message); }
  return errors;
}

export function activePlanView(session, state) {
  const errors = planHistoryErrors(session, state);
  if (errors.length) throw Error(errors.join('\n'));
  if (!state.planHistory) return { state, coordinateOffset: 0 };
  const active = readContext(session, state.planHistory.active, 'plans');
  const cells = activePlanCells(state);
  return { state: { ...state, steps: Object.fromEntries(Object.entries(state.steps).filter(([cell]) => cells.has(cell))), planned: active.planned }, forecast: active.forecast, resumeOwners: state.steps, coordinateOffset: Number(state.chain[0][0].split('/')[0]) - 1 };
}

// A unit dependency names logical work. Old sealed forecasts can still name a failed execution;
// only its unique recorded retry lineage, opened under that exact authority, can replace its proof.
export async function acceptedUnitDependency(root, session, state, dependency) {
  const { forecast } = activePlanView(session, state);
  const unit = forecast?.units?.[dependency], operator = forecast?.steps?.[dependency];
  if (!unit || !operator) throw Error('PLAN_UNIT_UNBOUND: dependency must name one declared logical unit');
  const seen = new Set(), proved = new Set(); let cell = dependency;
  const ancestors = new Set([cell]);
  while (forecast.retries?.[cell]) {
    cell = forecast.retries[cell].source;
    if (ancestors.has(cell)) throw Error('PLAN_UNIT_UNBOUND: retry dependency lineage contains a cycle');
    ancestors.add(cell);
  }
  const proof = async target => {
    if (proved.has(target)) return;
    const status = state.attempts?.[target]?.status;
    if (!['matched','mismatched','inconclusive','blocked'].includes(status)) throw Error(`PLAN_PROOF_UNAVAILABLE: latest unit successor ${target} has no terminal accepted invocation`);
    await acceptedCurrent(root, session, state, target, status); proved.add(target);
  };
  while (true) {
    if (seen.has(cell)) throw Error('PLAN_UNIT_UNBOUND: retry dependency lineage contains a cycle');
    seen.add(cell);
    const currentUnit = forecast.units?.[cell];
    if (forecast.steps?.[cell] !== operator || currentUnit?.id !== unit.id || currentUnit?.input !== unit.input) throw Error('PLAN_UNIT_UNBOUND: retry dependency changes operator, logical unit or accepted plan input');
    if (state.attempts?.[cell]) {
      const actual = requestAt(session, cell);
      if (actual.operatorId !== operator || actual.unit !== unit.id || actual.inputs?.units !== unit.input) throw Error('PLAN_UNIT_UNBOUND: dependency differs from its actual operator, logical unit or accepted plan input');
    }
    const successors = Object.entries(forecast.retries ?? {}).filter(([,retry]) => retry.source === cell);
    if (successors.length > 1) throw Error('PLAN_UNIT_UNBOUND: logical unit has ambiguous retry successors');
    if (!successors.length) {
      if (state.attempts?.[cell]?.status !== 'matched') throw Error(`PLAN_PROOF_UNAVAILABLE: latest unit successor ${cell} has no sealed matched invocation`);
      await proof(cell);
      const { assertCurrentProducerDelivery } = await import('./producer-import.mjs');
      const [step, parallel] = cell.split('/').map(Number);
      await assertCurrentProducerDelivery(root, state.id, step, parallel, { hostRoot: state.workflowOwner.sourceRoot });
      return cell;
    }
    const [next, retry] = successors[0];
    if (seen.has(next)) throw Error('PLAN_UNIT_UNBOUND: retry dependency lineage contains a cycle');
    if (!['mismatched','inconclusive','blocked'].includes(state.attempts?.[cell]?.status)) throw Error('PLAN_RETRY_UNBOUND: a retry dependency must replace its exact failed invocation');
    await proof(cell); await proof(next);
    const original = requestAt(session, cell), request = requestAt(session, next);
    const context = readContext(session, state.attempts[next].context, 'invocations');
    if (context.phase !== 'opening' || !context.planRevision) throw Error('PLAN_RETRY_UNBOUND: unit successor needs its original admitted forecast authority');
    const opening = readContext(session, context.planRevision, 'plans');
    if (opening.sessionId !== state.id || opening.missionVersion !== state.mission.version || opening.scopeHash !== scopeHash(state.mission) || !isDeepStrictEqual(opening.forecast?.retries?.[next], retry)) throw Error('PLAN_RETRY_UNBOUND: successor differs from its exact invocation forecast retry authority');
    if (retry.attempt !== original.attempt.id || retry.requestHash !== state.requestHashes[cell] || retry.fingerprint !== state.attempts[cell].evidenceManifest.fingerprint) throw Error('PLAN_RETRY_UNBOUND: successor does not bind its original failed request and evidence');
    for (const target of [cell,next]) {
      const plannedUnit = opening.forecast?.units?.[target], actual = requestAt(session, target);
      if (opening.forecast?.steps?.[target] !== operator || plannedUnit?.id !== unit.id || plannedUnit?.input !== unit.input || actual.operatorId !== operator || actual.unit !== unit.id || actual.inputs?.units !== unit.input) throw Error('PLAN_UNIT_UNBOUND: admitted successor changes operator, logical unit or accepted plan input');
    }
    if (!isDeepStrictEqual(request.goal, original.goal) || !isDeepStrictEqual(opening.forecast.goals?.[next], request.goal)) throw Error('PLAN_RETRY_UNAUTHORIZED: unit successor must retain the original source goal');
    assertRetryRequest(state, next, original, request, retry);
    if (retry.rebind) {
      const rebind = opening.forecast.rebinds?.[retry.rebind];
      if (rebind?.retry !== next || !isDeepStrictEqual(forecast.rebinds?.[retry.rebind], rebind)) throw Error('PLAN_REBIND_UNBOUND: successor lost its exact prior binding repair');
      const response = await acceptedCurrent(root, session, state, retry.rebind);
      const route = JSON.parse(readFileSync(path.join(branchPath(session, retry.rebind), response.fields.route)));
      if (!samePath(route.checkout.diskPath, request.environment?.workspace?.worktree) || route.sourceHead !== request.environment.workspace.revision || !isDeepStrictEqual(route.writeRoots, opening.forecast.presets[retry.rebind].declaredWriteRoots)) throw Error('PLAN_REBIND_UNBOUND: unit successor differs from its accepted repaired checkout');
    }
    cell = next;
  }
}

export async function planAdmissionErrors(root, session, state, request) {
  const view = activePlanView(session, state);
  if (!view.forecast) return [];
  if (request.exchange) return nestedPlanAdmissionErrors(root, session, state, request, view.forecast);
  const forecast = view.forecast, cell = `${request.step}/${request.parallel}`, errors = [];
  errors.push(...await partitionAdmissionErrors(root, session, state, request, forecast));
  if (!forecast.sourceReviews?.[cell]) errors.push(...await sourceReviewAdmissionErrors(root,session,state,request,forecast));
  if (!isDeepStrictEqual(request.goal, forecast.goals[cell])) errors.push('PLAN_GOAL_UNBOUND: the invocation must bind the current reviewed logical goal mapping');
  const resume = request.resume ? `${request.resume.step}/${request.resume.parallel}` : null;
  if (resume !== (forecast.resumes?.[cell] ?? null)) errors.push('PLAN_REENTRY_UNBOUND: invocation resume differs from the reviewed execution mapping');
  if (resume) try {
    if (forecast.reviewResumes?.[cell]) errors.push(...await resolvedWaitingReplanErrors(root, session, state, request));
    else await acceptedCurrent(root, session, state, resume, 'blocked');
  } catch (error) { errors.push(error.message); }
  const retry = forecast.retries?.[cell];
  if (retry) try {
    const proved = await retryBinding(root, session, state, retry.source, retry);
    const expected = { ...proved.binding, ...(retry.rebind ? { rebind: retry.rebind } : {}) };
    if (!isDeepStrictEqual(retry, expected)) throw Error('PLAN_RETRY_UNBOUND: retry identity differs from its exact sealed failed invocation');
    const original = proved.request;
    assertRetryRequest(state, cell, original, request, retry);
    const after = request.environment ?? {};
    if (retry.rebind) {
      const rebind = forecast.rebinds?.[retry.rebind];
      if (!rebind || rebind.retry !== cell) throw Error('PLAN_REBIND_UNBOUND: retry has no exact prior binding repair');
      await rebindBinding(root, session, state, original, { source: rebind.source, writeRoots: forecast.presets[retry.rebind].declaredWriteRoots });
      const response = await acceptedCurrent(root, session, state, retry.rebind);
      const route = JSON.parse(readFileSync(path.join(branchPath(session, retry.rebind), response.fields.route)));
      if (!samePath(route.checkout.diskPath, after.workspace?.worktree) || route.sourceHead !== after.workspace?.revision || !isDeepStrictEqual(route.writeRoots, forecast.presets[retry.rebind].declaredWriteRoots)) throw Error('PLAN_REBIND_UNBOUND: retry must bind the exact newly accepted checkout, head and write roots');
    }
  } catch (error) { errors.push(error.message); }
  const rebind = forecast.rebinds?.[cell];
  if (rebind) try {
    const retry = forecast.retries?.[rebind.retry];
    if (!retry || retry.rebind !== cell) throw Error('PLAN_REBIND_UNBOUND: a binding repair must enable its exact reviewed retry');
    const proved = await retryBinding(root, session, state, retry.source, retry);
    const expected = await rebindBinding(root, session, state, proved.request, { source: rebind.source, writeRoots: request.requirements?.declaredWriteRoots });
    if (request.operatorId !== 'workspace.bind' || !isDeepStrictEqual(request.requirements, expected.requirements)) throw Error('PLAN_REBIND_UNBOUND: repair changes more than the approved exact checkout write roots');
  } catch (error) { errors.push(error.message); }
  const repair = forecast.repairs?.[cell];
  if (repair) try {
    const { loadOperatorGraph, repairShapeErrors } = await import('./validate-chain.mjs');
    errors.push(...repairShapeErrors(await loadOperatorGraph(root), forecast, cell));
    await runtimeRepairSource(root, session, state, repair.source, repair.wall, request.requirements);
    if (request.operatorId !== 'runtime.serve' || Object.keys(request.inputs ?? {}).length || request.environment?.workspace || (request.environment?.writes ?? []).some(alias => alias !== '@worktrees/sessions/central-runtime')) errors.push('PLAN_REPAIR_UNBOUND: attestation repair carries no product input or source write authority');
  } catch (error) { errors.push(error.message); }
  const repairedBy = forecast.repairDependencies?.[cell];
  if (repairedBy) try {
    const response = await acceptedCurrent(root, session, state, repairedBy);
    const binding = forecast.repairs?.[repairedBy];
    const delta = JSON.parse(readFileSync(path.join(branchPath(session, repairedBy), response.fields.delta)));
    if (!binding || binding.resume !== cell || binding.source !== resume || !delta.runtimeLadder?.reused || delta.runtimeLadder.integration !== null || delta.runtimeLadder.wantedCommit !== binding.commit || !delta.runtimeLadder.contains?.includes(binding.commit) || response.fields.changes) errors.push('PLAN_REPAIR_UNPROVED: preflight re-entry needs the matched exact runtime attestation, without integration changes');
    const source = JSON.parse(readFileSync(path.join(branchPath(session, binding.source), 'request/request.json')));
    if (!isDeepStrictEqual(request.requirements, source.requirements)) errors.push('PLAN_REPAIR_UNBOUND: preflight re-entry reruns the same complete requirements');
  } catch (error) { errors.push(error.message); }
  const unit = forecast.units?.[cell];
  if (unit && (request.unit !== unit.id || request.inputs?.units !== unit.input)) errors.push('PLAN_UNIT_UNBOUND: invocation must bind the exact accepted unit and plan output');
  if (unit) for (const dependency of unit.dependsOn ?? []) try { await acceptedUnitDependency(root, session, state, dependency); } catch (error) { errors.push(error.message); }
  if (forecast.handoffs?.[cell]) {
    const { loadOperatorGraph, dependencyHandoffErrors } = await import('./validate-chain.mjs');
    const graph = await loadOperatorGraph(root);
    errors.push(...dependencyHandoffErrors(graph, forecast, cell));
    if (!errors.length) try {
      const owner = forecast.handoffs[cell], response = await acceptedCurrent(root, session, state, owner);
      const source = graph.get(forecast.steps[owner]), consumer = graph.get(request.operatorId);
      if (source.id !== 'workspace.bind') {
        const prefix = `step-${owner.split('/')[0]}/parallel-${owner.split('/')[1]}/`;
        const bound = consumer.inputs.some(input => source.outputs.has(input.kind) && typeof response.fields?.[input.kind] === 'string' && request.inputs?.[input.kind] === prefix + response.fields[input.kind]);
        if (!bound) errors.push('PLAN_HANDOFF_UNBOUND: the invocation must actually consume its declared dependency owner accepted output');
      }
    } catch (error) { errors.push(error.message); }
  }
  return errors;
}

// A nested exchange executes its parent's declared review, not another forecast delivery node.
// Reuse the accepted-input gate for waiting checkpoints and sealed-child replay after parent resume.
async function nestedPlanAdmissionErrors(root, session, state, request, forecast) {
  const errors = [], say = message => errors.push('PLAN_EXCHANGE_UNBOUND: ' + message);
  try {
    const cell = `${request.step}/${request.parallel}`, branch = branchPath(session, cell);
    if (!/^[a-z][a-z-]*$/.test(request.exchange)) throw Error('PLAN_EXCHANGE_UNBOUND: exchange must be a declared nested name');
    const parent = JSON.parse(readFileSync(path.join(branch, 'request/request.json')));
    const response = JSON.parse(readFileSync(path.join(branch, 'response/response.json')));
    const attempt = state.attempts?.[cell], child = state.attempts?.[`${cell}/${request.exchange}`];
    if (request.goal !== undefined || request.resume != null || Object.keys(request.requirements ?? {}).length) say('the parent owns the goal, re-entry and requirements');
    if (request.sessionId !== state.id || parent.sessionId !== state.id || parent.exchange || parent.step !== request.step || parent.parallel !== request.parallel || parent.operatorId !== request.operatorId || forecast.steps[cell] !== request.operatorId) say('the exchange must belong to the current same-cell operator and session');
    if (!attempt?.context || parent.expected?.goalVersion !== state.mission?.version || request.expected?.goalVersion !== parent.expected?.goalVersion) say('the parent must retain its current mission invocation and the child must share that version');
    invocationState(session, state, parent);
    const parentResume = parent.resume ? `${parent.resume.step}/${parent.resume.parallel}` : null;
    if (!isDeepStrictEqual(parent.goal, forecast.goals[cell]) || parentResume !== (forecast.resumes?.[cell] ?? null)) say('the accepted parent must retain its reviewed goal and re-entry mapping');
    const { loadOperatorPackages, exchangeOf, kindOf } = await import('./operator-md.mjs');
    const op = (await loadOperatorPackages(root)).find(pkg => pkg.manifest.id === request.operatorId)?.en;
    const outputs = (op?.tables.outputs?.rows ?? []).filter(row => exchangeOf(kindOf(row.file)) === request.exchange);
    if (!outputs.length) say('the owning operator must declare this exchange output');
    const { localAcceptedInputErrors } = await import('./validate-request.mjs');
    if (child?.status === 'matched') {
      const childRequest = JSON.parse(readFileSync(path.join(branch, request.exchange, 'request/request.json')));
      if (!isDeepStrictEqual(childRequest, request) || child.id !== request.attempt?.id) say('replay must retain the exact accepted child request and attempt');
      const childResponse = JSON.parse(readFileSync(path.join(branch, request.exchange, 'response/response.json')));
      const kind = outputs.map(row => kindOf(row.kind)).find(kind => typeof childResponse.fields?.[kind] === 'string');
      if (!kind) say('accepted child must retain its declared exchange output');
      else errors.push(...await localAcceptedInputErrors(session, state, `step-${request.step}/parallel-${request.parallel}/${request.exchange}/${childResponse.fields[kind]}`, kind));
    } else if (attempt?.status !== 'waiting' || response.status !== 'waiting' || response.awaiting?.exchange !== request.exchange || !outputs.some(row => kindOf(row.kind) === response.awaiting?.kind)) say('a new exchange requires its exact accepted waiting parent and declared awaited kind');
    const prefix = `step-${request.step}/parallel-${request.parallel}/`;
    const inputs = Object.entries(request.inputs ?? {});
    if (!inputs.length) say('the exchange must consume its own parent checkpoint');
    for (const [kind, ref] of inputs) {
      if (typeof ref !== 'string' || !ref.startsWith(prefix + 'response/')) say('every exchange input must name an output of its own parent');
      else errors.push(...await localAcceptedInputErrors(session, state, ref, kind, request));
    }
  } catch (error) { errors.push(error.message); }
  return errors;
}

export function mappedPlanRequests(session, state, requests, forecast) {
  if (!forecast) return requests;
  const out = { ...requests };
  for (const [cell, request] of Object.entries(requests)) if (request && state.attempts?.[cell]?.context) {
    invocationState(session, state, request);
    // The original goal remains in the sealed invocation. Chain validation checks its current
    // logical destination, not a claim that an obsolete physical coordinate was executed.
    out[cell] = { ...request, goal: forecast.goals[cell] };
  }
  return out;
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const [command, target, inputFile] = process.argv.slice(2);
  try {
    if (!target || !['preview', 'commit'].includes(command)) throw Error('usage: plan-history.mjs preview <session> [flags.json] | commit <session> <reviewed-plan.json>');
    const input = inputFile ? JSON.parse(readFileSync(path.resolve(inputFile), 'utf8')) : {};
    const result = command === 'preview' ? await previewRevision(root, path.resolve(target), input) : await commitRevision(root, path.resolve(target), input);
    if (command === 'preview') process.stdout.write(`${result.preview}\n\n${JSON.stringify({ previewHash: result.previewHash, flags: input }, null, 2)}\n`);
    else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}

// Finish module evaluation before following dynamic validator imports back to this module.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void main();
