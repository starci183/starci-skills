// The planner's immutable forecasts and explicit replacement of unexecuted work. This module never
// changes an invocation coordinate, marks a forecast as delivered, or imports a historical result.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, lstatSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { retainContext, readContext, retainMission, invocationState } from './mission-history.mjs';
import { scopeHash } from './mission-scope.mjs';
import { mutateSession } from './session-lock.mjs';
import { evidenceManifestErrors } from './evidence-manifest.mjs';

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
  for (const field of ['steps', 'goals', 'reasons', 'dependencies', 'evidenceDependencies', 'handoffs', 'requestRefs', 'presets', 'fanout', 'imports', 'nodes', 'resumes', 'units', 'repairs', 'repairDependencies']) out[field] = Object.fromEntries(Object.entries(plan[field] ?? {}).map(([key, value]) => [cell(key), structuredClone(value)]));
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
  const { validateStep } = await import('./validate-step.mjs');
  const result = await validateStep(root, branchPath(session, cell), { operator: true, requestPhase: 'accept' });
  if (result.errors.length) throw Error(result.errors.join('\n'));
  return JSON.parse(readFileSync(path.join(branchPath(session, cell), 'response/response.json')));
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
  if (!edit || !['resume', 'expand', 'repair'].includes(edit.kind) || !forecast.steps[edit.cell]) throw Error('PLAN_EDIT_INVALID: name one current resume, unit expansion or typed repair');
  for (const cell of forecast.chain.flat()) if (state.attempts?.[cell]) await acceptedCurrent(root, session, state, cell, state.attempts[cell].status);
  const cell = edit.cell, operator = forecast.steps[cell];
  if (edit.kind === 'repair') {
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
    const response = await acceptedCurrent(root, session, state, sourceCell, 'blocked');
    const originalRequest = JSON.parse(readFileSync(path.join(branchPath(session, sourceCell),'request/request.json')));
    if (sourceCell !== cell && !isDeepStrictEqual(originalRequest.goal, forecast.goals[cell])) throw Error('PLAN_EDIT_INVALID: the prior reading belongs to a different logical goal');
    const routing = JSON.parse(readFileSync(path.join(root, 'routing.json')));
    const { loadOperatorPackages } = await import('./operator-md.mjs');
    const packages = await loadOperatorPackages(root);
    const pkg = packages.find(p => p.manifest.id === operator);
    const stop = pkg?.en.tables.stops?.rows.find(row => String(row.code).replaceAll('`','') === response.stop);
    // User-owned restatements require the exact content-bound answer. Other re-entries retain the
    // ordinary operator resume and typed stop gates at dispatch; an external stop cannot be edited.
    if (response.stop === 'RESTATEMENT_UNCONFIRMED') {
      if (state.choices?.[response.interaction?.decisionId]?.selectedBy !== 'user') throw Error('PLAN_REENTRY_UNAUTHORIZED: the rendered reading has no actual user answer');
    } else {
      const shared = JSON.parse(readFileSync(path.join(root, 'operators/errors.json'))).codes;
      const own = JSON.parse(readFileSync(path.join(root, 'operators', operator.replaceAll('.','-'), 'errors.json'))).codes;
      const definition = own[response.stop] ?? shared[response.stop];
      if (!stop || routing.routes?.[operator]?.[definition?.domain]?.kind !== 'resume') throw Error('PLAN_REENTRY_UNAUTHORIZED: the accepted stop does not route to this operator resume');
    }
    const next = `pending:${cell}`;
    for (const field of ['steps','goals','reasons','dependencies','evidenceDependencies','presets','nodes']) (forecast[field] ??= {})[next] = structuredClone(forecast[field]?.[cell] ?? (['dependencies','evidenceDependencies'].includes(field) ? [] : {}));
    forecast.nodes[next] = `${forecast.nodes[cell]}:resume:${sourceCell}`;
    forecast.resumes ??= {}; forecast.resumes[next] = sourceCell;
    for (const target of Object.keys(forecast.dependencies)) if (target !== next && target !== cell) {
      forecast.dependencies[target] = forecast.dependencies[target].map(dep => dep === cell ? next : dep);
      forecast.evidenceDependencies[target] = (forecast.evidenceDependencies[target] ?? []).map(dep => dep === cell ? next : dep);
      if (forecast.handoffs?.[target] === cell) forecast.handoffs[target] = next;
    }
    const index = sourceCell === cell ? Math.max(...forecast.chain.map((step,index)=>step.some(cell=>state.attempts?.[cell])?index:-1)) : forecast.chain.findIndex(step => step.includes(cell));
    if (sourceCell === cell) forecast.chain.splice(index + 1, 0, [next]);
    else {
      // Replace the unopened logical node in place; its independent peers retain their work.
      // The mapping below still refuses a partially dispatched parallel step.
      forecast.chain[index] = forecast.chain[index].map(peer => peer === cell ? next : peer);
      for (const field of ['steps','goals','reasons','dependencies','evidenceDependencies','presets','nodes','fanout','handoffs']) delete forecast[field]?.[cell];
    }
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
    const ordered = [], pending = [...loaded.units.units];
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
  for (const field of ['steps','goals','reasons','dependencies','evidenceDependencies','handoffs','requestRefs','presets','fanout','imports','nodes','resumes','units','repairs','repairDependencies']) result[field] = Object.fromEntries(Object.entries(forecast[field] ?? {}).filter(([cell]) => mapping.has(cell)).map(([cell,value]) => [map(cell),structuredClone(value)]));
  for (const goal of Object.values(result.goals)) if (goal.prerequisite) goal.prerequisite = map(goal.prerequisite);
  for (const field of ['dependencies','evidenceDependencies']) for (const [cell,deps] of Object.entries(result[field])) result[field][cell] = deps.map(map);
  for (const [cell,owner] of Object.entries(result.handoffs)) result.handoffs[cell] = map(owner);
  for (const repair of Object.values(result.repairs ?? {})) { repair.source = map(repair.source); repair.resume = map(repair.resume); }
  for (const [cell, dependency] of Object.entries(result.repairDependencies ?? {})) result.repairDependencies[cell] = map(dependency);
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
  const basis = { mission: scopeHash(state.mission), active: state.planHistory?.active ?? null, chain: state.chain, steps: state.steps, planned: state.planned, choices: state.choices, attempts: state.attempts, requestHashes: state.requestHashes, forecast };
  return { state, forecast, previewHash: fingerprint(basis), preview: previewChain(forecast, state.mission) };
}

