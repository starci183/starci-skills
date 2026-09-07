// One goal may require several independently accepted invocations. The sealed forecast owns the
// closed obligation set; a branch proves its member, never substitutes for another member.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { readContext, invocationState } from './mission-history.mjs';
import { scopeHash } from './mission-scope.mjs';
import { evidenceManifestErrors } from './evidence-manifest.mjs';
import { verifiesUnits, isJourney } from './unchecked.mjs';

const sha = value => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const json = file => JSON.parse(readFileSync(file, 'utf8'));
const fail = message => { throw Error(`GOAL_PARTITION_UNBOUND: ${message}`); };
const branchOf = (session, cell) => {
  if (!/^[1-9][0-9]*\/[1-9][0-9]*$/.test(cell)) fail('a member names no canonical invocation');
  const [n,m] = cell.split('/'); return path.join(session, `step-${n}`, `parallel-${m}`);
};
export const obligationId = value => sha(JSON.stringify(value));

export function routeObligation(state, operator, env, routes, goal) {
  if (operator !== 'runtime.serve' || typeof env !== 'string' || !/^[a-z][a-z0-9-]*$/.test(env)) fail('route decomposition requires a runtime goal and one declared environment');
  if (state.mission.doneWhen?.[goal]?.producedBy !== operator || !Number.isInteger(goal)) fail('route decomposition must name its existing runtime goal');
  const repositories = state.mission.discovery?.repositories ?? [];
  if (!Array.isArray(routes) || !routes.length || new Set(routes).size !== routes.length) fail('explicitly map the complete required route set for this goal');
  const members = routes.map(routeKey => {
    const repository = repositories.find(repository => routeKey === repository.project+'/'+repository.role);
    if (!repository || repository.project !== state.project || repository.routeRef !== '.workspaces/local/routes/'+routeKey+'/config.json') fail('a route differs from confirmed project/repository ownership');
    return { id: routeKey, goal, repository: structuredClone(repository) };
  }).sort((a,b) => a.id.localeCompare(b.id));
  return { kind: 'routes', operator, missionVersion: state.mission.version, scopeHash: scopeHash(state.mission), env, goal, members };
}

async function sealedInvocation(root, session, state, cell, { operator = null } = {}) {
  const branch = branchOf(session, cell), attempt = state.attempts?.[cell];
  if (attempt?.status !== 'matched' || !attempt.context || !attempt.endedAt || attempt.expected?.goalVersion !== state.mission.version || operator && attempt.operatorId !== operator) fail(`${cell} has no matched current invocation`);
  const errors = await evidenceManifestErrors(branch, attempt.evidenceManifest);
  if (errors.length) fail(errors.join('; '));
  const bytes = readFileSync(path.join(branch, 'request/request.json')), request = JSON.parse(bytes);
  invocationState(session, state, request);
  const response = json(path.join(branch, 'response/response.json'));
  if (state.requestHashes?.[cell] !== sha(bytes) || request.sessionId !== state.id || request.operatorId !== state.steps[cell] || request.attempt?.id !== attempt.id || response.attempt?.id !== attempt.id || response.status !== 'done' || response.comparison?.verdict !== 'matched' || !isDeepStrictEqual(attempt.comparison, response.comparison)) fail(`${cell} differs from its accepted invocation identity`);
  const checked = await (await import('./validate-step.mjs')).validateStep(root, branch, { origin: true, operator: true, requestPhase: 'accept' });
  if (checked.errors.length) fail(checked.errors.join('; '));
  return { request, response, branch, attempt };
}

async function routeSourceErrors(root, session, state, request, member, requireContext = true) {
  const errors = [], roleAlias = `@workspaces/${member.repository.role}`, commit = request.requirements?.commit;
  const sourceContext = (request.contexts ?? []).find(context => context.alias === roleAlias);
  if (requireContext && !sourceContext || sourceContext && sourceContext.head !== commit) errors.push('GOAL_PARTITION_UNBOUND: requested runtime commit must equal this route source-role context head');
  const input = request.inputs?.changes;
  if (input) try {
    const match = /^step-([1-9][0-9]*)\/parallel-([1-9][0-9]*)\/(response\/changes\.md)$/.exec(input);
    if (!match) fail('runtime source changes require a canonical accepted same-session producer');
    const proof = await sealedInvocation(root, session, state, `${match[1]}/${match[2]}`);
    if (proof.response.fields.changes !== match[3] || proof.request.environment?.workspace?.alias !== roleAlias || proof.response.commits?.at(-1) !== commit) fail('runtime target commit and source role must bind its exact accepted changes input');
  } catch (error) { errors.push(error.message); }
  return errors;
}

