import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAgainst } from './json-schema.mjs';
import { contentHash, RUNTIME_REVISION, sameRoot } from './workflow-root.mjs';
import { parseOperatorMd, cellAliases } from './operator-md.mjs';
import { requiredWhen, requirementValues } from './operator-conditions.mjs';
import { resolveWorkspaceCheckout } from './workspace-checkout.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const deliveryPolicy = root => JSON.parse(readFileSync(path.join(root, 'resources', 'delivery.json'), 'utf8'));
export function scopeHash(mission) {
  const { confirmation, scope, bankRef, ...frozen } = mission;
  return contentHash(frozen);
}
export function requiredLanes(mission, root = ROOT) {
  const tags = new Set(mission.discovery?.impacts?.flatMap(impact => impact.tags) ?? []);
  const policy = deliveryPolicy(root);
  return Object.entries(policy.lanes).filter(([, lane]) => lane.when.some(tag => tags.has(tag))).map(([id]) => id);
}
export function scopeErrors(mission, { root = ROOT, complete = false } = {}) {
  const schema = JSON.parse(readFileSync(path.join(root, 'templates', 'kinds', 'goal-discovery.schema.json'), 'utf8'));
  const errors = validateAgainst(schema, mission?.discovery, 'mission.discovery');
  if (errors.length) return errors;
  const discovery = mission.discovery;
  const policy = deliveryPolicy(root);
  const roles = new Set(discovery.repositories.map(repo => repo.role));
  if (complete) for (const target of deliveryTargets(mission, root)) if (!mission.doneWhen?.some(line => line.producedBy === target)) errors.push(`GOAL_DELIVERY_INCOMPLETE: handoff or delivery requires observable evidence from ${target}`);
  if (roles.size !== discovery.repositories.length) errors.push('mission.discovery.repositories: role ownership must be unique');
  const impactIds = new Set(discovery.impacts.map(impact => impact.id));
  if (impactIds.size !== discovery.impacts.length) errors.push('mission.discovery.impacts: ids must be unique');
  for (const impact of discovery.impacts) {
    if (!roles.has(impact.role)) errors.push(`impact ${impact.id}: no repository owns role ${impact.role}`);
    if (impact.tags.some(tag => ['interface', 'browser'].includes(tag)) && !impact.routes.length) errors.push(`impact ${impact.id}: affected route patterns are required for a surface or browser journey`);
  }
  for (const destination of discovery.destinations) if (!roles.has(destination.role)) errors.push(`destination ${destination.role}: unknown repository role`);
  for (const repo of discovery.repositories) if (!discovery.destinations.some(destination => destination.role === repo.role)) errors.push(`repository ${repo.role}: final artifact or branch destination is missing`);
  if (complete && discovery.unresolved.length) errors.push(`GOAL_UNRESOLVED: ${discovery.unresolved.join('; ')}`);
  const applicable = new Set(requiredLanes(mission, root));
  for (const [id, lane] of Object.entries(policy.lanes)) {
    const record = discovery.lanes[id];
    if (!record) { errors.push(`handoff lane ${id}: explicit planned or not-applicable disposition required`); continue; }
    if (applicable.has(id) && record.status !== 'planned') errors.push(`handoff lane ${id}: applicable impact cannot be marked not-applicable`);
    if (record.status === 'planned') {
      if (!roles.has(record.owner)) errors.push(`handoff lane ${id}: owner must name a declared repository role`);
      for (const field of ['inputs', 'outputs', 'verification']) if (!record[field]?.length) errors.push(`handoff lane ${id}: ${field} must be concrete enough for the next owner`);
      if (!Array.isArray(record.dependsOn)) errors.push(`handoff lane ${id}: dependsOn must explicitly name dependencies`);
      for (const dependency of lane.after) if (applicable.has(dependency) && !record.dependsOn?.includes(dependency)) errors.push(`handoff lane ${id}: missing applicable dependency ${dependency}`);
      for (const dependency of record.dependsOn ?? []) if (!discovery.lanes[dependency] || discovery.lanes[dependency].status !== 'planned') errors.push(`handoff lane ${id}: dependency ${dependency} is not planned`);
    }
  }
  for (const id of Object.keys(discovery.lanes)) if (!policy.lanes[id]) errors.push(`handoff lane ${id}: unknown lane`);
  const visiting = new Set(); const visited = new Set();
  function visit(id) { if (visiting.has(id)) { errors.push(`handoff dependency cycle at ${id}`); return; } if (visited.has(id)) return; visiting.add(id); for (const dependency of discovery.lanes[id]?.dependsOn ?? []) visit(dependency); visiting.delete(id); visited.add(id); }
  for (const id of Object.keys(discovery.lanes)) visit(id);
  return errors;
}
export function authorityErrors(mission, authority, root = ROOT) {
  const errors = scopeErrors(mission, { root, complete: true });
  if (!authority || !['opening-scope', 'scope-answer', 'bank-approval'].includes(authority.kind)) errors.push('GOAL_AUTHORITY_REQUIRED: record opening-scope, scope-answer or bank-approval provenance');
  if (authority?.scopeHash !== scopeHash(mission)) errors.push('GOAL_SCOPE_CHANGED: authority does not seal this exact mission version and impact');
  if (!authority?.sourceRef || !authority?.statement?.trim()) errors.push('GOAL_AUTHORITY_REQUIRED: retain the actual authorizing statement and its message reference');
  const fields = deliveryPolicy(root).authorityFields;
  for (const field of fields) {
    const evidence = authority?.coverage?.[field];
    if (!evidence || !authority?.statement?.includes(evidence)) errors.push(`GOAL_AUTHORITY_REQUIRED: ${field} needs an exact supporting excerpt from the authorizing statement`);
  }
  if (authority?.kind === 'scope-answer' && authority.presentedScopeHash !== scopeHash(mission)) errors.push('GOAL_AUTHORITY_REQUIRED: a scope answer binds the exact scope table previously presented');
  if (authority?.kind === 'opening-scope') {
    const required = {
      goal: [mission.goal],
      impact: mission.discovery?.impacts?.flatMap(impact => [...impact.routes, ...impact.code]) ?? [],
      destination: mission.discovery?.destinations?.map(destination => destination.target) ?? [],
      verification: [mission.verification]
    };
    for (const [field, values] of Object.entries(required)) for (const value of values) if (value && !authority.coverage?.[field]?.includes(value)) {
      const normalized = authority.normalizations?.[field];
      if (field !== 'goal' || normalized?.excerpt !== authority.coverage?.[field] || normalized?.value !== value || !normalized?.reason?.trim()) errors.push(`GOAL_AUTHORITY_REQUIRED: opening-scope ${field} does not explicitly contain ${value}; present the discovered scope and bind its answer`);
    }
    const stageTerms = deliveryPolicy(root).stageTerms[mission.discovery?.stage] ?? [];
    if (!stageTerms.some(term => authority.coverage?.stage?.toLocaleLowerCase().includes(term))) errors.push('GOAL_AUTHORITY_REQUIRED: opening-scope stage must explicitly authorize its action in the display language');
  }
  if (authority?.kind === 'opening-scope' && authority?.sourceRef !== mission.sourceRef) errors.push('GOAL_AUTHORITY_REQUIRED: opening-scope must cite the opening mission prompt');
  return errors;
}
export function frozenScopeErrors(state, { root = ROOT } = {}) {
  if (state?.runtimeRevision !== RUNTIME_REVISION) return [];
  const errors = scopeErrors(state.mission, { root, complete: state.lifecycle?.phase !== 'draft' });
  if (state.lifecycle?.phase !== 'draft') {
    const confirmation = state.mission?.confirmation;
    const authority = confirmation?.authority;
    errors.push(...authorityErrors(state.mission, authority, root));
    if (confirmation?.scopeHash !== scopeHash(state.mission)) errors.push('GOAL_SCOPE_CHANGED: frozen mission changed after confirmation');
    if (authority?.sourceRef !== confirmation?.sourceRef) errors.push('GOAL_AUTHORITY_REQUIRED: confirmation source and authority source differ');
  }
  return [...new Set(errors)];
}
export function deliveryTargets(mission, root = ROOT) {
  if (!mission?.discovery) return [];
  const stage = mission.discovery.stage; const policy = deliveryPolicy(root);
  return [...new Set(Object.entries(mission.discovery.lanes).filter(([, lane]) => lane.status === 'planned').flatMap(([id]) => policy.lanes[id]?.[stage === 'handoff' ? 'plan' : 'execute'] ?? []))];
}
export function completeDeliveryMission(mission, root = ROOT) {
  if (!mission.discovery) return mission;
  const doneWhen = [...(mission.doneWhen ?? [])];
  for (const operator of deliveryTargets(mission, root)) if (!doneWhen.some(line => line.producedBy === operator)) doneWhen.push({ evidence: `The frozen ${mission.discovery.stage} scope has a validator-accepted ${operator} outcome.`, producedBy: operator });
  return { ...mission, doneWhen };
}
export function deliveryRequestErrors(state, request, root = ROOT) {
  if (state?.runtimeRevision !== RUNTIME_REVISION) return [];
  const errors = frozenScopeErrors(state, { root });
  const stage = state.mission.discovery?.stage;
  const policy = deliveryPolicy(root);
  if (!policy.stages[stage]?.includes(request.operatorId) && stage === 'handoff') errors.push(`DELIVERY_STAGE: ${request.operatorId} is not a handoff planning operation`);
  if (request.operatorId === 'git.publish' && !['publish', 'deploy'].includes(stage)) errors.push('DELIVERY_STAGE: publication is outside this goal stage');
  if (['release.deploy', 'migration.release'].includes(request.operatorId) && stage !== 'deploy') errors.push('DELIVERY_STAGE: deployment is outside this goal stage');
  if (request.requirements?.checkout === 'session' || request.environment?.workspace?.worktree || (request.contexts ?? []).some(context => context.alias?.startsWith('@workspaces/'))) errors.push(...scopeBindingErrors(state, request, root));
  return errors;
}
function authoredOperator(root, id) {
  if (!/^[a-z]+(?:\.[a-z]+)+$/.test(id ?? '')) return null;
  try {
    const directory = path.join(root, 'operators', id.replaceAll('.', '-'));
    if (JSON.parse(readFileSync(path.join(directory, 'operator.json'), 'utf8')).id !== id) return null;
    return parseOperatorMd(readFileSync(path.join(directory, 'operator.md'), 'utf8'));
  } catch { return null; }
}
export function readOnlyPrerequisiteBinding(state, request, root = ROOT) {
  const requirements = request.requirements ?? {}, key = `${request.step}/${request.parallel}`, consumerKey = request.goal?.prerequisite;
  if (request.operatorId !== 'workspace.bind' || requirements.project !== state.project || requirements.checkout !== 'routed' || (requirements.declaredWriteRoots ?? []).length || request.environment?.workspace || (request.environment?.writes ?? []).length) return false;
  if (state.steps?.[key] !== request.operatorId || !(state.planHistory ? state.chain?.some(step => step.includes(key)) : state.chain?.[request.step - 1]?.includes(key)) || state.planned?.[key]?.requirements?.role !== requirements.role) return false;
  if (!/^\d+\/\d+$/.test(consumerKey ?? '') || Number(consumerKey.split('/')[0]) <= request.step || !state.chain?.flat().includes(consumerKey) || !state.planned?.[consumerKey]) return false;
  const consumer = state.steps?.[consumerKey];
  if (!(state.mission?.doneWhen ?? []).some(line => line.producedBy === consumer) && !deliveryTargets(state.mission, root).includes(consumer)) return false;
  const op = authoredOperator(root, consumer);
  if (!op) return false;
  const values = requirementValues(op, state.planned[consumerKey].requirements ?? {});
  if (!(op.tables.context?.rows ?? []).some(row => requiredWhen(row.required, values) && cellAliases(row.alias).some(alias => alias === `@workspaces/${requirements.role}` || alias.startsWith(`@workspaces/${requirements.role}/`)))) return false;
  try {
    resolveWorkspaceCheckout({ source: state.workflowOwner.sourceRoot, project: requirements.project, role: requirements.role, sessionId: state.id, checkout: 'routed', declaredWriteRoots: [], sharedInstall: requirements.sharedInstall ?? false });
    return true;
  } catch { return false; }
}
export function scopeBindingErrors(state, request, root = ROOT) {
  const errors = [];
  const discovery = state.mission?.discovery;
  if (!discovery) return ['GOAL_UNRESOLVED: source work requires discovered repository ownership'];
  const source = state.workflowOwner?.sourceRoot;
  for (const repository of discovery.repositories) {
    try {
      if (repository.project !== state.project) throw Error('repository project differs from the owning workflow project');
      const expected = `.workspaces/local/routes/${repository.project}/${repository.role}/config.json`;
      if (repository.routeRef !== expected) throw Error('routeRef is not the declared project/role address');
      const route = JSON.parse(readFileSync(path.join(source, expected), 'utf8'));
      if (!sameRoot(route.source?.path ?? '.', source)) throw Error('hydrated route belongs to a different runtime Source');
      if (route.project !== repository.project || route.role !== repository.role || route.repository.gitRepository !== repository.repository) throw Error('repository identity differs from its hydrated route');
      if (!/^[a-f0-9]{40}$/.test(repository.head)) throw Error('head must name the actual frozen Git commit');
      execFileSync('git', ['-c', `safe.directory=${route.repository.diskPath}`, '-C', route.repository.diskPath, 'merge-base', '--is-ancestor', repository.head, 'HEAD'], { windowsHide: true, stdio: 'ignore', env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } });
    } catch (error) { errors.push(`GOAL_SOURCE_UNBOUND: ${repository.role}: ${error.message}`); }
  }
  if (request.requirements?.role && !discovery.repositories.some(repository => repository.role === request.requirements.role && repository.project === request.requirements.project) && !readOnlyPrerequisiteBinding(state, request, root)) errors.push('GOAL_SOURCE_UNBOUND: request project/role is outside the frozen discovery');
  // Binding a read-only context never adds a product write role to the confirmed mission.
  const op = authoredOperator(root, request.operatorId);
  const writeRoles = new Set((op?.tables.steps?.rows ?? []).flatMap(row => cellAliases(row.writes)).map(alias => /^@workspaces\/(fe|be)(?:\/|$)/.exec(alias)?.[1]).filter(Boolean));
  for (const role of writeRoles) if (!discovery.repositories.some(repository => repository.role === role && repository.project === state.project)) errors.push(`GOAL_SOURCE_UNBOUND: product source writes to ${role} are outside the frozen discovery; a prerequisite bind grants no write impact`);
  return errors;
}