export async function commitRevision(root, session, input) {
  if (typeof input?.reason !== 'string' || !input.reason.trim() || !/^sha256:[a-f0-9]{64}$/.test(input.previewHash ?? '')) throw Error('PLAN_REVIEW_REQUIRED: retain the displayed full forecast digest and the concrete reason for replanning');
  return mutateSession(session, async state => {
    const { missionCorrectionBusy } = await import('./session-open.mjs');
    if (await missionCorrectionBusy(session, state)) throw Error('PLAN_BUSY: finish or truthfully seal active invocations before superseding the remaining forecast');
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
    const { loadOperatorPackages } = await import('./operator-md.mjs');
    const { validateChain, loadOperatorGraph, loadMaxParallel, readImportedInputs } = await import('./validate-chain.mjs');
    const packages = await loadOperatorPackages(root), graph = await loadOperatorGraph(root, packages);
    const forecast = next.forecast, planned = plannedOf(forecast);
    const offset = Number(forecast.chain[0][0].split('/')[0]) - 1;
    const plannedRequests = Object.fromEntries(Object.keys(forecast.steps).map(cell => [cell, { operatorId: forecast.steps[cell], goal: forecast.goals[cell], requirements: planned[cell].requirements }]));
    const errors = validateChain(root, packages, forecast.chain, forecast.steps, plannedRequests, { graph, forecast, resumeOwners: state.steps, mission: state.mission, maxParallel: await loadMaxParallel(root), planned, coordinateOffset: offset, imported: await readImportedInputs(root, session, {}, { planned }) });
    const { effectiveBudget } = await import('./validate-request.mjs');
    const budget = effectiveBudget(state);
    const combinedSteps = { ...state.steps, ...forecast.steps };
    if (budget && Math.max(...Object.keys(combinedSteps).map(cell => Number(cell.split('/')[0]))) > budget.maxSteps) errors.push('BUDGET_EXHAUSTED: the reviewed forecast exceeds the retained finite step budget');
    if (budget && budget.maxSameOperator !== null) for (const op of new Set(Object.values(combinedSteps))) if (new Set(Object.entries(combinedSteps).filter(([, value]) => value === op).map(([cell]) => cell.split('/')[0])).size > budget.maxSameOperator) errors.push(`BUDGET_EXHAUSTED: the forecast exceeds the retained same-operator budget for ${op}`);
    if (errors.length) throw Error(errors.join('\n'));
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
    for (const [cell, target] of Object.entries(forecast.resumes ?? {})) (state.resumes ??= {})[cell] = { resumes: target, stop: JSON.parse(readFileSync(path.join(branchPath(session, target), 'response/response.json'))).stop };
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

export async function planAdmissionErrors(root, session, state, request) {
  const view = activePlanView(session, state);
  if (!view.forecast) return [];
  if (request.exchange) return nestedPlanAdmissionErrors(root, session, state, request, view.forecast);
  const forecast = view.forecast, cell = `${request.step}/${request.parallel}`, errors = [];
  if (!isDeepStrictEqual(request.goal, forecast.goals[cell])) errors.push('PLAN_GOAL_UNBOUND: the invocation must bind the current reviewed logical goal mapping');
  const resume = request.resume ? `${request.resume.step}/${request.resume.parallel}` : null;
  if (resume !== (forecast.resumes?.[cell] ?? null)) errors.push('PLAN_REENTRY_UNBOUND: invocation resume differs from the reviewed execution mapping');
  if (resume) try { await acceptedCurrent(root, session, state, resume, 'blocked'); } catch (error) { errors.push(error.message); }
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
  if (unit) for (const dependency of unit.dependsOn ?? []) try { await acceptedCurrent(root, session, state, dependency); } catch (error) { errors.push(error.message); }
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