export async function unitObligation(root, session, state, operator, input, goals = {}) {
  const match = /^step-([1-9][0-9]*)\/parallel-([1-9][0-9]*)\/(response\/data\/units\.json)$/.exec(input ?? '');
  if (!match) fail('units must name the exact accepted plan output');
  const cell = `${match[1]}/${match[2]}`;
  const { loadOperatorPackages } = await import('./operator-md.mjs');
  const { planOperatorOf, loadUnits } = await import('./validate-request.mjs');
  const owner = planOperatorOf(operator, await loadOperatorPackages(root))?.manifest.id;
  if (!owner) fail('the operator has no declared unit plan input');
  const proof = await sealedInvocation(root, session, state, cell, { operator: owner });
  if (proof.response.fields.units !== match[3]) fail('the accepted producer did not declare this units output');
  const loaded = await loadUnits(root, path.join(session, input));
  if (loaded.errors.length) fail(loaded.errors.join('; '));
  const targets = state.mission.doneWhen.map((line,index) => line.producedBy === operator ? index : null).filter(index => index !== null);
  const required = loaded.units.units.filter(unit => !verifiesUnits(operator) || isJourney(unit));
  const members = required.map(unit => {
    const goal = targets.length === 1 ? targets[0] : goals[unit.id];
    // A prerequisite fanout has no delivery line but must still finish all of its own units.
    if (targets.length && !targets.includes(goal)) fail('map every required unit to its exact existing goal');
    return { id: unit.id, goal: goal ?? null };
  });
  if (!members.length || Object.keys(goals).some(id => !loaded.units.units.some(unit => unit.id === id))) fail('unit mapping has no required members or names a foreign unit');
  return { kind: 'units', operator, missionVersion: state.mission.version, scopeHash: scopeHash(state.mission), input,
    source: { cell, requestHash: state.requestHashes[cell], fingerprint: proof.attempt.evidenceManifest.fingerprint }, members };
}

// Existing accepted unit forecasts need no rewritten context: derive their complete obligation from
// the immutable producer they already bind. New forecasts retain that same set explicitly.
export async function forecastObligations(root, session, state, forecast) {
  const sets = new Map(), partitions = structuredClone(forecast?.partitions ?? {}), errors = [];
  try {
    for (const [id, set] of Object.entries(forecast?.obligations ?? {})) {
      const goals = Object.fromEntries(set.members.map(member => [member.id, member.goal]));
      const expected = set.kind === 'routes' ? routeObligation(state, set.operator, set.env, set.members.map(member => member.id), set.goal)
        : set.kind === 'units' ? await unitObligation(root, session, state, set.operator, set.input, goals) : fail('unknown obligation kind');
      if (id !== obligationId(set) || !isDeepStrictEqual(expected, set)) fail('obligation members or accepted source differ from the sealed authority');
      sets.set(id, set);
    }
    // A sealed, goal-specific single-route preset already resolves the route ambiguity. Preserve
    // that existing authority without requiring another edit or changing its accepted invocation.
    for (const cell of Object.keys(forecast?.steps ?? {})) if (!partitions[cell] && forecast.steps[cell] === 'runtime.serve' && Number.isInteger(forecast.goals?.[cell]?.doneWhen) && forecast.presets?.[cell]?.routeKey) {
      const { loadOperatorPackages } = await import('./operator-md.mjs');
      const { requirementValues } = await import('./operator-conditions.mjs');
      const pkg = (await loadOperatorPackages(root)).find(pkg => pkg.manifest.id === 'runtime.serve');
      const requirements = requirementValues(pkg.en, forecast.presets[cell]);
      const set = routeObligation(state, 'runtime.serve', requirements.env, [requirements.routeKey], forecast.goals[cell].doneWhen), id = obligationId(set);
      sets.set(id, set); partitions[cell] = { set: id, member: requirements.routeKey };
    }
    const groups = new Map();
    for (const [cell, unit] of Object.entries(forecast?.units ?? {})) if (!partitions[cell]) {
      const key = `${forecast.steps[cell]}:${unit.input}`;
      const group = groups.get(key) ?? { operator: forecast.steps[cell], input: unit.input, cells: [] };
      group.cells.push(cell); groups.set(key, group);
    }
    for (const group of groups.values()) {
      const goals = Object.fromEntries(group.cells.map(cell => [forecast.units[cell].id, forecast.goals[cell]?.doneWhen]));
      const set = await unitObligation(root, session, state, group.operator, group.input, goals), id = obligationId(set);
      sets.set(id, set);
      for (const cell of group.cells) partitions[cell] = { set: id, member: forecast.units[cell].id };
    }
    for (const [cell, partition] of Object.entries(partitions)) {
      const set = sets.get(partition.set), member = set?.members.find(item => item.id === partition.member);
      if (!member || forecast.steps[cell] !== set.operator || (forecast.goals[cell]?.doneWhen ?? null) !== member.goal) fail(`${cell} is not an exact member of its goal obligation`);
      if (set.kind === 'units' && (forecast.units?.[cell]?.id !== member.id || forecast.units[cell].input !== set.input)) fail(`${cell} substitutes a different accepted unit plan`);
      if (set.kind === 'routes' && (forecast.presets?.[cell]?.routeKey !== member.id || forecast.presets[cell].env !== undefined && forecast.presets[cell].env !== set.env)) fail(`${cell} substitutes a different route or environment`);
    }
  } catch (error) { errors.push(error.message); }
  return { sets, partitions, errors };
}

export async function goalPartitionCoverage(root, session, state, suppliedForecast = null) {
  let forecast = suppliedForecast;
  try {
    if (!forecast && state.planHistory?.active) {
      const record = readContext(session, state.planHistory.active, 'plans');
      if (record.sessionId !== state.id || record.missionVersion !== state.mission.version || record.scopeHash !== scopeHash(state.mission)) fail('active obligations belong to a different confirmed mission');
      forecast = record.forecast;
    }
  } catch (error) { return { errors: [error.message], goals: new Map(), branches: new Map(), sets: new Map() }; }
  const derived = await forecastObligations(root, session, state, forecast), { sets, partitions, errors } = derived;
  let reviews = { errors: [], pending: [], retiredSources: [] };
  if (Object.keys(forecast?.sourceReviews ?? {}).length || Object.keys(forecast?.sourceRepairs ?? {}).length) {
    try { reviews = await (await import('./source-review.mjs')).sourceReviewCoverage(root, session, state, forecast); }
    catch (error) { errors.push(error.message); }
    errors.push(...reviews.errors);
  }
  const retiredSources = new Set(reviews.retiredSources);
  const pendingSources = new Set(reviews.pending.map(item => item.sourceCell));
  const goals = new Map(), branches = new Map(), active = new Set(state.chain?.flat() ?? []);
  const need = (goal, key) => {
    if (goal === null || goal === undefined) return;
    const row = goals.get(goal) ?? { required: new Set(), proven: new Set(), complete: false };
    row.required.add(key); goals.set(goal, row);
  };
  for (const [id,set] of sets) for (const member of set.members) need(member.goal, `${id}:${member.id}`);
  for (const pending of reviews.pending) {
    const goal = Number.isInteger(pending.goal) ? pending.goal : pending.goal?.doneWhen;
    if (!Number.isInteger(goal)) continue;
    if (!goals.has(goal)) need(goal, `source-review:${pending.sourceCell}`);
    const row = goals.get(goal); (row.pendingReviews ??= []).push(pending.reviewCell);
  }
  const runtimeGoals = (state.mission?.doneWhen ?? []).map((line,index) => line.producedBy === 'runtime.serve' ? index : null).filter(index => index !== null);
  if ((state.mission?.discovery?.repositories?.length ?? 0) > 1) for (const goal of runtimeGoals) if (![...sets.values()].some(set => set.kind === 'routes' && set.goal === goal)) need(goal, 'unpartitioned:goal-route-mapping');
  for (const [cell, kind] of Object.entries(forecast?.fanout ?? {})) if (kind === 'units') need(forecast.goals?.[cell]?.doneWhen, `unexpanded:${cell}`);
  for (const [cell, partition] of Object.entries(partitions)) {
    const set = sets.get(partition.set), member = set?.members.find(value => value.id === partition.member);
    if (!member || !active.has(cell) || retiredSources.has(cell) || pendingSources.has(cell) || state.attempts?.[cell]?.status !== 'matched') continue;
    try {
      const proof = await sealedInvocation(root, session, state, cell, { operator: set.operator });
      if ((proof.request.goal?.doneWhen ?? null) !== member.goal || proof.response.goalCheck?.achieved !== true) fail(`${cell} does not prove its partition goal`);
      if (set.kind === 'units') {
        if (proof.request.unit !== member.id || proof.request.inputs?.units !== set.input) fail(`${cell} proves a different unit or producer`);
      } else {
        const requirements = proof.request.requirements, ladder = json(path.join(proof.branch, proof.response.fields.delta)).runtimeLadder;
        if (requirements.routeKey !== member.id || requirements.env !== set.env || requirements.operation !== 'serve' || !/^[a-f0-9]{40}$/.test(requirements.commit ?? '') || ladder?.routeKey !== member.id || ladder.sessionId !== state.id || ladder.wantedCommit !== requirements.commit || !ladder.contains?.includes(requirements.commit) || !/^[a-f0-9]{40}$/.test(ladder.servedHead ?? '')) fail(`${cell} does not attest its exact served route and frozen target commit`);
        const sourceErrors = await routeSourceErrors(root, session, state, proof.request, member, Boolean(forecast.partitions?.[cell]));
        if (sourceErrors.length) fail(sourceErrors.join('; '));
      }
      const key = `${partition.set}:${member.id}`;
      branches.set(cell, { key, set: partition.set, member: member.id, goal: member.goal });
      goals.get(member.goal)?.proven.add(key);
    } catch (error) { errors.push(error.message); }
  }
  const art = await (await import('./art-direction.mjs')).artDeliveryCoverage(root,session,state,new Set([...active].filter(cell=>!retiredSources.has(cell)&&!pendingSources.has(cell))),cell=>sealedInvocation(root,session,state,cell));
  errors.push(...art.errors);
  for(const row of art.rows){
    need(row.goal,row.key);
    if(row.complete)goals.get(row.goal).proven.add(row.key);
    if(!branches.has(row.cell))branches.set(row.cell,{key:row.key,goal:row.goal});
  }
  for (const goal of goals.values()) goal.complete = !errors.length && !goal.pendingReviews?.length && goal.required.size > 0 && [...goal.required].every(key => goal.proven.has(key));
  return { errors, goals, branches, sets, partitions, retiredSources: [...retiredSources], pendingReviews: reviews.pending };
}

export async function partitionAdmissionErrors(root, session, state, request, forecast) {
  const derived = await forecastObligations(root, session, state, forecast), errors = [...derived.errors], cell = `${request.step}/${request.parallel}`;
  const partition = derived.partitions[cell], set = derived.sets.get(partition?.set);
  if (request.operatorId === 'runtime.serve' && Number.isInteger(request.goal?.doneWhen) && (state.mission?.discovery?.repositories?.length ?? 0) > 1 && set?.kind !== 'routes') errors.push('GOAL_PARTITION_REQUIRED: explicitly map this runtime goal to its complete required declared routes before dispatch');
  if (set?.kind === 'routes') {
    const member = set.members.find(member => member.id === partition.member);
    const r = request.requirements ?? {};
    if (r.routeKey !== member.id || r.env !== set.env || r.operation !== 'serve' || !/^[a-f0-9]{40}$/.test(r.commit ?? '')) errors.push('GOAL_PARTITION_UNBOUND: invocation must serve its exact declared route, environment and frozen target commit');
    errors.push(...await routeSourceErrors(root, session, state, request, member, Boolean(forecast.partitions?.[cell])));
    // Live admission checks current declared repository identity; accepted history retains its own
    // invocation context and is never reinterpreted against a later hydrated checkout.
    try {
      const config = json(path.join(state.workflowOwner.sourceRoot, member.repository.routeRef));
      if (config.project !== member.repository.project || config.role !== member.repository.role || config.repository?.gitRepository !== member.repository.repository) fail('current runtime route differs from its confirmed repository identity');
    } catch (error) { errors.push(error.message); }
  }
  if (forecast.sourceReviews?.[cell]) {
    // A source-only diagnostic measures an accepted member without claiming delivery of its set.
    // Its exact read-only proof and method gate owns this exception; a marker alone grants none.
    const { sourceReviewAdmissionErrors } = await import('./source-review.mjs');
    const diagnosticErrors = await sourceReviewAdmissionErrors(root, session, state, request, forecast);
    errors.push(...diagnosticErrors);
    if (!diagnosticErrors.length) return errors;
  }
  const dependencies = forecast.dependencies?.[cell] ?? [];
  const required = new Set(dependencies.map(dependency => derived.partitions[dependency]?.set).filter(id => id && id !== partition?.set));
  if (required.size) {
    const coverage = await goalPartitionCoverage(root, session, state, forecast); errors.push(...coverage.errors);
    for (const id of required) for (const member of derived.sets.get(id).members) if (![...coverage.branches.values()].some(proof => proof.set === id && proof.member === member.id)) errors.push(`GOAL_PARTITION_PENDING: ${cell} needs accepted ${member.id} before consuming the complete obligation`);
  }
  return errors;
}
